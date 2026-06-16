(() => {
  'use strict';

  window.VAW.define('foundation.craft-compiler', [
    'foundation.config', 'foundation.catalog', 'foundation.control-frame', 'foundation.mass-properties',
    'foundation.diagnostics', 'foundation.structural-graph-compiler', 'foundation.mechanical-authoring-resolver',
    'foundation.rigid-island-compiler', 'foundation.mechanical-graph-compiler'
  ], (config, catalog, ControlFrame, MassProperties, Diagnostics, StructuralGraphCompiler, MechanicalAuthoringResolver, RigidIslandCompiler, MechanicalGraphCompiler) => {
    const { BLOCKS } = catalog; const cache = new WeakMap();
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value); for (const nested of Object.values(value)) deepFreeze(nested, seen); return Object.freeze(value);
    }
    function stableHash(text) {
      let hash = 0x811c9dc5;
      for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; }
      return hash.toString(16).padStart(8, '0');
    }
    function canonicalInput(source) {
      if (source && typeof source.snapshot === 'function' && typeof source.revision === 'number') {
        const snapshot = source.snapshot();
        return { model: source, revision: snapshot.revision, blocks: snapshot.blocks || [], mechanicalLinks: snapshot.mechanicalLinks || [] };
      }
      if (Array.isArray(source)) return { model: null, revision: -1, blocks: source, mechanicalLinks: [] };
      if (source && Array.isArray(source.blocks)) return {
        model: null, revision: Number.isInteger(source.revision) ? source.revision : -1,
        blocks: source.blocks, mechanicalLinks: Array.isArray(source.mechanicalLinks) ? source.mechanicalLinks : []
      };
      return { model: null, revision: -1, blocks: [], mechanicalLinks: [] };
    }

    function compile(source) {
      const input = canonicalInput(source);
      if (input.model) {
        const cached = cache.get(input.model);
        if (cached && cached.revision === input.revision) return cached.compiled;
      }

      const structural = StructuralGraphCompiler.compile(input.blocks);
      const authoring = MechanicalAuthoringResolver.compile(input.mechanicalLinks, structural);
      const rigid = RigidIslandCompiler.compile(structural, authoring.cutEdgeIds);
      const mechanical = MechanicalGraphCompiler.compile(authoring, rigid);
      const diagnostics = [
        ...structural.diagnostics, ...authoring.diagnostics, ...rigid.diagnostics, ...mechanical.diagnostics
      ];

      const counts = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, 0]));
      let fuelCapacity = 0; let dragArea = 0;
      for (const block of structural.blocks) {
        const definition = BLOCKS[block.type]; counts[block.type] += 1;
        fuelCapacity += Number(definition.fuelCapacity) || 0; dragArea += Number(definition.dragArea) || 0;
      }
      if (structural.blocks.length === 1) diagnostics.push(Diagnostics.create('single-block-craft', 'warning'));
      if (counts.Thruster + counts.VectorThruster + counts.Balloon === 0) diagnostics.push(Diagnostics.create('no-propulsion', 'warning'));
      if (structural.blocks.length > config.PHYSICS.maxFlightParts) diagnostics.push(Diagnostics.create('flight-part-limit', 'warning', [], { limit: config.PHYSICS.maxFlightParts }));

      const aggregateMass = MassProperties.compute(structural.blocks.map(block => ({
        id: block.blockId, mass: Number(BLOCKS[block.type].mass) || 0, center: block.assemblyPosition, halfExtents: [0.5, 0.5, 0.5]
      })));
      const parts = [...rigid.parts].sort((a, b) => {
        const pa = a.assemblyPosition; const pb = b.assemblyPosition;
        return (pa[1] - pb[1]) || (pa[0] - pb[0]) || (pa[2] - pb[2]) || a.blockId.localeCompare(b.blockId);
      }).map((part, index) => ({ ...part, index }));
      const blockIdToIndex = Object.fromEntries(parts.map((part, index) => [part.blockId, index]));
      const gridKeyToIndex = Object.fromEntries(parts.map((part, index) => [part.gridKey, index]));
      const adjacency = parts.map(part => part.rigidNeighborBlockIds.map(id => blockIdToIndex[id]).filter(Number.isInteger).sort((a, b) => a - b));
      const functionalByType = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, []]));
      parts.forEach((part, index) => functionalByType[part.type].push(index));
      const coreIndex = parts.findIndex(part => part.type === 'Core');
      const controlFrame = ControlFrame.fromCore(coreIndex >= 0 ? parts[coreIndex] : null);
      const colliderPlan = parts.map(part => ({
        colliderId: `collider:${part.blockId}`, blockId: part.blockId, bodyId: part.bodyId,
        kind: 'box', bodyLocalPosition: [...part.bodyLocalPosition], halfExtents: [0.5, 0.5, 0.5]
      }));
      const cutByEdgeId = Object.fromEntries(authoring.resolvedLinks.map(link => [link.cutEdgeId, link.mechanicalLinkId]));
      const structuralGraph = {
        blocks: structural.blocks,
        edges: structural.edges.map(edge => ({ ...edge, cutByMechanicalLinkId: cutByEdgeId[edge.edgeId] || null })),
        adjacencyByBlockId: structural.adjacencyByBlockId
      };
      const canonicalSignature = {
        blocks: structural.blocks.map(block => [block.blockId, ...block.assemblyPosition, block.type, block.orientation, block.controlAxis, block.controlSign]),
        mechanicalLinks: [...input.mechanicalLinks].map(link => ({
          mechanicalLinkId: String(link?.mechanicalLinkId ?? ''), kind: String(link?.kind ?? ''),
          endpointA: [String(link?.endpointA?.blockId ?? ''), String(link?.endpointA?.face ?? '')],
          endpointB: [String(link?.endpointB?.blockId ?? ''), String(link?.endpointB?.face ?? '')],
          axis: String(link?.axis ?? ''), collideConnected: link?.collideConnected === true,
          maxForce: Number(link?.maxForce ?? 1000000), frictionTorque: Number(link?.frictionTorque ?? 0),
          limits: link?.limits == null ? null : [
            Number(link.limits.minAngle), Number(link.limits.maxAngle), Number(link.limits.tolerance ?? 0.01),
            Number(link.limits.maxTorque ?? 80), Number(link.limits.maxSpeed ?? 5),
            Number(link.limits.positionGain ?? 16), Number(link.limits.velocityDamping ?? 1.5)
          ]
        })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      };
      const canonicalDiagnostics = Diagnostics.canonicalize(diagnostics);
      const compiled = deepFreeze({
        format: 'VAW_COMPILED_CRAFT_V4', sourceRevision: input.revision,
        signature: stableHash(JSON.stringify(canonicalSignature)),
        ready: Diagnostics.ready(canonicalDiagnostics), diagnostics: canonicalDiagnostics,
        errors: Diagnostics.codes(canonicalDiagnostics, 'error'), warnings: Diagnostics.codes(canonicalDiagnostics, 'warning'),
        blockCount: parts.length, rigidIslandCount: rigid.rigidIslands.length, mechanicalLinkCount: mechanical.constraints.length,
        rootBodyId: rigid.rootBodyId, coreIndex, coreBlockId: coreIndex >= 0 ? parts[coreIndex].blockId : null,
        coreKey: coreIndex >= 0 ? parts[coreIndex].gridKey : null,
        coreAssemblyPosition: coreIndex >= 0 ? [...parts[coreIndex].assemblyPosition] : null,
        controlFrame,
        mass: aggregateMass.mass, weight: aggregateMass.mass * config.AEROSTATICS.gravity,
        gravity: config.AEROSTATICS.gravity, fuelCapacity, dragArea,
        assemblyCenterOfMass: [...aggregateMass.centerOfMass], aggregateInertiaDiagonal: [...aggregateMass.inertiaDiagonal],
        counts, parts, blockIdToIndex, gridKeyToIndex, adjacency, functionalByType, colliderPlan,
        structuralGraph, rigidIslands: rigid.rigidIslands, mechanicalGraph: mechanical,
        blockIdToBodyId: rigid.blockIdToBodyId, bodyById: rigid.bodyById,
        rigidAdjacencyByBlockId: rigid.rigidAdjacencyByBlockId
      });
      if (input.model) cache.set(input.model, { revision: input.revision, compiled });
      return compiled;
    }
    function invalidate(model) { if (model && typeof model === 'object') cache.delete(model); }
    return Object.freeze({ compile, invalidate, stableHash });
  });
})();
