(() => {
  'use strict';

  window.VAW.define(
    'foundation.craft-model',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint'],
    (config, catalog, orientation, blueprint) => {
      const { GRID, SAVE_VERSION, NEIGHBOR_DIRECTIONS } = config;
      const { BLOCKS } = catalog;

      function makeResult(ok, reason = '', details = {}) { return Object.freeze({ ok, reason, ...details }); }
      function freezeList(values) { return Object.freeze([...values]); }

      function canonicalBlock(raw, usedIds = new Set(), options = {}) {
        const canonical = blueprint.canonicalBlock(raw, usedIds, { strictId: options.strictId === true });
        if (!canonical) return null;
        return Object.freeze({ ...canonical, key: blueprint.makeKey(canonical.x, canonical.y, canonical.z) });
      }

      function canonicalMechanicalLink(raw, usedIds = new Set()) {
        const canonical = blueprint.canonicalMechanicalLink(raw, usedIds, { strictId: true });
        return canonical ? Object.freeze({
          ...canonical,
          endpointA: Object.freeze({ ...canonical.endpointA }),
          endpointB: Object.freeze({ ...canonical.endpointB }),
          limits: canonical.limits ? Object.freeze({ ...canonical.limits }) : null
        }) : null;
      }

      function recordEquals(a, b) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }

      function connectedKeys(blocksByKey) {
        if (!(blocksByKey instanceof Map) || blocksByKey.size === 0) return new Set();
        const firstKey = blocksByKey.keys().next().value;
        const visited = new Set([firstKey]); const queue = [firstKey];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const current = blocksByKey.get(queue[cursor]);
          if (!current) continue;
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const nextKey = blueprint.makeKey(current.x + dx, current.y + dy, current.z + dz);
            if (blocksByKey.has(nextKey) && !visited.has(nextKey)) { visited.add(nextKey); queue.push(nextKey); }
          }
        }
        return visited;
      }

      function validateMap(blocksByKey, { allowEmpty = true } = {}) {
        if (!(blocksByKey instanceof Map)) return makeResult(false, 'invalid-map');
        if (blocksByKey.size === 0) return allowEmpty ? makeResult(true) : makeResult(false, 'empty-craft');
        if (blocksByKey.size > GRID.maxBlocks) return makeResult(false, 'block-limit');
        let coreCount = 0; const ids = new Set();
        for (const block of blocksByKey.values()) {
          if (block.type === 'Core') coreCount += 1;
          if (!blueprint.normalizeBlockId(block.blockId)) return makeResult(false, 'invalid-block-id');
          if (ids.has(block.blockId)) return makeResult(false, 'duplicate-block-id');
          ids.add(block.blockId);
        }
        if (coreCount > 1) return makeResult(false, 'multiple-cores');
        const connected = connectedKeys(blocksByKey);
        return makeResult(true, '', { coreCount, connectedCount: connected.size, blockCount: blocksByKey.size, contiguous: connected.size === blocksByKey.size });
      }

      function create(initial = [], options = {}) {
        let blocksByKey = new Map();
        let blocksById = new Map();
        let mechanicalLinksById = new Map();
        let revision = 0;
        const listeners = new Set();
        let generatedLinkCounter = 0;
        let generatedBlockCounter = 0;
        const externalAllocator = typeof options.idAllocator === 'function' ? options.idAllocator : null;

        function allocateAuthoringId(kind, used) {
          if (externalAllocator) {
            const value = externalAllocator(kind, freezeList(used));
            const normalized = blueprint.normalizeEntityId(value);
            if (!normalized || used.has(normalized)) throw new Error(`Injected ${kind} id allocator returned an invalid or duplicate id.`);
            return normalized;
          }
          const prefix = kind === 'mechanical-link' ? 'mechanical:hinge' : 'block:copy';
          let candidate;
          do {
            if (kind === 'mechanical-link') generatedLinkCounter += 1;
            else generatedBlockCounter += 1;
            candidate = `${prefix}:${kind === 'mechanical-link' ? generatedLinkCounter : generatedBlockCounter}`;
          } while (used.has(candidate));
          return candidate;
        }

        function rebuildBlockIdIndex(map = blocksByKey) {
          const index = new Map();
          for (const block of map.values()) index.set(block.blockId, block);
          return index;
        }
        function usedBlockIds() { return new Set(blocksById.keys()); }
        function usedLinkIds() { return new Set(mechanicalLinksById.keys()); }
        function blockById(blockId) { return blocksById.get(String(blockId)) || null; }
        function resolveBlock(keyOrId) {
          if (typeof keyOrId !== 'string') return null;
          return blocksByKey.get(keyOrId) || blockById(keyOrId);
        }
        function linksForBlock(blockId) {
          const id = String(blockId);
          return freezeList([...mechanicalLinksById.values()]
            .filter(link => link.endpointA.blockId === id || link.endpointB.blockId === id)
            .sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId)));
        }

        function snapshot() {
          const blocks = [...blocksByKey.values()].sort((a, b) =>
            (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type) || a.blockId.localeCompare(b.blockId));
          const mechanicalLinks = [...mechanicalLinksById.values()].sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId));
          return Object.freeze({ revision, blocks: freezeList(blocks), mechanicalLinks: freezeList(mechanicalLinks) });
        }

        function emit(label, changes = {}) {
          revision += 1;
          const event = Object.freeze({
            label, revision,
            added: freezeList(changes.added || []),
            removed: freezeList(changes.removed || []),
            updated: freezeList(changes.updated || []),
            mechanicalLinksAdded: freezeList(changes.mechanicalLinksAdded || []),
            mechanicalLinksRemoved: freezeList(changes.mechanicalLinksRemoved || []),
            mechanicalLinksUpdated: freezeList(changes.mechanicalLinksUpdated || []),
            size: blocksByKey.size,
            mechanicalLinkCount: mechanicalLinksById.size
          });
          for (const listener of [...listeners]) {
            try { listener(event); } catch (error) { console.error('CraftModel listener failed:', error); }
          }
          return event;
        }

        function subscribe(listener) {
          if (typeof listener !== 'function') throw new TypeError('CraftModel listener must be a function.');
          listeners.add(listener); return () => listeners.delete(listener);
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
        function mechanicalLinks() { return freezeList([...mechanicalLinksById.values()].sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId))); }
        function getMechanicalLink(id) { return mechanicalLinksById.get(String(id)) || null; }
        function isContiguous() { return blocksByKey.size === 0 || connectedKeys(blocksByKey).size === blocksByKey.size; }
        function neighborCount(keyOrBlock) {
          const block = typeof keyOrBlock === 'string' ? resolveBlock(keyOrBlock) : keyOrBlock;
          if (!block) return 0;
          let count = 0;
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) if (blocksByKey.has(blueprint.makeKey(block.x + dx, block.y + dy, block.z + dz))) count += 1;
          return count;
        }

        function validateAddMany(rawBlocks) {
          if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return makeResult(false, 'empty-plan');
          if (blocksByKey.size + rawBlocks.length > GRID.maxBlocks) return makeResult(false, 'block-limit');
          const additions = []; const candidate = new Map(blocksByKey); const ids = usedBlockIds();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const block = canonicalBlock(raw, ids, { strictId: false });
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key)) return makeResult(false, 'occupied', { key: block.key });
            ids.add(block.blockId); additions.push(block); candidate.set(block.key, block);
          }
          const validity = validateMap(candidate); if (!validity.ok) return validity;
          return makeResult(true, '', { additions: freezeList(additions) });
        }
        function addMany(rawBlocks, label = 'add-blocks') {
          const validation = validateAddMany(rawBlocks); if (!validation.ok) return validation;
          for (const block of validation.additions) { blocksByKey.set(block.key, block); blocksById.set(block.blockId, block); }
          return makeResult(true, '', { event: emit(label, { added: validation.additions }), blocks: validation.additions });
        }
        function add(rawBlock, label = 'add-block') { return addMany([rawBlock], label); }

        function validateRemove(keyOrX, y, z) {
          const block = typeof keyOrX === 'string' ? resolveBlock(keyOrX) : blocksByKey.get(blueprint.makeKey(keyOrX, y, z));
          return block ? makeResult(true, '', { key: block.key, block }) : makeResult(false, 'missing-block', { key: keyOrX });
        }
        function remove(keyOrX, y, z, label = 'remove-block') {
          let actualLabel = label; let actualY = y; let actualZ = z;
          if (typeof keyOrX === 'string' && typeof y === 'string' && z === undefined) { actualLabel = y; actualY = undefined; actualZ = undefined; }
          const validation = validateRemove(keyOrX, actualY, actualZ); if (!validation.ok) return validation;
          const dependentLinks = linksForBlock(validation.block.blockId);
          blocksByKey.delete(validation.key); blocksById.delete(validation.block.blockId);
          for (const link of dependentLinks) mechanicalLinksById.delete(link.mechanicalLinkId);
          return makeResult(true, '', { event: emit(actualLabel, { removed: [validation.block], mechanicalLinksRemoved: dependentLinks }), block: validation.block, removedMechanicalLinks: dependentLinks });
        }

        function move(keyOrId, x, y, z, label = 'move-block') {
          const before = resolveBlock(keyOrId); if (!before) return makeResult(false, 'missing-block');
          const nx = Number(x); const ny = Number(y); const nz = Number(z);
          const targetKey = blueprint.makeKey(nx, ny, nz);
          if (!blueprint.isWithinGrid(nx, ny, nz)) return makeResult(false, 'invalid-position');
          if (targetKey !== before.key && blocksByKey.has(targetKey)) return makeResult(false, 'occupied', { key: targetKey });
          if (targetKey === before.key) return makeResult(true, 'unchanged', { event: null, block: before });
          const after = canonicalBlock({ ...before, x: nx, y: ny, z: nz }, new Set(), { strictId: true });
          const candidate = new Map(blocksByKey); candidate.delete(before.key); candidate.set(after.key, after);
          const validity = validateMap(candidate); if (!validity.ok) return validity;
          blocksByKey = candidate; blocksById.set(after.blockId, after);
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { updated: [change] }), block: after });
        }

        function canonicalBlockMap(rawBlocks) {
          if (!Array.isArray(rawBlocks)) return makeResult(false, 'invalid-block-list');
          const candidate = new Map(); const ids = new Set();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const block = canonicalBlock(raw, ids, { strictId: false });
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (candidate.has(block.key)) return makeResult(false, 'duplicate-position', { key: block.key });
            ids.add(block.blockId); candidate.set(block.key, block);
          }
          const validity = validateMap(candidate); if (!validity.ok) return validity;
          return makeResult(true, '', { candidate });
        }

        function diffBlocks(candidate) {
          const added = []; const removed = []; const updated = [];
          const previousById = blocksById; const nextById = rebuildBlockIdIndex(candidate);
          for (const oldBlock of blocksByKey.values()) {
            const nextBlock = nextById.get(oldBlock.blockId);
            if (!nextBlock) removed.push(oldBlock);
            else if (!recordEquals(oldBlock, nextBlock)) updated.push(Object.freeze({ before: oldBlock, after: nextBlock }));
          }
          for (const nextBlock of candidate.values()) if (!previousById.has(nextBlock.blockId)) added.push(nextBlock);
          return { added, removed, updated, nextById };
        }

        function replace(rawBlocks, label = 'replace-craft') {
          const built = canonicalBlockMap(rawBlocks); if (!built.ok) return built;
          const changes = diffBlocks(built.candidate);
          const survivingIds = new Set(changes.nextById.keys());
          const removedLinks = [...mechanicalLinksById.values()].filter(link => !survivingIds.has(link.endpointA.blockId) || !survivingIds.has(link.endpointB.blockId));
          if (!changes.added.length && !changes.removed.length && !changes.updated.length && !removedLinks.length) return makeResult(true, 'unchanged', { event: null });
          blocksByKey = built.candidate; blocksById = changes.nextById;
          for (const link of removedLinks) mechanicalLinksById.delete(link.mechanicalLinkId);
          return makeResult(true, '', { event: emit(label, { ...changes, mechanicalLinksRemoved: removedLinks }) });
        }

        function addMechanicalLink(raw, label = 'add-mechanical-link') {
          const ids = usedLinkIds();
          const withId = raw?.mechanicalLinkId ? raw : { ...raw, mechanicalLinkId: allocateAuthoringId('mechanical-link', ids) };
          if (withId?.mechanicalLinkId && mechanicalLinksById.has(withId.mechanicalLinkId)) {
            return makeResult(false, 'duplicate-mechanical-link-id', { mechanicalLinkId: withId.mechanicalLinkId });
          }
          const link = canonicalMechanicalLink(withId, ids);
          if (!link) return makeResult(false, 'invalid-mechanical-link', { raw });
          mechanicalLinksById.set(link.mechanicalLinkId, link);
          return makeResult(true, '', { event: emit(label, { mechanicalLinksAdded: [link] }), link });
        }
        function updateMechanicalLink(id, patch, label = 'update-mechanical-link') {
          const before = getMechanicalLink(id); if (!before) return makeResult(false, 'missing-mechanical-link');
          const ids = usedLinkIds(); ids.delete(before.mechanicalLinkId);
          const after = canonicalMechanicalLink({ ...before, ...(patch || {}), mechanicalLinkId: before.mechanicalLinkId,
            endpointA: patch?.endpointA ? { ...before.endpointA, ...patch.endpointA } : before.endpointA,
            endpointB: patch?.endpointB ? { ...before.endpointB, ...patch.endpointB } : before.endpointB }, ids);
          if (!after) return makeResult(false, 'invalid-mechanical-link');
          if (recordEquals(before, after)) return makeResult(true, 'unchanged', { event: null, link: before });
          mechanicalLinksById.set(after.mechanicalLinkId, after);
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { mechanicalLinksUpdated: [change] }), link: after });
        }
        function removeMechanicalLink(id, label = 'remove-mechanical-link') {
          const link = getMechanicalLink(id); if (!link) return makeResult(false, 'missing-mechanical-link');
          mechanicalLinksById.delete(link.mechanicalLinkId);
          return makeResult(true, '', { event: emit(label, { mechanicalLinksRemoved: [link] }), link });
        }

        function replaceDocument(document, label = 'replace-document') {
          const normalized = blueprint.normalize(document); if (!normalized) return makeResult(false, 'invalid-document');
          const blockBuild = canonicalBlockMap(normalized.blocks); if (!blockBuild.ok) return blockBuild;
          const nextLinks = new Map(); const linkIds = new Set();
          for (const raw of normalized.mechanicalLinks) {
            const link = canonicalMechanicalLink(raw, linkIds); if (!link) return makeResult(false, 'invalid-mechanical-link');
            nextLinks.set(link.mechanicalLinkId, link);
          }
          const blockChanges = diffBlocks(blockBuild.candidate);
          const linksAdded = []; const linksRemoved = []; const linksUpdated = [];
          for (const oldLink of mechanicalLinksById.values()) {
            const next = nextLinks.get(oldLink.mechanicalLinkId);
            if (!next) linksRemoved.push(oldLink);
            else if (!recordEquals(oldLink, next)) linksUpdated.push(Object.freeze({ before: oldLink, after: next }));
          }
          for (const next of nextLinks.values()) if (!mechanicalLinksById.has(next.mechanicalLinkId)) linksAdded.push(next);
          if (!blockChanges.added.length && !blockChanges.removed.length && !blockChanges.updated.length && !linksAdded.length && !linksRemoved.length && !linksUpdated.length) {
            return makeResult(true, 'unchanged', { event: null, document: normalized });
          }
          blocksByKey = blockBuild.candidate; blocksById = blockChanges.nextById; mechanicalLinksById = nextLinks;
          const event = emit(label, { ...blockChanges, mechanicalLinksAdded: linksAdded, mechanicalLinksRemoved: linksRemoved, mechanicalLinksUpdated: linksUpdated });
          return makeResult(true, '', { event, document: normalized });
        }
        function loadDocument(rawDocument, label = 'load-document') { return replaceDocument(rawDocument, label); }

        function copySubgraph(blockIds, delta = { x: 1, y: 0, z: 0 }, label = 'copy-subgraph') {
          const sourceIds = new Set(Array.isArray(blockIds) ? blockIds.map(String) : []);
          const sources = [...sourceIds].map(blockById).filter(Boolean).sort((a, b) => a.blockId.localeCompare(b.blockId));
          if (!sources.length) return makeResult(false, 'empty-copy');
          const dx = Number(delta.x ?? delta[0] ?? 0); const dy = Number(delta.y ?? delta[1] ?? 0); const dz = Number(delta.z ?? delta[2] ?? 0);
          if (![dx, dy, dz].every(Number.isInteger)) return makeResult(false, 'invalid-copy-offset');
          const ids = usedBlockIds(); const idMap = new Map();
          const rawCopies = sources.map(source => {
            const blockId = allocateAuthoringId('block', ids); ids.add(blockId); idMap.set(source.blockId, blockId);
            return { ...source, blockId, x: source.x + dx, y: source.y + dy, z: source.z + dz };
          });
          const validation = validateAddMany(rawCopies); if (!validation.ok) return validation;
          const linkIds = usedLinkIds(); const copiedLinks = [];
          for (const link of mechanicalLinksById.values()) {
            if (!sourceIds.has(link.endpointA.blockId) || !sourceIds.has(link.endpointB.blockId)) continue;
            const mechanicalLinkId = allocateAuthoringId('mechanical-link', linkIds);
            const copy = canonicalMechanicalLink({ ...link, mechanicalLinkId,
              endpointA: { ...link.endpointA, blockId: idMap.get(link.endpointA.blockId) },
              endpointB: { ...link.endpointB, blockId: idMap.get(link.endpointB.blockId) } }, linkIds);
            if (!copy) return makeResult(false, 'invalid-copied-mechanical-link');
            copiedLinks.push(copy);
          }
          for (const block of validation.additions) { blocksByKey.set(block.key, block); blocksById.set(block.blockId, block); }
          for (const link of copiedLinks) mechanicalLinksById.set(link.mechanicalLinkId, link);
          const event = emit(label, { added: validation.additions, mechanicalLinksAdded: copiedLinks });
          return makeResult(true, '', { event, blocks: validation.additions, mechanicalLinks: freezeList(copiedLinks), blockIdMap: Object.freeze(Object.fromEntries(idMap)) });
        }

        function toDocument(settings = {}) {
          return blueprint.createDocument({
            blocks: values().map(block => ({ blockId: block.blockId, x: block.x, y: block.y, z: block.z, type: block.type, orientation: block.orientation, controlAxis: block.controlAxis, controlSign: block.controlSign })),
            mechanicalLinks: mechanicalLinks(),
            selectedBlock: settings.selectedBlock, selectedOrientation: settings.selectedOrientation,
            symmetry: settings.symmetry, thrusterPower: settings.thrusterPower, balloonPower: settings.balloonPower,
            stabilityAssist: settings.stabilityAssist, controlAxis: settings.controlAxis, controlSign: settings.controlSign
          });
        }
        function clear(label = 'clear-craft') {
          if (blocksByKey.size === 0 && mechanicalLinksById.size === 0) return makeResult(true, 'unchanged', { event: null });
          const removed = [...blocksByKey.values()]; const removedLinks = [...mechanicalLinksById.values()];
          blocksByKey = new Map(); blocksById = new Map(); mechanicalLinksById = new Map();
          return makeResult(true, '', { event: emit(label, { removed, mechanicalLinksRemoved: removedLinks }) });
        }

        const api = {
          get, getById, keyForId, has, keys, values, entries, snapshot, subscribe,
          isContiguous, neighborCount, validateAddMany, addMany, add, validateRemove, remove, move, replace,
          mechanicalLinks, getMechanicalLink, linksForBlock, addMechanicalLink, updateMechanicalLink, removeMechanicalLink,
          replaceDocument, loadDocument, copySubgraph, toDocument, clear
        };
        Object.defineProperties(api, {
          size: { enumerable: true, get: () => blocksByKey.size },
          mechanicalLinkCount: { enumerable: true, get: () => mechanicalLinksById.size },
          revision: { enumerable: true, get: () => revision }
        });
        Object.freeze(api);

        const initialDocument = Array.isArray(initial)
          ? blueprint.createDocument({ blocks: initial, mechanicalLinks: [] })
          : initial;
        if (Array.isArray(initial) ? initial.length : initialDocument?.blocks?.length || initialDocument?.mechanicalLinks?.length) {
          const result = replaceDocument(initialDocument, 'initialize');
          if (!result.ok) throw new Error(`CraftModel initialization failed: ${result.reason}`);
        }
        return api;
      }

      return Object.freeze({ schemaVersion: SAVE_VERSION, canonicalBlock, canonicalMechanicalLink, connectedKeys, validateMap, create });
    }
  );
})();
