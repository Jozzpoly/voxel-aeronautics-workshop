(() => {
  'use strict';

  window.VAW.define('foundation.mechanical-graph-compiler', ['foundation.diagnostics'], Diagnostics => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value); for (const nested of Object.values(value)) deepFreeze(nested, seen); return Object.freeze(value);
    }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

    function compile(resolvedAuthoring, rigidCompilation) {
      const diagnostics = []; const constraints = []; const constraintsByBodyId = Object.create(null); const constraintsByEndpointBlockId = Object.create(null); const constraintById = Object.create(null);
      for (const island of rigidCompilation.rigidIslands) constraintsByBodyId[island.bodyId] = [];
      for (const link of resolvedAuthoring.resolvedLinks) {
        const bodyAId = rigidCompilation.blockIdToBodyId[link.endpointA.blockId];
        const bodyBId = rigidCompilation.blockIdToBodyId[link.endpointB.blockId];
        const entities = [{ kind: 'mechanical-link', id: link.mechanicalLinkId }, { kind: 'block', id: link.endpointA.blockId }, { kind: 'block', id: link.endpointB.blockId }];
        if (!bodyAId || !bodyBId) { diagnostics.push(Diagnostics.create('mechanical-missing-body', 'error', entities)); continue; }
        if (bodyAId === bodyBId) { diagnostics.push(Diagnostics.create('mechanical-rigid-bypass', 'error', entities, { bodyId: bodyAId, cutEdgeId: link.cutEdgeId })); continue; }
        const bodyA = rigidCompilation.bodyById[bodyAId]; const bodyB = rigidCompilation.bodyById[bodyBId];
        const constraint = {
          constraintId: link.mechanicalLinkId, mechanicalLinkId: link.mechanicalLinkId, kind: 'hinge',
          bodyAId, bodyBId, endpointA: link.endpointA, endpointB: link.endpointB,
          assemblyPivotPosition: [...link.pivotAssemblyPosition],
          pivotA: sub(link.pivotAssemblyPosition, bodyA.assemblyPose.position),
          pivotB: sub(link.pivotAssemblyPosition, bodyB.assemblyPose.position),
          axisA: [...link.axisAssemblyVector], axisB: [...link.axisAssemblyVector], axis: link.axis,
          collideConnected: link.collideConnected, maxForce: link.maxForce, frictionTorque: link.frictionTorque,
          limits: link.limits
        };
        constraints.push(constraint); constraintById[constraint.constraintId] = constraint;
        constraintsByBodyId[bodyAId].push(constraint.constraintId); constraintsByBodyId[bodyBId].push(constraint.constraintId);
        for (const endpoint of [link.endpointA, link.endpointB]) {
          if (!constraintsByEndpointBlockId[endpoint.blockId]) constraintsByEndpointBlockId[endpoint.blockId] = [];
          constraintsByEndpointBlockId[endpoint.blockId].push(constraint.constraintId);
        }
      }
      constraints.sort((a, b) => a.constraintId.localeCompare(b.constraintId));
      for (const ids of Object.values(constraintsByBodyId)) ids.sort();
      for (const ids of Object.values(constraintsByEndpointBlockId)) ids.sort();

      if (rigidCompilation.rigidIslands.length > 0) {
        const graph = Object.fromEntries(rigidCompilation.rigidIslands.map(body => [body.bodyId, []]));
        for (const constraint of constraints) { graph[constraint.bodyAId].push(constraint.bodyBId); graph[constraint.bodyBId].push(constraint.bodyAId); }
        const start = rigidCompilation.rootBodyId || rigidCompilation.rigidIslands[0].bodyId;
        const visited = new Set(start ? [start] : []); const queue = start ? [start] : [];
        for (let cursor = 0; cursor < queue.length; cursor += 1) for (const next of graph[queue[cursor]]) if (!visited.has(next)) { visited.add(next); queue.push(next); }
        if (visited.size !== rigidCompilation.rigidIslands.length) {
          const missing = rigidCompilation.rigidIslands.map(body => body.bodyId).filter(id => !visited.has(id));
          diagnostics.push(Diagnostics.create('assembly-disconnected', 'error', missing.map(id => ({ kind: 'body', id })), { connectedBodies: visited.size, bodyCount: rigidCompilation.rigidIslands.length }));
        }
      }
      return deepFreeze({
        nodes: rigidCompilation.rigidIslands.map(body => body.bodyId).sort(), constraints,
        constraintById, constraintsByBodyId, constraintsByEndpointBlockId,
        diagnostics: Diagnostics.canonicalize(diagnostics)
      });
    }
    return Object.freeze({ compile });
  });
})();
