(() => {
  'use strict';

  window.VAW.define(
    'foundation.craft-model',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint', 'foundation.assembly-spaces', 'foundation.transform-math'],
    (config, catalog, orientation, blueprint, AssemblySpaces, TransformMath) => {
      const { GRID, SAVE_VERSION, NEIGHBOR_DIRECTIONS } = config;

      function makeResult(ok, reason = '', details = {}) { return Object.freeze({ ok, reason, ...details }); }
      function freezeList(values) { return Object.freeze([...values]); }
      function recordEquals(a, b) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }

      function canonicalBlock(raw, usedIds = new Set(), options = {}) {
        const canonical = blueprint.canonicalBlock(raw, usedIds, {
          strictId: options.strictId === true,
          strictAssemblySpace: options.strictAssemblySpace === true
        });
        if (!canonical) return null;
        return Object.freeze({ ...canonical, key: blueprint.makeOwnedKey(canonical.assemblySpaceId, canonical.x, canonical.y, canonical.z) });
      }

      function canonicalMechanicalLink(raw, usedIds = new Set(), options = {}) {
        const canonical = blueprint.canonicalMechanicalLink(raw, usedIds, {
          strictId: true,
          strictAssemblySpace: options.strictAssemblySpace !== false
        });
        return canonical ? Object.freeze({
          ...canonical,
          endpointA: Object.freeze({ ...canonical.endpointA }),
          endpointB: Object.freeze({ ...canonical.endpointB }),
          limits: canonical.limits ? Object.freeze({ ...canonical.limits }) : null
        }) : null;
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
            const nextKey = blueprint.makeOwnedKey(current.assemblySpaceId, current.x + dx, current.y + dy, current.z + dz);
            if (blocksByKey.has(nextKey) && !visited.has(nextKey)) { visited.add(nextKey); queue.push(nextKey); }
          }
        }
        return visited;
      }

      function validateMap(blocksByKey, { allowEmpty = true, assemblySpacesById = null } = {}) {
        if (!(blocksByKey instanceof Map)) return makeResult(false, 'invalid-map');
        if (blocksByKey.size === 0) return allowEmpty ? makeResult(true) : makeResult(false, 'empty-craft');
        if (blocksByKey.size > GRID.maxBlocks) return makeResult(false, 'block-limit');
        let coreCount = 0;
        const ids = new Set();
        for (const block of blocksByKey.values()) {
          if (block.type === 'Core') coreCount += 1;
          if (!blueprint.normalizeBlockId(block.blockId)) return makeResult(false, 'invalid-block-id');
          if (ids.has(block.blockId)) return makeResult(false, 'duplicate-block-id');
          if (assemblySpacesById && !assemblySpacesById.has(block.assemblySpaceId)) {
            return makeResult(false, 'orphan-block-assembly-space', { blockId: block.blockId, assemblySpaceId: block.assemblySpaceId });
          }
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

      function create(initial = [], options = {}) {
        let blocksByKey = new Map();
        let blocksById = new Map();
        let mechanicalLinksById = new Map();
        let spacesById = new Map([[AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID, AssemblySpaces.createRootSpace()]]);
        let spacesIndex = AssemblySpaces.validateAndIndex([...spacesById.values()], { allowDefaultRoot: false });
        let revision = 0;
        const listeners = new Set();
        let generatedLinkCounter = 0;
        let generatedBlockCounter = 0;
        let generatedSpaceCounter = 0;
        const externalAllocator = typeof options.idAllocator === 'function' ? options.idAllocator : null;

        function replaceSpaces(spaces) {
          const validation = AssemblySpaces.validateAndIndex(spaces, { allowDefaultRoot: false });
          if (!validation.ok) return validation;
          spacesById = new Map(validation.spaces.map(space => [space.assemblySpaceId, space]));
          spacesIndex = validation;
          return validation;
        }

        function allocateAuthoringId(kind, used) {
          if (externalAllocator) {
            const value = externalAllocator(kind, freezeList(used));
            const normalized = blueprint.normalizeEntityId(value);
            if (!normalized || used.has(normalized)) throw new Error(`Injected ${kind} id allocator returned an invalid or duplicate id.`);
            return normalized;
          }
          const prefix = kind === 'mechanical-link'
            ? 'mechanical:hinge'
            : kind === 'assembly-space'
              ? 'space:child'
              : 'block:copy';
          let candidate;
          do {
            if (kind === 'mechanical-link') generatedLinkCounter += 1;
            else if (kind === 'assembly-space') generatedSpaceCounter += 1;
            else generatedBlockCounter += 1;
            const value = kind === 'mechanical-link' ? generatedLinkCounter : kind === 'assembly-space' ? generatedSpaceCounter : generatedBlockCounter;
            candidate = `${prefix}:${value}`;
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
        function usedSpaceIds() { return new Set(spacesById.keys()); }
        function blockById(blockId) { return blocksById.get(String(blockId)) || null; }
        function resolveBlock(keyOrId) {
          if (typeof keyOrId !== 'string') return null;
          return blocksByKey.get(keyOrId) || blockById(keyOrId);
        }
        function assemblySpaces() { return freezeList(spacesIndex.spaces); }
        function getAssemblySpace(id) { return spacesById.get(String(id)) || null; }
        function linksForBlock(blockId) {
          const id = String(blockId);
          return freezeList([...mechanicalLinksById.values()]
            .filter(link => link.endpointA.blockId === id || link.endpointB.blockId === id)
            .sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId)));
        }

        function snapshot() {
          const blocks = [...blocksByKey.values()].sort((a, b) =>
            a.assemblySpaceId.localeCompare(b.assemblySpaceId)
            || (a.y - b.y) || (a.x - b.x) || (a.z - b.z)
            || a.type.localeCompare(b.type) || a.blockId.localeCompare(b.blockId));
          const mechanicalLinks = [...mechanicalLinksById.values()].sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId));
          return Object.freeze({
            revision,
            assemblySpaces: freezeList(spacesIndex.spaces),
            blocks: freezeList(blocks),
            mechanicalLinks: freezeList(mechanicalLinks)
          });
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
            assemblySpacesAdded: freezeList(changes.assemblySpacesAdded || []),
            assemblySpacesRemoved: freezeList(changes.assemblySpacesRemoved || []),
            assemblySpacesUpdated: freezeList(changes.assemblySpacesUpdated || []),
            size: blocksByKey.size,
            mechanicalLinkCount: mechanicalLinksById.size,
            assemblySpaceCount: spacesById.size
          });
          for (const listener of [...listeners]) {
            try { listener(event); } catch (error) { console.error('CraftModel listener failed:', error); }
          }
          return event;
        }

        function subscribe(listener) {
          if (typeof listener !== 'function') throw new TypeError('CraftModel listener must be a function.');
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
        function get(keyOrX, y, z, assemblySpaceId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) {
          const key = typeof keyOrX === 'string' ? keyOrX : blueprint.makeOwnedKey(assemblySpaceId, keyOrX, y, z);
          return blocksByKey.get(key) || null;
        }
        function getById(blockId) { return blockById(blockId); }
        function keyForId(blockId) { return blockById(blockId)?.key || null; }
        function has(keyOrX, y, z, assemblySpaceId) { return !!get(keyOrX, y, z, assemblySpaceId); }
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
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            if (blocksByKey.has(blueprint.makeOwnedKey(block.assemblySpaceId, block.x + dx, block.y + dy, block.z + dz))) count += 1;
          }
          return count;
        }

        function validateAddMany(rawBlocks) {
          if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return makeResult(false, 'empty-plan');
          if (blocksByKey.size + rawBlocks.length > GRID.maxBlocks) return makeResult(false, 'block-limit');
          const additions = [];
          const candidate = new Map(blocksByKey);
          const ids = usedBlockIds();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const withOwner = { ...raw, assemblySpaceId: raw?.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID };
            const block = canonicalBlock(withOwner, ids, { strictId: false, strictAssemblySpace: true });
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (!spacesById.has(block.assemblySpaceId)) return makeResult(false, 'orphan-block-assembly-space', { blockId: block.blockId, assemblySpaceId: block.assemblySpaceId });
            if (candidate.has(block.key)) return makeResult(false, 'occupied', { key: block.key });
            ids.add(block.blockId);
            additions.push(block);
            candidate.set(block.key, block);
          }
          const validity = validateMap(candidate, { assemblySpacesById: spacesById });
          if (!validity.ok) return validity;
          return makeResult(true, '', { additions: freezeList(additions) });
        }
        function addMany(rawBlocks, label = 'add-blocks') {
          const validation = validateAddMany(rawBlocks);
          if (!validation.ok) return validation;
          for (const block of validation.additions) { blocksByKey.set(block.key, block); blocksById.set(block.blockId, block); }
          return makeResult(true, '', { event: emit(label, { added: validation.additions }), blocks: validation.additions });
        }
        function add(rawBlock, label = 'add-block') { return addMany([rawBlock], label); }

        function validateRemove(keyOrX, y, z) {
          const block = typeof keyOrX === 'string'
            ? resolveBlock(keyOrX)
            : blocksByKey.get(blueprint.makeOwnedKey(AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID, keyOrX, y, z));
          return block ? makeResult(true, '', { key: block.key, block }) : makeResult(false, 'missing-block', { key: keyOrX });
        }
        function remove(keyOrX, y, z, label = 'remove-block') {
          let actualLabel = label; let actualY = y; let actualZ = z;
          if (typeof keyOrX === 'string' && typeof y === 'string' && z === undefined) { actualLabel = y; actualY = undefined; actualZ = undefined; }
          const validation = validateRemove(keyOrX, actualY, actualZ);
          if (!validation.ok) return validation;
          const dependentLinks = linksForBlock(validation.block.blockId);
          blocksByKey.delete(validation.key);
          blocksById.delete(validation.block.blockId);
          for (const link of dependentLinks) mechanicalLinksById.delete(link.mechanicalLinkId);
          return makeResult(true, '', {
            event: emit(actualLabel, { removed: [validation.block], mechanicalLinksRemoved: dependentLinks }),
            block: validation.block,
            removedMechanicalLinks: dependentLinks
          });
        }

        function move(keyOrId, x, y, z, label = 'move-block') {
          const before = resolveBlock(keyOrId);
          if (!before) return makeResult(false, 'missing-block');
          const nx = Number(x); const ny = Number(y); const nz = Number(z);
          const targetKey = blueprint.makeOwnedKey(before.assemblySpaceId, nx, ny, nz);
          if (!blueprint.isWithinGrid(nx, ny, nz)) return makeResult(false, 'invalid-position');
          if (targetKey !== before.key && blocksByKey.has(targetKey)) return makeResult(false, 'occupied', { key: targetKey });
          if (targetKey === before.key) return makeResult(true, 'unchanged', { event: null, block: before });
          const after = canonicalBlock({ ...before, x: nx, y: ny, z: nz }, new Set(), { strictId: true, strictAssemblySpace: true });
          const candidate = new Map(blocksByKey);
          candidate.delete(before.key);
          candidate.set(after.key, after);
          const validity = validateMap(candidate, { assemblySpacesById: spacesById });
          if (!validity.ok) return validity;
          blocksByKey = candidate;
          blocksById.set(after.blockId, after);
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { updated: [change] }), block: after });
        }

        function canonicalBlockMap(rawBlocks, candidateSpaces = spacesById) {
          if (!Array.isArray(rawBlocks)) return makeResult(false, 'invalid-block-list');
          const candidate = new Map();
          const ids = new Set();
          for (const raw of rawBlocks) {
            const explicitId = blueprint.normalizeBlockId(raw?.blockId);
            if (explicitId && ids.has(explicitId)) return makeResult(false, 'duplicate-block-id', { blockId: explicitId });
            const block = canonicalBlock({ ...raw, assemblySpaceId: raw?.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID }, ids, { strictId: false, strictAssemblySpace: true });
            if (!block) return makeResult(false, 'invalid-block', { raw });
            if (!candidateSpaces.has(block.assemblySpaceId)) return makeResult(false, 'orphan-block-assembly-space', { blockId: block.blockId, assemblySpaceId: block.assemblySpaceId });
            if (candidate.has(block.key)) return makeResult(false, 'duplicate-position', { key: block.key });
            ids.add(block.blockId);
            candidate.set(block.key, block);
          }
          const validity = validateMap(candidate, { assemblySpacesById: candidateSpaces });
          if (!validity.ok) return validity;
          return makeResult(true, '', { candidate });
        }

        function diffBlocks(candidate) {
          const added = []; const removed = []; const updated = [];
          const previousById = blocksById;
          const nextById = rebuildBlockIdIndex(candidate);
          for (const oldBlock of blocksByKey.values()) {
            const nextBlock = nextById.get(oldBlock.blockId);
            if (!nextBlock) removed.push(oldBlock);
            else if (!recordEquals(oldBlock, nextBlock)) updated.push(Object.freeze({ before: oldBlock, after: nextBlock }));
          }
          for (const nextBlock of candidate.values()) if (!previousById.has(nextBlock.blockId)) added.push(nextBlock);
          return { added, removed, updated, nextById };
        }

        function replace(rawBlocks, label = 'replace-craft') {
          const built = canonicalBlockMap(rawBlocks);
          if (!built.ok) return built;
          const changes = diffBlocks(built.candidate);
          const survivingIds = new Set(changes.nextById.keys());
          const survivingLinks = new Map();
          const removedLinks = [];
          for (const link of mechanicalLinksById.values()) {
            if (!survivingIds.has(link.endpointA.blockId) || !survivingIds.has(link.endpointB.blockId)) removedLinks.push(link);
            else survivingLinks.set(link.mechanicalLinkId, link);
          }
          const links = recalculateLinkOwners(changes.nextById, spacesIndex, survivingLinks);
          if (!links.ok) return links;
          if (!changes.added.length && !changes.removed.length && !changes.updated.length && !removedLinks.length && !links.updated.length) {
            return makeResult(true, 'unchanged', { event: null });
          }
          blocksByKey = built.candidate;
          blocksById = changes.nextById;
          mechanicalLinksById = links.links;
          return makeResult(true, '', { event: emit(label, { ...changes, mechanicalLinksRemoved: removedLinks, mechanicalLinksUpdated: links.updated }) });
        }

        function linkOwnerFor(raw, candidateBlocksById = blocksById, candidateSpaces = spacesIndex) {
          return blueprint.resolveLinkOwner(raw, candidateBlocksById, candidateSpaces);
        }

        function recalculateLinkOwners(candidateBlocksById = blocksById, candidateSpaces = spacesIndex, sourceLinks = mechanicalLinksById) {
          const next = new Map();
          const updated = [];
          for (const before of sourceLinks.values()) {
            const owner = linkOwnerFor(before, candidateBlocksById, candidateSpaces);
            if (!owner) return makeResult(false, 'orphan-mechanical-link-owner', { mechanicalLinkId: before.mechanicalLinkId });
            const after = canonicalMechanicalLink({ ...before, assemblySpaceId: owner }, new Set([...next.keys()]), { strictAssemblySpace: true });
            if (!after) return makeResult(false, 'invalid-mechanical-link');
            next.set(after.mechanicalLinkId, after);
            if (!recordEquals(before, after)) updated.push(Object.freeze({ before, after }));
          }
          return makeResult(true, '', { links: next, updated });
        }

        function addMechanicalLink(raw, label = 'add-mechanical-link') {
          const ids = usedLinkIds();
          const withId = raw?.mechanicalLinkId ? raw : { ...raw, mechanicalLinkId: allocateAuthoringId('mechanical-link', ids) };
          if (withId?.mechanicalLinkId && mechanicalLinksById.has(withId.mechanicalLinkId)) {
            return makeResult(false, 'duplicate-mechanical-link-id', { mechanicalLinkId: withId.mechanicalLinkId });
          }
          const owner = linkOwnerFor(withId);
          if (!owner) return makeResult(false, 'orphan-mechanical-link-owner');
          const link = canonicalMechanicalLink({ ...withId, assemblySpaceId: owner }, ids, { strictAssemblySpace: true });
          if (!link) return makeResult(false, 'invalid-mechanical-link', { raw });
          if (!blocksById.has(link.endpointA.blockId) || !blocksById.has(link.endpointB.blockId)) return makeResult(false, 'orphan-mechanical-link-endpoint');
          mechanicalLinksById.set(link.mechanicalLinkId, link);
          return makeResult(true, '', { event: emit(label, { mechanicalLinksAdded: [link] }), link });
        }
        function updateMechanicalLink(id, patch, label = 'update-mechanical-link') {
          const before = getMechanicalLink(id);
          if (!before) return makeResult(false, 'missing-mechanical-link');
          const candidate = {
            ...before, ...(patch || {}), mechanicalLinkId: before.mechanicalLinkId,
            endpointA: patch?.endpointA ? { ...before.endpointA, ...patch.endpointA } : before.endpointA,
            endpointB: patch?.endpointB ? { ...before.endpointB, ...patch.endpointB } : before.endpointB
          };
          const owner = linkOwnerFor(candidate);
          if (!owner) return makeResult(false, 'orphan-mechanical-link-owner');
          const ids = usedLinkIds();
          ids.delete(before.mechanicalLinkId);
          const after = canonicalMechanicalLink({ ...candidate, assemblySpaceId: owner }, ids, { strictAssemblySpace: true });
          if (!after) return makeResult(false, 'invalid-mechanical-link');
          if (recordEquals(before, after)) return makeResult(true, 'unchanged', { event: null, link: before });
          mechanicalLinksById.set(after.mechanicalLinkId, after);
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { mechanicalLinksUpdated: [change] }), link: after });
        }
        function removeMechanicalLink(id, label = 'remove-mechanical-link') {
          const link = getMechanicalLink(id);
          if (!link) return makeResult(false, 'missing-mechanical-link');
          mechanicalLinksById.delete(link.mechanicalLinkId);
          return makeResult(true, '', { event: emit(label, { mechanicalLinksRemoved: [link] }), link });
        }

        function replaceDocument(document, label = 'replace-document') {
          const normalized = blueprint.normalize(document);
          if (!normalized) return makeResult(false, 'invalid-document');
          const indexedSpaces = AssemblySpaces.validateAndIndex(normalized.assemblySpaces, { allowDefaultRoot: false });
          if (!indexedSpaces.ok) return makeResult(false, indexedSpaces.diagnostics[0]?.code || 'invalid-assembly-spaces');
          const nextSpaces = new Map(indexedSpaces.spaces.map(space => [space.assemblySpaceId, space]));
          const blockBuild = canonicalBlockMap(normalized.blocks, nextSpaces);
          if (!blockBuild.ok) return blockBuild;
          const nextBlocksById = rebuildBlockIdIndex(blockBuild.candidate);
          const nextLinks = new Map();
          const linkIds = new Set();
          for (const raw of normalized.mechanicalLinks) {
            const link = canonicalMechanicalLink(raw, linkIds, { strictAssemblySpace: true });
            if (!link) return makeResult(false, 'invalid-mechanical-link');
            const expectedOwner = blueprint.resolveLinkOwner(link, nextBlocksById, indexedSpaces);
            if (link.assemblySpaceId !== expectedOwner) return makeResult(false, 'invalid-mechanical-link-owner');
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
          const spacesAdded = []; const spacesRemoved = []; const spacesUpdated = [];
          for (const oldSpace of spacesById.values()) {
            const next = nextSpaces.get(oldSpace.assemblySpaceId);
            if (!next) spacesRemoved.push(oldSpace);
            else if (!recordEquals(oldSpace, next)) spacesUpdated.push(Object.freeze({ before: oldSpace, after: next }));
          }
          for (const next of nextSpaces.values()) if (!spacesById.has(next.assemblySpaceId)) spacesAdded.push(next);
          if (!blockChanges.added.length && !blockChanges.removed.length && !blockChanges.updated.length
            && !linksAdded.length && !linksRemoved.length && !linksUpdated.length
            && !spacesAdded.length && !spacesRemoved.length && !spacesUpdated.length) {
            return makeResult(true, 'unchanged', { event: null, document: normalized });
          }
          blocksByKey = blockBuild.candidate;
          blocksById = blockChanges.nextById;
          mechanicalLinksById = nextLinks;
          spacesById = nextSpaces;
          spacesIndex = indexedSpaces;
          const event = emit(label, {
            ...blockChanges,
            mechanicalLinksAdded: linksAdded,
            mechanicalLinksRemoved: linksRemoved,
            mechanicalLinksUpdated: linksUpdated,
            assemblySpacesAdded: spacesAdded,
            assemblySpacesRemoved: spacesRemoved,
            assemblySpacesUpdated: spacesUpdated
          });
          return makeResult(true, '', { event, document: normalized });
        }
        function loadDocument(rawDocument, label = 'load-document') { return replaceDocument(rawDocument, label); }

        function createAssemblySpace(raw = {}, label = 'create-assembly-space') {
          const ids = usedSpaceIds();
          const assemblySpaceId = raw.assemblySpaceId || allocateAuthoringId('assembly-space', ids);
          if (ids.has(assemblySpaceId)) return makeResult(false, 'duplicate-assembly-space-id', { assemblySpaceId });
          const space = AssemblySpaces.canonicalSpace({
            assemblySpaceId,
            parentAssemblySpaceId: raw.parentAssemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
            name: raw.name,
            localPose: raw.localPose || AssemblySpaces.IDENTITY_POSE
          });
          if (!space) return makeResult(false, 'invalid-assembly-space');
          const validation = replaceSpaces([...spacesById.values(), space]);
          if (!validation.ok) return makeResult(false, validation.diagnostics[0]?.code || 'invalid-assembly-spaces');
          return makeResult(true, '', { event: emit(label, { assemblySpacesAdded: [space] }), assemblySpace: space });
        }

        function updateAssemblySpace(id, patch = {}, label = 'update-assembly-space') {
          const before = getAssemblySpace(id);
          if (!before) return makeResult(false, 'missing-assembly-space');
          if (patch.parentAssemblySpaceId !== undefined && patch.parentAssemblySpaceId !== before.parentAssemblySpaceId) {
            return makeResult(false, 'assembly-space-use-reparent-operation');
          }
          const after = AssemblySpaces.canonicalSpace({
            ...before,
            ...patch,
            assemblySpaceId: before.assemblySpaceId,
            localPose: patch.localPose ? { ...before.localPose, ...patch.localPose } : before.localPose
          });
          if (!after) return makeResult(false, 'invalid-assembly-space');
          if (recordEquals(before, after)) return makeResult(true, 'unchanged', { event: null, assemblySpace: before });
          const candidate = [...spacesById.values()].map(space => space.assemblySpaceId === before.assemblySpaceId ? after : space);
          const validation = AssemblySpaces.validateAndIndex(candidate, { allowDefaultRoot: false });
          if (!validation.ok) return makeResult(false, validation.diagnostics[0]?.code || 'invalid-assembly-spaces');
          const links = recalculateLinkOwners(blocksById, validation);
          if (!links.ok) return links;
          spacesById = new Map(validation.spaces.map(item => [item.assemblySpaceId, item]));
          spacesIndex = validation;
          mechanicalLinksById = links.links;
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { assemblySpacesUpdated: [change], mechanicalLinksUpdated: links.updated }), assemblySpace: after });
        }

        function reparentAssemblySpace(id, newParentAssemblySpaceId, options = {}, label = 'reparent-assembly-space') {
          const before = getAssemblySpace(id);
          if (!before) return makeResult(false, 'missing-assembly-space');
          if (before.assemblySpaceId === AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) return makeResult(false, 'cannot-reparent-root-assembly-space');
          const parentId = blueprint.normalizeAssemblySpaceId(newParentAssemblySpaceId);
          if (!parentId || !spacesById.has(parentId)) return makeResult(false, 'missing-assembly-space', { assemblySpaceId: newParentAssemblySpaceId });
          if (parentId === before.parentAssemblySpaceId) return makeResult(true, 'unchanged', { event: null, assemblySpace: before });

          let localPose = before.localPose;
          if (options.preserveRootPose !== false) {
            const oldRootPose = spacesIndex.rootPoses[before.assemblySpaceId];
            const newParentRootPose = spacesIndex.rootPoses[parentId];
            localPose = AssemblySpaces.canonicalPose(TransformMath.composePose(TransformMath.inversePose(newParentRootPose), oldRootPose));
            if (!localPose) return makeResult(false, 'invalid-assembly-space-pose');
          }
          const after = AssemblySpaces.canonicalSpace({
            ...before,
            parentAssemblySpaceId: parentId,
            localPose
          });
          if (!after) return makeResult(false, 'invalid-assembly-space');
          const candidate = [...spacesById.values()].map(space => space.assemblySpaceId === before.assemblySpaceId ? after : space);
          const validation = AssemblySpaces.validateAndIndex(candidate, { allowDefaultRoot: false });
          if (!validation.ok) return makeResult(false, validation.diagnostics[0]?.code || 'invalid-assembly-spaces');
          const links = recalculateLinkOwners(blocksById, validation);
          if (!links.ok) return links;
          spacesById = new Map(validation.spaces.map(item => [item.assemblySpaceId, item]));
          spacesIndex = validation;
          mechanicalLinksById = links.links;
          const change = Object.freeze({ before, after });
          return makeResult(true, '', {
            event: emit(label, { assemblySpacesUpdated: [change], mechanicalLinksUpdated: links.updated }),
            assemblySpace: after
          });
        }

        function reassignBlock(blockId, targetAssemblySpaceId, options = {}, label = 'reassign-block-space') {
          const before = blockById(blockId);
          if (!before) return makeResult(false, 'missing-block');
          const targetId = blueprint.normalizeAssemblySpaceId(targetAssemblySpaceId);
          if (!targetId || !spacesById.has(targetId)) return makeResult(false, 'missing-assembly-space', { assemblySpaceId: targetAssemblySpaceId });
          if (targetId === before.assemblySpaceId) return makeResult(true, 'unchanged', { event: null, block: before });
          let targetPosition = [before.x, before.y, before.z];
          if (options.preserveRootPosition !== false) {
            const rootPoint = AssemblySpaces.spaceLocalToRoot(before.assemblySpaceId, targetPosition, spacesIndex);
            const localPoint = AssemblySpaces.rootToSpaceLocal(targetId, rootPoint, spacesIndex);
            const rounded = localPoint.map(Math.round);
            if (localPoint.some((value, index) => Math.abs(value - rounded[index]) > 1e-8)) {
              return makeResult(false, 'assembly-space-reassign-off-grid', { blockId: before.blockId, targetAssemblySpaceId: targetId, localPoint });
            }
            targetPosition = rounded;
          }
          if (!blueprint.isWithinGrid(...targetPosition)) return makeResult(false, 'invalid-position');
          const targetKey = blueprint.makeOwnedKey(targetId, ...targetPosition);
          if (blocksByKey.has(targetKey)) return makeResult(false, 'occupied', { key: targetKey });
          const after = canonicalBlock({ ...before, assemblySpaceId: targetId, x: targetPosition[0], y: targetPosition[1], z: targetPosition[2] }, new Set(), { strictId: true, strictAssemblySpace: true });
          const candidate = new Map(blocksByKey);
          candidate.delete(before.key);
          candidate.set(after.key, after);
          const candidateById = rebuildBlockIdIndex(candidate);
          const links = recalculateLinkOwners(candidateById);
          if (!links.ok) return links;
          const validity = validateMap(candidate, { assemblySpacesById: spacesById });
          if (!validity.ok) return validity;
          blocksByKey = candidate;
          blocksById = candidateById;
          mechanicalLinksById = links.links;
          const change = Object.freeze({ before, after });
          return makeResult(true, '', { event: emit(label, { updated: [change], mechanicalLinksUpdated: links.updated }), block: after });
        }

        function removeAssemblySpace(id, options = {}, label = 'remove-assembly-space') {
          const space = getAssemblySpace(id);
          if (!space) return makeResult(false, 'missing-assembly-space');
          if (space.assemblySpaceId === AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) return makeResult(false, 'cannot-remove-root-assembly-space');
          const children = spacesIndex.childrenById[space.assemblySpaceId] || [];
          if (children.length) return makeResult(false, 'assembly-space-has-children', { childAssemblySpaceIds: [...children] });
          const ownedBlocks = [...blocksById.values()].filter(block => block.assemblySpaceId === space.assemblySpaceId);
          const policy = options.policy || 'reject';
          if (ownedBlocks.length && policy !== 'reassign-to-parent') {
            return makeResult(false, 'assembly-space-not-empty', { blockIds: ownedBlocks.map(block => block.blockId) });
          }
          const nextSpaces = assemblySpaces().filter(item => item.assemblySpaceId !== space.assemblySpaceId);
          const validation = AssemblySpaces.validateAndIndex(nextSpaces, { allowDefaultRoot: false });
          if (!validation.ok) return makeResult(false, validation.diagnostics[0]?.code || 'invalid-assembly-spaces');
          let candidate = new Map(blocksByKey);
          const updates = [];
          if (ownedBlocks.length) {
            for (const before of ownedBlocks) {
              const rootPoint = AssemblySpaces.spaceLocalToRoot(before.assemblySpaceId, [before.x, before.y, before.z], spacesIndex);
              const localPoint = AssemblySpaces.rootToSpaceLocal(space.parentAssemblySpaceId, rootPoint, validation);
              const rounded = localPoint.map(Math.round);
              if (localPoint.some((value, index) => Math.abs(value - rounded[index]) > 1e-8)) {
                return makeResult(false, 'assembly-space-reassign-off-grid', { blockId: before.blockId, localPoint });
              }
              const after = canonicalBlock({ ...before, assemblySpaceId: space.parentAssemblySpaceId, x: rounded[0], y: rounded[1], z: rounded[2] }, new Set(), { strictId: true, strictAssemblySpace: true });
              const occupying = candidate.get(after.key);
              if (occupying && occupying.blockId !== before.blockId) return makeResult(false, 'occupied', { key: after.key });
              candidate.delete(before.key);
              candidate.set(after.key, after);
              updates.push(Object.freeze({ before, after }));
            }
          }
          const candidateById = rebuildBlockIdIndex(candidate);
          const links = recalculateLinkOwners(candidateById, validation);
          if (!links.ok) return links;
          const validity = validateMap(candidate, { assemblySpacesById: new Map(validation.spaces.map(item => [item.assemblySpaceId, item])) });
          if (!validity.ok) return validity;
          blocksByKey = candidate;
          blocksById = candidateById;
          mechanicalLinksById = links.links;
          spacesById = new Map(validation.spaces.map(item => [item.assemblySpaceId, item]));
          spacesIndex = validation;
          return makeResult(true, '', {
            event: emit(label, { updated: updates, mechanicalLinksUpdated: links.updated, assemblySpacesRemoved: [space] }),
            assemblySpace: space
          });
        }

        function copySubgraph(blockIds, delta = { x: 1, y: 0, z: 0 }, label = 'copy-subgraph') {
          const sourceIds = new Set(Array.isArray(blockIds) ? blockIds.map(String) : []);
          const sources = [...sourceIds].map(blockById).filter(Boolean).sort((a, b) => a.blockId.localeCompare(b.blockId));
          if (!sources.length) return makeResult(false, 'empty-copy');
          const dx = Number(delta.x ?? delta[0] ?? 0); const dy = Number(delta.y ?? delta[1] ?? 0); const dz = Number(delta.z ?? delta[2] ?? 0);
          if (![dx, dy, dz].every(Number.isInteger)) return makeResult(false, 'invalid-copy-offset');
          const targetSpaceId = delta.assemblySpaceId ? blueprint.normalizeAssemblySpaceId(delta.assemblySpaceId) : null;
          if (targetSpaceId && !spacesById.has(targetSpaceId)) return makeResult(false, 'missing-assembly-space', { assemblySpaceId: targetSpaceId });
          const ids = usedBlockIds();
          const idMap = new Map();
          const rawCopies = sources.map(source => {
            const blockId = allocateAuthoringId('block', ids);
            ids.add(blockId);
            idMap.set(source.blockId, blockId);
            return {
              ...source,
              blockId,
              assemblySpaceId: targetSpaceId || source.assemblySpaceId,
              x: source.x + dx, y: source.y + dy, z: source.z + dz
            };
          });
          const validation = validateAddMany(rawCopies);
          if (!validation.ok) return validation;
          const candidateBlocks = new Map(blocksByKey);
          for (const block of validation.additions) candidateBlocks.set(block.key, block);
          const candidateById = rebuildBlockIdIndex(candidateBlocks);
          const linkIds = usedLinkIds();
          const copiedLinks = [];
          for (const link of mechanicalLinksById.values()) {
            if (!sourceIds.has(link.endpointA.blockId) || !sourceIds.has(link.endpointB.blockId)) continue;
            const mechanicalLinkId = allocateAuthoringId('mechanical-link', linkIds);
            const candidate = {
              ...link,
              mechanicalLinkId,
              endpointA: { ...link.endpointA, blockId: idMap.get(link.endpointA.blockId) },
              endpointB: { ...link.endpointB, blockId: idMap.get(link.endpointB.blockId) }
            };
            const owner = linkOwnerFor(candidate, candidateById);
            const copy = canonicalMechanicalLink({ ...candidate, assemblySpaceId: owner }, linkIds, { strictAssemblySpace: true });
            if (!copy) return makeResult(false, 'invalid-copied-mechanical-link');
            linkIds.add(mechanicalLinkId);
            copiedLinks.push(copy);
          }
          blocksByKey = candidateBlocks;
          blocksById = candidateById;
          for (const link of copiedLinks) mechanicalLinksById.set(link.mechanicalLinkId, link);
          const event = emit(label, { added: validation.additions, mechanicalLinksAdded: copiedLinks });
          return makeResult(true, '', {
            event,
            blocks: validation.additions,
            mechanicalLinks: freezeList(copiedLinks),
            blockIdMap: Object.freeze(Object.fromEntries(idMap))
          });
        }

        function toDocument(settings = {}) {
          return blueprint.createDocument({
            assemblySpaces: assemblySpaces(),
            blocks: values().map(block => ({
              blockId: block.blockId,
              assemblySpaceId: block.assemblySpaceId,
              x: block.x, y: block.y, z: block.z,
              type: block.type,
              orientation: block.orientation,
              controlAxis: block.controlAxis,
              controlSign: block.controlSign
            })),
            mechanicalLinks: mechanicalLinks(),
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
          const rootOnly = spacesById.size === 1 && spacesById.has(AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID);
          if (blocksByKey.size === 0 && mechanicalLinksById.size === 0 && rootOnly) return makeResult(true, 'unchanged', { event: null });
          const removed = [...blocksByKey.values()];
          const removedLinks = [...mechanicalLinksById.values()];
          const removedSpaces = [...spacesById.values()].filter(space => space.assemblySpaceId !== AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID);
          blocksByKey = new Map();
          blocksById = new Map();
          mechanicalLinksById = new Map();
          replaceSpaces([AssemblySpaces.createRootSpace()]);
          return makeResult(true, '', { event: emit(label, { removed, mechanicalLinksRemoved: removedLinks, assemblySpacesRemoved: removedSpaces }) });
        }

        const api = {
          get, getById, keyForId, has, keys, values, entries, snapshot, subscribe,
          isContiguous, neighborCount, validateAddMany, addMany, add, validateRemove, remove, move, replace,
          mechanicalLinks, getMechanicalLink, linksForBlock, addMechanicalLink, updateMechanicalLink, removeMechanicalLink,
          assemblySpaces, getAssemblySpace, createAssemblySpace, updateAssemblySpace, reparentAssemblySpace, removeAssemblySpace, reassignBlock,
          replaceDocument, loadDocument, copySubgraph, toDocument, clear
        };
        Object.defineProperties(api, {
          size: { enumerable: true, get: () => blocksByKey.size },
          mechanicalLinkCount: { enumerable: true, get: () => mechanicalLinksById.size },
          assemblySpaceCount: { enumerable: true, get: () => spacesById.size },
          revision: { enumerable: true, get: () => revision }
        });
        Object.freeze(api);

        const initialDocument = Array.isArray(initial) ? blueprint.createDocument({ blocks: initial, mechanicalLinks: [] }) : initial;
        if (Array.isArray(initial)
          ? initial.length
          : initialDocument?.blocks?.length || initialDocument?.mechanicalLinks?.length || initialDocument?.assemblySpaces?.length > 1) {
          const result = replaceDocument(initialDocument, 'initialize');
          if (!result.ok) throw new Error(`CraftModel initialization failed: ${result.reason}`);
        }
        return api;
      }

      return Object.freeze({
        schemaVersion: SAVE_VERSION,
        canonicalBlock,
        canonicalMechanicalLink,
        connectedKeys,
        validateMap,
        create
      });
    }
  );
})();
