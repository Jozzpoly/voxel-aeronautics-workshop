(() => {
  'use strict';

  window.VAW.define('game.flight-thruster-router', [], () => {
    const THRUSTER_TYPES = new Set(['Thruster', 'VectorThruster']);

    function isThruster(part) {
      return Boolean(part && THRUSTER_TYPES.has(part.type));
    }

    function pilotVector(pilot, kind) {
      if (kind === 'angular') {
        return {
          x: Number(pilot?.roll) || 0,
          y: Number(pilot?.yaw) || 0,
          z: Number(pilot?.pitch) || 0
        };
      }
      return {
        x: Number(pilot?.surge) || 0,
        y: Number(pilot?.lift) || 0,
        z: Number(pilot?.sway) || 0
      };
    }

    function pilotFromVectors(linear, angular) {
      return Object.freeze({
        pitch: Number(angular?.z) || 0,
        yaw: Number(angular?.y) || 0,
        roll: Number(angular?.x) || 0,
        surge: Number(linear?.x) || 0,
        lift: Number(linear?.y) || 0,
        sway: Number(linear?.z) || 0
      });
    }

    function create({ flightSession }) {
      if (!flightSession?.hasBody || !flightSession?.vectorToWorldFrame || !flightSession?.vectorToLocalFrame ||
          !flightSession?.pointToWorldFrame || !flightSession?.applyBodyForce) {
        throw new TypeError('FlightThrusterRouter requires explicit FlightSession body/frame APIs.');
      }

      function requireBodyId(part) {
        const bodyId = part?.bodyId == null ? '' : String(part.bodyId);
        if (!bodyId) throw new Error(`Thruster ${part?.blockId || '<unknown>'} has no body ownership.`);
        return bodyId;
      }

      function pilotForBody(primaryBodyId, bodyId, pilot) {
        const primaryId = primaryBodyId == null ? '' : String(primaryBodyId);
        const targetId = bodyId == null ? '' : String(bodyId);
        if (!primaryId || !targetId) throw new Error('Pilot remapping requires explicit primary and target body IDs.');
        if (!flightSession.hasBody(primaryId) || !flightSession.hasBody(targetId)) return null;
        const linearWorld = flightSession.vectorToWorldFrame(primaryId, pilotVector(pilot, 'linear'));
        const angularWorld = flightSession.vectorToWorldFrame(primaryId, pilotVector(pilot, 'angular'));
        const linearLocal = flightSession.vectorToLocalFrame(targetId, linearWorld);
        const angularLocal = flightSession.vectorToLocalFrame(targetId, angularWorld);
        return pilotFromVectors(linearLocal, angularLocal);
      }

      function routeLocalForce(part, localForce) {
        if (!isThruster(part)) throw new TypeError('Only thruster parts may use FlightThrusterRouter.');
        if (!part.attached) return Object.freeze({ applied: false, reason: 'detached' });
        const bodyId = requireBodyId(part);
        if (!flightSession.hasBody(bodyId)) return Object.freeze({ applied: false, reason: 'missing-body', bodyId });
        const worldForce = flightSession.vectorToWorldFrame(bodyId, localForce);
        const worldPoint = flightSession.pointToWorldFrame(bodyId, part.bodyLocalPosition);
        flightSession.applyBodyForce(bodyId, worldForce, worldPoint);
        return Object.freeze({ applied: true, bodyId, worldForce, worldPoint });
      }

      function recordCommand(part, command, fuelScale = 1, health = 1) {
        if (!isThruster(part)) throw new TypeError('Only thruster parts may record thruster commands.');
        const effective = Math.max(0, Number(command) || 0) * Math.max(0, Number(fuelScale) || 0) * Math.max(0, Number(health) || 0);
        part.lastCommand = part.attached ? effective : 0;
        return part.lastCommand;
      }

      return Object.freeze({ isThruster, pilotForBody, routeLocalForce, recordCommand });
    }

    return Object.freeze({ create, isThruster });
  });
})();
