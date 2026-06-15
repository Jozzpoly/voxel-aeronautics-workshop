(() => {
  'use strict';

  window.VAW.define('foundation.runtime-assembly', [], () => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }
    function number(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
    function vector(value) {
      if (Array.isArray(value)) return [number(value[0]), number(value[1]), number(value[2])];
      return [number(value?.x), number(value?.y), number(value?.z)];
    }
    function positiveVector(value, fallback = [0.5, 0.5, 0.5]) {
      const result = vector(value);
      return result.map((component, index) => component > 0 ? component : fallback[index]);
    }
    function createPlan(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.parts)) throw new TypeError('Runtime assembly requires a compiled or loaded craft snapshot.');
      const bodyId = 'body:root';
      const blockIdToBodyId = Object.create(null);
      const blockIdToPartIndex = Object.create(null);
      const colliders = [];
      const parts = snapshot.parts.map((part, index) => {
        const blockId = String(part.blockId || `legacy:${part.key || index}`);
        if (blockIdToPartIndex[blockId] !== undefined) throw new Error(`Duplicate runtime block id: ${blockId}`);
        blockIdToBodyId[blockId] = bodyId;
        blockIdToPartIndex[blockId] = index;
        const offset = vector(part.offset);
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
          gridKey: part.key || null,
          type: part.type,
          grid: vector(part.grid || part.position),
          offset,
          orientation: number(part.orientation),
          controlAxis: part.controlAxis || 'pitch',
          controlSign: number(part.controlSign),
          properties: { ...(part.properties || {}) }
        };
      });
      if (number(snapshot.payloadMass) > 0 && snapshot.payloadOffset) {
        colliders.push({
          colliderId: 'collider:mission-payload',
          blockId: null,
          bodyId,
          kind: 'box',
          center: vector(snapshot.payloadOffset),
          halfExtents: [0.42, 0.42, 0.42],
          payload: true
        });
      }
      const rigidBody = {
        bodyId,
        role: 'root',
        blockIds: parts.map(part => part.blockId),
        sourceCenterOfMass: vector(snapshot.com),
        massProperties: {
          mass: Math.max(0, number(snapshot.mass)),
          centerOfMass: [0, 0, 0],
          inertiaDiagonal: positiveVector(snapshot.inertia, [1, 1, 1])
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
