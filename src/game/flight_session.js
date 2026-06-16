(() => {
  'use strict';

  window.VAW.define('game.flight-session', [], () => {
    function aggregateErrors(errors, message, complete = false) {
      const error = typeof AggregateError === 'function'
        ? new AggregateError(errors, message)
        : Object.assign(new Error(message), { errors });
      Object.defineProperty(error, 'cleanupComplete', { value: complete, enumerable: true });
      return error;
    }

    function create({
      state,
      RuntimeAssembly,
      AssemblyBuilder,
      Physics,
      world,
      removeVisualRoot = null
    }) {
      if (!state?.flight || !RuntimeAssembly?.createPlan || !AssemblyBuilder?.build || !Physics) {
        throw new TypeError('FlightSession requires flight state, RuntimeAssembly, AssemblyBuilder, and Physics.');
      }

      let runtime = null;
      let plan = null;
      let primaryBodyIdValue = null;
      let cleanupPending = false;
      const visualRootByBodyId = new Map();
      const transientCleanup = [];

      function choosePrimaryBodyId(candidatePlan, requested = null) {
        const ids = new Set((candidatePlan?.rigidBodies || []).map(body => body.bodyId));
        if (ids.size === 0) throw new Error('Flight session requires at least one rigid body.');
        if (requested != null) {
          const explicit = String(requested);
          if (!ids.has(explicit)) throw new Error(`Requested primary body is missing: ${explicit}`);
          return explicit;
        }
        if (candidatePlan.rootBodyId && ids.has(candidatePlan.rootBodyId)) return candidatePlan.rootBodyId;
        const roleRoot = (candidatePlan.rigidBodies || [])
          .filter(body => body.role === 'root')
          .map(body => body.bodyId)
          .sort()[0];
        return roleRoot || [...ids].sort()[0];
      }

      function publishRuntime(nextRuntime, nextPlan, requestedPrimaryBodyId = null) {
        runtime = nextRuntime;
        plan = nextPlan;
        primaryBodyIdValue = nextRuntime ? choosePrimaryBodyId(nextPlan, requestedPrimaryBodyId) : null;
        state.flight.assembly = nextRuntime;
        state.flight.assemblyPlan = nextPlan;
        state.flight.primaryBodyId = primaryBodyIdValue;
        state.flight.visualRootByBodyId = visualRootByBodyId;
      }

      function clearPublishedState() {
        runtime = null;
        plan = null;
        primaryBodyIdValue = null;
        cleanupPending = false;
        state.flight.assembly = null;
        state.flight.assemblyPlan = null;
        state.flight.primaryBodyId = null;
        state.flight.visualRootByBodyId = visualRootByBodyId;
      }

      function assertActive() {
        if (!runtime) throw new Error('Flight session is not active.');
        if (cleanupPending) throw new Error('Flight session cleanup is incomplete; retry stop() before further use.');
      }

      function start({ snapshot = null, assemblyPlan = null, bodyDescriptor, constraintBuilder, collisionListener, classifyCollision = null, primaryBodyId = null } = {}) {
        if (runtime || cleanupPending || visualRootByBodyId.size || transientCleanup.length) {
          throw new Error('Flight session is already active or still owns cleanup resources.');
        }
        const nextPlan = assemblyPlan || RuntimeAssembly.createPlan(snapshot);
        const selectedPrimaryBodyId = choosePrimaryBodyId(nextPlan, primaryBodyId);
        const nextRuntime = AssemblyBuilder.build({
          plan: nextPlan,
          physics: Physics,
          world,
          bodyDescriptor,
          constraintBuilder,
          collisionListener: typeof collisionListener === 'function'
            ? ({ event, bodyPlan, runtime: builtRuntime }) => collisionListener({
              collision: Object.freeze({
                impactSpeed: Number(event?.impactSpeed) || 0,
                relativePoint: event?.relativePoint ? Object.freeze({
                  x: Number(event.relativePoint.x) || 0,
                  y: Number(event.relativePoint.y) || 0,
                  z: Number(event.relativePoint.z) || 0
                }) : null,
                kind: typeof classifyCollision === 'function' ? classifyCollision(event?.otherBody || null) : 'unknown'
              }),
              bodyId: bodyPlan.bodyId,
              bodyPlan,
              assembly: builtRuntime
            })
            : undefined
        });
        publishRuntime(nextRuntime, nextPlan, selectedPrimaryBodyId);
        return Object.freeze({ plan: nextPlan, assembly: nextRuntime, primaryBodyId: selectedPrimaryBodyId });
      }

      function registerTransient(dispose, label = 'transient resource') {
        assertActive();
        if (typeof dispose !== 'function') throw new TypeError('Transient cleanup must be a function.');
        const entry = { dispose, label: String(label), disposed: false };
        transientCleanup.push(entry);
        return () => {
          if (entry.disposed) return false;
          const result = entry.dispose();
          if (result === false) return false;
          entry.disposed = true;
          const index = transientCleanup.indexOf(entry);
          if (index >= 0) transientCleanup.splice(index, 1);
          return true;
        };
      }

      function registerVisualRoot(bodyId, root, disposer = null) {
        assertActive();
        const id = String(bodyId);
        if (!runtime.getBodyIds().includes(id)) throw new Error(`Cannot register visual root for unknown body: ${id}`);
        if (!root || typeof root !== 'object') throw new TypeError('Visual root must be an object.');
        if (visualRootByBodyId.has(id)) throw new Error(`Visual root already registered for body: ${id}`);
        visualRootByBodyId.set(id, { root, disposer });
        return root;
      }

      function unregisterVisualRoot(bodyId) {
        const entry = visualRootByBodyId.get(String(bodyId));
        if (!entry) return false;
        const dispose = entry.disposer || removeVisualRoot;
        if (typeof dispose === 'function') {
          const result = dispose(entry.root, String(bodyId));
          if (result === false) return false;
        }
        visualRootByBodyId.delete(String(bodyId));
        return true;
      }

      function copyVector(target, value) {
        if (!target || !value) return;
        if (typeof target.set === 'function') target.set(value.x, value.y, value.z);
        else { target.x = value.x; target.y = value.y; target.z = value.z; }
      }

      function copyQuaternion(target, value) {
        if (!target || !value) return;
        if (typeof target.set === 'function') target.set(value.x, value.y, value.z, value.w);
        else { target.x = value.x; target.y = value.y; target.z = value.z; target.w = value.w; }
      }

      function syncVisuals() {
        assertActive();
        for (const [bodyId, entry] of visualRootByBodyId) {
          const transform = runtime.getBodyTransform(bodyId);
          copyVector(entry.root.position, transform.position);
          copyQuaternion(entry.root.quaternion, transform.quaternion);
        }
      }

      function cleanupOwnedResources() {
        const errors = [];
        for (let index = transientCleanup.length - 1; index >= 0; index -= 1) {
          const entry = transientCleanup[index];
          if (entry.disposed) { transientCleanup.splice(index, 1); continue; }
          try {
            const result = entry.dispose();
            if (result === false) throw new Error(`Cleanup rejected for ${entry.label}.`);
            entry.disposed = true;
            transientCleanup.splice(index, 1);
          } catch (error) { errors.push(error); }
        }
        for (const bodyId of [...visualRootByBodyId.keys()].reverse()) {
          try {
            if (!unregisterVisualRoot(bodyId)) throw new Error(`Visual cleanup rejected for ${bodyId}.`);
          } catch (error) { errors.push(error); }
        }
        return errors;
      }

      function stop() {
        const hasOwnedResources = Boolean(runtime || visualRootByBodyId.size || transientCleanup.length);
        if (!hasOwnedResources) return false;
        cleanupPending = true;
        const errors = [];

        if (runtime && !runtime.disposed) {
          try { runtime.dispose(); }
          catch (error) { errors.push(error); }
        }

        if (runtime && !runtime.disposed) {
          state.flight.cleanupPending = true;
          throw aggregateErrors(errors.length ? errors : [new Error('Runtime assembly cleanup is incomplete.')], 'Flight session cleanup failed.', false);
        }

        errors.push(...cleanupOwnedResources());
        const complete = transientCleanup.length === 0 && visualRootByBodyId.size === 0;
        state.flight.cleanupPending = !complete;
        if (!complete || errors.length) {
          cleanupPending = !complete;
          throw aggregateErrors(errors, 'Flight session resource cleanup failed.', complete);
        }

        clearPublishedState();
        state.flight.cleanupPending = false;
        return true;
      }

      function bodyIds() { assertActive(); return runtime.getBodyIds(); }
      function primaryBodyId() { return primaryBodyIdValue; }
      function hasBody(bodyId) { return Boolean(runtime && runtime.getBodyIds().includes(String(bodyId))); }
      function ownsBody(body) { return Boolean(runtime?.ownsBody(body)); }
      function getBodyTransform(bodyId = primaryBodyIdValue) { assertActive(); return runtime.getBodyTransform(bodyId); }
      function getBodyLinearVelocity(bodyId = primaryBodyIdValue) { assertActive(); return runtime.getBodyLinearVelocity(bodyId); }
      function getBodyAngularVelocity(bodyId = primaryBodyIdValue) { assertActive(); return runtime.getBodyAngularVelocity(bodyId); }
      function getBodyPointVelocity(bodyId, localPoint) { assertActive(); return runtime.getBodyPointVelocity(bodyId, localPoint); }
      function setBodyTransform(bodyId, transform) { assertActive(); return runtime.setBodyTransform(bodyId, transform); }
      function setBodyVelocity(bodyId, velocity) { assertActive(); return runtime.setBodyVelocity(bodyId, velocity); }
      function clearBodyMotion(bodyId = primaryBodyIdValue) { assertActive(); return runtime.clearBodyMotion(bodyId); }
      function vectorToWorldFrame(bodyId, vector) { assertActive(); return runtime.vectorToWorldFrame(bodyId, vector); }
      function vectorToLocalFrame(bodyId, vector) { assertActive(); return runtime.vectorToLocalFrame(bodyId, vector); }
      function pointToWorldFrame(bodyId, point) { assertActive(); return runtime.pointToWorldFrame(bodyId, point); }
      function pointToLocalFrame(bodyId, point) { assertActive(); return runtime.pointToLocalFrame(bodyId, point); }
      function applyBodyForce(bodyId, force, worldPoint) { assertActive(); return runtime.applyBodyForce(bodyId, force, worldPoint); }
      function addBodyTorque(bodyId, torque) { assertActive(); return runtime.addBodyTorque(bodyId, torque); }
      function getBodyIdForBlock(blockId) { assertActive(); return runtime.getBodyIdForBlock(blockId); }
      function getPartDescriptor(blockId) { assertActive(); return runtime.getPartDescriptor(blockId); }
      function getColliderOwnership(colliderId) { assertActive(); return runtime.getColliderOwnership(colliderId); }
      function getColliderOwnershipByBlockId(blockId) { assertActive(); return runtime.getColliderOwnershipByBlockId(blockId); }
      function removeColliderByBlockId(blockId) { assertActive(); return runtime.removeColliderByBlockId(blockId); }
      function removeCollider(colliderId) { assertActive(); return runtime.removeCollider(colliderId); }
      function recenterBody(bodyId, shift) { assertActive(); return runtime.recenterBody(bodyId, shift); }
      function setBodyMassProperties(bodyId, properties) { assertActive(); return runtime.setBodyMassProperties(bodyId, properties); }
      function constraintIdsForBody(bodyId) { assertActive(); return runtime.constraintIdsForBody(bodyId); }
      function constraintIdsForEndpointBlock(blockId) { assertActive(); return runtime.constraintIdsForEndpointBlock(blockId); }
      function breakConstraintsForEndpointBlock(blockId, reason) { assertActive(); return runtime.breakConstraintsForEndpointBlock(blockId, reason); }
      function removeConstraint(constraintId) { assertActive(); return runtime.removeConstraint(constraintId); }
      function setConstraintControl(constraintId, control) { assertActive(); return runtime.setConstraintControl(constraintId, control); }
      function getConstraintState(constraintId) { assertActive(); return runtime.getConstraintState(constraintId); }
      function getVisualRoot(bodyId = primaryBodyIdValue) { return visualRootByBodyId.get(String(bodyId))?.root || null; }
      function getAssembly() { return runtime; }
      function getPlan() { return plan; }
      function isActive() { return Boolean(runtime && !runtime.disposed && !cleanupPending); }

      return Object.freeze({
        start,
        stop,
        cleanup: stop,
        isActive,
        getAssembly,
        getPlan,
        bodyIds,
        primaryBodyId,
        hasBody,
        ownsBody,
        getBodyTransform,
        getBodyLinearVelocity,
        getBodyAngularVelocity,
        getBodyPointVelocity,
        setBodyTransform,
        setBodyVelocity,
        clearBodyMotion,
        vectorToWorldFrame,
        vectorToLocalFrame,
        pointToWorldFrame,
        pointToLocalFrame,
        applyBodyForce,
        addBodyTorque,
        getBodyIdForBlock,
        getPartDescriptor,
        getColliderOwnership,
        getColliderOwnershipByBlockId,
        removeColliderByBlockId,
        removeCollider,
        recenterBody,
        setBodyMassProperties,
        constraintIdsForBody,
        constraintIdsForEndpointBlock,
        breakConstraintsForEndpointBlock,
        removeConstraint,
        setConstraintControl,
        getConstraintState,
        registerTransient,
        registerVisualRoot,
        unregisterVisualRoot,
        getVisualRoot,
        syncVisuals
      });
    }

    return Object.freeze({ create });
  });
})();
