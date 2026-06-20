(() => {
  'use strict';

  window.VAW.define('foundation.structural-graph-compiler', [
    'foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint',
    'foundation.diagnostics', 'foundation.assembly-spaces', 'foundation.transform-math'
  ], (config, catalog, orientation, blueprint, Diagnostics, AssemblySpaces, TransformMath) => {
    const { GRID } = config;
    const { BLOCKS } = catalog;
    const POSITIVE_FACES = Object.freeze(['PX', 'PY', 'PZ']);

    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }
    function edgeKey(blockAId, blockBId) {
      const [a, b] = [String(blockAId), String(blockBId)].sort();
      return `structural:${a}|${b}`;
    }
    function directionFace(dx, dy, dz) {
      if (dx === 1) return 'PX'; if (dx === -1) return 'NX';
      if (dy === 1) return 'PY'; if (dy === -1) return 'NY';
      if (dz === 1) return 'PZ'; if (dz === -1) return 'NZ';
      return null;
    }
    function basisValues(orientationId) {
      const basis = orientation.ORIENTATION_BASES[orientation.normalizeOrientationId(orientationId)];
      return {
        forward: [basis.forward.x, basis.forward.y, basis.forward.z],
        up: [basis.up.x, basis.up.y, basis.up.z],
        span: [basis.span.x, basis.span.y, basis.span.z]
      };
    }
    function rotateBasis(quaternion, basis) {
      return {
        forward: TransformMath.rotateVector(quaternion, basis.forward),
        up: TransformMath.rotateVector(quaternion, basis.up),
        span: TransformMath.rotateVector(quaternion, basis.span)
      };
    }

    function compile(rawBlocks, rawSpaces = null, options = {}) {
      const diagnostics = [];
      const blocks = [];
      const byGrid = new Map();
      const byId = new Map();
      const strictOwnership = options.strictOwnership === true;
      const indexedSpaces = AssemblySpaces.validateAndIndex(rawSpaces, { allowDefaultRoot: !strictOwnership });
      if (!indexedSpaces.ok) {
        for (const item of indexedSpaces.diagnostics) {
          diagnostics.push(Diagnostics.create(
            item.code,
            'error',
            item.id ? [{ kind: 'assembly-space', id: item.id }] : [],
            item
          ));
        }
      }
      const fallbackRoot = AssemblySpaces.createRootSpace();
      const spaces = indexedSpaces.ok ? indexedSpaces.spaces : [fallbackRoot];
      const spacesById = indexedSpaces.ok ? indexedSpaces.byId : { [AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID]: fallbackRoot };
      const rootPoses = indexedSpaces.ok ? indexedSpaces.rootPoses : { [AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID]: AssemblySpaces.IDENTITY_POSE };
      const source = Array.isArray(rawBlocks) ? rawBlocks : [];
      if (source.length > GRID.maxBlocks) diagnostics.push(Diagnostics.create('block-limit', 'error', [], { limit: GRID.maxBlocks, count: source.length }));

      for (let sourceIndex = 0; sourceIndex < Math.min(source.length, GRID.maxBlocks); sourceIndex += 1) {
        const raw = source[sourceIndex];
        const x = Number(raw?.x); const y = Number(raw?.y); const z = Number(raw?.z);
        const blockId = blueprint.normalizeBlockId(raw?.blockId);
        const entities = blockId ? [{ kind: 'block', id: blockId }] : [];
        if (!raw || !BLOCKS[raw.type] || ![x, y, z].every(Number.isInteger) || !blueprint.isWithinGrid(x, y, z)) {
          diagnostics.push(Diagnostics.create('invalid-block', 'error', entities, { sourceIndex }));
          continue;
        }
        if (!blockId) {
          diagnostics.push(Diagnostics.create('invalid-block-id', 'error', [], { sourceIndex }));
          continue;
        }
        const requestedSpaceId = blueprint.normalizeAssemblySpaceId(raw.assemblySpaceId);
        if (strictOwnership && !requestedSpaceId) {
          diagnostics.push(Diagnostics.create('assembly-space-missing-block-owner', 'error', entities, { sourceIndex }));
          continue;
        }
        const assemblySpaceId = requestedSpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
        if (!spacesById[assemblySpaceId]) {
          diagnostics.push(Diagnostics.create('assembly-space-orphan-block', 'error', [
            ...entities, { kind: 'assembly-space', id: assemblySpaceId }
          ], { sourceIndex }));
          continue;
        }
        const gridKey = blueprint.makeOwnedKey(assemblySpaceId, x, y, z);
        if (byGrid.has(gridKey)) {
          diagnostics.push(Diagnostics.create('duplicate-position', 'error', [
            { kind: 'block', id: byGrid.get(gridKey).blockId }, { kind: 'block', id: blockId }
          ], { gridKey, assemblySpaceId }));
          continue;
        }
        if (byId.has(blockId)) {
          diagnostics.push(Diagnostics.create('duplicate-block-id', 'error', [{ kind: 'block', id: blockId }]));
          continue;
        }
        const orientationMode = BLOCKS[raw.type].orientationMode || 'none';
        const orientationId = orientationMode === 'none' ? orientation.DEFAULT_ORIENTATION : orientation.normalizeOrientationId(raw.orientation);
        const basis = basisValues(orientationId);
        const spaceRootPose = rootPoses[assemblySpaceId];
        const block = {
          blockId,
          assemblySpaceId,
          gridKey,
          localGridKey: blueprint.makeKey(x, y, z),
          x, y, z,
          spaceLocalPosition: [x, y, z],
          assemblyPosition: TransformMath.transformPoint(spaceRootPose, [x, y, z]),
          type: raw.type,
          orientation: orientationId,
          controlAxis: blueprint.normalizeControlAxis(raw.controlAxis),
          controlSign: blueprint.normalizeControlSign(raw.controlSign),
          basis,
          assemblyBasis: rotateBasis(spaceRootPose.quaternion, basis)
        };
        blocks.push(block);
        byGrid.set(gridKey, block);
        byId.set(blockId, block);
      }

      blocks.sort((a, b) => a.assemblySpaceId.localeCompare(b.assemblySpaceId)
        || (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.blockId.localeCompare(b.blockId));
      if (!blocks.length) diagnostics.push(Diagnostics.create('empty-craft'));

      const edges = [];
      const edgeByBlockPair = Object.create(null);
      const adjacencyByBlockId = Object.create(null);
      for (const block of blocks) adjacencyByBlockId[block.blockId] = [];
      for (const block of blocks) {
        for (const face of POSITIVE_FACES) {
          const [dx, dy, dz] = blueprint.FACE_VECTORS[face];
          const neighbor = byGrid.get(blueprint.makeOwnedKey(block.assemblySpaceId, block.x + dx, block.y + dy, block.z + dz));
          if (!neighbor) continue;
          const id = edgeKey(block.blockId, neighbor.blockId);
          const blockAFirst = block.blockId.localeCompare(neighbor.blockId) <= 0;
          const faceFromBlock = directionFace(dx, dy, dz);
          const edge = {
            edgeId: id,
            assemblySpaceId: block.assemblySpaceId,
            blockAId: blockAFirst ? block.blockId : neighbor.blockId,
            blockBId: blockAFirst ? neighbor.blockId : block.blockId,
            faceA: blockAFirst ? faceFromBlock : blueprint.OPPOSITE_FACE[faceFromBlock],
            faceB: blockAFirst ? blueprint.OPPOSITE_FACE[faceFromBlock] : faceFromBlock
          };
          edges.push(edge);
          edgeByBlockPair[id] = edge;
          adjacencyByBlockId[block.blockId].push(neighbor.blockId);
          adjacencyByBlockId[neighbor.blockId].push(block.blockId);
        }
      }
      edges.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
      for (const id of Object.keys(adjacencyByBlockId)) adjacencyByBlockId[id].sort();
      const blockById = Object.fromEntries(blocks.map(block => [block.blockId, block]));
      const gridKeyToBlockId = Object.fromEntries(blocks.map(block => [block.gridKey, block.blockId]));
      return deepFreeze({
        assemblySpaces: spaces,
        assemblySpaceIndex: indexedSpaces.ok ? indexedSpaces : null,
        assemblySpaceById: spacesById,
        assemblySpaceRootPoses: rootPoses,
        blocks,
        edges,
        blockById,
        gridKeyToBlockId,
        edgeByBlockPair,
        adjacencyByBlockId,
        diagnostics: Diagnostics.canonicalize(diagnostics)
      });
    }

    return Object.freeze({ compile, edgeKey, directionFace });
  });
})();
