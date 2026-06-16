(() => {
  'use strict';

  window.VAW.define(
    'foundation.blueprint',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation'],
    (config, catalog, orientation) => {
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
      function normalizeFaceId(value) { return FACE_IDS.includes(value) ? value : null; }
      function baseBlockId(x, y, z) { return `block:${x}:${y}:${z}`; }
      function allocateBlockId(value, x, y, z, usedIds = new Set()) {
        const requested = normalizeBlockId(value);
        const base = requested || baseBlockId(x, y, z);
        if (!usedIds.has(base)) return base;
        let suffix = 2;
        while (usedIds.has(`${base}~${suffix}`)) suffix += 1;
        return `${base}~${suffix}`;
      }
      function isWithinGrid(x, y, z) {
        return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
          x >= -GRID.halfExtent && x <= GRID.halfExtent &&
          z >= -GRID.halfExtent && z <= GRID.halfExtent &&
          y >= GRID.minY && y <= GRID.maxY;
      }

      function canonicalBlock(block, usedIds = new Set(), { strictId = false } = {}) {
        if (!block || typeof block !== 'object' || !BLOCKS[block.type]) return null;
        const x = Number(block.x); const y = Number(block.y); const z = Number(block.z);
        if (![x, y, z].every(Number.isInteger) || !isWithinGrid(x, y, z)) return null;
        const requested = normalizeBlockId(block.blockId);
        if (strictId && (!requested || usedIds.has(requested))) return null;
        const definition = BLOCKS[block.type];
        const blockId = strictId ? requested : allocateBlockId(requested, x, y, z, usedIds);
        usedIds.add(blockId);
        return {
          blockId, x, y, z, type: block.type,
          orientation: definition?.orientationMode === 'none'
            ? orientation.DEFAULT_ORIENTATION
            : orientation.normalizeOrientationId(block.orientation),
          controlAxis: normalizeControlAxis(block.controlAxis),
          controlSign: normalizeControlSign(block.controlSign)
        };
      }

      function canonicalLimits(value) {
        if (value == null) return null;
        if (!value || typeof value !== 'object') return null;
        const minAngle = Number(value.minAngle); const maxAngle = Number(value.maxAngle);
        if (!Number.isFinite(minAngle) || !Number.isFinite(maxAngle) || !(minAngle < maxAngle)) return null;
        const finiteOr = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
        return {
          minAngle, maxAngle,
          tolerance: Math.max(0, finiteOr(value.tolerance, 0.01)),
          maxTorque: Math.max(Number.MIN_VALUE, finiteOr(value.maxTorque, 80)),
          maxSpeed: Math.max(Number.MIN_VALUE, finiteOr(value.maxSpeed, 5)),
          positionGain: Math.max(Number.MIN_VALUE, finiteOr(value.positionGain, 16)),
          velocityDamping: Math.max(0, finiteOr(value.velocityDamping, 1.5))
        };
      }

      function canonicalMechanicalLink(raw, usedIds = new Set(), { strictId = true } = {}) {
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
        if (!blockAId || !blockBId || !faceA || !faceB || !axis) return null;
        const maxForce = Number(raw.maxForce ?? 1000000);
        const frictionTorque = Number(raw.frictionTorque ?? 0);
        if (!Number.isFinite(maxForce) || maxForce <= 0 || !Number.isFinite(frictionTorque) || frictionTorque < 0) return null;
        const limits = raw.limits == null ? null : canonicalLimits(raw.limits);
        if (raw.limits != null && !limits) return null;
        usedIds.add(mechanicalLinkId);
        return {
          mechanicalLinkId,
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
          (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type) || a.blockId.localeCompare(b.blockId)
        );
      }
      function sortMechanicalLinks(links) { return links.sort((a, b) => a.mechanicalLinkId.localeCompare(b.mechanicalLinkId)); }

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

      function createDocument({ blocks = [], mechanicalLinks = [], ...settings } = {}) {
        const usedBlockIds = new Set();
        const canonicalBlocks = [];
        for (const block of blocks) {
          const canonical = canonicalBlock(block, usedBlockIds, { strictId: block?.blockId != null });
          if (!canonical) throw new TypeError('Cannot create blueprint from an invalid block.');
          canonicalBlocks.push(canonical);
        }
        const usedLinkIds = new Set();
        const canonicalLinks = [];
        for (const link of mechanicalLinks) {
          const canonical = canonicalMechanicalLink(link, usedLinkIds, { strictId: true });
          if (!canonical) throw new TypeError('Cannot create blueprint from an invalid mechanical link.');
          canonicalLinks.push(canonical);
        }
        return {
          version: SAVE_VERSION,
          blocks: sortBlocks(canonicalBlocks),
          mechanicalLinks: sortMechanicalLinks(canonicalLinks),
          ...currentSettings(settings)
        };
      }

      function clone(document) { return JSON.parse(JSON.stringify(document)); }
      function signature(document) { return JSON.stringify(document); }

      function connectedCount(blocksByKey) {
        if (!(blocksByKey instanceof Map) || blocksByKey.size === 0) return 0;
        const firstKey = blocksByKey.keys().next().value;
        const visited = new Set([firstKey]);
        const queue = [firstKey];
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const [cx, cy, cz] = queue[cursor].split(',').map(Number);
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const next = makeKey(cx + dx, cy + dy, cz + dz);
            if (blocksByKey.has(next) && !visited.has(next)) { visited.add(next); queue.push(next); }
          }
        }
        return visited.size;
      }

      function migrateV10ToV11(document) {
        if (!document || Number(document.version) !== 10) throw new TypeError('migrateV10ToV11 requires a v10 document.');
        return { ...clone(document), version: 11, mechanicalLinks: [] };
      }

      function migrateLegacyVersionToNext(document, expectedVersion) {
        if (!document || Number(document.version) !== expectedVersion) {
          throw new TypeError(`Legacy migration requires a v${expectedVersion} document.`);
        }
        return { ...clone(document), version: expectedVersion + 1 };
      }

      const MIGRATIONS = Object.freeze({
        3: document => migrateLegacyVersionToNext(document, 3),
        4: document => migrateLegacyVersionToNext(document, 4),
        5: document => migrateLegacyVersionToNext(document, 5),
        6: document => migrateLegacyVersionToNext(document, 6),
        7: document => migrateLegacyVersionToNext(document, 7),
        8: document => migrateLegacyVersionToNext(document, 8),
        9: document => migrateLegacyVersionToNext(document, 9),
        10: migrateV10ToV11
      });

      function migrateToCurrent(raw) {
        if (!raw || typeof raw !== 'object') return null;
        let version = Number.isInteger(raw.version) ? raw.version : 3;
        if (version < 3 || version > SAVE_VERSION) return null;
        let document = clone(raw);
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
        if (!migrated || !Array.isArray(migrated.mechanicalLinks)) return null;

        const normalizedByKey = new Map();
        const usedIds = new Set();
        let coreCount = 0;
        for (const raw of migrated.blocks) {
          if (!raw || !BLOCKS[raw.type]) return null;
          const x = Number(raw.x); const y = Number(raw.y); const z = Number(raw.z);
          if (![x, y, z].every(Number.isInteger) || !isWithinGrid(x, y, z)) return null;
          const key = makeKey(x, y, z);
          if (normalizedByKey.has(key)) return null;
          const strictId = originalVersion >= 10;
          const canonical = canonicalBlock({
            ...raw,
            orientation: orientation.normalizeSavedOrientation(raw.orientation, originalVersion, raw.type)
          }, usedIds, { strictId });
          if (!canonical) return null;
          if (canonical.type === 'Core') {
            coreCount += 1;
            if (originalVersion <= 7 && key !== '0,0,0') return null;
          }
          normalizedByKey.set(key, canonical);
        }

        if (originalVersion <= 7 && coreCount === 0) {
          if (normalizedByKey.has('0,0,0')) return null;
          const canonical = canonicalBlock({ x: 0, y: 0, z: 0, type: 'Core' }, usedIds, { strictId: false });
          normalizedByKey.set('0,0,0', canonical);
          coreCount = 1;
        }
        if (coreCount > 1) return null;
        if (originalVersion <= 7 && normalizedByKey.size > 0 && connectedCount(normalizedByKey) !== normalizedByKey.size) return null;

        const usedLinkIds = new Set();
        const mechanicalLinks = [];
        for (const raw of migrated.mechanicalLinks) {
          const canonical = canonicalMechanicalLink(raw, usedLinkIds, { strictId: true });
          if (!canonical) return null;
          mechanicalLinks.push(canonical);
        }

        const selectedBlock = BLOCKS[migrated.selectedBlock] ? migrated.selectedBlock : 'Hull';
        return {
          version: SAVE_VERSION,
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
          + (Array.isArray(document?.mechanicalLinks) ? document.mechanicalLinks.length : 0);
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
        makeKey, isWithinGrid, normalizeControlAxis, normalizeControlSign,
        normalizeEntityId, normalizeBlockId, normalizeMechanicalLinkId, normalizeFaceId,
        baseBlockId, allocateBlockId, canonicalBlock, canonicalMechanicalLink, canonicalLimits,
        createDocument, clone, signature, normalize, migrateToCurrent, migrateV10ToV11,
        connectedCount, trimHistory, sortBlocks, sortMechanicalLinks
      });
    }
  );
})();
