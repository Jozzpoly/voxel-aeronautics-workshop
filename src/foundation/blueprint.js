(() => {
  'use strict';

  window.VAW.define(
    'foundation.blueprint',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation'],
    (config, catalog, orientation) => {
      const { GRID, SAVE_VERSION, SYMMETRY_MODES, CONTROL_AXES, CONTROL_SIGNS, NEIGHBOR_DIRECTIONS } = config;
      const { BLOCKS } = catalog;

      function makeKey(x, y, z) { return `${x},${y},${z}`; }
      function clamp01(value) { return Math.max(0, Math.min(1, value)); }
      function normalizeControlAxis(value) { return CONTROL_AXES.includes(value) ? value : 'pitch'; }
      function normalizeControlSign(value) {
        const numeric = Number(value);
        return CONTROL_SIGNS.includes(numeric) ? numeric : 0;
      }
      function isWithinGrid(x, y, z) {
        return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
          x >= -GRID.halfExtent && x <= GRID.halfExtent &&
          z >= -GRID.halfExtent && z <= GRID.halfExtent &&
          y >= GRID.minY && y <= GRID.maxY;
      }

      function canonicalBlock(block) {
        return {
          x: block.x,
          y: block.y,
          z: block.z,
          type: block.type,
          orientation: block.type === 'Core' ? orientation.DEFAULT_ORIENTATION : orientation.normalizeOrientationId(block.orientation),
          controlAxis: normalizeControlAxis(block.controlAxis),
          controlSign: normalizeControlSign(block.controlSign)
        };
      }

      function sortBlocks(blocks) {
        return blocks.sort((a, b) =>
          (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type)
        );
      }

      function createDocument({ blocks, selectedBlock, selectedOrientation, symmetry, thrusterPower, balloonPower, stabilityAssist, controlAxis, controlSign }) {
        return {
          version: SAVE_VERSION,
          blocks: sortBlocks(blocks.map(canonicalBlock)),
          selectedBlock: BLOCKS[selectedBlock] && selectedBlock !== 'Core' ? selectedBlock : 'Hull',
          orientation: orientation.normalizeOrientationId(selectedOrientation),
          symmetry: SYMMETRY_MODES.includes(symmetry) ? symmetry : 'NONE',
          thrusterPower: clamp01(Number.isFinite(thrusterPower) ? thrusterPower : 0.7),
          balloonPower: clamp01(Number.isFinite(balloonPower) ? balloonPower : 0.7),
          stabilityAssist: clamp01(Number.isFinite(stabilityAssist) ? stabilityAssist : 0.18),
          controlAxis: normalizeControlAxis(controlAxis),
          controlSign: normalizeControlSign(controlSign)
        };
      }

      function clone(document) { return JSON.parse(JSON.stringify(document)); }
      function signature(document) { return JSON.stringify(document); }

      function connectedCount(blocksByKey) {
        if (!blocksByKey.has('0,0,0')) return 0;
        const visited = new Set(['0,0,0']);
        const queue = ['0,0,0'];
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const [cx, cy, cz] = queue[cursor].split(',').map(Number);
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const next = makeKey(cx + dx, cy + dy, cz + dz);
            if (blocksByKey.has(next) && !visited.has(next)) {
              visited.add(next);
              queue.push(next);
            }
          }
        }
        return visited.size;
      }

      function normalize(data) {
        if (!data || !Array.isArray(data.blocks) || data.blocks.length > GRID.maxBlocks) return null;
        const dataVersion = Number.isInteger(data.version) ? data.version : 3;
        if (dataVersion < 3 || dataVersion > SAVE_VERSION) return null;

        const normalizedByKey = new Map();
        let coreCount = 0;
        for (const raw of data.blocks) {
          if (!raw || !BLOCKS[raw.type]) return null;
          const x = Number(raw.x);
          const y = Number(raw.y);
          const z = Number(raw.z);
          if (![x, y, z].every(Number.isFinite) || ![x, y, z].every(Number.isInteger)) return null;
          if (!isWithinGrid(x, y, z)) return null;

          const key = makeKey(x, y, z);
          if (normalizedByKey.has(key)) return null;
          if (raw.type === 'Core') {
            coreCount += 1;
            if (key !== '0,0,0') return null;
          }
          normalizedByKey.set(key, {
            x, y, z,
            type: raw.type,
            orientation: orientation.normalizeSavedOrientation(raw.orientation, dataVersion, raw.type),
            controlAxis: normalizeControlAxis(raw.controlAxis),
            controlSign: normalizeControlSign(raw.controlSign)
          });
        }

        if (coreCount === 0) {
          if (normalizedByKey.has('0,0,0')) return null;
          normalizedByKey.set('0,0,0', {
            x: 0, y: 0, z: 0, type: 'Core',
            orientation: orientation.DEFAULT_ORIENTATION,
            controlAxis: 'pitch', controlSign: 0
          });
        } else if (coreCount !== 1) {
          return null;
        }

        if (connectedCount(normalizedByKey) !== normalizedByKey.size) return null;
        const selectedBlock = BLOCKS[data.selectedBlock] && data.selectedBlock !== 'Core' ? data.selectedBlock : 'Hull';
        return {
          version: dataVersion,
          blocks: sortBlocks([...normalizedByKey.values()]),
          selectedBlock,
          orientation: orientation.normalizeSavedOrientation(data.orientation, dataVersion, selectedBlock),
          symmetry: SYMMETRY_MODES.includes(data.symmetry) ? data.symmetry : 'NONE',
          thrusterPower: clamp01(typeof data.thrusterPower === 'number' ? data.thrusterPower : (typeof data.throttle === 'number' ? data.throttle : 0.7)),
          balloonPower: clamp01(typeof data.balloonPower === 'number' ? data.balloonPower : (typeof data.throttle === 'number' ? data.throttle : 0.7)),
          stabilityAssist: clamp01(typeof data.stabilityAssist === 'number' ? data.stabilityAssist : 0.18),
          controlAxis: normalizeControlAxis(data.controlAxis),
          controlSign: normalizeControlSign(data.controlSign)
        };
      }

      function trimHistory(stack, maxSnapshots, maxStoredParts) {
        let storedParts = stack.reduce((sum, blueprint) => sum + (Array.isArray(blueprint?.blocks) ? blueprint.blocks.length : 0), 0);
        while (stack.length > maxSnapshots || (storedParts > maxStoredParts && stack.length > 1)) {
          const removed = stack.shift();
          storedParts -= Array.isArray(removed?.blocks) ? removed.blocks.length : 0;
        }
        return storedParts;
      }

      return {
        makeKey, isWithinGrid, normalizeControlAxis, normalizeControlSign,
        createDocument, clone, signature, normalize, connectedCount, trimHistory
      };
    }
  );
})();
