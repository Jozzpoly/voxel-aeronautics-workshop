(() => {
  'use strict';

  window.VAW.define('game.flight-integrity', [], () => {
    function aggregate(errors, message) {
      return typeof AggregateError === 'function'
        ? new AggregateError(errors, message)
        : Object.assign(new Error(message), { errors });
    }

    function create({
      state,
      flightSession,
      MassProperties,
      makeKey = (x, y, z) => `${x},${y},${z}`,
      clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
      hooks = {}
    }) {
      if (!state?.flight || !flightSession || !MassProperties?.compute) {
        throw new TypeError('FlightIntegrity requires flight state, FlightSession, and MassProperties.');
      }

      const bodyRestriction = 'per-rigid-island-static-frame-guard';

      function notify(hookName, ...args) {
        try { hooks[hookName]?.(...args); }
        catch (error) {
          try { hooks.onDiagnostic?.({ source: 'flight-integrity', hook: hookName, error }); }
          catch (_) {}
        }
      }

      function healthFraction(part) {
        return part && part.maxHealth > 0 ? clamp(part.health / part.maxHealth, 0, 1) : 0;
      }

      function bodyIdForPart(part) {
        if (!part || typeof part !== 'object') return null;
        const declared = part.bodyId == null ? null : String(part.bodyId);
        const compiled = part.blockId == null ? null : flightSession.getBodyIdForBlock(part.blockId);
        if (declared && compiled && declared !== compiled) {
          throw new Error(`Part ${part.blockId || '<unknown>'} body ownership mismatch: ${declared} != ${compiled}`);
        }
        const bodyId = declared || compiled;
        if (!bodyId || !flightSession.hasBody(bodyId)) return null;
        return bodyId;
      }

      function requireOwnedPart(part) {
        const bodyId = bodyIdForPart(part);
        if (!bodyId) throw new Error(`Part ${part?.blockId || '<unknown>'} has no runtime body ownership.`);
        if (part.blockId) {
          const descriptor = flightSession.getPartDescriptor(part.blockId);
          if (!descriptor || descriptor.bodyId !== bodyId) {
            throw new Error(`Part ${part.blockId} is missing from the authoritative RuntimeAssembly.`);
          }
        }
        return bodyId;
      }

      function colliderForBlock(blockId) {
        return blockId ? flightSession.getColliderOwnershipByBlockId(blockId) : null;
      }

      function requirePrimaryIsland(part) {
        return requireOwnedPart(part);
      }


      function removePartCollider(part) {
        const bodyId = requireOwnedPart(part);
        const ownership = colliderForBlock(part.blockId);
        if (!ownership) return false;
        if (ownership.bodyId !== bodyId) {
          throw new Error(`Collider ownership mismatch for ${part.blockId}.`);
        }
        return flightSession.removeColliderByBlockId(part.blockId) === true;
      }

      function partsForBody(bodyId) {
        const indexed = state.flight.runtimePartsByBodyId?.get(String(bodyId));
        const source = Array.isArray(indexed) ? indexed : state.flight.runtimeParts;
        return source.filter(part => part.attached && bodyIdForPart(part) === bodyId);
      }

      function getRuntimeCore(bodyId = flightSession.primaryBodyId()) {
        return partsForBody(bodyId).find(part => part.type === 'Core') || null;
      }

      function markMetricsDirty() { state.flight.metricsDirty = true; }

      function recompute(force = false) {
        if (!force && !state.flight.metricsDirty) return false;
        const primaryBodyId = flightSession.primaryBodyId();
        const attached = partsForBody(primaryBodyId);
        const health = attached.reduce((sum, part) => sum + Math.max(0, part.health), 0);
        const core = getRuntimeCore(primaryBodyId);
        state.flight.integrity = core?.health > 0 && state.flight.initialHealth > 0
          ? clamp(health / state.flight.initialHealth * 100, 0, 100)
          : 0;
        state.flight.dragArea = attached.reduce((sum, part) => sum + (part.def.dragArea || 0) * Math.max(0.15, healthFraction(part)), 0)
          + (state.flight.payload?.attached && state.flight.payload.bodyId === primaryBodyId ? 0.2 : 0);
        state.flight.gyroAuthority = attached.filter(part => part.type === 'Gyro').reduce((sum, part) => sum + healthFraction(part), 0);
        state.flight.gyroCount = state.flight.gyroAuthority;
        state.flight.leakingFuelRate = attached.filter(part => part.type === 'Fuel').reduce((sum, part) => {
          const healthValue = healthFraction(part);
          return sum + (part.def.leakRate || 0) * Math.max(0, (0.82 - healthValue) / 0.82);
        }, 0);
        state.flight.metricsDirty = false;
        return true;
      }

      function computeBodyMassProperties(bodyId) {
        const parts = partsForBody(bodyId);
        const payload = state.flight.payload?.attached && state.flight.payload.bodyId === bodyId ? state.flight.payload : null;
        return MassProperties.compute([
          ...parts.map(part => ({ id: part.blockId, mass: part.mass, center: part.bodyLocalPosition, halfExtents: [0.5, 0.5, 0.5] })),
          ...(payload ? [{ id: 'mission-payload', mass: payload.mass, center: payload.bodyLocalPosition, halfExtents: [0.42, 0.42, 0.42] }] : [])
        ]);
      }

      function subtractVector(target, value) {
        target.x -= value.x; target.y -= value.y; target.z -= value.z;
      }

      function recenterBody(bodyId = flightSession.primaryBodyId()) {
        if (!flightSession.hasBody(bodyId)) throw new Error(`Cannot recenter missing body: ${bodyId}`);
        const parts = partsForBody(bodyId);
        const payload = state.flight.payload?.attached && state.flight.payload.bodyId === bodyId ? state.flight.payload : null;
        const massProperties = computeBodyMassProperties(bodyId);
        if (!(massProperties.mass > 0)) return null;
        const shift = { x: massProperties.centerOfMass[0], y: massProperties.centerOfMass[1], z: massProperties.centerOfMass[2] };
        const activeConstraints = flightSession.constraintIdsForBody(bodyId);
        if (activeConstraints.length && Math.hypot(shift.x, shift.y, shift.z) >= 1e-8) {
          const result = Object.freeze({ bodyId, guarded: true, constraintIds: activeConstraints, shift: Object.freeze(shift), massProperties });
          notify('onDiagnostic', { source: 'flight-integrity', code: 'connected-body-recenter-blocked', bodyId, constraintIds: activeConstraints });
          return result;
        }
        if (Math.hypot(shift.x, shift.y, shift.z) >= 1e-8) {
          flightSession.recenterBody(bodyId, shift);
          for (const part of parts) subtractVector(part.bodyLocalPosition, shift);
          if (payload) {
            subtractVector(payload.bodyLocalPosition, shift);
            state.flight.payloadBodyLocalPosition = payload.bodyLocalPosition;
          }
          const visualRoot = flightSession.getVisualRoot(bodyId);
          for (const child of visualRoot?.children || []) subtractVector(child.position, shift);
        }
        const inertia = { x: massProperties.inertiaDiagonal[0], y: massProperties.inertiaDiagonal[1], z: massProperties.inertiaDiagonal[2] };
        flightSession.setBodyMassProperties(bodyId, { mass: massProperties.mass, inertiaDiagonal: inertia });
        if (bodyId === flightSession.primaryBodyId()) {
          state.flight.runtimeMass = massProperties.mass;
          state.flight.payloadMass = payload ? payload.mass : 0;
          if (state.flight.currentInertia?.set) state.flight.currentInertia.set(inertia.x, inertia.y, inertia.z);
          else state.flight.currentInertia = inertia;
          state.flight.lowestLocalY = Math.min(...parts.map(part => part.bodyLocalPosition.y - 0.5), payload ? payload.bodyLocalPosition.y - 0.42 : Infinity);
        }
        notify('onRecenter', { bodyId, shift, massProperties, parts, payload });
        markMetricsDirty();
        return Object.freeze({ bodyId, guarded: false, shift: Object.freeze(shift), massProperties });
      }


      function collectDisconnected(bodyId = flightSession.primaryBodyId()) {
        const parts = partsForBody(bodyId);
        if (!parts.length) return [];
        const bodyPlan = state.flight.assemblyPlan?.rigidBodies?.find(body => body.bodyId === bodyId);
        const anchor = parts.find(part => part.type === 'Core')
          || parts.find(part => part.blockId === bodyPlan?.anchorBlockId)
          || [...parts].sort((a, b) => a.blockId.localeCompare(b.blockId))[0];
        const byId = new Map(parts.map(part => [part.blockId, part]));
        const visited = new Set([anchor.blockId]);
        const queue = [anchor.blockId];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const part = byId.get(queue[cursor]);
          for (const neighborId of part?.rigidNeighborBlockIds || []) {
            if (byId.has(neighborId) && !visited.has(neighborId)) { visited.add(neighborId); queue.push(neighborId); }
          }
        }
        return parts.filter(part => part.blockId !== anchor.blockId && !visited.has(part.blockId));
      }


      function finalizeDetachedPart(part, reason) {
        part.attached = false;
        part.health = 0;
        state.flight.runtimePartById?.delete(part.blockId);
        if (part.key) state.flight.runtimePartByKey?.delete(part.key);
        state.flight.lostParts += 1;
        state.flight.structuralFailures += 1;
        state.flight.blockCount = Math.max(1, state.flight.blockCount - 1);
        if (!state.flight.firstFailure) state.flight.firstFailure = `${part.type} detached: ${reason}`;
        notify('onPartDetached', part, reason);
      }

      function detachParts(entries, cascade = true) {
        const pending = new Map();
        for (const entry of entries || []) {
          const part = entry?.part || entry;
          if (part?.attached) pending.set(part, entry?.reason || 'structural failure');
        }
        if (!pending.size) return 0;
        let fuelCapacityLost = 0;
        let detached = 0;
        let coreFailed = false;
        const affectedBodies = new Set();

        const detachOne = (part, reason) => {
          const bodyId = requireOwnedPart(part);
          if (!part.attached) return;
          if (part.type === 'Core') {
            part.health = 0; coreFailed = true; state.flight.integrity = 0;
            state.flight.firstFailure = `Command core failed: ${reason}`;
            notify('onCoreFailed', part, reason); return;
          }
          const broken = flightSession.breakConstraintsForEndpointBlock(part.blockId, reason);
          if (broken.length) notify('onDiagnostic', { source: 'flight-integrity', code: 'mechanical-endpoint-failure', blockId: part.blockId, constraintIds: broken });
          const remaining = flightSession.constraintIdsForBody(bodyId);
          if (remaining.length) {
            part.health = Math.max(1, part.maxHealth * 0.01);
            notify('onDiagnostic', { source: 'flight-integrity', code: 'connected-body-detach-blocked', blockId: part.blockId, bodyId, constraintIds: remaining });
            return;
          }
          const ownership = colliderForBlock(part.blockId);
          if (ownership && !removePartCollider(part)) throw new Error(`Backend rejected collider removal for ${part.blockId}; part state was not mutated.`);
          finalizeDetachedPart(part, reason);
          affectedBodies.add(bodyId);
          if (part.type === 'Fuel') fuelCapacityLost += part.def.fuelCapacity || 0;
          detached += 1;
        };

        for (const [part, reason] of pending) detachOne(part, reason);
        if (cascade && !coreFailed) {
          for (const bodyId of [...affectedBodies]) {
            for (const part of collectDisconnected(bodyId)) detachOne(part, 'rigid connection to body anchor was severed');
          }
        }
        if (fuelCapacityLost > 0) {
          state.flight.fuelMax = Math.max(0, state.flight.fuelMax - fuelCapacityLost);
          state.flight.fuel = Math.min(state.flight.fuel, state.flight.fuelMax);
        }
        for (const bodyId of affectedBodies) recenterBody(bodyId);
        markMetricsDirty(); recompute(true); notify('onDetachBatch', detached);
        return detached;
      }


      function applyDamageOnly(part, amount, reason = 'impact') {
        const bodyId = requireOwnedPart(part);
        if (!part.attached || !(amount > 0)) return false;
        const absorbed = Math.max(0.25, part.def.structural || 1);
        const projected = Math.max(0, part.health - amount / absorbed);
        if (projected <= 0) {
          const bodyConstraints = flightSession.constraintIdsForBody(bodyId);
          const endpointConstraints = new Set(flightSession.constraintIdsForEndpointBlock(part.blockId));
          const unbrokenConstraints = bodyConstraints.filter(id => !endpointConstraints.has(id));
          if (unbrokenConstraints.length) {
            part.health = Math.max(1, part.maxHealth * 0.01);
            notify('onDiagnostic', { source: 'flight-integrity', code: 'connected-body-damage-detach-guard', blockId: part.blockId, bodyId, constraintIds: unbrokenConstraints });
            markMetricsDirty();
            return false;
          }
        }
        part.health = projected;
        if (!state.flight.firstFailure && healthFraction(part) < 0.55) state.flight.firstFailure = `${part.type} critically damaged by ${reason}`;
        notify('onPartDamaged', part, reason); markMetricsDirty();
        return part.health <= 0;
      }


      function damagePart(part, amount, reason = 'impact') {
        if (applyDamageOnly(part, amount, reason)) return detachParts([{ part, reason }], true) > 0;
        recompute();
        return false;
      }

      function requireOwnedPayload() {
        const payload = state.flight.payload;
        if (!payload?.attached) return null;
        if (!payload.bodyId || !flightSession.hasBody(payload.bodyId)) throw new Error('Payload has no valid body ownership.');
        const ownership = flightSession.getColliderOwnership(payload.colliderId);
        if (ownership && ownership.bodyId !== payload.bodyId) throw new Error('Payload collider belongs to a different body.');
        return { payload, ownership };
      }

      function detachPayload(reason = 'payload mount failure') {
        const owned = requireOwnedPayload();
        if (!owned) return false;
        const { payload, ownership } = owned;
        const activeConstraints = flightSession.constraintIdsForBody(payload.bodyId);
        if (activeConstraints.length) {
          payload.health = Math.max(1, payload.maxHealth * 0.01);
          notify('onDiagnostic', { source: 'flight-integrity', code: 'connected-body-payload-detach-blocked', bodyId: payload.bodyId, constraintIds: activeConstraints });
          return false;
        }
        if (ownership && !flightSession.removeCollider(payload.colliderId)) {
          throw new Error('Backend rejected payload collider removal; payload state was not mutated.');
        }
        payload.attached = false;
        payload.health = 0;
        state.flight.payloadMass = 0;
        state.flight.payloadBodyLocalPosition = null;
        if (!state.flight.firstFailure) state.flight.firstFailure = `Payload lost: ${reason}`;
        notify('onPayloadDetached', payload, reason);
        recenterBody(payload.bodyId);
        recompute(true);
        return true;
      }

      function damagePayload(amount, reason = 'impact') {
        if (!(amount > 0)) return false;
        const owned = requireOwnedPayload();
        if (!owned) return false;
        const { payload } = owned;
        payload.health = Math.max(0, payload.health - amount);
        notify('onPayloadDamaged', payload, reason);
        return payload.health <= 0 ? detachPayload(reason) : false;
      }

      function registerDebris(entry) {
        if (!entry || typeof entry !== 'object') throw new TypeError('Debris entry is required.');
        state.flight.debris.push(entry);
        return entry;
      }

      function createDebris(descriptor) {
        if (!descriptor || typeof descriptor !== 'object') throw new TypeError('Debris descriptor is required.');
        if (typeof hooks.createDebris !== 'function') throw new Error('Debris creation hook is not configured.');
        const entry = hooks.createDebris(descriptor);
        if (!entry) throw new Error('Debris creation hook returned no owned entry.');
        return registerDebris(entry);
      }

      function updateDebris(dt) {
        const errors = [];
        for (let index = state.flight.debris.length - 1; index >= 0; index -= 1) {
          const entry = state.flight.debris[index];
          try {
            const expired = hooks.updateDebris?.(entry, dt) === true;
            if (expired) {
              hooks.disposeDebris?.(entry);
              state.flight.debris.splice(index, 1);
            }
          } catch (error) { errors.push(error); }
        }
        if (errors.length) throw aggregate(errors, 'Debris update failed.');
      }

      function disposeAllDebris() {
        const errors = [];
        for (let index = state.flight.debris.length - 1; index >= 0; index -= 1) {
          const entry = state.flight.debris[index];
          try {
            const result = hooks.disposeDebris?.(entry);
            if (result === false) throw new Error('Debris disposer rejected cleanup.');
            state.flight.debris.splice(index, 1);
          } catch (error) { errors.push(error); }
        }
        if (errors.length) throw aggregate(errors, 'Debris cleanup failed.');
        return true;
      }

      return Object.freeze({
        bodyRestriction,
        healthFraction,
        bodyIdForPart,
        requireOwnedPart,
        colliderForBlock,
        removePartCollider,
        partsForBody,
        getRuntimeCore,
        recompute,
        computeBodyMassProperties,
        recenterBody,
        collectDisconnected,
        detachParts,
        applyDamageOnly,
        damagePart,
        requireOwnedPayload,
        detachPayload,
        damagePayload,
        registerDebris,
        createDebris,
        updateDebris,
        disposeAllDebris
      });
    }

    return Object.freeze({ create });
  });
})();
