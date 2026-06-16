(() => {
  'use strict';

  window.VAW.define('runtime.assembly-builder', ['runtime.physics-port'], PhysicsPort => {
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
      const bodyIds = new Set();
      const colliderIds = new Set();
      const blockIds = new Set();
      const colliderBlockIds = new Set();
      const declaredBodyByBlockId = new Map();

      for (const body of plan.rigidBodies) {
        if (!body || typeof body !== 'object') throw new TypeError('Assembly body plan must be an object.');
        const bodyId = requireId(body.bodyId, 'Assembly bodyId');
        if (bodyIds.has(bodyId)) throw new Error(`Duplicate body id: ${bodyId}`);
        bodyIds.add(bodyId);
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
        if (declaredBodyByBlockId.get(blockId) !== bodyId) {
          throw new Error(`Part ${blockId} is not declared by body ${bodyId}.`);
        }
        partBlockIds.add(blockId);
      }
      for (const blockId of blockIds) {
        if (!partBlockIds.has(blockId)) throw new Error(`Body block ${blockId} has no runtime part.`);
      }

      const constraintIds = new Set();
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
        constraintIds.add(constraintId);
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

      return { bodyIds, colliderIds, blockIds, constraintIds };
    }

    function build(options = {}) {
      const physics = PhysicsPort.assertBackend(options.physics);
      const plan = options.plan;
      validatePlan(plan);
      const world = options.world || null;
      const bodyById = new Map();
      const colliderById = new Map();
      const colliderByBlockId = new Map();
      const partByBlockId = new Map();
      const constraintById = new Map();
      const unsubscribe = [];
      const addedBodies = [];
      let disposed = false;

      function assertActive() {
        if (disposed) throw new Error('Runtime assembly has been disposed.');
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
        const runtimeBody = bodyById.get(bodyId);
        if (!runtimeBody) throw new Error(`Unknown assembly body: ${bodyId}`);
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
        const runtimeBody = bodyById.get(bodyId);
        if (!runtimeBody) throw new Error(`Unknown assembly body: ${bodyId}`);
        const shift = PhysicsPort.normalizeVec3(shiftValue);
        const body = runtimeBody.body;
        const worldPosition = physics.pointToWorldFrame(body, shift);
        const linearVelocity = physics.getPointVelocity(body, shift);
        physics.shiftColliderOffsets(body, shift);
        physics.setBodyTransform(body, { position: worldPosition });
        physics.setBodyVelocity(body, { linear: linearVelocity });
        return Object.freeze({
          worldPosition: PhysicsPort.normalizeVec3(worldPosition),
          linearVelocity: PhysicsPort.normalizeVec3(linearVelocity)
        });
      }

      function cleanup(throwOnError) {
        if (disposed) return { changed: false, errors: [] };
        disposed = true;
        const errors = [];
        for (const stop of unsubscribe.splice(0).reverse()) {
          try { stop(); } catch (error) { errors.push(error); }
        }
        for (const runtimeConstraint of [...constraintById.values()].reverse()) {
          try { runtimeConstraint.dispose?.(); } catch (error) { errors.push(error); }
        }
        constraintById.clear();
        if (world) {
          for (const runtimeBody of addedBodies.splice(0).reverse()) {
            try { physics.removeBody(world, runtimeBody.body); } catch (error) { errors.push(error); }
          }
        }
        bodyById.clear();
        colliderById.clear();
        colliderByBlockId.clear();
        partByBlockId.clear();
        if (throwOnError && errors.length) {
          const aggregate = typeof AggregateError === 'function'
            ? new AggregateError(errors, 'Runtime assembly cleanup failed.')
            : Object.assign(new Error('Runtime assembly cleanup failed.'), { errors });
          throw aggregate;
        }
        return { changed: true, errors };
      }

      function dispose() {
        return cleanup(true).changed;
      }

      const runtime = {
        format: 'VAW_RUNTIME_ASSEMBLY_V1',
        plan,
        physics,
        world,
        bodyById,
        colliderById,
        colliderByBlockId,
        partByBlockId,
        constraintById,
        rootBody: null,
        removeCollider,
        removeColliderByBlockId,
        setBodyMassProperties,
        recenterBody,
        dispose,
        get disposed() { return disposed; }
      };

      try {
        for (const bodyPlan of plan.rigidBodies) {
          const body = physics.createBody(descriptorFor(options, bodyPlan));
          if (!body) throw new Error(`Physics backend returned no body for ${bodyPlan.bodyId}.`);
          const runtimeBody = { bodyId: bodyPlan.bodyId, plan: bodyPlan, body, massProperties: bodyPlan.massProperties };
          bodyById.set(bodyPlan.bodyId, runtimeBody);

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
          if (typeof options.constraintBuilder !== 'function') {
            throw new Error('Assembly contains constraints but no constraintBuilder was provided.');
          }
          for (const constraintPlan of plan.constraints) {
            const bodyA = bodyById.get(constraintPlan.bodyAId).body;
            const bodyB = bodyById.get(constraintPlan.bodyBId).body;
            const built = options.constraintBuilder({ constraintPlan, bodyA, bodyB, physics, world, runtime });
            if (!built) throw new Error(`Constraint builder returned no runtime for ${constraintPlan.constraintId}.`);
            constraintById.set(constraintPlan.constraintId, built);
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
