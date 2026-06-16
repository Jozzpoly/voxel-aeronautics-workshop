(() => {
  'use strict';

  window.VAW.define('foundation.structural-graph-compiler', [
    'foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint', 'foundation.diagnostics'
  ], (config, catalog, orientation, blueprint, Diagnostics) => {
    const { GRID } = config; const { BLOCKS } = catalog;
    const POSITIVE_FACES = Object.freeze(['PX', 'PY', 'PZ']);

    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value); for (const nested of Object.values(value)) deepFreeze(nested, seen); return Object.freeze(value);
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

    function compile(rawBlocks) {
      const diagnostics = []; const blocks = []; const byGrid = new Map(); const byId = new Map();
      const source = Array.isArray(rawBlocks) ? rawBlocks : [];
      if (source.length > GRID.maxBlocks) diagnostics.push(Diagnostics.create('block-limit', 'error', [], { limit: GRID.maxBlocks, count: source.length }));
      for (let index = 0; index < Math.min(source.length, GRID.maxBlocks); index += 1) {
        const raw = source[index]; const x = Number(raw?.x); const y = Number(raw?.y); const z = Number(raw?.z);
        const blockId = blueprint.normalizeBlockId(raw?.blockId);
        const entities = blockId ? [{ kind: 'block', id: blockId }] : [];
        if (!raw || !BLOCKS[raw.type] || ![x, y, z].every(Number.isInteger) || !blueprint.isWithinGrid(x, y, z)) {
          diagnostics.push(Diagnostics.create('invalid-block', 'error', entities, { sourceIndex: index })); continue;
        }
        if (!blockId) { diagnostics.push(Diagnostics.create('invalid-block-id', 'error', [], { sourceIndex: index })); continue; }
        const gridKey = blueprint.makeKey(x, y, z);
        if (byGrid.has(gridKey)) {
          diagnostics.push(Diagnostics.create('duplicate-position', 'error', [
            { kind: 'block', id: byGrid.get(gridKey).blockId }, { kind: 'block', id: blockId }
          ], { gridKey })); continue;
        }
        if (byId.has(blockId)) {
          diagnostics.push(Diagnostics.create('duplicate-block-id', 'error', [{ kind: 'block', id: blockId }])); continue;
        }
        const orientationMode = BLOCKS[raw.type].orientationMode || 'none';
        const orientationId = orientationMode === 'none' ? orientation.DEFAULT_ORIENTATION : orientation.normalizeOrientationId(raw.orientation);
        const block = {
          blockId, gridKey, x, y, z, assemblyPosition: [x, y, z], type: raw.type,
          orientation: orientationId,
          controlAxis: blueprint.normalizeControlAxis(raw.controlAxis), controlSign: blueprint.normalizeControlSign(raw.controlSign),
          basis: basisValues(orientationId)
        };
        blocks.push(block); byGrid.set(gridKey, block); byId.set(blockId, block);
      }
      blocks.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.blockId.localeCompare(b.blockId));
      if (!blocks.length) diagnostics.push(Diagnostics.create('empty-craft'));
      const edges = []; const edgeByBlockPair = Object.create(null); const adjacencyByBlockId = Object.create(null);
      for (const block of blocks) adjacencyByBlockId[block.blockId] = [];
      for (const block of blocks) {
        for (const face of POSITIVE_FACES) {
          const [dx, dy, dz] = blueprint.FACE_VECTORS[face];
          const neighbor = byGrid.get(blueprint.makeKey(block.x + dx, block.y + dy, block.z + dz));
          if (!neighbor) continue;
          const id = edgeKey(block.blockId, neighbor.blockId);
          const blockAFirst = block.blockId.localeCompare(neighbor.blockId) <= 0;
          const faceFromBlock = directionFace(dx, dy, dz);
          const edge = {
            edgeId: id,
            blockAId: blockAFirst ? block.blockId : neighbor.blockId,
            blockBId: blockAFirst ? neighbor.blockId : block.blockId,
            faceA: blockAFirst ? faceFromBlock : blueprint.OPPOSITE_FACE[faceFromBlock],
            faceB: blockAFirst ? blueprint.OPPOSITE_FACE[faceFromBlock] : faceFromBlock
          };
          edges.push(edge); edgeByBlockPair[id] = edge;
          adjacencyByBlockId[block.blockId].push(neighbor.blockId);
          adjacencyByBlockId[neighbor.blockId].push(block.blockId);
        }
      }
      edges.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
      for (const id of Object.keys(adjacencyByBlockId)) adjacencyByBlockId[id].sort();
      const blockById = Object.fromEntries(blocks.map(block => [block.blockId, block]));
      const gridKeyToBlockId = Object.fromEntries(blocks.map(block => [block.gridKey, block.blockId]));
      return deepFreeze({
        blocks, edges, blockById, gridKeyToBlockId, edgeByBlockPair, adjacencyByBlockId,
        diagnostics: Diagnostics.canonicalize(diagnostics)
      });
    }

    return Object.freeze({ compile, edgeKey, directionFace });
  });
})();
