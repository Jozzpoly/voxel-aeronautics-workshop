(() => {
  'use strict';

  window.VAW.define('foundation.rigid-island-compiler', [
    'foundation.catalog', 'foundation.mass-properties', 'foundation.diagnostics', 'foundation.transform-math'
  ], (catalog, MassProperties, Diagnostics, TransformMath) => {
    const { BLOCKS } = catalog;
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function scale(a, value) { return [a[0] * value, a[1] * value, a[2] * value]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

    function compile(structuralGraph, cutEdgeIds = []) {
      const diagnostics = [];
      const cuts = new Set(cutEdgeIds);
      const rigidAdjacency = Object.create(null);
      for (const block of structuralGraph.blocks) rigidAdjacency[block.blockId] = [];
      for (const edge of structuralGraph.edges) {
        if (cuts.has(edge.edgeId)) continue;
        rigidAdjacency[edge.blockAId].push(edge.blockBId);
        rigidAdjacency[edge.blockBId].push(edge.blockAId);
      }
      for (const id of Object.keys(rigidAdjacency)) rigidAdjacency[id].sort();

      const components = [];
      const visited = new Set();
      for (const block of structuralGraph.blocks) {
        if (visited.has(block.blockId)) continue;
        const queue = [block.blockId];
        visited.add(block.blockId);
        const ids = [];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const id = queue[cursor];
          ids.push(id);
          for (const neighbor of rigidAdjacency[id]) if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
        ids.sort();
        components.push(ids);
      }
      components.sort((a, b) => a[0].localeCompare(b[0]));

      const coreBlocks = structuralGraph.blocks.filter(block => block.type === 'Core');
      if (!coreBlocks.length) diagnostics.push(Diagnostics.create('missing-core'));
      if (coreBlocks.length > 1) diagnostics.push(Diagnostics.create('multiple-cores', 'error', coreBlocks.map(block => ({ kind: 'block', id: block.blockId }))));
      const coreId = coreBlocks.length === 1 ? coreBlocks[0].blockId : null;

      const rigidIslands = [];
      const blockIdToBodyId = Object.create(null);
      const bodyIdToAssemblySpaceId = Object.create(null);
      const bodyById = Object.create(null);
      const parts = [];
      for (const blockIds of components) {
        const anchorBlockId = coreId && blockIds.includes(coreId) ? coreId : blockIds[0];
        const bodyId = `body:${anchorBlockId}`;
        const blocks = blockIds.map(id => structuralGraph.blockById[id]);
        const assemblySpaceIds = [...new Set(blocks.map(block => block.assemblySpaceId))];
        if (assemblySpaceIds.length !== 1) {
          diagnostics.push(Diagnostics.create('assembly-space-rigid-island-mixed-ownership', 'error', [
            { kind: 'body', id: bodyId }, ...blockIds.map(id => ({ kind: 'block', id }))
          ], { assemblySpaceIds }));
          continue;
        }
        const assemblySpaceId = assemblySpaceIds[0];
        const massProperties = MassProperties.compute(blocks.map(block => ({
          id: block.blockId,
          mass: Number(BLOCKS[block.type].mass) || 0,
          center: block.spaceLocalPosition,
          halfExtents: [0.5, 0.5, 0.5]
        })));
        const spaceLocalCenterOfMass = [...massProperties.centerOfMass];
        const bodyPoseInSpace = { position: spaceLocalCenterOfMass, quaternion: [0, 0, 0, 1] };
        const assemblyPose = TransformMath.composePose(structuralGraph.assemblySpaceRootPoses[assemblySpaceId], bodyPoseInSpace);
        const role = coreId && blockIds.includes(coreId) ? 'root' : 'subassembly';
        const islandParts = [];
        for (const block of blocks) {
          const definition = BLOCKS[block.type];
          const bodyLocalPosition = sub(block.spaceLocalPosition, spaceLocalCenterOfMass);
          const fullForceBodyLocal = (block.type === 'Thruster' || block.type === 'VectorThruster')
            ? scale(block.basis.forward, Number(definition.force) || 0)
            : [0, 0, 0];
          const localTorqueBody = cross(bodyLocalPosition, fullForceBodyLocal);
          const part = {
            blockId: block.blockId,
            bodyId,
            assemblySpaceId,
            gridKey: block.gridKey,
            localGridKey: block.localGridKey,
            spaceLocalPosition: [...block.spaceLocalPosition],
            assemblyPosition: [...block.assemblyPosition],
            bodyLocalPosition,
            type: block.type,
            orientation: block.orientation,
            controlAxis: block.controlAxis,
            controlSign: block.controlSign,
            basis: block.basis,
            assemblyBasis: block.assemblyBasis,
            mass: Number(definition.mass) || 0,
            fullForceBodyLocal,
            localTorqueBody,
            rigidNeighborBlockIds: [...rigidAdjacency[block.blockId]],
            properties: {
              force: Number(definition.force) || 0,
              fuelRate: Number(definition.fuelRate) || 0,
              fuelCapacity: Number(definition.fuelCapacity) || 0,
              wingArea: Number(definition.wingArea) || 0,
              dragArea: Number(definition.dragArea) || 0,
              durability: Number(definition.durability) || 60,
              structural: Number(definition.structural) || 0
            }
          };
          blockIdToBodyId[block.blockId] = bodyId;
          islandParts.push(part);
          parts.push(part);
        }
        const island = {
          bodyId,
          assemblySpaceId,
          anchorBlockId,
          role,
          blockIds: [...blockIds],
          bodyPoseInSpace,
          assemblyPose,
          sourceSpaceLocalCenterOfMass: spaceLocalCenterOfMass,
          sourceAssemblyCenterOfMass: [...assemblyPose.position],
          massProperties: {
            mass: massProperties.mass,
            centerOfMass: [0, 0, 0],
            inertiaDiagonal: [...massProperties.inertiaDiagonal]
          },
          parts: islandParts
        };
        rigidIslands.push(island);
        bodyById[bodyId] = island;
        bodyIdToAssemblySpaceId[bodyId] = assemblySpaceId;
      }
      rigidIslands.sort((a, b) => a.bodyId.localeCompare(b.bodyId));
      parts.sort((a, b) => a.blockId.localeCompare(b.blockId));
      const rootBodyId = coreId ? blockIdToBodyId[coreId] : null;
      return deepFreeze({
        rigidIslands,
        bodyById,
        rootBodyId,
        blockIdToBodyId,
        bodyIdToAssemblySpaceId,
        rigidAdjacencyByBlockId: rigidAdjacency,
        parts,
        diagnostics: Diagnostics.canonicalize(diagnostics)
      });
    }

    return Object.freeze({ compile });
  });
})();
