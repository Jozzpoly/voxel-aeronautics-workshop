(() => {
  'use strict';

  window.VAW.define('runtime.assembly-builder', ['runtime.physics-port', 'foundation.assembly-spaces'], (PhysicsPort, AssemblySpaces) => {
    function requireId(value, label) {
      if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
      return value;
    }

    function vector3(value, label, { positive = false, nonNegative = false } = {}) {
      const source = Array.isArray(value)
        ? { x: value[0], y: value[1], z: value[2] }
        : value;
      if (!source || typeof source !== 'object') throw new TypeError(`${label} must be a 3D vector.`);
      const result = [Number(source.x), Number(source.y), Number(source.z)];
      if (!result.every(Number.isFinite)) throw new TypeError(`${label} must contain finite numbers.`);
      if (positive && result.some(component => component <= 0)) throw new RangeError(`${label} components must be greater than zero.`);
      if (nonNegative && result.some(component => component < 0)) throw new RangeError(`${label} components cannot be negative.`);
      return result;
    }

    function validateMassProperties(value, bodyId) {
      if (!value || typeof value !== 'object') throw new TypeError(`Body ${bodyId} has no mass properties.`);
      const mass = Number(value.mass);
      if (!Number.isFinite(mass) || mass < 0) throw new RangeError(`Body ${bodyId} mass must be a finite non-negative number.`);
      const centerOfMass = vector3(value.centerOfMass, `Body ${bodyId} centerOfMass`);
      if (Math.hypot(...centerOfMass) > 1e-8) {
        throw new RangeError(`Body ${bodyId} colliders must already be centered around local COM.`);
      }
      const inertiaDiagonal = vector3(value.inertiaDiagonal, `Body ${bodyId} inertiaDiagonal`, { nonNegative: true });
      if (mass > 0 && inertiaDiagonal.some(component => component <= 0)) {
        throw new RangeError(`Dynamic body ${bodyId} requires positive inertia on every axis.`);
      }
      return { mass, centerOfMass, inertiaDiagonal };
    }

    function descriptorFor(options, bodyPlan) {
      const defaults = options.bodyDefaults && typeof options.bodyDefaults === 'object' ? options.bodyDefaults : {};
      const source = typeof options.bodyDescriptor === 'function'
        ? options.bodyDescriptor(bodyPlan)
        : options.bodyDescriptor;
      const override = source && typeof source === 'object' ? source : {};
      const userData = Object.freeze({
        ...(defaults.userData && typeof defaults.userData === 'object' ? defaults.userData : {}),
        ...(override.userData && typeof override.userData === 'object' ? override.userData : {}),
        assemblyBodyId: bodyPlan.bodyId,
        assemblySpaceId: bodyPlan.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
        assemblyRole: bodyPlan.role || 'body'
      });
      return {
        ...defaults,
        ...override,
        mass: bodyPlan.massProperties.mass,
        userData
      };
    }

    function validatePlan(plan) {
      if (!plan || typeof plan !== 'object' || !Array.isArray(plan.rigidBodies) || !Array.isArray(plan.parts)) {
        throw new TypeError('Assembly builder requires a RuntimeAssemblyPlan-like object.');
      }
      if (!Array.isArray(plan.constraints) || !Array.isArray(plan.signalLinks)) {
        throw new TypeError('Assembly plan constraints and signalLinks must be arrays.');
      }

      const rootBodyId = requireId(plan.rootBodyId, 'Assembly rootBodyId');
      const strictSpaces = plan.format === 'VAW_RUNTIME_ASSEMBLY_PLAN_V3';
      if (strictSpaces && (!plan.bodyIdToAssemblySpaceId || typeof plan.bodyIdToAssemblySpaceId !== 'object')) {
        throw new TypeError('RuntimeAssemblyPlan V3 requires bodyIdToAssemblySpaceId.');
      }
      if (strictSpaces && (!plan.blockIdToAssemblySpaceId || typeof plan.blockIdToAssemblySpaceId !== 'object')) {
        throw new TypeError('RuntimeAssemblyPlan V3 requires blockIdToAssemblySpaceId.');
      }
      if (strictSpaces && (!plan.bodyById || typeof plan.bodyById !== 'object')) {
        throw new TypeError('RuntimeAssemblyPlan V3 requires bodyById.');
      }
      const indexedSpaces = AssemblySpaces.validateAndIndex(plan.assemblySpaces, { allowDefaultRoot: !strictSpaces });
      if (!indexedSpaces.ok) throw new Error(`Invalid assembly spaces: ${indexedSpaces.diagnostics.map(item => item.code).join(', ')}`);
      const assemblySpaceIds = new Set(indexedSpaces.spaces.map(space => space.assemblySpaceId));
      const bodyIdsByAssemblySpaceId = new Map(indexedSpaces.spaces.map(space => [space.assemblySpaceId, new Set()]));
      const bodyIds = new Set();
      const colliderIds = new Set();
      const blockIds = new Set();
      const colliderBlockIds = new Set();
      const declaredBodyByBlockId = new Map();

      for (const body of plan.rigidBodies) {
        if (!body || typeof body !== 'object') throw new TypeError('Assembly body plan must be an object.');
        const bodyId = requireId(body.bodyId, 'Assembly bodyId');
        if (bodyIds.has(bodyId)) throw new Error(`Duplicate body id: ${bodyId}`);
        const assemblySpaceId = strictSpaces
          ? requireId(body.assemblySpaceId, `Body ${bodyId} assemblySpaceId`)
          : (body.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID);
        if (!assemblySpaceIds.has(assemblySpaceId)) throw new Error(`Body ${bodyId} references missing assembly space ${assemblySpaceId}.`);
        if (strictSpaces && (!body.bodyPoseInSpace || typeof body.bodyPoseInSpace !== 'object')) throw new TypeError(`Body ${bodyId} requires bodyPoseInSpace.`);
        bodyIds.add(bodyId);
        bodyIdsByAssemblySpaceId.get(assemblySpaceId).add(bodyId);
        if (!body.assemblyPose || typeof body.assemblyPose !== 'object') throw new TypeError(`Body ${bodyId} requires assemblyPose.`);
        vector3(body.assemblyPose.position, `Body ${bodyId} assemblyPose.position`);
        const assemblyQuaternion = Array.isArray(body.assemblyPose.quaternion)
          ? body.assemblyPose.quaternion
          : [body.assemblyPose.quaternion?.x, body.assemblyPose.quaternion?.y, body.assemblyPose.quaternion?.z, body.assemblyPose.quaternion?.w];
        if (assemblyQuaternion.length !== 4 || !assemblyQuaternion.map(Number).every(Number.isFinite)) throw new TypeError(`Body ${bodyId} assemblyPose.quaternion must contain finite numbers.`);
        validateMassProperties(body.massProperties, bodyId);
        if (!Array.isArray(body.blockIds)) throw new TypeError(`Body ${bodyId} blockIds must be an array.`);
        if (!Array.isArray(body.colliders)) throw new TypeError(`Body ${bodyId} colliders must be an array.`);

        for (const rawBlockId of body.blockIds) {
          const blockId = requireId(rawBlockId, `Body ${bodyId} blockId`);
          if (blockIds.has(blockId)) throw new Error(`Block ${blockId} is declared by more than one body.`);
          blockIds.add(blockId);
          declaredBodyByBlockId.set(blockId, bodyId);
        }

        for (const collider of body.colliders) {
          if (!collider || typeof collider !== 'object') throw new TypeError(`Body ${bodyId} collider must be an object.`);
          const colliderId = requireId(collider.colliderId, `Body ${bodyId} colliderId`);
          if (colliderIds.has(colliderId)) throw new Error(`Duplicate collider id: ${colliderId}`);
          colliderIds.add(colliderId);
          if (collider.bodyId !== bodyId) throw new Error(`Collider ${colliderId} points to the wrong body.`);
          if (strictSpaces && collider.assemblySpaceId !== assemblySpaceId) throw new Error(`Collider ${colliderId} points to the wrong assembly space.`);
          if (collider.kind !== 'box') throw new Error(`Unsupported assembly collider kind: ${collider.kind}`);
          vector3(collider.center, `Collider ${colliderId} center`);
          vector3(collider.halfExtents, `Collider ${colliderId} halfExtents`, { positive: true });
          if (collider.quaternion != null) {
            const q = Array.isArray(collider.quaternion)
              ? { x: collider.quaternion[0], y: collider.quaternion[1], z: collider.quaternion[2], w: collider.quaternion[3] }
              : collider.quaternion;
            if (!q || ![q.x, q.y, q.z, q.w].map(Number).every(Number.isFinite)) {
              throw new TypeError(`Collider ${colliderId} quaternion must contain finite numbers.`);
            }
          }
          if (collider.blockId != null) {
            const blockId = requireId(collider.blockId, `Collider ${colliderId} blockId`);
            if (colliderBlockIds.has(blockId)) throw new Error(`Duplicate collider block mapping: ${blockId}`);
            if (declaredBodyByBlockId.get(blockId) !== bodyId) {
              throw new Error(`Collider ${colliderId} references block ${blockId} outside body ${bodyId}.`);
            }
            colliderBlockIds.add(blockId);
          }
        }
      }

      if (!bodyIds.has(rootBodyId)) throw new Error('Assembly plan root body is missing.');
      const rootBody = plan.rigidBodies.find(body => body.bodyId === rootBodyId);
      if (!(Number(rootBody.massProperties.mass) > 0)) throw new Error('Assembly root body must be dynamic.');

      const partBlockIds = new Set();
      for (const part of plan.parts) {
        if (!part || typeof part !== 'object') throw new TypeError('Assembly part plan must be an object.');
        const blockId = requireId(part.blockId, 'Assembly part blockId');
        const bodyId = requireId(part.bodyId, `Part ${blockId} bodyId`);
        if (partBlockIds.has(blockId)) throw new Error(`Duplicate runtime part mapping: ${blockId}`);
        if (!bodyIds.has(bodyId)) throw new Error(`Part ${blockId} references missing body ${bodyId}.`);
        if (strictSpaces) {
          const ownerSpace = plan.bodyIdToAssemblySpaceId?.[bodyId];
          if (!ownerSpace || part.assemblySpaceId !== ownerSpace) throw new Error(`Part ${blockId} has invalid assembly space ownership.`);
        }
        if (declaredBodyByBlockId.get(blockId) !== bodyId) {
          throw new Error(`Part ${blockId} is not declared by body ${bodyId}.`);
        }
        partBlockIds.add(blockId);
      }
      for (const blockId of blockIds) {
        if (!partBlockIds.has(blockId)) throw new Error(`Body block ${blockId} has no runtime part.`);
      }

      const constraintIds = new Set();
      const normalizedConstraints = new Map();
      for (const constraint of plan.constraints) {
        if (!constraint || typeof constraint !== 'object') throw new TypeError('Assembly constraint plan must be an object.');
        const constraintId = requireId(constraint.constraintId, 'Assembly constraintId');
        if (constraintIds.has(constraintId)) throw new Error(`Duplicate constraint id: ${constraintId}`);
        const bodyAId = requireId(constraint.bodyAId, `Constraint ${constraintId} bodyAId`);
        const bodyBId = requireId(constraint.bodyBId, `Constraint ${constraintId} bodyBId`);
        if (!bodyIds.has(bodyAId) || !bodyIds.has(bodyBId)) {
          throw new Error(`Constraint ${constraintId} references a missing body.`);
        }
        if (bodyAId === bodyBId) throw new Error(`Constraint ${constraintId} cannot connect a body to itself.`);
        if (strictSpaces) {
          const owner = requireId(constraint.assemblySpaceId, `Constraint ${constraintId} assemblySpaceId`);
          if (!assemblySpaceIds.has(owner)) throw new Error(`Constraint ${constraintId} references missing assembly space ${owner}.`);
        }
        const normalizedConstraint = PhysicsPort.normalizeConstraintPlan(constraint);
        constraintIds.add(constraintId);
        normalizedConstraints.set(constraintId, normalizedConstraint);
      }

      if (plan.blockIdToBodyId && typeof plan.blockIdToBodyId === 'object') {
        for (const [blockId, bodyId] of declaredBodyByBlockId) {
          if (plan.blockIdToBodyId[blockId] !== bodyId) throw new Error(`blockIdToBodyId mismatch for ${blockId}.`);
        }
      }
      if (plan.blockIdToPartIndex && typeof plan.blockIdToPartIndex === 'object') {
        plan.parts.forEach((part, index) => {
          if (plan.blockIdToPartIndex[part.blockId] !== index) throw new Error(`blockIdToPartIndex mismatch for ${part.blockId}.`);
        });
      }
      if (strictSpaces) {
        for (const body of plan.rigidBodies) {
          if (plan.bodyIdToAssemblySpaceId[body.bodyId] !== body.assemblySpaceId) throw new Error(`bodyIdToAssemblySpaceId mismatch for ${body.bodyId}.`);
          if (plan.bodyById[body.bodyId] !== body) throw new Error(`bodyById mismatch for ${body.bodyId}.`);
        }
        for (const part of plan.parts) {
          if (plan.blockIdToAssemblySpaceId[part.blockId] !== part.assemblySpaceId) throw new Error(`blockIdToAssemblySpaceId mismatch for ${part.blockId}.`);
        }
      }

      return { bodyIds, colliderIds, blockIds, constraintIds, normalizedConstraints, assemblySpaceIds, bodyIdsByAssemblySpaceId };
    }

    function build(options = {}) {
      const physics = PhysicsPort.assertBackend(options.physics);
      const plan = options.plan;
      const validation = validatePlan(plan);
      const world = options.world || null;
      if (plan.constraints.length && typeof options.constraintBuilder !== 'function') {
        if (!world) throw new Error('Assembly constraints require a physics world.');
        for (const constraintPlan of plan.constraints) {
          const normalized = validation.normalizedConstraints.get(constraintPlan.constraintId);
          if (!PhysicsPort.supportsConstraint(physics, normalized.kind)) {
            throw new Error(`Physics backend ${physics.id} does not support ${normalized.kind} constraints.`);
          }
        }
      }
      const bodyById = new Map();
      const bodyIdByHandle = new WeakMap();
      const colliderById = new Map();
      const colliderByBlockId = new Map();
      const partByBlockId = new Map();
      const constraintById = new Map();
      const constraintIdsByBodyId = new Map([...validation.bodyIds].map(bodyId => [bodyId, new Set()]));
      const constraintIdsByEndpointBlockId = new Map();
      const constraintFailureLog = [];
      const bodyIdsByAssemblySpaceId = new Map(validation.bodyIdsByAssemblySpaceId || []);
      const removedConstraints = new WeakSet();
      const unsubscribe = [];
      const addedBodies = [];
      let disposed = false;
      let cleanupPending = false;

      function assertActive() {
        if (disposed) throw new Error('Runtime assembly has been disposed.');
        if (cleanupPending) throw new Error('Runtime assembly cleanup is incomplete; retry dispose() before further use.');
      }

      function runtimeBodyFor(bodyId) {
        assertActive();
        const runtimeBody = bodyById.get(String(bodyId));
        if (!runtimeBody) throw new Error(`Unknown assembly body: ${String(bodyId)}`);
        return runtimeBody;
      }

      function getBodyIds() {
        assertActive();
        return Object.freeze([...bodyById.keys()].sort());
      }

      function hasBody(bodyId) {
        return !disposed && bodyById.has(String(bodyId));
      }

      function getBodyPlan(bodyId) {
        return runtimeBodyFor(bodyId).plan;
      }

      function getBodyTransform(bodyId) {
        return physics.getBodyTransform(runtimeBodyFor(bodyId).body);
      }

      function getBodyLinearVelocity(bodyId) {
        return physics.getBodyLinearVelocity(runtimeBodyFor(bodyId).body);
      }

      function getBodyAngularVelocity(bodyId) {
        return physics.getBodyAngularVelocity(runtimeBodyFor(bodyId).body);
      }

      function setBodyTransform(bodyId, transform) {
        physics.setBodyTransform(runtimeBodyFor(bodyId).body, transform);
        return getBodyTransform(bodyId);
      }

      function setBodyVelocity(bodyId, velocity) {
        physics.setBodyVelocity(runtimeBodyFor(bodyId).body, velocity);
        return Object.freeze({
          linear: getBodyLinearVelocity(bodyId),
          angular: getBodyAngularVelocity(bodyId)
        });
      }

      function clearBodyMotion(bodyId) {
        return setBodyVelocity(bodyId, {
          linear: { x: 0, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: 0 }
        });
      }

      function vectorToWorldFrame(bodyId, vector) {
        return PhysicsPort.normalizeVec3(physics.vectorToWorldFrame(runtimeBodyFor(bodyId).body, vector));
      }

      function vectorToLocalFrame(bodyId, vector) {
        return PhysicsPort.normalizeVec3(physics.vectorToLocalFrame(runtimeBodyFor(bodyId).body, vector));
      }

      function pointToWorldFrame(bodyId, point) {
        return PhysicsPort.normalizeVec3(physics.pointToWorldFrame(runtimeBodyFor(bodyId).body, point));
      }

      function pointToLocalFrame(bodyId, point) {
        return PhysicsPort.normalizeVec3(physics.pointToLocalFrame(runtimeBodyFor(bodyId).body, point));
      }

      function getBodyPointVelocity(bodyId, localPoint) {
        return PhysicsPort.normalizeVec3(physics.getPointVelocity(runtimeBodyFor(bodyId).body, localPoint));
      }

      function applyBodyForce(bodyId, force, worldPoint) {
        const body = runtimeBodyFor(bodyId).body;
        physics.applyForce(body, force, worldPoint);
      }

      function addBodyTorque(bodyId, torque) {
        physics.addTorque(runtimeBodyFor(bodyId).body, torque);
      }

      function ownsBody(body) {
        return Boolean(body && !disposed && bodyIdByHandle.has(body));
      }

      function getBodyIdForBlock(blockId) {
        assertActive();
        return partByBlockId.get(String(blockId))?.plan?.bodyId || null;
      }

      function getAssemblySpaceIdForBody(bodyId) {
        assertActive();
        const plan = bodyById.get(String(bodyId))?.plan;
        return plan ? (plan.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) : null;
      }

      function getAssemblySpaceIdForBlock(blockId) {
        assertActive();
        const plan = partByBlockId.get(String(blockId))?.plan;
        return plan ? (plan.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) : null;
      }

      function getBodyIdsForAssemblySpace(assemblySpaceId) {
        assertActive();
        return Object.freeze([...(bodyIdsByAssemblySpaceId.get(String(assemblySpaceId)) || [])].sort());
      }

      function getPartDescriptor(blockId) {
        assertActive();
        return partByBlockId.get(String(blockId))?.plan || null;
      }

      function getColliderOwnershipByBlockId(blockId) {
        assertActive();
        const runtimeCollider = colliderByBlockId.get(String(blockId));
        if (!runtimeCollider) return null;
        return Object.freeze({
          colliderId: runtimeCollider.plan.colliderId,
          blockId: runtimeCollider.plan.blockId,
          bodyId: runtimeCollider.bodyPlan.bodyId,
          assemblySpaceId: runtimeCollider.bodyPlan.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID
        });
      }

      function getColliderOwnership(colliderId) {
        assertActive();
        const runtimeCollider = colliderById.get(String(colliderId));
        if (!runtimeCollider) return null;
        return Object.freeze({
          colliderId: runtimeCollider.plan.colliderId,
          blockId: runtimeCollider.plan.blockId || null,
          bodyId: runtimeCollider.bodyPlan.bodyId,
          assemblySpaceId: runtimeCollider.bodyPlan.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID
        });
      }

      function removeCollider(colliderId) {
        assertActive();
        const runtimeCollider = colliderById.get(colliderId);
        if (!runtimeCollider || runtimeCollider.removed) return false;
        const removed = physics.removeCollider(runtimeCollider.body, runtimeCollider.shape);
        if (removed === false) return false;
        runtimeCollider.removed = true;
        colliderById.delete(colliderId);
        if (runtimeCollider.plan.blockId) colliderByBlockId.delete(runtimeCollider.plan.blockId);
        return true;
      }

      function removeColliderByBlockId(blockId) {
        assertActive();
        const runtimeCollider = colliderByBlockId.get(String(blockId));
        return runtimeCollider ? removeCollider(runtimeCollider.plan.colliderId) : false;
      }

      function setBodyMassProperties(bodyId, massProperties) {
        assertActive();
        const runtimeBody = runtimeBodyFor(bodyId);
        const normalized = PhysicsPort.normalizeMassProperties(massProperties);
        if (normalized.mass > 0 && [normalized.inertiaDiagonal.x, normalized.inertiaDiagonal.y, normalized.inertiaDiagonal.z].some(value => value <= 0)) {
          throw new RangeError(`Dynamic body ${bodyId} requires positive inertia on every axis.`);
        }
        const applied = physics.setBodyMassProperties(runtimeBody.body, normalized);
        runtimeBody.massProperties = normalized;
        return applied;
      }

      function recenterBody(bodyId, shiftValue) {
        assertActive();
        const runtimeBody = runtimeBodyFor(bodyId);
        const activeConstraints = [...(constraintIdsByBodyId.get(String(bodyId)) || [])]
          .filter(constraintId => constraintById.has(constraintId));
        if (activeConstraints.length) {
          throw new Error(`Cannot recenter constrained body ${String(bodyId)}; active constraints: ${activeConstraints.join(', ')}`);
        }
        const shift = PhysicsPort.normalizeVec3(shiftValue);
        const body = runtimeBody.body;
        const worldPosition = physics.pointToWorldFrame(body, shift);
        const linearVelocity = physics.getPointVelocity(body, shift);
        physics.shiftColliderOffsets(body, shift);
        physics.setBodyTransform(body, { position: worldPosition });
        physics.setBodyVelocity(body, { linear: linearVelocity });
        return Object.freeze({ worldPosition: PhysicsPort.normalizeVec3(worldPosition), linearVelocity: PhysicsPort.normalizeVec3(linearVelocity) });
      }

      function constraintIdsForBody(bodyId) {
        assertActive();
        return Object.freeze([...(constraintIdsByBodyId.get(String(bodyId)) || [])].filter(id => constraintById.has(id)).sort());
      }

      function constraintIdsForEndpointBlock(blockId) {
        assertActive();
        return Object.freeze([...(constraintIdsByEndpointBlockId.get(String(blockId)) || [])].filter(id => constraintById.has(id)).sort());
      }

      function disposeRuntimeConstraint(runtimeConstraint) {
        if (!runtimeConstraint || removedConstraints.has(runtimeConstraint)) return false;
        const removed = runtimeConstraint.dispose?.();
        if (removed === false) return false;
        removedConstraints.add(runtimeConstraint);
        return true;
      }

      function removeConstraint(constraintId) {
        assertActive();
        const runtimeConstraint = constraintById.get(constraintId);
        if (!runtimeConstraint || removedConstraints.has(runtimeConstraint)) return false;
        if (!disposeRuntimeConstraint(runtimeConstraint)) return false;
        constraintById.delete(constraintId);
        for (const ids of constraintIdsByBodyId.values()) ids.delete(constraintId);
        for (const ids of constraintIdsByEndpointBlockId.values()) ids.delete(constraintId);
        return true;
      }

      function breakConstraintsForEndpointBlock(blockId, reason = 'endpoint-failure') {
        assertActive();
        const ids = constraintIdsForEndpointBlock(blockId);
        const removed = [];
        for (const constraintId of ids) {
          if (!removeConstraint(constraintId)) throw new Error(`Constraint removal failed for endpoint ${String(blockId)}: ${constraintId}`);
          removed.push(constraintId);
          constraintFailureLog.push(Object.freeze({ constraintId, blockId: String(blockId), reason: String(reason) }));
        }
        return Object.freeze(removed);
      }

      function setConstraintControl(constraintId, control) {
        assertActive();
        const runtimeConstraint = constraintById.get(constraintId);
        if (!runtimeConstraint || removedConstraints.has(runtimeConstraint)) throw new Error(`Unknown assembly constraint: ${constraintId}`);
        if (typeof runtimeConstraint.setControl !== 'function') {
          throw new Error(`Assembly constraint ${constraintId} does not expose runtime control.`);
        }
        return runtimeConstraint.setControl(control);
      }

      function getConstraintState(constraintId) {
        assertActive();
        const runtimeConstraint = constraintById.get(constraintId);
        if (!runtimeConstraint || removedConstraints.has(runtimeConstraint)) throw new Error(`Unknown assembly constraint: ${constraintId}`);
        if (typeof runtimeConstraint.getState !== 'function') {
          throw new Error(`Assembly constraint ${constraintId} does not expose runtime state.`);
        }
        return runtimeConstraint.getState();
      }

      function cleanup(throwOnError) {
        if (disposed) return { changed: false, complete: true, errors: [] };
        cleanupPending = true;
        const errors = [];

        // Mechanical ownership is released first. No body or collider may disappear while a
        // constraint still references it.
        for (const [constraintId, runtimeConstraint] of [...constraintById.entries()].reverse()) {
          try {
            if (!disposeRuntimeConstraint(runtimeConstraint)) {
              errors.push(new Error(`Constraint cleanup failed: ${constraintId}`));
              continue;
            }
            constraintById.delete(constraintId);
          } catch (error) { errors.push(error); }
        }

        if (constraintById.size === 0) {
          const failedStops = [];
          for (const stop of unsubscribe.splice(0).reverse()) {
            try {
              const stopped = stop();
              if (stopped === false) throw new Error('Collision listener cleanup was rejected.');
            } catch (error) { errors.push(error); failedStops.unshift(stop); }
          }
          unsubscribe.push(...failedStops);

          for (const [colliderId, runtimeCollider] of [...colliderById.entries()].reverse()) {
            try {
              const removed = physics.removeCollider(runtimeCollider.body, runtimeCollider.shape);
              if (removed === false) {
                errors.push(new Error(`Collider cleanup failed: ${colliderId}`));
                continue;
              }
              runtimeCollider.removed = true;
              colliderById.delete(colliderId);
              if (runtimeCollider.plan.blockId) colliderByBlockId.delete(runtimeCollider.plan.blockId);
            } catch (error) { errors.push(error); }
          }
        }

        if (constraintById.size === 0 && unsubscribe.length === 0 && colliderById.size === 0) {
          if (world) {
            for (let index = addedBodies.length - 1; index >= 0; index -= 1) {
              const runtimeBody = addedBodies[index];
              try {
                const removed = physics.removeBody(world, runtimeBody.body);
                if (removed === false) {
                  errors.push(new Error(`Body cleanup failed: ${runtimeBody.bodyId}`));
                  continue;
                }
                addedBodies.splice(index, 1);
              } catch (error) { errors.push(error); }
            }
          } else {
            addedBodies.length = 0;
          }
        }

        const complete = unsubscribe.length === 0 && constraintById.size === 0
          && colliderById.size === 0 && addedBodies.length === 0;
        if (complete) {
          bodyById.clear();
          colliderById.clear();
          colliderByBlockId.clear();
          partByBlockId.clear();
          disposed = true;
          cleanupPending = false;
        }

        if (throwOnError && errors.length) {
          const aggregate = typeof AggregateError === 'function'
            ? new AggregateError(errors, 'Runtime assembly cleanup failed.')
            : Object.assign(new Error('Runtime assembly cleanup failed.'), { errors });
          Object.defineProperty(aggregate, 'cleanupComplete', { value: complete, enumerable: true });
          throw aggregate;
        }
        return { changed: true, complete, errors };
      }

      function dispose() {
        return cleanup(true).changed;
      }

      const runtime = {
        format: 'VAW_RUNTIME_ASSEMBLY_V3',
        plan,
        physics,
        world,
        bodyById,
        colliderById,
        colliderByBlockId,
        partByBlockId,
        constraintById,
        constraintIdsByBodyId,
        constraintIdsByEndpointBlockId,
        constraintFailureLog,
        bodyIdsByAssemblySpaceId,
        rootBody: null,
        getBodyIds,
        hasBody,
        getBodyPlan,
        getBodyTransform,
        getBodyLinearVelocity,
        getBodyAngularVelocity,
        setBodyTransform,
        setBodyVelocity,
        clearBodyMotion,
        vectorToWorldFrame,
        vectorToLocalFrame,
        pointToWorldFrame,
        pointToLocalFrame,
        getBodyPointVelocity,
        applyBodyForce,
        addBodyTorque,
        ownsBody,
        getBodyIdForBlock,
        getAssemblySpaceIdForBody,
        getAssemblySpaceIdForBlock,
        getBodyIdsForAssemblySpace,
        getPartDescriptor,
        getColliderOwnership,
        getColliderOwnershipByBlockId,
        removeCollider,
        removeColliderByBlockId,
        setBodyMassProperties,
        recenterBody,
        constraintIdsForBody,
        constraintIdsForEndpointBlock,
        breakConstraintsForEndpointBlock,
        removeConstraint,
        setConstraintControl,
        getConstraintState,
        dispose,
        get disposed() { return disposed; },
        get cleanupPending() { return cleanupPending; }
      };

      try {
        for (const bodyPlan of plan.rigidBodies) {
          const body = physics.createBody(descriptorFor(options, bodyPlan));
          if (!body) throw new Error(`Physics backend returned no body for ${bodyPlan.bodyId}.`);
          const runtimeBody = { bodyId: bodyPlan.bodyId, plan: bodyPlan, body, massProperties: bodyPlan.massProperties };
          bodyById.set(bodyPlan.bodyId, runtimeBody);
          bodyIdByHandle.set(body, bodyPlan.bodyId);

          for (const colliderPlan of bodyPlan.colliders) {
            const shape = physics.addBoxCollider(body, {
              halfExtents: {
                x: colliderPlan.halfExtents[0],
                y: colliderPlan.halfExtents[1],
                z: colliderPlan.halfExtents[2]
              },
              offset: {
                x: colliderPlan.center[0],
                y: colliderPlan.center[1],
                z: colliderPlan.center[2]
              },
              quaternion: colliderPlan.quaternion
            });
            if (!shape) throw new Error(`Physics backend returned no collider for ${colliderPlan.colliderId}.`);
            const runtimeCollider = { plan: colliderPlan, bodyPlan, body, shape, removed: false };
            colliderById.set(colliderPlan.colliderId, runtimeCollider);
            if (colliderPlan.blockId) colliderByBlockId.set(colliderPlan.blockId, runtimeCollider);
          }

          setBodyMassProperties(bodyPlan.bodyId, {
            mass: bodyPlan.massProperties.mass,
            centerOfMass: {
              x: bodyPlan.massProperties.centerOfMass[0],
              y: bodyPlan.massProperties.centerOfMass[1],
              z: bodyPlan.massProperties.centerOfMass[2]
            },
            inertiaDiagonal: {
              x: bodyPlan.massProperties.inertiaDiagonal[0],
              y: bodyPlan.massProperties.inertiaDiagonal[1],
              z: bodyPlan.massProperties.inertiaDiagonal[2]
            }
          });

          if (typeof options.collisionListener === 'function') {
            const stop = physics.addCollisionListener(body, event => options.collisionListener({ event, body, bodyPlan, runtime }));
            if (typeof stop === 'function') unsubscribe.push(stop);
          }
          if (world) {
            physics.addBody(world, body);
            addedBodies.push(runtimeBody);
          }
        }

        for (const partPlan of plan.parts) {
          const blockId = partPlan.blockId;
          const runtimeBody = bodyById.get(partPlan.bodyId);
          partByBlockId.set(blockId, Object.freeze({
            plan: partPlan,
            body: runtimeBody.body,
            collider: colliderByBlockId.get(blockId) || null
          }));
        }

        if (plan.constraints.length) {
          for (const constraintPlan of plan.constraints) {
            const bodyA = bodyById.get(constraintPlan.bodyAId).body;
            const bodyB = bodyById.get(constraintPlan.bodyBId).body;
            let built;
            if (typeof options.constraintBuilder === 'function') {
              built = options.constraintBuilder({ constraintPlan, bodyA, bodyB, physics, world, runtime });
              if (!built || typeof built !== 'object') throw new Error(`Constraint builder returned no runtime object for ${constraintPlan.constraintId}.`);
            } else {
              const normalized = validation.normalizedConstraints.get(constraintPlan.constraintId);
              let backendConstraint = null;
              let constraintAdded = false;
              try {
                backendConstraint = physics.createConstraint({ ...normalized, bodyA, bodyB });
                if (!backendConstraint) throw new Error(`Physics backend returned no constraint for ${constraintPlan.constraintId}.`);
                const added = physics.addConstraint(world, backendConstraint);
                if (added === false) throw new Error(`Physics backend rejected constraint ${constraintPlan.constraintId}.`);
                constraintAdded = true;
              } catch (error) {
                if (backendConstraint && constraintAdded) {
                  try {
                    const removed = physics.removeConstraint(world, backendConstraint);
                    if (removed === false) throw new Error(`Constraint rollback failed: ${constraintPlan.constraintId}`);
                  } catch (cleanupError) {
                    if (error && typeof error === 'object') {
                      Object.defineProperty(error, 'constraintCleanupError', { value: cleanupError, enumerable: false });
                    }
                  }
                }
                throw error;
              }
              built = {
                constraintId: constraintPlan.constraintId,
                plan: constraintPlan,
                constraint: backendConstraint,
                bodyA,
                bodyB,
                setControl(control) { return physics.setConstraintControl(backendConstraint, control); },
                getState() { return physics.getConstraintState(backendConstraint); },
                dispose() { return physics.removeConstraint(world, backendConstraint); }
              };
            }
            const runtimeConstraint = Object.freeze({
              ...built,
              constraintId: constraintPlan.constraintId,
              plan: constraintPlan
            });
            constraintById.set(constraintPlan.constraintId, runtimeConstraint);
            constraintIdsByBodyId.get(constraintPlan.bodyAId)?.add(constraintPlan.constraintId);
            constraintIdsByBodyId.get(constraintPlan.bodyBId)?.add(constraintPlan.constraintId);
            for (const endpoint of [constraintPlan.endpointA, constraintPlan.endpointB]) {
              if (!endpoint?.blockId) continue;
              if (!constraintIdsByEndpointBlockId.has(endpoint.blockId)) constraintIdsByEndpointBlockId.set(endpoint.blockId, new Set());
              constraintIdsByEndpointBlockId.get(endpoint.blockId).add(constraintPlan.constraintId);
            }
          }
        }

        runtime.rootBody = bodyById.get(plan.rootBodyId)?.body || null;
        if (!runtime.rootBody) throw new Error('Assembly builder did not create the root body.');
        return Object.freeze(runtime);
      } catch (error) {
        const cleanupResult = cleanup(false);
        if (cleanupResult.errors.length && error && typeof error === 'object') {
          Object.defineProperty(error, 'cleanupErrors', { value: cleanupResult.errors, enumerable: false });
        }
        throw error;
      }
    }

    return Object.freeze({ build, validatePlan });
  });
})();
