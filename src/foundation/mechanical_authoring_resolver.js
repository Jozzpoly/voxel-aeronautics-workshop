(() => {
  'use strict';

  window.VAW.define('foundation.mechanical-authoring-resolver', [
    'foundation.blueprint', 'foundation.diagnostics', 'foundation.structural-graph-compiler'
  ], (blueprint, Diagnostics, StructuralGraphCompiler) => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value); for (const nested of Object.values(value)) deepFreeze(nested, seen); return Object.freeze(value);
    }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function scale(a, value) { return [a[0] * value, a[1] * value, a[2] * value]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function endpointKey(endpoint) { return `${endpoint.blockId}@${endpoint.face}`; }
    function rawLinkSortKey(raw) {
      const limits = raw?.limits;
      return JSON.stringify([
        String(raw?.mechanicalLinkId ?? ''), String(raw?.kind ?? ''),
        String(raw?.endpointA?.blockId ?? ''), String(raw?.endpointA?.face ?? ''),
        String(raw?.endpointB?.blockId ?? ''), String(raw?.endpointB?.face ?? ''),
        String(raw?.axis ?? ''), raw?.collideConnected === true,
        Number(raw?.maxForce ?? 1000000), Number(raw?.frictionTorque ?? 0),
        limits == null ? null : [
          Number(limits.minAngle), Number(limits.maxAngle), Number(limits.tolerance ?? 0.01),
          Number(limits.maxTorque ?? 80), Number(limits.maxSpeed ?? 5),
          Number(limits.positionGain ?? 16), Number(limits.velocityDamping ?? 1.5)
        ]
      ]);
    }

    function compile(rawLinks, structuralGraph) {
      const diagnostics = []; const resolvedLinks = []; const seenIds = new Set(); const usedEndpointFaces = new Map(); const usedCutEdges = new Map();
      for (const raw of [...(Array.isArray(rawLinks) ? rawLinks : [])].sort((a, b) => rawLinkSortKey(a).localeCompare(rawLinkSortKey(b)))) {
        const id = blueprint.normalizeMechanicalLinkId(raw?.mechanicalLinkId);
        const linkEntity = id ? [{ kind: 'mechanical-link', id }] : [];
        if (!id) { diagnostics.push(Diagnostics.create('invalid-mechanical-link-id', 'error')); continue; }
        if (seenIds.has(id)) { diagnostics.push(Diagnostics.create('duplicate-mechanical-link-id', 'error', linkEntity)); continue; }
        seenIds.add(id);
        if (raw?.kind !== 'hinge') { diagnostics.push(Diagnostics.create('unsupported-mechanical-link-kind', 'error', linkEntity, { kind: raw?.kind })); continue; }
        const endpointA = raw.endpointA; const endpointB = raw.endpointB;
        const faceA = blueprint.normalizeFaceId(endpointA?.face); const faceB = blueprint.normalizeFaceId(endpointB?.face);
        const axis = blueprint.normalizeFaceId(raw.axis);
        const blockA = structuralGraph.blockById[endpointA?.blockId]; const blockB = structuralGraph.blockById[endpointB?.blockId];
        const entities = [...linkEntity,
          ...(endpointA?.blockId ? [{ kind: 'block', id: String(endpointA.blockId) }] : []),
          ...(endpointB?.blockId ? [{ kind: 'block', id: String(endpointB.blockId) }] : [])];
        let invalid = false;
        if (!blockA || !blockB) { diagnostics.push(Diagnostics.create('mechanical-missing-endpoint', 'error', entities)); invalid = true; }
        if (!faceA || !faceB) { diagnostics.push(Diagnostics.create('mechanical-invalid-face', 'error', entities)); invalid = true; }
        if (!axis) { diagnostics.push(Diagnostics.create('mechanical-invalid-axis', 'error', entities)); invalid = true; }
        if (invalid) continue;
        const expectedB = add(blockA.assemblyPosition, blueprint.FACE_VECTORS[faceA]);
        if (expectedB.some((component, index) => component !== blockB.assemblyPosition[index]) || blueprint.OPPOSITE_FACE[faceA] !== faceB) {
          diagnostics.push(Diagnostics.create('mechanical-endpoints-not-opposite-adjacent-faces', 'error', entities, { faceA, faceB })); continue;
        }
        if (Math.abs(dot(blueprint.FACE_VECTORS[axis], blueprint.FACE_VECTORS[faceA])) > 0.5) {
          diagnostics.push(Diagnostics.create('mechanical-axis-normal-to-shared-face', 'error', entities, { axis, face: faceA })); continue;
        }
        const maxForce = Number(raw.maxForce ?? 1000000);
        if (!Number.isFinite(maxForce) || maxForce <= 0) {
          diagnostics.push(Diagnostics.create('mechanical-invalid-max-force', 'error', entities, { maxForce: raw.maxForce })); continue;
        }
        const frictionTorque = Number(raw.frictionTorque ?? 0);
        if (!Number.isFinite(frictionTorque) || frictionTorque < 0) {
          diagnostics.push(Diagnostics.create('mechanical-invalid-friction-torque', 'error', entities, { frictionTorque: raw.frictionTorque })); continue;
        }
        const limits = raw.limits == null ? null : blueprint.canonicalLimits(raw.limits);
        if (raw.limits != null && !limits) {
          diagnostics.push(Diagnostics.create('mechanical-invalid-limits', 'error', entities)); continue;
        }
        const endpointAKey = endpointKey({ blockId: blockA.blockId, face: faceA });
        const endpointBKey = endpointKey({ blockId: blockB.blockId, face: faceB });
        const duplicateEndpoint = usedEndpointFaces.get(endpointAKey) || usedEndpointFaces.get(endpointBKey);
        if (duplicateEndpoint) {
          diagnostics.push(Diagnostics.create('mechanical-endpoint-face-in-use', 'error', [...entities, { kind: 'mechanical-link', id: duplicateEndpoint }])); continue;
        }
        const cutEdgeId = StructuralGraphCompiler.edgeKey(blockA.blockId, blockB.blockId);
        if (!structuralGraph.edgeByBlockPair[cutEdgeId]) {
          diagnostics.push(Diagnostics.create('mechanical-missing-structural-edge', 'error', entities, { cutEdgeId })); continue;
        }
        if (usedCutEdges.has(cutEdgeId)) {
          diagnostics.push(Diagnostics.create('mechanical-duplicate-cut-edge', 'error', [...entities, { kind: 'mechanical-link', id: usedCutEdges.get(cutEdgeId) }], { cutEdgeId })); continue;
        }
        usedEndpointFaces.set(endpointAKey, id); usedEndpointFaces.set(endpointBKey, id); usedCutEdges.set(cutEdgeId, id);
        const pivotAssemblyPosition = scale(add(blockA.assemblyPosition, blockB.assemblyPosition), 0.5);
        resolvedLinks.push({
          mechanicalLinkId: id, kind: 'hinge',
          endpointA: { blockId: blockA.blockId, face: faceA }, endpointB: { blockId: blockB.blockId, face: faceB },
          axis, axisAssemblyVector: [...blueprint.FACE_VECTORS[axis]], pivotAssemblyPosition, cutEdgeId,
          collideConnected: raw.collideConnected === true,
          maxForce, frictionTorque, limits
        });
      }
      return deepFreeze({
        resolvedLinks: resolvedLinks.sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId)),
        cutEdgeIds: [...usedCutEdges.keys()].sort(), diagnostics: Diagnostics.canonicalize(diagnostics)
      });
    }
    return Object.freeze({ compile, endpointKey, rawLinkSortKey });
  });
})();
