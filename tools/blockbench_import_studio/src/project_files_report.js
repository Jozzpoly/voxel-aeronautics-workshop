(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_PROJECT_FILES_REPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ktx2', 'basis']);
  const MODEL_EXTENSIONS = new Set(['gltf', 'glb']);

  function categorize(recordOrDep) {
    const ext = String(recordOrDep.extension || '').toLowerCase();
    const kind = String(recordOrDep.kind || '').toLowerCase();
    const name = String(recordOrDep.basename || recordOrDep.uri || recordOrDep.path || '').toLowerCase();
    if (MODEL_EXTENSIONS.has(ext) || kind === 'model') return 'model';
    if (ext === 'bin' || kind === 'buffer') return 'buffer';
    if (IMAGE_EXTENSIONS.has(ext) || kind === 'image' || kind === 'texture') return 'texture';
    if (/\.vaw\.json$/i.test(name) || /(^|\/)(vaw_visual_asset_pack_v1|visual_asset_pack_v1|visual_asset_manifest)(\.manifest)?\.json$/i.test(name) || kind === 'sidecar') return 'sidecar';
    return 'unknown';
  }

  function formatBytes(size) {
    const value = Number(size) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  function compactUri(uri, fallback = '') {
    const raw = String(uri || fallback || '');
    if (!raw) return '';
    if (/^data:/i.test(raw)) {
      const comma = raw.indexOf(',');
      const header = comma >= 0 ? raw.slice(0, comma) : raw.slice(0, 72);
      return `${header},… (${raw.length} chars)`;
    }
    return raw.length > 96 ? `${raw.slice(0, 96)}… (${raw.length} chars)` : raw;
  }

  function extensionForDependency(dep = {}) {
    const uri = String(dep.uri || '');
    if (/^data:image\/png/i.test(uri) || dep.mimeType === 'image/png') return 'png';
    if (/^data:image\/jpe?g/i.test(uri) || dep.mimeType === 'image/jpeg') return 'jpg';
    if (/^data:image\/webp/i.test(uri) || dep.mimeType === 'image/webp') return 'webp';
    if (uri.includes('.') && !/^data:/i.test(uri)) return uri.split('.').pop().toLowerCase();
    return '';
  }

  function dependencyDisplayName(dep = {}) {
    if (dep.status === 'embedded') {
      if (dep.kind === 'image') return `(embedded image #${dep.index ?? '?'})`;
      if (dep.kind === 'buffer') return `(embedded buffer #${dep.index ?? '?'})`;
      return `(embedded ${dep.kind || 'dependency'} #${dep.index ?? '?'})`;
    }
    const display = dep.displayUri || compactUri(dep.uri || '');
    return display ? String(display).split('/').pop() : '(missing uri)';
  }

  function dependencyDisplayPath(dep = {}) {
    if (dep.displayUri) return dep.displayUri;
    if (dep.status === 'embedded') return dependencyDisplayName(dep);
    return compactUri(dep.uri || '(missing dependency)');
  }

  function materialUsageIndexes(textureReport = null) {
    const byPath = new Map();
    const byImageIndex = new Map();
    if (!textureReport || !Array.isArray(textureReport.images) || !Array.isArray(textureReport.materials)) return { byPath, byImageIndex };
    const imagesByIndex = new Map(textureReport.images.map(image => [image.index, image]));
    for (const material of textureReport.materials) {
      for (const slot of material.slots || []) {
        const image = imagesByIndex.get(slot.imageIndex);
        if (!image) continue;
        const row = { material: material.name, slot: slot.slot, imageIndex: image.index, textureIndex: slot.textureIndex };
        if (!byImageIndex.has(image.index)) byImageIndex.set(image.index, []);
        byImageIndex.get(image.index).push(row);
        if (!image.path) continue;
        if (!byPath.has(image.path)) byPath.set(image.path, []);
        byPath.get(image.path).push(row);
      }
    }
    return { byPath, byImageIndex };
  }

  function materialUsageByPath(textureReport = null) {
    return materialUsageIndexes(textureReport).byPath;
  }

  function buildDependencyIndexes(dependencies = []) {
    const usedByPath = new Map();
    const ambiguousByPath = new Map();
    const virtual = [];
    for (const dep of dependencies || []) {
      if (dep.status === 'found' && dep.path) {
        if (!usedByPath.has(dep.path)) usedByPath.set(dep.path, []);
        usedByPath.get(dep.path).push(dep);
      } else if (dep.status === 'ambiguous') {
        for (const candidate of dep.candidates || []) {
          if (!ambiguousByPath.has(candidate)) ambiguousByPath.set(candidate, []);
          ambiguousByPath.get(candidate).push(dep);
        }
        virtual.push(dep);
      } else if (['missing', 'embedded', 'external'].includes(dep.status)) {
        virtual.push(dep);
      }
    }
    return { usedByPath, ambiguousByPath, virtual };
  }

  function sidecarState(record, sidecarParseReport = {}) {
    const recognized = new Set(sidecarParseReport.recognizedPaths || []);
    const invalid = new Set(sidecarParseReport.invalidPaths || []);
    return { recognized: recognized.has(record.normalizedPath), invalid: invalid.has(record.normalizedPath) };
  }

  function buildProjectFilesReport({ bundle = null, dependencies = [], textureReport = null, sidecarParseReport = {} } = {}) {
    const records = bundle && Array.isArray(bundle.records) ? bundle.records : [];
    const mainPath = bundle && bundle.mainModel ? bundle.mainModel.normalizedPath : null;
    const { usedByPath, ambiguousByPath, virtual } = buildDependencyIndexes(dependencies);
    const textureUsage = materialUsageIndexes(textureReport);
    const rows = [];

    for (const record of records) {
      const category = categorize(record);
      const sidecarInfo = category === 'sidecar' ? sidecarState(record, sidecarParseReport) : { recognized: false, invalid: false };
      let status = 'unused';
      if (record.normalizedPath === mainPath) status = 'main model';
      else if (ambiguousByPath.has(record.normalizedPath)) status = 'ambiguous';
      else if (usedByPath.has(record.normalizedPath)) status = 'dependency used';

      const usedByMaterialSlots = textureUsage.byPath.get(record.normalizedPath) || [];
      rows.push({
        id: `file:${record.normalizedPath}`,
        virtual: false,
        name: record.basename || record.name,
        relativePath: record.normalizedPath,
        extension: record.extension || '',
        size: record.size || 0,
        sizeLabel: formatBytes(record.size || 0),
        category,
        status,
        includeInDebugExport: true,
        includeInVawExport: status === 'main model' || status === 'dependency used' || sidecarInfo.recognized,
        textureUsedByMaterial: usedByMaterialSlots.length > 0,
        materialSlots: usedByMaterialSlots,
        sidecarRecognized: sidecarInfo.recognized,
        sidecarInvalid: sidecarInfo.invalid,
        dependencyRefs: usedByPath.get(record.normalizedPath) || ambiguousByPath.get(record.normalizedPath) || [],
        warning: status === 'unused' ? 'Loaded but not referenced by the current glTF. This is a neutral warning, not an import error.' : '',
      });
    }

    for (const dep of virtual) {
      const usedByMaterialSlots = dep.kind === 'image' ? (textureUsage.byImageIndex.get(dep.index) || []) : [];
      rows.push({
        id: `dependency:${dep.kind}:${dep.index}:${dep.displayUri || dep.uri || dep.status}`,
        virtual: true,
        name: dependencyDisplayName(dep),
        relativePath: dependencyDisplayPath(dep),
        rawUri: dep.uri || '',
        extension: extensionForDependency(dep),
        size: 0,
        sizeLabel: dep.status === 'embedded' ? 'embedded' : '0 B',
        category: categorize(dep),
        status: dep.status,
        includeInDebugExport: false,
        includeInVawExport: false,
        textureUsedByMaterial: usedByMaterialSlots.length > 0,
        materialSlots: usedByMaterialSlots,
        sidecarRecognized: false,
        sidecarInvalid: false,
        dependencyRefs: [dep],
        warning: dep.status === 'missing' ? 'Referenced by glTF but not found in the loaded files.' : dep.status === 'embedded' ? 'Embedded inside the glTF JSON; no separate file is required.' : dep.reason || '',
      });
    }

    const summary = {
      totalLoadedFiles: records.length,
      totalRows: rows.length,
      models: rows.filter(row => row.category === 'model' && !row.virtual).length,
      buffers: rows.filter(row => row.category === 'buffer' && !row.virtual).length,
      textures: rows.filter(row => row.category === 'texture').length,
      physicalTextures: rows.filter(row => row.category === 'texture' && !row.virtual).length,
      embeddedTextures: rows.filter(row => row.category === 'texture' && row.virtual && row.status === 'embedded').length,
      sidecars: rows.filter(row => row.category === 'sidecar' && !row.virtual).length,
      unknown: rows.filter(row => row.category === 'unknown' && !row.virtual).length,
      used: rows.filter(row => row.status === 'main model' || row.status === 'dependency used').length,
      unused: rows.filter(row => row.status === 'unused').length,
      missing: rows.filter(row => row.status === 'missing').length,
      ambiguous: rows.filter(row => row.status === 'ambiguous').length,
      embedded: rows.filter(row => row.status === 'embedded').length,
    };

    return { schemaVersion: 1, generatedBy: 'VAW Blockbench Import Studio Workbench Shell', summary, files: rows };
  }

  return Object.freeze({ buildProjectFilesReport, categorize, formatBytes, materialUsageByPath });
});
