(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VAW_TERRAIN_AUTHORING_V1 = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const FORMAT = 'VAW_TERRAIN_AUTHORING_V1';
  const PRESET_ID = 'local_working_terrain';
  const TEXTURE_KINDS = Object.freeze(['checker', 'stripe', 'noise']);
  const DEFAULT_PAD_IDS = Object.freeze([
    'startPad', 'finishPad', 'weatherSpirePad', 'northPad', 'ridgePad',
    'southPad', 'towerPad', 'eastDepot', 'skyhookPad', 'frontierPad'
  ]);
  const DEFAULT_PAD_PREVIEW_POSITIONS = Object.freeze({
    startPad: Object.freeze({ x: 0, z: 0, label: 'Launch Yard' }),
    finishPad: Object.freeze({ x: 100, z: 0, label: 'Yard Receiver' }),
    weatherSpirePad: Object.freeze({ x: 174, z: -46, label: 'Weather Spire' }),
    northPad: Object.freeze({ x: 92, z: -108, label: 'North Survey' }),
    ridgePad: Object.freeze({ x: 172, z: -162, label: 'Ridge Shelf' }),
    southPad: Object.freeze({ x: 86, z: 120, label: 'South Basin' }),
    towerPad: Object.freeze({ x: 144, z: 188, label: 'Tower Service' }),
    eastDepot: Object.freeze({ x: 252, z: 70, label: 'East Depot' }),
    skyhookPad: Object.freeze({ x: 250, z: 178, label: 'Skyhook Mast' }),
    frontierPad: Object.freeze({ x: 312, z: -218, label: 'Frontier Relay' })
  });

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum, fallback) {
    return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
  }

  function hexToNumber(value, fallback = 0) {
    if (Number.isFinite(value)) return Math.max(0, Math.min(0xffffff, Math.round(value)));
    const text = String(value || '').trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(text)) return parseInt(text, 16);
    return fallback;
  }

  function numberToHex(value) {
    return `#${hexToNumber(value, 0).toString(16).padStart(6, '0')}`;
  }

  function normalizeTexture(texture = {}, fallback = {}) {
    const kind = TEXTURE_KINDS.includes(String(texture.kind || '').trim()) ? String(texture.kind).trim() : (fallback.kind || 'checker');
    return {
      kind,
      colorA: hexToNumber(texture.colorA, hexToNumber(fallback.colorA, 0x15283a)),
      colorB: hexToNumber(texture.colorB, hexToNumber(fallback.colorB, 0x1b3349)),
      repeat: clamp(texture.repeat, 1, 128, finiteNumber(fallback.repeat, 16))
    };
  }

  function normalizeMaterial(material = {}, fallback = {}) {
    return {
      color: hexToNumber(material.color, hexToNumber(fallback.color, 0x15283a)),
      roughness: clamp(material.roughness, 0, 1, finiteNumber(fallback.roughness, 1)),
      opacity: clamp(material.opacity, 0.05, 1, finiteNumber(fallback.opacity, 1)),
      texture: normalizeTexture(material.texture || {}, fallback.texture || {})
    };
  }

  function normalizeMaterials(source = {}) {
    const materials = {};
    for (const [id, material] of Object.entries(source || {})) {
      if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) materials[id] = normalizeMaterial(material);
    }
    if (!Object.keys(materials).length) {
      materials.basin = normalizeMaterial({ color: 0x15283a, texture: { kind: 'checker', colorA: 0x15283a, colorB: 0x1b3349, repeat: 34 } });
      materials.routePaint = normalizeMaterial({ color: 0x93c5fd, opacity: 0.34, texture: { kind: 'stripe', colorA: 0x60a5fa, colorB: 0x1e3a8a, repeat: 12 } });
    }
    return materials;
  }

  function normalizePatch(patch = {}, fallbackMaterial = 'basin', index = 0) {
    return {
      id: String(patch.id || `terrain-patch-${index + 1}`).trim(),
      material: String(patch.material || fallbackMaterial).trim(),
      center: { x: finiteNumber(patch.center?.x, 0), z: finiteNumber(patch.center?.z, 0) },
      size: { x: Math.max(0.1, finiteNumber(patch.size?.x, 20)), z: Math.max(0.1, finiteNumber(patch.size?.z, 20)) },
      rotation: finiteNumber(patch.rotation, 0),
      opacity: patch.opacity === undefined ? undefined : clamp(patch.opacity, 0.05, 1, 1),
      layer: Math.max(0, Math.round(finiteNumber(patch.layer, 10)))
    };
  }

  function normalizeStrip(strip = {}, fallbackMaterial = 'routePaint', index = 0) {
    return {
      id: String(strip.id || `terrain-strip-${index + 1}`).trim(),
      fromPad: String(strip.fromPad || DEFAULT_PAD_IDS[0]).trim(),
      toPad: String(strip.toPad || DEFAULT_PAD_IDS[1]).trim(),
      width: Math.max(0.1, finiteNumber(strip.width, 8)),
      material: String(strip.material || fallbackMaterial).trim(),
      opacity: clamp(strip.opacity, 0.05, 1, 0.4),
      layer: Math.max(0, Math.round(finiteNumber(strip.layer, 20)))
    };
  }

  function normalizeTerrain(terrain = {}) {
    const materials = normalizeMaterials(terrain.materials || {});
    const materialIds = Object.keys(materials);
    const baseMaterial = materialIds.includes(terrain.baseMaterial) ? terrain.baseMaterial : materialIds[0];
    return {
      fog: {
        color: hexToNumber(terrain.fog?.color, 0x0b1220),
        density: clamp(terrain.fog?.density, 0.0001, 0.05, 0.0038)
      },
      baseMaterial,
      materials,
      patches: (Array.isArray(terrain.patches) ? terrain.patches : []).map((patch, index) => normalizePatch(patch, baseMaterial, index)),
      strips: (Array.isArray(terrain.strips) ? terrain.strips : []).map((strip, index) => normalizeStrip(strip, 'routePaint', index))
    };
  }

  function normalizePreset(document = {}) {
    const source = document && typeof document === 'object' ? document : {};
    return {
      format: FORMAT,
      presetId: String(source.presetId || PRESET_ID),
      version: String(source.version || '0.1.0-local.0'),
      metadata: {
        ...(source.metadata && typeof source.metadata === 'object' ? cloneJson(source.metadata) : {}),
        authority: 'renderer-only-terrain'
      },
      terrain: normalizeTerrain(source.terrain || {})
    };
  }

  function diagnosticsForPreset(preset, padIds = DEFAULT_PAD_IDS) {
    const normalized = normalizePreset(preset);
    const diagnostics = [];
    const padSet = new Set(padIds);
    const materialIds = new Set(Object.keys(normalized.terrain.materials));
    if (!materialIds.has(normalized.terrain.baseMaterial)) diagnostics.push({ severity: 'error', code: 'terrain.baseMaterialMissing', message: 'Base material must exist.' });
    for (const patch of normalized.terrain.patches) {
      if (!materialIds.has(patch.material)) diagnostics.push({ severity: 'error', code: 'terrain.patchMaterialMissing', message: `${patch.id} references missing material ${patch.material}.` });
    }
    for (const strip of normalized.terrain.strips) {
      if (!materialIds.has(strip.material)) diagnostics.push({ severity: 'error', code: 'terrain.stripMaterialMissing', message: `${strip.id} references missing material ${strip.material}.` });
      if (!padSet.has(strip.fromPad) || !padSet.has(strip.toPad)) diagnostics.push({ severity: 'error', code: 'terrain.stripPadMissing', message: `${strip.id} references a missing pad.` });
    }
    if (normalized.terrain.fog.density > 0.006) diagnostics.push({ severity: 'warning', code: 'terrain.fogDense', message: 'Fog above 0.006 may hide the expanded range.' });
    return diagnostics;
  }

  function defaultPreset() {
    return normalizePreset({
      terrain: {
        fog: { color: 0x0b1220, density: 0.0038 },
        baseMaterial: 'basin',
        materials: {
          basin: { color: 0x15283a, texture: { kind: 'checker', colorA: 0x15283a, colorB: 0x1b3349, repeat: 34 } },
          routePaint: { color: 0x93c5fd, opacity: 0.34, texture: { kind: 'stripe', colorA: 0x60a5fa, colorB: 0x1e3a8a, repeat: 12 } }
        },
        patches: [],
        strips: []
      }
    });
  }

  return Object.freeze({
    FORMAT, PRESET_ID, TEXTURE_KINDS, DEFAULT_PAD_IDS, DEFAULT_PAD_PREVIEW_POSITIONS,
    normalizePreset, normalizeTerrain, diagnosticsForPreset, defaultPreset,
    hexToNumber, numberToHex
  });
});
