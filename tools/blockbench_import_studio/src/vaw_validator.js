(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_VALIDATOR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function collectNodeNames(gltfJson = {}) {
    return (gltfJson.nodes || []).map((node, index) => node.name || `node_${index}`);
  }

  function collectAnimationNames(gltfJson = {}) {
    return (gltfJson.animations || []).map((clip, index) => clip.name || `clip_${index}`);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function validateSidecarShape({ sidecar = null, gltfJson = {}, modelRecord = null } = {}) {
    const diagnostics = [];
    const nodeNames = collectNodeNames(gltfJson);
    const animationNames = collectAnimationNames(gltfJson);
    if (!sidecar) {
      diagnostics.push({ domain: 'vaw-readiness', severity: 'warning', code: 'vaw.noSidecar', message: 'No .vaw.json sidecar loaded. Model preview is valid, but VAW package export is not ready.' });
      return { ok: false, diagnostics, facts: { hasSidecar: false } };
    }
    if (!isPlainObject(sidecar)) {
      diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.sidecarNotObject', message: 'Sidecar must be a JSON object.' });
      return { ok: false, diagnostics, facts: { hasSidecar: true, validJsonObject: false } };
    }

    if (!Number.isInteger(sidecar.schemaVersion)) diagnostics.push({ domain: 'vaw-readiness', severity: 'warning', code: 'vaw.schemaVersionMissing', message: 'schemaVersion is missing or not an integer.' });
    if (!sidecar.assetId || typeof sidecar.assetId !== 'string') diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.assetIdMissing', message: 'assetId is required for VAW package export.' });
    if (!sidecar.kind || typeof sidecar.kind !== 'string') diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.kindMissing', message: 'kind is required for VAW package export.' });

    const modelPath = sidecar.model && sidecar.model.path;
    if (!modelPath) diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.modelPathMissing', message: 'model.path is required in the sidecar.' });
    else if (modelRecord && modelRecord.normalizedPath && modelPath !== modelRecord.normalizedPath) diagnostics.push({ domain: 'vaw-readiness', severity: 'warning', code: 'vaw.modelPathMismatch', message: `sidecar model.path '${modelPath}' does not match loaded model '${modelRecord.normalizedPath}'.` });

    const visualRoot = sidecar.semantics && sidecar.semantics.visualRoot && sidecar.semantics.visualRoot.node;
    if (!visualRoot) diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.missingVisualRoot', message: 'Missing visualRoot in VAW sidecar. This blocks VAW-ready export, not model preview.' });
    else if (nodeNames.length && !nodeNames.includes(visualRoot)) diagnostics.push({ domain: 'vaw-readiness', severity: 'error', code: 'vaw.visualRootNotFound', message: `visualRoot '${visualRoot}' was not found in loaded glTF nodes. Preview remains allowed.` });

    const clips = Array.isArray(sidecar.clips) ? sidecar.clips : [];
    for (const clip of clips) {
      if (!clip || typeof clip !== 'object') continue;
      if (clip.sourceClip && animationNames.length && !animationNames.includes(clip.sourceClip)) diagnostics.push({ domain: 'vaw-readiness', severity: 'warning', code: 'vaw.clipSourceNotFound', message: `sidecar clip source '${clip.sourceClip}' was not found in glTF animations.` });
    }

    const unknownTopLevel = Object.keys(sidecar).filter(key => !['schemaVersion', 'assetId', 'kind', 'model', 'moduleTypeBindings', 'semantics', 'sockets', 'clips', 'runtimePolicy', 'notes'].includes(key));
    if (unknownTopLevel.length) diagnostics.push({ domain: 'vaw-readiness', severity: 'info', code: 'vaw.unknownTopLevelFields', message: `Unknown sidecar fields kept as-is: ${unknownTopLevel.join(', ')}.` });

    const errors = diagnostics.filter(item => item.severity === 'error');
    return { ok: errors.length === 0, diagnostics, facts: { hasSidecar: true, visualRoot: visualRoot || null, assetId: sidecar.assetId || null, kind: sidecar.kind || null, clipCount: clips.length } };
  }

  function validateReadiness({ gltfJson = {}, sidecar = null, dependencies = [], modelRecord = null } = {}) {
    const diagnostics = [];
    const nodeNames = collectNodeNames(gltfJson);
    const counts = new Map();
    for (const name of nodeNames) counts.set(name, (counts.get(name) || 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    if (duplicates.length) diagnostics.push({ domain: 'vaw-readiness', severity: 'warning', code: 'gltf.duplicateNodeNames', message: `Duplicate node names: ${duplicates.join(', ')}. Preview is still allowed; semantic binding should use unique paths later.` });

    const hasEmissive = (gltfJson.materials || []).some(material => material.emissiveTexture || (Array.isArray(material.emissiveFactor) && material.emissiveFactor.some(value => value > 0)));
    if (!hasEmissive) diagnostics.push({ domain: 'vaw-readiness', severity: 'info', code: 'gltf.noEmissive', message: 'No emissive material detected. This is not an import/viewer error.' });

    const missingDeps = dependencies.filter(dep => dep.status === 'missing' || dep.status === 'ambiguous');
    for (const dep of missingDeps) diagnostics.push({ domain: 'viewer-import', severity: dep.status === 'ambiguous' ? 'error' : 'warning', code: `dependency.${dep.status}`, message: `${dep.kind} dependency ${dep.uri || '(empty)'} is ${dep.status}. Preview may use fallbacks if GLTFLoader can continue.` });

    const sidecarResult = validateSidecarShape({ sidecar, gltfJson, modelRecord });
    diagnostics.push(...sidecarResult.diagnostics);

    const viewerErrors = diagnostics.filter(item => item.domain === 'viewer-import' && item.severity === 'error');
    const vawErrors = diagnostics.filter(item => item.domain === 'vaw-readiness' && item.severity === 'error');
    return {
      viewerOk: viewerErrors.length === 0,
      vawReady: sidecarResult.ok && vawErrors.length === 0 && Boolean(sidecar),
      diagnostics,
      sidecarFacts: sidecarResult.facts,
    };
  }

  function inferSidecar(gltfJson = {}, modelRecord = null) {
    const nodes = collectNodeNames(gltfJson);
    const visualRoot = nodes.find(name => /root|body|mesh|cube|model/i.test(name)) || nodes[0] || '';
    const baseName = modelRecord && modelRecord.basename ? modelRecord.basename.replace(/\.[^.]+$/, '') : 'imported_asset';
    return {
      schemaVersion: 1,
      assetId: baseName.replace(/[^a-z0-9_\-]+/ig, '_').toLowerCase() || 'imported_asset',
      kind: 'moduleVisual',
      model: { path: modelRecord ? modelRecord.normalizedPath : '', format: modelRecord ? modelRecord.extension : 'gltf' },
      moduleTypeBindings: [],
      semantics: visualRoot ? { visualRoot: { node: visualRoot, required: true } } : {},
      sockets: [],
      clips: (gltfJson.animations || []).map((clip, index) => ({ clipId: clip.name || `clip_${index}`, sourceClip: clip.name || `clip_${index}`, mode: 'preview-only', events: [] })),
      runtimePolicy: { fallback: 'viewer-preview-first' },
      notes: 'Generated as a minimal preview-first sidecar. It is not a full semantic authoring result.',
    };
  }

  return Object.freeze({ validateReadiness, validateSidecarShape, inferSidecar, collectNodeNames, collectAnimationNames });
});
