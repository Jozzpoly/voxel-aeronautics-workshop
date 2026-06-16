(() => {
  'use strict';

  window.VAW.define('runtime.assembly-builder', ['runtime.physics-port'], PhysicsPort => {
    function mergeUserData(base, extra) {
      if (!base && !extra) return null;
      return Object.freeze({ ...(base || {}), ...(extra || {}) });
    }

    function descriptorFor(options, bodyPlan) {
      const source = typeof options.bodyDescriptor === 'function'
        ? options.bodyDescriptor(bodyPlan)
        : options.bodyDescriptor;
      return {
        ...(options.bodyDefaults || {}),
        ...(source || {}),
        mass: bodyPlan.massProperties.mass,
        userData: mergeUserData(
          { assemblyBodyId: bodyPlan.bodyId, assemblyRole: bodyPlan.role || 'body' },
          source?.userData || options.bodyDefaults?.userData
        )
      };
    }

    function validatePlan(plan) {
      if (!plan || !Array.isArray(plan.rigidBodies) || !Array.isArray(plan.parts)) {
        throw new TypeError('Assembly builder requires a RuntimeAssemblyPlan-like object.');
      }
      if (!plan.rootBodyId || !plan.rigidBodies.some(body => body.bodyId === plan.rootBodyId)) {
        throw new Error('Assembly plan root body is missing.');
      }
      const bodyIds = new Set();
      const colliderIds = new Set();
      for (const body of plan.rigidBodies) {
        if (!body?.bodyId || bodyIds.has(body.bodyId)) throw new Error(`Duplicate or missing body id: ${body?.bodyId || 'unknown'}`);
        bodyIds.add(body.bodyId);
        if (!body.massProperties) throw new Error(`Body ${body.bodyId} has no mass properties.`);
        for (const collider of body.colliders || []) {
          if (!collider?.colliderId || colliderIds.has(collider.colliderId)) {
            throw new Error(`Duplicate or missing collider id: ${collider?.colliderId || 'unknown'}`);
          }
          if (collider.bodyId !== body.bodyId) throw new Error(`Collider ${collider.colliderId} points to the wrong body.`);
          colliderIds.add(collider.colliderId);
        }
      }
      return { bodyIds, colliderIds };
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
      let disposed = false;

      function removeCollider(colliderId) {
        const runtimeCollider = colliderById.get(colliderId);
        if (!runtimeCollider || runtimeCollider.removed) return false;
        runtimeCollider.removed = true;
        physics.removeCollider(runtimeCollider.body, runtimeCollider.shape);
        colliderById.delete(colliderId);
        if (runtimeCollider.plan.blockId) colliderByBlockId.delete(runtimeCollider.plan.blockId);
        return true;
      }

      function removeColliderByBlockId(blockId) {
        const runtimeCollider = colliderByBlockId.get(String(blockId));
        return runtimeCollider ? removeCollider(runtimeCollider.plan.colliderId) : false;
      }

      function setBodyMassProperties(bodyId, massProperties) {
        const runtimeBody = bodyById.get(bodyId);
        if (!runtimeBody) throw new Error(`Unknown assembly body: ${bodyId}`);
        const applied = physics.setBodyMassProperties(runtimeBody.body, massProperties);
        runtimeBody.massProperties = PhysicsPort.normalizeMassProperties(massProperties);
        return applied;
      }

      function recenterBody(bodyId, shiftValue) {
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

      function dispose() {
        if (disposed) return false;
        disposed = true;
        for (const stop of unsubscribe.splice(0)) {
          try { stop(); } catch (error) { console.warn('Assembly collision listener cleanup failed.', error); }
        }
        for (const runtimeConstraint of [...constraintById.values()].reverse()) {
          try { runtimeConstraint.dispose?.(); } catch (error) { console.warn('Assembly constraint cleanup failed.', error); }
        }
        constraintById.clear();
        if (world) {
          for (const runtimeBody of [...bodyById.values()].reverse()) physics.removeBody(world, runtimeBody.body);
        }
        bodyById.clear();
        colliderById.clear();
        colliderByBlockId.clear();
        partByBlockId.clear();
        return true;
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
          const runtimeBody = { bodyId: bodyPlan.bodyId, plan: bodyPlan, body, massProperties: bodyPlan.massProperties };
          bodyById.set(bodyPlan.bodyId, runtimeBody);

          for (const colliderPlan of bodyPlan.colliders || []) {
            let shape;
            if (colliderPlan.kind === 'box') {
              shape = physics.addBoxCollider(body, {
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
            } else {
              throw new Error(`Unsupported assembly collider kind: ${colliderPlan.kind}`);
            }
            const runtimeCollider = { plan: colliderPlan, bodyPlan, body, shape, removed: false };
            colliderById.set(colliderPlan.colliderId, runtimeCollider);
            if (colliderPlan.blockId) {
              if (colliderByBlockId.has(colliderPlan.blockId)) throw new Error(`Duplicate collider block mapping: ${colliderPlan.blockId}`);
              colliderByBlockId.set(colliderPlan.blockId, runtimeCollider);
            }
          }

          physics.setBodyMassProperties(body, {
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
          if (world) physics.addBody(world, body);
        }

        for (const partPlan of plan.parts) {
          const blockId = String(partPlan.blockId);
          if (partByBlockId.has(blockId)) throw new Error(`Duplicate runtime part mapping: ${blockId}`);
          const runtimeBody = bodyById.get(partPlan.bodyId);
          if (!runtimeBody) throw new Error(`Part ${blockId} references missing body ${partPlan.bodyId}.`);
          partByBlockId.set(blockId, Object.freeze({
            plan: partPlan,
            body: runtimeBody.body,
            collider: colliderByBlockId.get(blockId) || null
          }));
        }

        if ((plan.constraints || []).length) {
          if (typeof options.constraintBuilder !== 'function') {
            throw new Error('Assembly contains constraints but no constraintBuilder was provided.');
          }
          for (const constraintPlan of plan.constraints) {
            if (!constraintPlan?.constraintId || constraintById.has(constraintPlan.constraintId)) {
              throw new Error(`Duplicate or missing constraint id: ${constraintPlan?.constraintId || 'unknown'}`);
            }
            const bodyA = bodyById.get(constraintPlan.bodyAId)?.body;
            const bodyB = bodyById.get(constraintPlan.bodyBId)?.body;
            if (!bodyA || !bodyB) throw new Error(`Constraint ${constraintPlan.constraintId} references a missing body.`);
            const built = options.constraintBuilder({ constraintPlan, bodyA, bodyB, physics, world, runtime });
            if (!built) throw new Error(`Constraint builder returned no runtime for ${constraintPlan.constraintId}.`);
            constraintById.set(constraintPlan.constraintId, built);
          }
        }

        runtime.rootBody = bodyById.get(plan.rootBodyId)?.body || null;
        if (!runtime.rootBody) throw new Error('Assembly builder did not create the root body.');
        return Object.freeze(runtime);
      } catch (error) {
        dispose();
        throw error;
      }
    }

    return Object.freeze({ build, validatePlan });
  });
})();
