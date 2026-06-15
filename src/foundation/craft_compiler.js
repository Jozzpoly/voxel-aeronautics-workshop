(() => {
  'use strict';

  window.VAW.define(
    'foundation.craft-compiler',
    ['foundation.config', 'foundation.catalog', 'foundation.orientation', 'foundation.blueprint', 'foundation.control-frame'],
    (config, catalog, orientation, blueprint, ControlFrame) => {
      const { GRID, NEIGHBOR_DIRECTIONS } = config;
      const { BLOCKS } = catalog;
      const cache = new WeakMap();

      function deepFreeze(value, seen = new Set()) {
        if (!value || typeof value !== 'object' || seen.has(value)) return value;
        seen.add(value);
        for (const nested of Object.values(value)) deepFreeze(nested, seen);
        return Object.freeze(value);
      }

      function vec(x = 0, y = 0, z = 0) { return [x, y, z]; }
      function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
      function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
      function scale(a, scalar) { return [a[0] * scalar, a[1] * scalar, a[2] * scalar]; }
      function cross(a, b) {
        return [
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]
        ];
      }

      function basisValues(orientationId) {
        const basis = orientation.ORIENTATION_BASES[orientation.normalizeOrientationId(orientationId)];
        return {
          forward: vec(basis.forward.x, basis.forward.y, basis.forward.z),
          up: vec(basis.up.x, basis.up.y, basis.up.z),
          span: vec(basis.span.x, basis.span.y, basis.span.z)
        };
      }

      function stableHash(text) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
      }

      function canonicalInput(source) {
        if (source && typeof source.snapshot === 'function' && typeof source.revision === 'number') {
          const snapshot = source.snapshot();
          return { model: source, revision: snapshot.revision, blocks: snapshot.blocks };
        }
        if (Array.isArray(source)) return { model: null, revision: -1, blocks: source };
        if (source && Array.isArray(source.blocks)) {
          return { model: null, revision: Number.isInteger(source.revision) ? source.revision : -1, blocks: source.blocks };
        }
        return { model: null, revision: -1, blocks: [] };
      }

      function compile(source) {
        const input = canonicalInput(source);
        if (input.model) {
          const cached = cache.get(input.model);
          if (cached && cached.revision === input.revision) return cached.compiled;
        }

        const errors = [];
        const warnings = [];
        const normalized = [];
        const seen = new Set();
        const seenBlockIds = new Set();
        let coreCount = 0;

        if (input.blocks.length > GRID.maxBlocks) errors.push('block-limit');
        for (const raw of input.blocks.slice(0, GRID.maxBlocks + 1)) {
          const x = Number(raw?.x);
          const y = Number(raw?.y);
          const z = Number(raw?.z);
          if (![x, y, z].every(Number.isInteger) || !blueprint.isWithinGrid(x, y, z) || !BLOCKS[raw?.type]) {
            errors.push('invalid-block');
            continue;
          }
          const key = blueprint.makeKey(x, y, z);
          if (seen.has(key)) {
            errors.push('duplicate-position');
            continue;
          }
          seen.add(key);
          const requestedBlockId = blueprint.normalizeBlockId(raw.blockId);
          const blockId = blueprint.allocateBlockId(requestedBlockId, x, y, z, seenBlockIds);
          if (requestedBlockId && seenBlockIds.has(requestedBlockId)) errors.push('duplicate-block-id');
          seenBlockIds.add(blockId);
          if (raw.type === 'Core') coreCount += 1;
          const orientationMode = BLOCKS[raw.type].orientationMode || 'none';
          normalized.push({
            blockId,
            key,
            x,
            y,
            z,
            type: raw.type,
            orientation: orientationMode === 'none'
              ? orientation.DEFAULT_ORIENTATION
              : orientation.normalizeOrientationId(raw.orientation),
            controlAxis: blueprint.normalizeControlAxis(raw.controlAxis),
            controlSign: blueprint.normalizeControlSign(raw.controlSign)
          });
        }

        normalized.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.z - b.z) || a.type.localeCompare(b.type));
        if (normalized.length === 0) errors.push('empty-craft');
        if (coreCount === 0) errors.push('missing-core');
        if (coreCount > 1) errors.push('multiple-cores');

        const keyToIndex = Object.create(null);
        const blockIdToIndex = Object.create(null);
        normalized.forEach((block, index) => { keyToIndex[block.key] = index; blockIdToIndex[block.blockId] = index; });
        const adjacency = normalized.map(() => []);
        for (let index = 0; index < normalized.length; index += 1) {
          const block = normalized[index];
          for (const [dx, dy, dz] of NEIGHBOR_DIRECTIONS) {
            const neighbor = keyToIndex[blueprint.makeKey(block.x + dx, block.y + dy, block.z + dz)];
            if (neighbor !== undefined) adjacency[index].push(neighbor);
          }
          adjacency[index].sort((a, b) => a - b);
        }

        let connectedCount = 0;
        if (normalized.length) {
          const visited = new Set([0]);
          const queue = [0];
          for (let cursor = 0; cursor < queue.length; cursor += 1) {
            for (const neighbor of adjacency[queue[cursor]]) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
          connectedCount = visited.size;
          if (connectedCount !== normalized.length) errors.push('disconnected');
        }

        const counts = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, 0]));
        let mass = 0;
        let fuelCapacity = 0;
        let dragArea = 0;
        let weightedPosition = vec();
        for (const block of normalized) {
          const def = BLOCKS[block.type];
          const partMass = Number(def.mass) || 0;
          mass += partMass;
          weightedPosition = add(weightedPosition, scale([block.x, block.y, block.z], partMass));
          fuelCapacity += Number(def.fuelCapacity) || 0;
          dragArea += Number(def.dragArea) || 0;
          counts[block.type] += 1;
        }
        const com = mass > 0 ? scale(weightedPosition, 1 / mass) : vec();
        const inertia = vec();
        const parts = [];
        const functionalByType = Object.fromEntries(Object.keys(BLOCKS).map(type => [type, []]));
        const colliderPlan = [];
        let coreIndex = -1;

        for (let index = 0; index < normalized.length; index += 1) {
          const block = normalized[index];
          const def = BLOCKS[block.type];
          const partMass = Number(def.mass) || 0;
          const position = [block.x, block.y, block.z];
          const offset = sub(position, com);
          const basis = basisValues(block.orientation);
          const fullForce = block.type === 'Thruster' || block.type === 'VectorThruster'
            ? scale(basis.forward, Number(def.force) || 0)
            : vec();
          const localTorque = cross(offset, fullForce);
          const cubeInertia = partMass / 6;
          inertia[0] += partMass * (offset[1] ** 2 + offset[2] ** 2) + cubeInertia;
          inertia[1] += partMass * (offset[0] ** 2 + offset[2] ** 2) + cubeInertia;
          inertia[2] += partMass * (offset[0] ** 2 + offset[1] ** 2) + cubeInertia;
          if (block.type === 'Core') coreIndex = index;

          const part = {
            index,
            blockId: block.blockId,
            key: block.key,
            grid: position,
            type: block.type,
            orientation: block.orientation,
            controlAxis: block.controlAxis,
            controlSign: block.controlSign,
            basis,
            mass: partMass,
            offset,
            fullForce,
            localTorque,
            neighbors: adjacency[index],
            properties: {
              force: Number(def.force) || 0,
              fuelRate: Number(def.fuelRate) || 0,
              fuelCapacity: Number(def.fuelCapacity) || 0,
              wingArea: Number(def.wingArea) || 0,
              dragArea: Number(def.dragArea) || 0,
              durability: Number(def.durability) || 60,
              structural: Number(def.structural) || 0
            }
          };
          parts.push(part);
          functionalByType[block.type].push(index);
          colliderPlan.push({ partIndex: index, kind: 'box', center: offset, halfExtents: [0.5, 0.5, 0.5] });
        }

        const controlFrame = ControlFrame.fromCore(coreIndex >= 0 ? parts[coreIndex] : null);

        if (normalized.length === 1) warnings.push('single-block-craft');
        if (counts.Thruster + counts.VectorThruster + counts.Balloon === 0) warnings.push('no-propulsion');
        if (normalized.length > config.PHYSICS.maxFlightParts) warnings.push('flight-part-limit');

        const canonicalSignature = normalized.map(block => [
          block.blockId, block.x, block.y, block.z, block.type, block.orientation, block.controlAxis, block.controlSign
        ]);
        const signature = stableHash(JSON.stringify(canonicalSignature));
        const uniqueErrors = [...new Set(errors)];
        const compiled = deepFreeze({
          format: 'VAW_COMPILED_CRAFT_V3',
          sourceRevision: input.revision,
          signature,
          ready: uniqueErrors.length === 0,
          errors: uniqueErrors,
          warnings: [...new Set(warnings)],
          blockCount: normalized.length,
          connectedCount,
          coreIndex,
          coreKey: coreIndex >= 0 ? normalized[coreIndex].key : null,
          corePosition: coreIndex >= 0 ? [normalized[coreIndex].x, normalized[coreIndex].y, normalized[coreIndex].z] : null,
          controlFrame,
          mass,
          gravity: config.AEROSTATICS.gravity,
          weight: mass * config.AEROSTATICS.gravity,
          fuelCapacity,
          dragArea,
          com,
          inertia,
          counts,
          keyToIndex,
          blockIdToIndex,
          adjacency,
          parts,
          functionalByType,
          colliderPlan
        });

        if (input.model) cache.set(input.model, { revision: input.revision, compiled });
        return compiled;
      }

      function invalidate(model) {
        if (model && typeof model === 'object') cache.delete(model);
      }

      return Object.freeze({ compile, invalidate, stableHash });
    }
  );
})();
