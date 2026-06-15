(() => {
  'use strict';

  window.VAW.define(
    'foundation.craft-model',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint'],
    (config, catalog, orientation, blueprint) => {
      const { GRID, SAVE_VERSION, NEIGHBOR_DIRECTIONS } = config;
      const { BLOCKS } = catalog;

      function makeResult(ok, reason = '', details = {}) {
        return Object.freeze({ ok, reason, ...details });
      }

      function canonicalBlock(raw, usedIds = new Set()) {
        if (!raw || typeof raw !== 'object') return null;
        const x = Number(raw.x);
        const y = Number(raw.y);
        const z = Number(raw.z);
        if (![x, y, z].every(Number.isInteger)) return null;
        if (!blueprint.isWithinGrid(x, y, z)) return null;
        if (!BLOCKS[raw.type]) return null;
        const key = blueprint.makeKey(x, y, z);
        const orientationMode = BLOCKS[raw.type].orientationMode || 'none';
        const safeOrientation = orientationMode === 'none'
          ? orientation.DEFAULT_ORIENTATION
          : orientation.normalizeOrientationId(raw.orientation);
        const blockId = blueprint.allocateBlockId(raw.blockId, x, y, z, usedIds);
        return Object.freeze({
          blockId,
          key,
          x,
          y,
          z,
          type: raw.type,
          orientation: safeOrientation,
          controlAxis: blueprint.normalizeControlAxis(raw.controlAxis),
          controlSign: blueprint.normalizeControlSign(raw.controlSign)
        });
      }

      function recordEquals(a, b) {
        return !!a && !!b &&
          a.blockId === b.blockId &&
          a.x === b.x && a.y === b.y && a.z === b.z &&
          a.type === b.type && a.orientation === b.orientation &&
          a.controlAxis === b.controlAxis && a.controlSign === b.controlSign;
      }

      function connectedKeys(blocksByKey) {
        if (!(blocksByKey instanceof Map) || blocksByKey.size === 0) return new Set();
        const firstKey = blocksByKey.keys().next().value;
        const visited = new Set([firstKey]);
        const queue = [firstKey];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const current = blocksByKey.get(queue[cursor]);
          if (!current) continue;
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const nextKey = blueprint.makeKey(current.x + dx, current.y + dy, current.z + dz);
            if (blocksByKey.has(nextKey) && !visited.has(nextKey)) {
              visited.add(nextKey);
              queue.push(nextKey);
            }
          }
        }
        return visited;
      }

      function validateMap(blocksByKey, { allowEmpty = true } = {}) {
        if (!(blocksByKey instanceof Map)) return makeResult(false, 'invalid-map');
        if (blocksByKey.size === 0) return allowEmpty ? makeResult(true) : makeResult(false, 'empty-craft');
        if (blocksByKey.size > GRID.maxBlocks) return makeResult(false, 'block-limit');
        let coreCount = 0;
        const ids = new Set();
        for (const block of blocksByKey.values()) {
          if (block.type === 'Core') coreCount += 1;
          if (!blueprint.normalizeBlockId(block.blockId)) return makeResult(false, 'invalid-block-id');
          if (ids.has(block.blockId)) return makeResult(false, 'duplicate-block-id');
          ids.add(block.blockId);
        }
        if (coreCount > 1) return makeResult(false, 'multiple-cores');
        const connected = connectedKeys(blocksByKey);
        return makeResult(true, '', {
          coreCount,
          connectedCount: connected.size,
          blockCount: blocksByKey.size,
          contiguous: connected.size === blocksByKey.size
        });
      }

      function freezeList(values) { return Object.freeze([...values]); }

      function create(initialBlocks = []) {
        let blocksByKey = new Map();
        let revision = 0;
        const listeners = new Set();

        function usedIds() { return new Set([...blocksByKey.values()].map(block => block.blockId)); }
        function blockById(blockId) {
          const normalized = blueprint.normalizeBlockId(blockId);
          if (!normalized) return null;
          for (const block of blocksByKey.values()) if (block.blockId === normalized) return block;
          return null;
        }
        function resolveBlock(keyOrId) {
          if (typeof keyOrId !== 'string') return null;
          return blocksByKey.get(keyOrId) || blockById(keyOrId);
        }

        function snapshot() {
          const blocks = [...blocksByKey.values()]
            .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type) || a.blockId.localeCompare(b.blockId));
          return Object.freeze({ revision, blocks: freezeList(blocks) });
        }

        function emit(label, added = [], removed = [], updated = []) {
          revision += 1;
          const event = Object.freeze({
            label,
            revision,
            added: freezeList(added),
            removed: freezeList(removed),
            updated: freezeList(updated),
            size: blocksByKey.size
          });
          for (const listener of [...listeners]) {
            try { listener(event); }
            catch (error) { console.error('CraftModel listener failed:', error); }
          }
          return event;
        }

        function subscribe(listener) {
          if (typeof listener !== 'function') throw new TypeError('CraftModel listener must be a function.');
          listeners.add(listener);
          return () => listeners.delete(listener);
        }

        function get(keyOrX, y, z) {
          const key = typeof keyOrX === 'string' ? keyOrX : blueprint.makeKey(keyOrX, y, z);
          return blocksByKey.get(key) || null;
        }
        function getById(blockId) { return blockById(blockId); }
        function keyForId(blockId) { return blockById(blockId)?.key || null; }
        function has(keyOrX, y, z) { return !!get(keyOrX, y, z); }
        function keys() { return freezeList(blocksByKey.keys()); }
        function values() { return freezeList(blocksByKey.values()); }
        function entries() { return freezeList(blocksByKey.entries()); }
        function isContiguous() { return blocksByKey.size === 0 || connectedKeys(blocksByKey).size === blocksByKey.size; }

        function neighborCount(keyOrBlock) {
          const block = typeof keyOrBlock === 'string' ? resolveBlock(keyOrBlock) : keyOrBlock;
          if (!block) return 0;
          let count = 0;
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            if (blocksByKey.has(blueprint.makeKey(block.x + dx, block.y + dy, block.z + dz))) count += 1;
          }
          return count;
        }

        function validateAddMany(rawBlocks) {
          if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return makeResult(false, 'empty-plan');
          if (blocksByKey.size + rawBlocks.length > GRID.maxBlocks) return makeResult(false, 'block-limit');

          const additions = [];
          const proposedKeys = new Set();
          const candidate = new Map(blocksByKey);
          const ids = usedIds();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const block = canonicalBlock(raw, ids);
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key) || proposedKeys.has(block.key)) return makeResult(false, 'occupied', { key: block.key });
            proposedKeys.add(block.key);
            ids.add(block.blockId);
            additions.push(block);
            candidate.set(block.key, block);
          }
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;
          return makeResult(true, '', { additions: freezeList(additions) });
        }

        function addMany(rawBlocks, label = 'add-blocks') {
          const validation = validateAddMany(rawBlocks);
          if (!validation.ok) return validation;
          for (const block of validation.additions) blocksByKey.set(block.key, block);
          const event = emit(label, validation.additions, [], []);
          return makeResult(true, '', { event, blocks: validation.additions });
        }
        function add(rawBlock, label = 'add-block') { return addMany([rawBlock], label); }

        function validateRemove(keyOrX, y, z) {
          const block = typeof keyOrX === 'string'
            ? resolveBlock(keyOrX)
            : blocksByKey.get(blueprint.makeKey(keyOrX, y, z));
          if (!block) return makeResult(false, 'missing-block', { key: keyOrX });
          const candidate = new Map(blocksByKey);
          candidate.delete(block.key);
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;
          return makeResult(true, '', { key: block.key, block });
        }

        function remove(keyOrX, y, z, label = 'remove-block') {
          let actualLabel = label;
          let actualY = y;
          let actualZ = z;
          if (typeof keyOrX === 'string' && typeof y === 'string' && z === undefined) {
            actualLabel = y;
            actualY = undefined;
          }
          const validation = validateRemove(keyOrX, actualY, actualZ);
          if (!validation.ok) return validation;
          blocksByKey.delete(validation.key);
          const event = emit(actualLabel, [], [validation.block], []);
          return makeResult(true, '', { event, block: validation.block });
        }

        function move(keyOrId, x, y, z, label = 'move-block') {
          const before = resolveBlock(keyOrId);
          if (!before) return makeResult(false, 'missing-block');
          const targetKey = blueprint.makeKey(Number(x), Number(y), Number(z));
          if (!blueprint.isWithinGrid(Number(x), Number(y), Number(z))) return makeResult(false, 'invalid-position');
          if (targetKey !== before.key && blocksByKey.has(targetKey)) return makeResult(false, 'occupied', { key: targetKey });
          if (targetKey === before.key) return makeResult(true, 'unchanged', { event: null, block: before });
          const after = canonicalBlock({ ...before, x: Number(x), y: Number(y), z: Number(z) }, new Set());
          const candidate = new Map(blocksByKey);
          candidate.delete(before.key);
          candidate.set(after.key, after);
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;
          blocksByKey = candidate;
          const change = Object.freeze({ before, after });
          const event = emit(label, [], [], [change]);
          return makeResult(true, '', { event, block: after });
        }

        function replace(rawBlocks, label = 'replace-craft') {
          if (!Array.isArray(rawBlocks)) return makeResult(false, 'invalid-block-list');
          const candidate = new Map();
          const ids = new Set();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const block = canonicalBlock(raw, ids);
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key)) return makeResult(false, 'duplicate-position', { key: block.key });
            ids.add(block.blockId);
            candidate.set(block.key, block);
          }
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;

          const added = [];
          const removed = [];
          const updated = [];
          const previousById = new Map([...blocksByKey.values()].map(block => [block.blockId, block]));
          const nextById = new Map([...candidate.values()].map(block => [block.blockId, block]));
          for (const oldBlock of blocksByKey.values()) {
            const nextBlock = nextById.get(oldBlock.blockId);
            if (!nextBlock) removed.push(oldBlock);
            else if (!recordEquals(oldBlock, nextBlock)) updated.push(Object.freeze({ before: oldBlock, after: nextBlock }));
          }
          for (const nextBlock of candidate.values()) if (!previousById.has(nextBlock.blockId)) added.push(nextBlock);
          if (!added.length && !removed.length && !updated.length) return makeResult(true, 'unchanged', { event: null });

          blocksByKey = candidate;
          const event = emit(label, added, removed, updated);
          return makeResult(true, '', { event });
        }

        function loadDocument(rawDocument, label = 'load-document') {
          const normalized = blueprint.normalize(rawDocument);
          if (!normalized) return makeResult(false, 'invalid-document');
          const result = replace(normalized.blocks, label);
          if (!result.ok) return result;
          return makeResult(true, result.reason, { event: result.event, document: normalized });
        }

        function toDocument(settings = {}) {
          return blueprint.createDocument({
            blocks: values().map(block => ({
              blockId: block.blockId,
              x: block.x, y: block.y, z: block.z,
              type: block.type,
              orientation: block.orientation,
              controlAxis: block.controlAxis,
              controlSign: block.controlSign
            })),
            selectedBlock: settings.selectedBlock,
            selectedOrientation: settings.selectedOrientation,
            symmetry: settings.symmetry,
            thrusterPower: settings.thrusterPower,
            balloonPower: settings.balloonPower,
            stabilityAssist: settings.stabilityAssist,
            controlAxis: settings.controlAxis,
            controlSign: settings.controlSign
          });
        }

        function clear(label = 'clear-craft') {
          if (blocksByKey.size === 0) return makeResult(true, 'unchanged', { event: null });
          const removed = [...blocksByKey.values()];
          blocksByKey = new Map();
          const event = emit(label, [], removed, []);
          return makeResult(true, '', { event });
        }

        const api = {
          get, getById, keyForId, has, keys, values, entries, snapshot, subscribe,
          isContiguous, neighborCount, validateAddMany, addMany, add,
          validateRemove, remove, move, replace, loadDocument, toDocument, clear
        };
        Object.defineProperties(api, {
          size: { enumerable: true, get: () => blocksByKey.size },
          revision: { enumerable: true, get: () => revision }
        });
        Object.freeze(api);

        if (initialBlocks.length) {
          const result = replace(initialBlocks, 'initialize');
          if (!result.ok) throw new Error(`CraftModel initialization failed: ${result.reason}`);
        }
        return api;
      }

      return Object.freeze({ schemaVersion: SAVE_VERSION, canonicalBlock, connectedKeys, validateMap, create });
    }
  );
})();
