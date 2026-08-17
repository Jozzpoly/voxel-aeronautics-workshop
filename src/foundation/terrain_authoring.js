(() => {
  'use strict';

  window.VAW.define('foundation.terrain-authoring', ['foundation.config'], Config => {
    const FORMAT = 'VAW_TERRAIN_AUTHORING_V1';
    const PRESET_ID = 'local_working_terrain';
    const LOCAL_PRESET_PATH = 'assets/terrain/local_working_terrain/VAW_TERRAIN_AUTHORING_V1.json';
    const TEXTURE_KINDS = Object.freeze(['checker', 'stripe', 'noise']);

    function cloneJson(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function finiteNumber(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function finiteColor(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(0xffffff, Math.round(number))) : fallback;
    }

    function clamp(value, minimum, maximum, fallback) {
      const number = finiteNumber(value, fallback);
      return Math.min(maximum, Math.max(minimum, number));
    }

    function normalizeTexture(texture = {}, fallback = {}) {
      const kind = TEXTURE_KINDS.includes(String(texture.kind || '').trim()) ? String(texture.kind).trim() : (fallback.kind || 'checker');
      return {
        kind,
        colorA: finiteColor(texture.colorA, finiteColor(fallback.colorA, 0x15283a)),
        colorB: finiteColor(texture.colorB, finiteColor(fallback.colorB, 0x1b3349)),
        repeat: clamp(texture.repeat, 1, 128, finiteNumber(fallback.repeat, 16))
      };
    }

    function normalizeMaterial(material = {}, fallback = {}) {
      return {
        color: finiteColor(material.color, finiteColor(fallback.color, 0x15283a)),
        roughness: clamp(material.roughness, 0, 1, finiteNumber(fallback.roughness, 1)),
        opacity: clamp(material.opacity, 0.05, 1, finiteNumber(fallback.opacity, 1)),
        texture: normalizeTexture(material.texture || {}, fallback.texture || {})
      };
    }

    function normalizeMaterials(source = {}, fallback = {}) {
      const ids = new Set([...Object.keys(fallback), ...Object.keys(source)]);
      const materials = {};
      for (const id of ids) {
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) continue;
        materials[id] = normalizeMaterial(source[id] || {}, fallback[id] || {});
      }
      return materials;
    }

    function normalizePatch(patch = {}, fallbackMaterial, index) {
      const id = String(patch.id || `terrain-patch-${index + 1}`).trim();
      return {
        id,
        material: String(patch.material || fallbackMaterial || '').trim(),
        center: {
          x: finiteNumber(patch.center?.x, 0),
          z: finiteNumber(patch.center?.z, 0)
        },
        size: {
          x: Math.max(0.1, finiteNumber(patch.size?.x, 1)),
          z: Math.max(0.1, finiteNumber(patch.size?.z, 1))
        },
        rotation: finiteNumber(patch.rotation, 0),
        opacity: patch.opacity === undefined ? undefined : clamp(patch.opacity, 0.05, 1, 1),
        layer: Math.max(0, Math.round(finiteNumber(patch.layer, 10)))
      };
    }

    function normalizeStrip(strip = {}, fallbackMaterial, index) {
      return {
        id: String(strip.id || `terrain-strip-${index + 1}`).trim(),
        fromPad: String(strip.fromPad || '').trim(),
        toPad: String(strip.toPad || '').trim(),
        width: Math.max(0.1, finiteNumber(strip.width, 1)),
        material: String(strip.material || fallbackMaterial || '').trim(),
        opacity: clamp(strip.opacity, 0.05, 1, 0.4),
        layer: Math.max(0, Math.round(finiteNumber(strip.layer, 20)))
      };
    }

    function normalizeTerrain(terrain = {}, defaults = Config.TEST_RANGE.terrain) {
      const fallbackMaterials = defaults?.materials || {};
      const materials = normalizeMaterials(terrain.materials || fallbackMaterials, fallbackMaterials);
      const materialIds = Object.keys(materials);
      const fallbackMaterial = materialIds.includes(terrain.baseMaterial) ? terrain.baseMaterial : (defaults?.baseMaterial || materialIds[0] || '');
      return {
        fog: {
          color: finiteColor(terrain.fog?.color, finiteColor(defaults?.fog?.color, 0x0b1220)),
          density: clamp(terrain.fog?.density, 0.0001, 0.05, finiteNumber(defaults?.fog?.density, 0.0038))
        },
        baseMaterial: materialIds.includes(fallbackMaterial) ? fallbackMaterial : materialIds[0],
        materials,
        patches: (Array.isArray(terrain.patches) ? terrain.patches : (defaults?.patches || []))
          .map((patch, index) => normalizePatch(patch, fallbackMaterial, index)),
        strips: (Array.isArray(terrain.strips) ? terrain.strips : (defaults?.strips || []))
          .map((strip, index) => normalizeStrip(strip, fallbackMaterial, index))
      };
    }

    function createPresetFromTestRange(testRange = Config.TEST_RANGE) {
      return {
        format: FORMAT,
        presetId: PRESET_ID,
        version: '0.1.0-local.0',
        metadata: {
          authority: 'renderer-only-terrain',
          source: 'TEST_RANGE.terrain',
          note: 'Local Studio terrain preset. It controls terrain appearance only.'
        },
        terrain: normalizeTerrain(testRange.terrain || Config.TEST_RANGE.terrain, Config.TEST_RANGE.terrain)
      };
    }

    function validateTerrain(terrain, testRange = Config.TEST_RANGE) {
      const diagnostics = [];
      const materials = terrain?.materials || {};
      const materialIds = new Set(Object.keys(materials));
      if (!materialIds.size) diagnostics.push({ severity: 'error', code: 'terrain.materialsMissing', message: 'Terrain preset needs at least one material.' });
      if (!materialIds.has(terrain?.baseMaterial)) diagnostics.push({ severity: 'error', code: 'terrain.baseMaterialMissing', message: `Base material "${terrain?.baseMaterial}" is not defined.` });
      for (const [materialId, material] of Object.entries(materials)) {
        if (!TEXTURE_KINDS.includes(material.texture?.kind)) diagnostics.push({ severity: 'error', code: 'terrain.textureKindInvalid', message: `${materialId} uses unsupported texture kind.` });
      }
      const seenPatchIds = new Set();
      for (const patch of terrain?.patches || []) {
        if (!patch.id || seenPatchIds.has(patch.id)) diagnostics.push({ severity: 'error', code: 'terrain.patchIdInvalid', message: `Patch id must be unique: ${patch.id || '<missing>'}.` });
        seenPatchIds.add(patch.id);
        if (!materialIds.has(patch.material)) diagnostics.push({ severity: 'error', code: 'terrain.patchMaterialMissing', message: `Patch ${patch.id} references missing material ${patch.material}.` });
        if (Math.abs(patch.center.x) > testRange.bounds || Math.abs(patch.center.z) > testRange.bounds) diagnostics.push({ severity: 'warning', code: 'terrain.patchOutsideBounds', message: `Patch ${patch.id} center is outside range bounds.` });
      }
      const pads = testRange.pads || {};
      const seenStripIds = new Set();
      for (const strip of terrain?.strips || []) {
        if (!strip.id || seenStripIds.has(strip.id)) diagnostics.push({ severity: 'error', code: 'terrain.stripIdInvalid', message: `Strip id must be unique: ${strip.id || '<missing>'}.` });
        seenStripIds.add(strip.id);
        if (!materialIds.has(strip.material)) diagnostics.push({ severity: 'error', code: 'terrain.stripMaterialMissing', message: `Strip ${strip.id} references missing material ${strip.material}.` });
        if (!pads[strip.fromPad] || !pads[strip.toPad]) diagnostics.push({ severity: 'error', code: 'terrain.stripPadMissing', message: `Strip ${strip.id} references missing pad.` });
      }
      return diagnostics;
    }

    function normalizePresetDocument(document = {}, defaults = Config.TEST_RANGE) {
      const source = document && typeof document === 'object' ? document : {};
      const terrain = normalizeTerrain(source.terrain || {}, defaults.terrain || Config.TEST_RANGE.terrain);
      return {
        preset: {
          format: FORMAT,
          presetId: String(source.presetId || PRESET_ID),
          version: String(source.version || '0.1.0-local.0'),
          metadata: {
            ...(source.metadata && typeof source.metadata === 'object' ? cloneJson(source.metadata) : {}),
            authority: 'renderer-only-terrain'
          },
          terrain
        },
        diagnostics: [
          ...(source.format && source.format !== FORMAT ? [{ severity: 'error', code: 'terrain.formatInvalid', message: `Terrain preset format must be ${FORMAT}.` }] : []),
          ...validateTerrain(terrain, defaults)
        ]
      };
    }

    function mergeTestRangeTerrain(testRange = Config.TEST_RANGE, presetDocument = null) {
      if (!presetDocument || typeof presetDocument !== 'object') return testRange;
      const { preset, diagnostics } = normalizePresetDocument(presetDocument, testRange);
      if (diagnostics.some(item => item.severity === 'error')) return testRange;
      return Config.deepFreeze({
        ...cloneJson(testRange),
        terrain: cloneJson(preset.terrain)
      });
    }

    return Object.freeze({
      FORMAT, PRESET_ID, LOCAL_PRESET_PATH, TEXTURE_KINDS,
      normalizeTerrain, validateTerrain, normalizePresetDocument,
      createPresetFromTestRange, mergeTestRangeTerrain
    });
  });
})();
