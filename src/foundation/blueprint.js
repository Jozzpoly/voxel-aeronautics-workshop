(() => {
  'use strict';

  window.VAW.define(
    'foundation.blueprint',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.assembly-spaces'],
    (config, catalog, orientation, AssemblySpaces) => {
      const { GRID, SAVE_VERSION, SYMMETRY_MODES, CONTROL_AXES, CONTROL_SIGNS, NEIGHBOR_DIRECTIONS } = config;
      const { BLOCKS } = catalog;
      const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
      const FACE_VECTORS = Object.freeze({
        PX: Object.freeze([1, 0, 0]), NX: Object.freeze([-1, 0, 0]),
        PY: Object.freeze([0, 1, 0]), NY: Object.freeze([0, -1, 0]),
        PZ: Object.freeze([0, 0, 1]), NZ: Object.freeze([0, 0, -1])
      });
      const FACE_IDS = Object.freeze(Object.keys(FACE_VECTORS));
      const OPPOSITE_FACE = Object.freeze({ PX: 'NX', NX: 'PX', PY: 'NY', NY: 'PY', PZ: 'NZ', NZ: 'PZ' });

      function makeKey(x, y, z) { return `${x},${y},${z}`; }
      function makeOwnedKey(assemblySpaceId, x, y, z) { return AssemblySpaces.ownedGridKey(assemblySpaceId, x, y, z); }
      function clamp01(value) { return Math.max(0, Math.min(1, value)); }
      function normalizeControlAxis(value) { return CONTROL_AXES.includes(value) ? value : 'pitch'; }
      function normalizeControlSign(value) {
        const numeric = Number(value);
        return CONTROL_SIGNS.includes(numeric) ? numeric : 0;
      }
      function normalizeEntityId(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim();
        return ENTITY_ID_PATTERN.test(normalized) ? normalized : null;
      }
      const normalizeBlockId = normalizeEntityId;
      const normalizeMechanicalLinkId = normalizeEntityId;
      const normalizeAssemblySpaceId = AssemblySpaces.normalizeAssemblySpaceId;
      function normalizeFaceId(value) { return FACE_IDS.includes(value) ? value : null; }
      function baseBlockId(x, y, z, assemblySpaceId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) {
        const owner = normalizeAssemblySpaceId(assemblySpaceId) || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
        return owner === AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID
          ? `block:${x}:${y}:${z}`
          : `block:${owner}:${x}:${y}:${z}`;
      }
      function allocateBlockId(value, x, y, z, usedIds = new Set(), assemblySpaceId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID) {
        const requested = normalizeBlockId(value);
        const base = requested || baseBlockId(x, y, z, assemblySpaceId);
        if (!usedIds.has(base)) return base;
        let suffix = 2;
        while (usedIds.has(`${base}~${suffix}`)) suffix += 1;
        return `${base}~${suffix}`;
      }
      function isWithinGrid(x, y, z) {
        return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
          && x >= -GRID.halfExtent && x <= GRID.halfExtent
          && z >= -GRID.halfExtent && z <= GRID.halfExtent
          && y >= GRID.minY && y <= GRID.maxY;
      }

      function canonicalBlock(block, usedIds = new Set(), { strictId = false, strictAssemblySpace = false } = {}) {
        if (!block || typeof block !== 'object' || !BLOCKS[block.type]) return null;
        const x = Number(block.x); const y = Number(block.y); const z = Number(block.z);
        if (![x, y, z].every(Number.isInteger) || !isWithinGrid(x, y, z)) return null;
        const requested = normalizeBlockId(block.blockId);
        if (strictId && (!requested || usedIds.has(requested))) return null;
        const requestedSpace = normalizeAssemblySpaceId(block.assemblySpaceId);
        if (strictAssemblySpace && !requestedSpace) return null;
        const assemblySpaceId = requestedSpace || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
        const definition = BLOCKS[block.type];
        const blockId = strictId ? requested : allocateBlockId(requested, x, y, z, usedIds, assemblySpaceId);
        usedIds.add(blockId);
        return {
          blockId,
          assemblySpaceId,
          x, y, z,
          type: block.type,
          orientation: definition?.orientationMode === 'none'
            ? orientation.DEFAULT_ORIENTATION
            : orientation.normalizeOrientationId(block.orientation),
          controlAxis: normalizeControlAxis(block.controlAxis),
          controlSign: normalizeControlSign(block.controlSign)
        };
      }

      function finiteNumber(value, fallback) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
      }

      function canonicalLimits(value) {
        if (value == null) return null;
        if (!value || typeof value !== 'object') return null;
        const minAngle = Number(value.minAngle); const maxAngle = Number(value.maxAngle);
        const tolerance = value.tolerance == null ? 0.01 : Number(value.tolerance);
        const maxTorque = value.maxTorque == null ? 80 : Number(value.maxTorque);
        const maxSpeed = value.maxSpeed == null ? 5 : Number(value.maxSpeed);
        const positionGain = value.positionGain == null ? 16 : Number(value.positionGain);
        const velocityDamping = value.velocityDamping == null ? 1.5 : Number(value.velocityDamping);
        if (!Number.isFinite(minAngle) || !Number.isFinite(maxAngle) || !(minAngle < maxAngle)) return null;
        if (!Number.isFinite(tolerance) || tolerance < 0) return null;
        if (!Number.isFinite(maxTorque) || maxTorque <= 0) return null;
        if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) return null;
        if (!Number.isFinite(positionGain) || positionGain <= 0) return null;
        if (!Number.isFinite(velocityDamping) || velocityDamping < 0) return null;
        return { minAngle, maxAngle, tolerance, maxTorque, maxSpeed, positionGain, velocityDamping };
      }

      function canonicalMechanicalLink(raw, usedIds = new Set(), { strictId = true, strictAssemblySpace = false } = {}) {
        if (!raw || typeof raw !== 'object' || raw.kind !== 'hinge') return null;
        const requestedId = normalizeMechanicalLinkId(raw.mechanicalLinkId);
        if (strictId && (!requestedId || usedIds.has(requestedId))) return null;
        const mechanicalLinkId = requestedId;
        if (!mechanicalLinkId) return null;
        const blockAId = normalizeBlockId(raw.endpointA?.blockId);
        const blockBId = normalizeBlockId(raw.endpointB?.blockId);
        const faceA = normalizeFaceId(raw.endpointA?.face);
        const faceB = normalizeFaceId(raw.endpointB?.face);
        const axis = normalizeFaceId(raw.axis);
        const requestedSpace = normalizeAssemblySpaceId(raw.assemblySpaceId);
        if (strictAssemblySpace && !requestedSpace) return null;
        if (!blockAId || !blockBId || blockAId === blockBId || !faceA || !faceB || !axis) return null;
        const maxForce = Number(raw.maxForce ?? 1000000);
        const frictionTorque = Number(raw.frictionTorque ?? 0);
        if (!Number.isFinite(maxForce) || maxForce <= 0 || !Number.isFinite(frictionTorque) || frictionTorque < 0) return null;
        const limits = raw.limits == null ? null : canonicalLimits(raw.limits);
        if (raw.limits != null && !limits) return null;
        usedIds.add(mechanicalLinkId);
        return {
          mechanicalLinkId,
          assemblySpaceId: requestedSpace || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
          kind: 'hinge',
          endpointA: { blockId: blockAId, face: faceA },
          endpointB: { blockId: blockBId, face: faceB },
          axis,
          collideConnected: raw.collideConnected === true,
          maxForce,
          frictionTorque,
          limits
        };
      }

      function sortBlocks(blocks) {
        return blocks.sort((a, b) =>
          a.assemblySpaceId.localeCompare(b.assemblySpaceId)
          || (a.y - b.y) || (a.x - b.x) || (a.z - b.z)
          || a.type.localeCompare(b.type) || a.blockId.localeCompare(b.blockId)
        );
      }
      function sortMechanicalLinks(links) { return links.sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId)); }
      function sortAssemblySpaces(spaces) {
        const indexed = AssemblySpaces.validateAndIndex(spaces, { allowDefaultRoot: false });
        return indexed.ok ? [...indexed.spaces] : [];
      }

      function currentSettings(data = {}) {
        const selectedBlock = BLOCKS[data.selectedBlock] ? data.selectedBlock : 'Hull';
        return {
          selectedBlock,
          orientation: BLOCKS[selectedBlock]?.orientationMode === 'none'
            ? orientation.DEFAULT_ORIENTATION
            : orientation.normalizeOrientationId(data.selectedOrientation ?? data.orientation),
          symmetry: SYMMETRY_MODES.includes(data.symmetry) ? data.symmetry : 'NONE',
          thrusterPower: clamp01(Number.isFinite(data.thrusterPower) ? data.thrusterPower : 0.7),
          balloonPower: clamp01(Number.isFinite(data.balloonPower) ? data.balloonPower : 0.7),
          stabilityAssist: clamp01(Number.isFinite(data.stabilityAssist) ? data.stabilityAssist : 0.18),
          controlAxis: normalizeControlAxis(data.controlAxis),
          controlSign: normalizeControlSign(data.controlSign)
        };
      }

      function resolveLinkOwner(raw, blocksById, spacesOrIndex) {
        const aSpace = blocksById.get(String(raw?.endpointA?.blockId))?.assemblySpaceId;
        const bSpace = blocksById.get(String(raw?.endpointB?.blockId))?.assemblySpaceId;
        return aSpace && bSpace ? AssemblySpaces.lowestCommonAncestor(aSpace, bSpace, spacesOrIndex) : null;
      }

      function createDocument({ blocks = [], mechanicalLinks = [], assemblySpaces = null, ...settings } = {}) {
        const indexedSpaces = AssemblySpaces.validateAndIndex(assemblySpaces, { allowDefaultRoot: true });
        if (!indexedSpaces.ok) throw new TypeError('Cannot create blueprint from invalid assembly spaces.');
        const usedBlockIds = new Set();
        const canonicalBlocks = [];
        const blocksById = new Map();
        const occupied = new Set();
        for (const block of blocks) {
          const canonical = canonicalBlock(block, usedBlockIds, {
            strictId: block?.blockId != null,
            strictAssemblySpace: block?.assemblySpaceId != null
          });
          if (!canonical || !indexedSpaces.byId[canonical.assemblySpaceId]) throw new TypeError('Cannot create blueprint from an invalid block.');
          const key = makeOwnedKey(canonical.assemblySpaceId, canonical.x, canonical.y, canonical.z);
          if (occupied.has(key)) throw new TypeError('Cannot create blueprint with duplicate block positions in one assembly space.');
          occupied.add(key);
          canonicalBlocks.push(canonical);
          blocksById.set(canonical.blockId, canonical);
        }
        const usedLinkIds = new Set();
        const canonicalLinks = [];
        for (const raw of mechanicalLinks) {
          const owner = resolveLinkOwner(raw, blocksById, indexedSpaces);
          const canonical = canonicalMechanicalLink({ ...raw, assemblySpaceId: raw?.assemblySpaceId ?? owner }, usedLinkIds, {
            strictId: true,
            strictAssemblySpace: true
          });
          if (!canonical || !indexedSpaces.byId[canonical.assemblySpaceId]) throw new TypeError('Cannot create blueprint from an invalid mechanical link.');
          if (!blocksById.has(canonical.endpointA.blockId) || !blocksById.has(canonical.endpointB.blockId)) {
            throw new TypeError('Cannot create blueprint with an orphaned mechanical link.');
          }
          const expectedOwner = resolveLinkOwner(canonical, blocksById, indexedSpaces);
          if (canonical.assemblySpaceId !== expectedOwner) throw new TypeError('Mechanical link owner must be the lowest common assembly space ancestor.');
          canonicalLinks.push(canonical);
        }
        return {
          version: SAVE_VERSION,
          assemblySpaces: sortAssemblySpaces(indexedSpaces.spaces),
          blocks: sortBlocks(canonicalBlocks),
          mechanicalLinks: sortMechanicalLinks(canonicalLinks),
          ...currentSettings(settings)
        };
      }

      function clone(document) { return JSON.parse(JSON.stringify(document)); }
      function signature(document) { return JSON.stringify(document); }

      function projectVector(value, length) {
        if (Array.isArray(value)) return value.slice(0, length);
        if (!value || typeof value !== 'object') return value;
        return length === 4
          ? [value.x, value.y, value.z, value.w]
          : [value.x, value.y, value.z];
      }

      function projectPose(value) {
        if (!value || typeof value !== 'object') return value;
        return {
          position: projectVector(value.position, 3),
          quaternion: projectVector(value.quaternion, 4)
        };
      }

      function projectLimits(value) {
        if (value == null || typeof value !== 'object') return value;
        return {
          minAngle: value.minAngle,
          maxAngle: value.maxAngle,
          tolerance: value.tolerance,
          maxTorque: value.maxTorque,
          maxSpeed: value.maxSpeed,
          positionGain: value.positionGain,
          velocityDamping: value.velocityDamping
        };
      }

      function projectBlock(value) {
        if (!value || typeof value !== 'object') return value;
        return {
          blockId: value.blockId,
          assemblySpaceId: value.assemblySpaceId,
          x: value.x,
          y: value.y,
          z: value.z,
          type: value.type,
          orientation: value.orientation,
          controlAxis: value.controlAxis,
          controlSign: value.controlSign
        };
      }

      function projectMechanicalLink(value) {
        if (!value || typeof value !== 'object') return value;
        return {
          mechanicalLinkId: value.mechanicalLinkId,
          assemblySpaceId: value.assemblySpaceId,
          kind: value.kind,
          endpointA: value.endpointA && typeof value.endpointA === 'object'
            ? { blockId: value.endpointA.blockId, face: value.endpointA.face }
            : value.endpointA,
          endpointB: value.endpointB && typeof value.endpointB === 'object'
            ? { blockId: value.endpointB.blockId, face: value.endpointB.face }
            : value.endpointB,
          axis: value.axis,
          collideConnected: value.collideConnected,
          maxForce: value.maxForce,
          frictionTorque: value.frictionTorque,
          limits: projectLimits(value.limits)
        };
      }

      function projectAssemblySpace(value) {
        if (!value || typeof value !== 'object') return value;
        return {
          assemblySpaceId: value.assemblySpaceId,
          parentAssemblySpaceId: value.parentAssemblySpaceId,
          name: value.name,
          localPose: projectPose(value.localPose)
        };
      }

      function projectDocument(raw) {
        if (!raw || typeof raw !== 'object') return null;
        return {
          version: raw.version,
          assemblySpaces: Array.isArray(raw.assemblySpaces)
            ? raw.assemblySpaces.map(projectAssemblySpace)
            : raw.assemblySpaces,
          blocks: Array.isArray(raw.blocks) ? raw.blocks.map(projectBlock) : raw.blocks,
          mechanicalLinks: Array.isArray(raw.mechanicalLinks)
            ? raw.mechanicalLinks.map(projectMechanicalLink)
            : raw.mechanicalLinks,
          selectedBlock: raw.selectedBlock,
          selectedOrientation: raw.selectedOrientation,
          orientation: raw.orientation,
          symmetry: raw.symmetry,
          thrusterPower: raw.thrusterPower,
          balloonPower: raw.balloonPower,
          throttle: raw.throttle,
          stabilityAssist: raw.stabilityAssist,
          controlAxis: raw.controlAxis,
          controlSign: raw.controlSign
        };
      }

      function connectedCount(blocksByKey) {
        if (!(blocksByKey instanceof Map) || blocksByKey.size === 0) return 0;
        const firstKey = blocksByKey.keys().next().value;
        const visited = new Set([firstKey]);
        const queue = [firstKey];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const current = blocksByKey.get(queue[cursor]);
          if (!current) continue;
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const next = makeOwnedKey(current.assemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID, current.x + dx, current.y + dy, current.z + dz);
            if (blocksByKey.has(next) && !visited.has(next)) { visited.add(next); queue.push(next); }
          }
        }
        return visited.size;
      }

      function migrateV10ToV11(document) {
        if (!document || Number(document.version) !== 10) throw new TypeError('migrateV10ToV11 requires a v10 document.');
        return { ...projectDocument(document), version: 11, mechanicalLinks: [] };
      }

      function migrateV11ToV12(document) {
        if (!document || Number(document.version) !== 11) throw new TypeError('migrateV11ToV12 requires a v11 document.');
        const projected = projectDocument(document);
        const rootId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
        return {
          ...projected,
          version: 12,
          assemblySpaces: [AssemblySpaces.createRootSpace()],
          blocks: (Array.isArray(projected.blocks) ? projected.blocks : []).map(block => ({ ...block, assemblySpaceId: rootId })),
          mechanicalLinks: (Array.isArray(projected.mechanicalLinks) ? projected.mechanicalLinks : []).map(link => ({ ...link, assemblySpaceId: rootId }))
        };
      }

      function migrateLegacyVersionToNext(document, expectedVersion) {
        if (!document || Number(document.version) !== expectedVersion) {
          throw new TypeError(`Legacy migration requires a v${expectedVersion} document.`);
        }
        return { ...projectDocument(document), version: expectedVersion + 1 };
      }

      const MIGRATIONS = Object.freeze({
        3: document => migrateLegacyVersionToNext(document, 3),
        4: document => migrateLegacyVersionToNext(document, 4),
        5: document => migrateLegacyVersionToNext(document, 5),
        6: document => migrateLegacyVersionToNext(document, 6),
        7: document => migrateLegacyVersionToNext(document, 7),
        8: document => migrateLegacyVersionToNext(document, 8),
        9: document => migrateLegacyVersionToNext(document, 9),
        10: migrateV10ToV11,
        11: migrateV11ToV12
      });

      function migrateToCurrent(raw) {
        if (!raw || typeof raw !== 'object') return null;
        let version = Number.isInteger(raw.version) ? raw.version : 3;
        if (version < 3 || version > SAVE_VERSION) return null;
        let document = projectDocument(raw);
        document.version = version;
        while (version < SAVE_VERSION) {
          const migration = MIGRATIONS[version];
          if (typeof migration !== 'function') return null;
          document = migration(document);
          if (!document || document.version !== version + 1) return null;
          version = document.version;
        }
        return document;
      }

      function normalize(data) {
        if (!data || !Array.isArray(data.blocks) || data.blocks.length > GRID.maxBlocks) return null;
        const originalVersion = Number.isInteger(data.version) ? data.version : 3;
        if (originalVersion < 3 || originalVersion > SAVE_VERSION) return null;
        const migrated = migrateToCurrent(data);
        if (!migrated || !Array.isArray(migrated.mechanicalLinks) || !Array.isArray(migrated.assemblySpaces)) return null;

        const indexedSpaces = AssemblySpaces.validateAndIndex(migrated.assemblySpaces, { allowDefaultRoot: false });
        if (!indexedSpaces.ok) return null;
        const normalizedByKey = new Map();
        const normalizedById = new Map();
        const usedIds = new Set();
        let coreCount = 0;
        for (const raw of migrated.blocks) {
          if (!raw || !BLOCKS[raw.type]) return null;
          const x = Number(raw.x); const y = Number(raw.y); const z = Number(raw.z);
          if (![x, y, z].every(Number.isInteger) || !isWithinGrid(x, y, z)) return null;
          const strictId = originalVersion >= 10;
          const strictAssemblySpace = originalVersion >= 12;
          const canonical = canonicalBlock({
            ...raw,
            orientation: orientation.normalizeSavedOrientation(raw.orientation, originalVersion, raw.type)
          }, usedIds, { strictId, strictAssemblySpace });
          if (!canonical || !indexedSpaces.byId[canonical.assemblySpaceId]) return null;
          const key = makeOwnedKey(canonical.assemblySpaceId, x, y, z);
          if (normalizedByKey.has(key)) return null;
          if (canonical.type === 'Core') {
            coreCount += 1;
            if (originalVersion <= 7 && makeKey(x, y, z) !== '0,0,0') return null;
          }
          normalizedByKey.set(key, canonical);
          normalizedById.set(canonical.blockId, canonical);
        }

        if (originalVersion <= 7 && coreCount === 0) {
          const rootId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
          const rootKey = makeOwnedKey(rootId, 0, 0, 0);
          if (normalizedByKey.has(rootKey)) return null;
          const canonical = canonicalBlock({ x: 0, y: 0, z: 0, type: 'Core', assemblySpaceId: rootId }, usedIds, { strictId: false, strictAssemblySpace: true });
          normalizedByKey.set(rootKey, canonical);
          normalizedById.set(canonical.blockId, canonical);
          coreCount = 1;
        }
        if (coreCount > 1) return null;
        if (originalVersion <= 7 && normalizedByKey.size > 0 && connectedCount(normalizedByKey) !== normalizedByKey.size) return null;

        const usedLinkIds = new Set();
        const mechanicalLinks = [];
        for (const raw of migrated.mechanicalLinks) {
          const canonical = canonicalMechanicalLink(raw, usedLinkIds, {
            strictId: true,
            strictAssemblySpace: originalVersion >= 12
          });
          if (!canonical || !indexedSpaces.byId[canonical.assemblySpaceId]) return null;
          if (!normalizedById.has(canonical.endpointA.blockId) || !normalizedById.has(canonical.endpointB.blockId)) return null;
          const expectedOwner = resolveLinkOwner(canonical, normalizedById, indexedSpaces);
          if (!expectedOwner || canonical.assemblySpaceId !== expectedOwner) return null;
          mechanicalLinks.push(canonical);
        }

        const selectedBlock = BLOCKS[migrated.selectedBlock] ? migrated.selectedBlock : 'Hull';
        return {
          version: SAVE_VERSION,
          assemblySpaces: sortAssemblySpaces(indexedSpaces.spaces),
          blocks: sortBlocks([...normalizedByKey.values()]),
          mechanicalLinks: sortMechanicalLinks(mechanicalLinks),
          selectedBlock,
          orientation: BLOCKS[selectedBlock]?.orientationMode === 'none'
            ? orientation.DEFAULT_ORIENTATION
            : orientation.normalizeSavedOrientation(migrated.orientation, originalVersion, selectedBlock),
          symmetry: SYMMETRY_MODES.includes(migrated.symmetry) ? migrated.symmetry : 'NONE',
          thrusterPower: clamp01(typeof migrated.thrusterPower === 'number' ? migrated.thrusterPower : (typeof migrated.throttle === 'number' ? migrated.throttle : 0.7)),
          balloonPower: clamp01(typeof migrated.balloonPower === 'number' ? migrated.balloonPower : (typeof migrated.throttle === 'number' ? migrated.throttle : 0.7)),
          stabilityAssist: clamp01(typeof migrated.stabilityAssist === 'number' ? migrated.stabilityAssist : 0.18),
          controlAxis: normalizeControlAxis(migrated.controlAxis),
          controlSign: normalizeControlSign(migrated.controlSign)
        };
      }

      function historyWeight(document) {
        return (Array.isArray(document?.blocks) ? document.blocks.length : 0)
          + (Array.isArray(document?.mechanicalLinks) ? document.mechanicalLinks.length : 0)
          + (Array.isArray(document?.assemblySpaces) ? document.assemblySpaces.length : 0);
      }
      function trimHistory(stack, maxSnapshots, maxStoredParts) {
        let storedParts = stack.reduce((sum, document) => sum + historyWeight(document), 0);
        while (stack.length > maxSnapshots || (storedParts > maxStoredParts && stack.length > 1)) {
          storedParts -= historyWeight(stack.shift());
        }
        return storedParts;
      }

      return Object.freeze({
        FACE_IDS, FACE_VECTORS, OPPOSITE_FACE,
        ROOT_ASSEMBLY_SPACE_ID: AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
        makeKey, makeOwnedKey, isWithinGrid, normalizeControlAxis, normalizeControlSign,
        normalizeEntityId, normalizeBlockId, normalizeMechanicalLinkId, normalizeAssemblySpaceId, normalizeFaceId,
        baseBlockId, allocateBlockId, canonicalBlock, canonicalMechanicalLink, canonicalLimits,
        createDocument, clone, signature, projectDocument, normalize, migrateToCurrent, migrateV10ToV11, migrateV11ToV12,
        connectedCount, trimHistory, sortBlocks, sortMechanicalLinks, sortAssemblySpaces, resolveLinkOwner
      });
    }
  );
})();
