(() => {
  'use strict';

  window.VAW.define('foundation.runtime-assembly', [], () => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }

    function requireNumber(value, label, minimum = -Infinity) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`);
      if (numeric < minimum) throw new RangeError(`${label} must be at least ${minimum}.`);
      return numeric;
    }

    function requireVector(value, label) {
      const source = Array.isArray(value)
        ? { x: value[0], y: value[1], z: value[2] }
        : value;
      if (!source || typeof source !== 'object') throw new TypeError(`${label} must be a 3D vector.`);
      return [
        requireNumber(source.x, `${label}.x`),
        requireNumber(source.y, `${label}.y`),
        requireNumber(source.z, `${label}.z`)
      ];
    }

    function requirePositiveVector(value, label) {
      const result = requireVector(value, label);
      if (result.some(component => component <= 0)) throw new RangeError(`${label} components must be greater than zero.`);
      return result;
    }

    function requireId(value, label) {
      if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
      return value;
    }

    function createPlan(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.parts)) {
        throw new TypeError('Runtime assembly requires a compiled or loaded craft snapshot.');
      }
      if (snapshot.parts.length === 0) throw new Error('Runtime assembly requires at least one part.');

      const bodyId = 'body:root';
      const mass = requireNumber(snapshot.mass, 'Runtime assembly mass', Number.MIN_VALUE);
      const sourceCenterOfMass = requireVector(snapshot.com, 'Runtime assembly center of mass');
      const inertiaDiagonal = requirePositiveVector(snapshot.inertia, 'Runtime assembly inertia');
      const blockIdToBodyId = Object.create(null);
      const blockIdToPartIndex = Object.create(null);
      const colliders = [];

      const parts = snapshot.parts.map((part, index) => {
        if (!part || typeof part !== 'object') throw new TypeError(`Runtime part ${index} must be an object.`);
        const blockId = requireId(part.blockId, `Runtime part ${index}.blockId`);
        if (blockIdToPartIndex[blockId] !== undefined) throw new Error(`Duplicate runtime block id: ${blockId}`);
        const type = requireId(part.type, `Runtime part ${blockId}.type`);
        const offset = requireVector(part.offset, `Runtime part ${blockId}.offset`);
        const grid = requireVector(part.grid ?? part.position, `Runtime part ${blockId}.grid`);
        blockIdToBodyId[blockId] = bodyId;
        blockIdToPartIndex[blockId] = index;
        colliders.push({
          colliderId: `collider:${blockId}`,
          blockId,
          bodyId,
          kind: 'box',
          center: offset,
          halfExtents: [0.5, 0.5, 0.5]
        });
        return {
          partIndex: index,
          blockId,
          bodyId,
          gridKey: part.key == null ? null : String(part.key),
          type,
          grid,
          offset,
          orientation: requireNumber(part.orientation ?? 0, `Runtime part ${blockId}.orientation`),
          controlAxis: typeof part.controlAxis === 'string' ? part.controlAxis : 'pitch',
          controlSign: requireNumber(part.controlSign ?? 0, `Runtime part ${blockId}.controlSign`),
          properties: { ...(part.properties || {}) }
        };
      });

      const payloadMass = requireNumber(snapshot.payloadMass ?? 0, 'Runtime payload mass', 0);
      if (payloadMass > 0) {
        colliders.push({
          colliderId: 'collider:mission-payload',
          blockId: null,
          bodyId,
          kind: 'box',
          center: requireVector(snapshot.payloadOffset, 'Runtime payload offset'),
          halfExtents: [0.42, 0.42, 0.42],
          payload: true
        });
      }

      const rigidBody = {
        bodyId,
        role: 'root',
        blockIds: parts.map(part => part.blockId),
        sourceCenterOfMass,
        massProperties: {
          mass,
          centerOfMass: [0, 0, 0],
          inertiaDiagonal
        },
        colliders
      };

      return deepFreeze({
        format: 'VAW_RUNTIME_ASSEMBLY_PLAN_V1',
        sourceSignature: snapshot.compiled?.signature || snapshot.signature || null,
        rootBodyId: bodyId,
        rigidBodies: [rigidBody],
        constraints: [],
        signalLinks: [],
        parts,
        blockIdToBodyId,
        blockIdToPartIndex
      });
    }

    function rootBody(plan) {
      if (!plan || !Array.isArray(plan.rigidBodies)) return null;
      return plan.rigidBodies.find(body => body.bodyId === plan.rootBodyId) || null;
    }

    return Object.freeze({ createPlan, rootBody });
  });
})();
