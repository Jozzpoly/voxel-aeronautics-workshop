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

      function canonicalBlock(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const x = Number(raw.x);
        const y = Number(raw.y);
        const z = Number(raw.z);
        if (![x, y, z].every(Number.isInteger)) return null;
        if (!blueprint.isWithinGrid(x, y, z)) return null;
        if (!BLOCKS[raw.type]) return null;
        const key = blueprint.makeKey(x, y, z);
        if (raw.type === 'Core' && key !== '0,0,0') return null;
        const orientationMode = BLOCKS[raw.type].orientationMode || 'none';
        const safeOrientation = orientationMode === 'none'
          ? orientation.DEFAULT_ORIENTATION
          : orientation.normalizeOrientationId(raw.orientation);
        return Object.freeze({
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
          a.x === b.x && a.y === b.y && a.z === b.z &&
          a.type === b.type && a.orientation === b.orientation &&
          a.controlAxis === b.controlAxis && a.controlSign === b.controlSign;
      }

      function connectedKeys(blocksByKey) {
        if (!blocksByKey.has('0,0,0')) return new Set();
        const visited = new Set(['0,0,0']);
        const queue = ['0,0,0'];
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

      function validateMap(blocksByKey, { allowEmpty = false } = {}) {
        if (!(blocksByKey instanceof Map)) return makeResult(false, 'invalid-map');
        if (blocksByKey.size === 0) return allowEmpty ? makeResult(true) : makeResult(false, 'missing-core');
        if (blocksByKey.size > GRID.maxBlocks) return makeResult(false, 'block-limit');
        const core = blocksByKey.get('0,0,0');
        if (!core || core.type !== 'Core') return makeResult(false, 'missing-core');
        let coreCount = 0;
        for (const block of blocksByKey.values()) {
          if (block.type === 'Core') coreCount += 1;
        }
        if (coreCount !== 1) return makeResult(false, 'invalid-core-count');
        const connected = connectedKeys(blocksByKey);
        if (connected.size !== blocksByKey.size) {
          return makeResult(false, 'disconnected', { connectedCount: connected.size, blockCount: blocksByKey.size });
        }
        return makeResult(true);
      }

      function freezeList(values) {
        return Object.freeze([...values]);
      }

      function create(initialBlocks = []) {
        let blocksByKey = new Map();
        let revision = 0;
        const listeners = new Set();

        function snapshot() {
          const blocks = [...blocksByKey.values()]
            .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type));
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
            try {
              listener(event);
            } catch (error) {
              console.error('CraftModel listener failed:', error);
            }
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

        function has(keyOrX, y, z) {
          return !!get(keyOrX, y, z);
        }

        function keys() {
          return freezeList(blocksByKey.keys());
        }

        function values() {
          return freezeList(blocksByKey.values());
        }

        function entries() {
          return freezeList(blocksByKey.entries());
        }

        function isContiguous() {
          return blocksByKey.size > 0 && connectedKeys(blocksByKey).size === blocksByKey.size;
        }

        function neighborCount(keyOrBlock) {
          const block = typeof keyOrBlock === 'string' ? blocksByKey.get(keyOrBlock) : keyOrBlock;
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
          for (const raw of rawBlocks) {
            const block = canonicalBlock(raw);
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key) || proposedKeys.has(block.key)) {
              return makeResult(false, 'occupied', { key: block.key });
            }
            proposedKeys.add(block.key);
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

        function add(rawBlock, label = 'add-block') {
          return addMany([rawBlock], label);
        }

        function validateRemove(keyOrX, y, z) {
          const key = typeof keyOrX === 'string' ? keyOrX : blueprint.makeKey(keyOrX, y, z);
          const block = blocksByKey.get(key);
          if (!block) return makeResult(false, 'missing-block', { key });
          if (block.type === 'Core') return makeResult(false, 'core-protected', { key });
          const candidate = new Map(blocksByKey);
          candidate.delete(key);
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;
          return makeResult(true, '', { key, block });
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

        function replace(rawBlocks, label = 'replace-craft') {
          if (!Array.isArray(rawBlocks)) return makeResult(false, 'invalid-block-list');
          const candidate = new Map();
          for (const raw of rawBlocks) {
            const block = canonicalBlock(raw);
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key)) return makeResult(false, 'duplicate-position', { key: block.key });
            candidate.set(block.key, block);
          }
          const validity = validateMap(candidate);
          if (!validity.ok) return validity;

          const added = [];
          const removed = [];
          const updated = [];
          for (const [key, oldBlock] of blocksByKey) {
            const nextBlock = candidate.get(key);
            if (!nextBlock) removed.push(oldBlock);
            else if (!recordEquals(oldBlock, nextBlock)) updated.push(Object.freeze({ before: oldBlock, after: nextBlock }));
          }
          for (const [key, nextBlock] of candidate) {
            if (!blocksByKey.has(key)) added.push(nextBlock);
          }
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
              x: block.x,
              y: block.y,
              z: block.z,
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
          get,
          has,
          keys,
          values,
          entries,
          snapshot,
          subscribe,
          isContiguous,
          neighborCount,
          validateAddMany,
          addMany,
          add,
          validateRemove,
          remove,
          replace,
          loadDocument,
          toDocument,
          clear
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

      return Object.freeze({
        schemaVersion: SAVE_VERSION,
        canonicalBlock,
        connectedKeys,
        validateMap,
        create
      });
    }
  );
})();
