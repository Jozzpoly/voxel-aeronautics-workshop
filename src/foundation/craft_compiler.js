(() => {
  'use strict';

  window.VAW.define('foundation.craft-compiler', [
    'foundation.config', 'foundation.catalog', 'foundation.control-frame', 'foundation.mass-properties',
    'foundation.diagnostics', 'foundation.structural-graph-compiler', 'foundation.mechanical-authoring-resolver',
    'foundation.rigid-island-compiler', 'foundation.mechanical-graph-compiler', 'foundation.assembly-spaces'
  ], (config, catalog, ControlFrame, MassProperties, Diagnostics, StructuralGraphCompiler, MechanicalAuthoringResolver, RigidIslandCompiler, MechanicalGraphCompiler, AssemblySpaces) => {
    const { BLOCKS } = catalog;
    const cache = new WeakMap();

    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }
    function avalanche32(value) {
      let hash = value >>> 0;
      hash ^= hash >>> 16;
      hash = Math.imul(hash, 0x85ebca6b) >>> 0;
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
      hash ^= hash >>> 16;
      return hash >>> 0;
    }
    function stableHash(text) {
      const source = String(text);
      let a = 0x811c9dc5;
      let b = 0x9e3779b9;
      let c = 0x85ebca6b;
      for (let index = 0; index < source.length; index += 1) {
        const code = source.charCodeAt(index);
        a = Math.imul(a ^ code, 0x01000193) >>> 0;
        b = Math.imul(b ^ (code + index), 0x27d4eb2d) >>> 0;
        c = Math.imul(c ^ (code + (index << 8)), 0x165667b1) >>> 0;
      }
      const words = [avalanche32(a ^ source.length), avalanche32(b ^ a), avalanche32(c ^ b)];
      return words.map(word => word.toString(16).padStart(8, '0')).join('');
    }
    function canonicalInput(source) {
      if (source && typeof source.snapshot === 'function' && typeof source.revision === 'number') {
        const snapshot = source.snapshot();
        return {
          model: source,
          revision: snapshot.revision,
          version: config.SAVE_VERSION,
          blocks: snapshot.blocks || [],
          mechanicalLinks: snapshot.mechanicalLinks || [],
          assemblySpaces: snapshot.assemblySpaces,
          strictOwnership: true
        };
      }
      if (Array.isArray(source)) {
        return {
          model: null,
          revision: -1,
          version: null,
          blocks: source,
          mechanicalLinks: [],
          assemblySpaces: [AssemblySpaces.createRootSpace()],
          strictOwnership: false
        };
      }
      if (source && Array.isArray(source.blocks)) {
        const isStrictV12 = Number(source.version) >= 12;
        const hasSpaces = Array.isArray(source.assemblySpaces);
        return {
          model: null,
          revision: Number.isInteger(source.revision) ? source.revision : -1,
          version: Number.isInteger(source.version) ? source.version : null,
          blocks: source.blocks,
          mechanicalLinks: Array.isArray(source.mechanicalLinks) ? source.mechanicalLinks : [],
          assemblySpaces: isStrictV12 ? source.assemblySpaces : (hasSpaces ? source.assemblySpaces : [AssemblySpaces.createRootSpace()]),
          strictOwnership: hasSpaces || isStrictV12
        };
      }
      return {
        model: null,
        revision: -1,
        version: null,
        blocks: [],
        mechanicalLinks: [],
        assemblySpaces: [AssemblySpaces.createRootSpace()],
        strictOwnership: false
      };
    }

    function compile(source) {
      const input = canonicalInput(source);
      if (input.model) {
        const cached = cache.get(input.model);
        if (cached && cached.revision === input.revision) return cached.compiled;
      }

      const structural = StructuralGraphCompiler.compile(input.blocks, input.assemblySpaces, { strictOwnership: input.strictOwnership });
      const authoring = MechanicalAuthoringResolver.compile(input.mechanicalLinks, structural, { strictOwnership: input.strictOwnership });
      const rigid = RigidIslandCompiler.compile(structural, authoring.cutEdgeIds);
      const mechanical = MechanicalGraphCompiler.compile(authoring, rigid);
      const diagnostics = [...structural.diagnostics, ...authoring.diagnostics, ...rigid.diagnostics, ...mechanical.diagnostics];

      const counts = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, 0]));
      let fuelCapacity = 0;
      let dragArea = 0;
      for (const block of structural.blocks) {
        const definition = BLOCKS[block.type];
        counts[block.type] += 1;
        fuelCapacity += Number(definition.fuelCapacity) || 0;
        dragArea += Number(definition.dragArea) || 0;
      }
      if (structural.blocks.length === 1) diagnostics.push(Diagnostics.create('single-block-craft', 'warning'));
      if (counts.Thruster + counts.VectorThruster + counts.Balloon === 0) diagnostics.push(Diagnostics.create('no-propulsion', 'warning'));
      if (structural.blocks.length > config.PHYSICS.maxFlightParts) diagnostics.push(Diagnostics.create('flight-part-limit', 'warning', [], { limit: config.PHYSICS.maxFlightParts }));

      const aggregateMass = MassProperties.compute(structural.blocks.map(block => ({
        id: block.blockId,
        mass: Number(BLOCKS[block.type].mass) || 0,
        center: block.assemblyPosition,
        halfExtents: [0.5, 0.5, 0.5]
      })));
      const parts = [...rigid.parts].sort((a, b) => {
        const pa = a.assemblyPosition; const pb = b.assemblyPosition;
        return (pa[1] - pb[1]) || (pa[0] - pb[0]) || (pa[2] - pb[2]) || a.blockId.localeCompare(b.blockId);
      }).map((part, index) => ({ ...part, index }));
      const blockIdToIndex = Object.fromEntries(parts.map((part, index) => [part.blockId, index]));
      const gridKeyToIndex = Object.fromEntries(parts.map((part, index) => [part.gridKey, index]));
      const blockIdToAssemblySpaceId = Object.fromEntries(parts.map(part => [part.blockId, part.assemblySpaceId]));
      const adjacency = parts.map(part => part.rigidNeighborBlockIds.map(id => blockIdToIndex[id]).filter(Number.isInteger).sort((a, b) => a - b));
      const functionalByType = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, []]));
      parts.forEach((part, index) => functionalByType[part.type].push(index));
      const coreIndex = parts.findIndex(part => part.type === 'Core');
      const controlFrame = ControlFrame.fromCore(coreIndex >= 0 ? parts[coreIndex] : null);
      const colliderPlan = parts.map(part => ({
        colliderId: `collider:${part.blockId}`,
        blockId: part.blockId,
        bodyId: part.bodyId,
        assemblySpaceId: part.assemblySpaceId,
        kind: 'box',
        bodyLocalPosition: [...part.bodyLocalPosition],
        halfExtents: [0.5, 0.5, 0.5]
      }));
      const cutByEdgeId = Object.fromEntries(authoring.resolvedLinks.filter(link => link.cutEdgeId).map(link => [link.cutEdgeId, link.mechanicalLinkId]));
      const structuralGraph = {
        blocks: structural.blocks,
        edges: structural.edges.map(edge => ({ ...edge, cutByMechanicalLinkId: cutByEdgeId[edge.edgeId] || null })),
        adjacencyByBlockId: structural.adjacencyByBlockId
      };
      const canonicalSignature = {
        assemblySpaces: structural.assemblySpaces.map(space => [
          space.assemblySpaceId,
          space.parentAssemblySpaceId,
          [...space.localPose.position],
          [...space.localPose.quaternion]
        ]),
        blocks: structural.blocks.map(block => [
          block.blockId,
          block.assemblySpaceId,
          ...block.spaceLocalPosition,
          block.type,
          block.orientation,
          block.controlAxis,
          block.controlSign
        ]),
        mechanicalLinks: authoring.resolvedLinks.map(link => ({
          mechanicalLinkId: link.mechanicalLinkId,
          assemblySpaceId: link.assemblySpaceId,
          kind: link.kind,
          endpointA: [link.endpointA.blockId, link.endpointA.face],
          endpointB: [link.endpointB.blockId, link.endpointB.face],
          axis: link.axis,
          collideConnected: link.collideConnected,
          maxForce: link.maxForce,
          frictionTorque: link.frictionTorque,
          limits: link.limits == null ? null : [
            link.limits.minAngle, link.limits.maxAngle, link.limits.tolerance,
            link.limits.maxTorque, link.limits.maxSpeed,
            link.limits.positionGain, link.limits.velocityDamping
          ]
        }))
      };
      const canonicalDiagnostics = Diagnostics.canonicalize(diagnostics);
      const compiled = deepFreeze({
        format: 'VAW_COMPILED_CRAFT_V5',
        sourceRevision: input.revision,
        sourceBlueprintVersion: input.version,
        signature: stableHash(JSON.stringify(canonicalSignature)),
        ready: Diagnostics.ready(canonicalDiagnostics),
        diagnostics: canonicalDiagnostics,
        errors: Diagnostics.codes(canonicalDiagnostics, 'error'),
        warnings: Diagnostics.codes(canonicalDiagnostics, 'warning'),
        blockCount: parts.length,
        rigidIslandCount: rigid.rigidIslands.length,
        mechanicalLinkCount: mechanical.constraints.length,
        assemblySpaceCount: structural.assemblySpaces.length,
        rootAssemblySpaceId: AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
        rootBodyId: rigid.rootBodyId,
        coreIndex,
        coreBlockId: coreIndex >= 0 ? parts[coreIndex].blockId : null,
        coreKey: coreIndex >= 0 ? parts[coreIndex].gridKey : null,
        coreAssemblySpaceId: coreIndex >= 0 ? parts[coreIndex].assemblySpaceId : null,
        coreAssemblyPosition: coreIndex >= 0 ? [...parts[coreIndex].assemblyPosition] : null,
        controlFrame,
        mass: aggregateMass.mass,
        weight: aggregateMass.mass * config.AEROSTATICS.gravity,
        gravity: config.AEROSTATICS.gravity,
        fuelCapacity,
        dragArea,
        assemblyCenterOfMass: [...aggregateMass.centerOfMass],
        aggregateInertiaDiagonal: [...aggregateMass.inertiaDiagonal],
        counts,
        parts,
        blockIdToIndex,
        gridKeyToIndex,
        adjacency,
        functionalByType,
        colliderPlan,
        structuralGraph,
        rigidIslands: rigid.rigidIslands,
        mechanicalGraph: mechanical,
        assemblySpaces: structural.assemblySpaces,
        assemblySpaceById: structural.assemblySpaceById,
        assemblySpaceRootPoses: structural.assemblySpaceRootPoses,
        blockIdToAssemblySpaceId,
        bodyIdToAssemblySpaceId: rigid.bodyIdToAssemblySpaceId,
        blockIdToBodyId: rigid.blockIdToBodyId,
        bodyById: rigid.bodyById,
        rigidAdjacencyByBlockId: rigid.rigidAdjacencyByBlockId
      });
      if (input.model) cache.set(input.model, { revision: input.revision, compiled });
      return compiled;
    }

    function invalidate(model) { if (model && typeof model === 'object') cache.delete(model); }
    return Object.freeze({ compile, invalidate, stableHash });
  });
})();
