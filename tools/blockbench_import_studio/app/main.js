(function () {
  'use strict';

  const Bundle = window.VAW_FILE_BUNDLE_RESOLVER;
  const TextureReport = window.VAW_TEXTURE_REPORT;
  const MaterialTools = window.VAW_GLTF_MATERIAL_TOOLS || null;
  const ViewerApi = window.VAW_MINIMAL_GLTF_VIEWER;
  const Validator = window.VAW_VALIDATOR || null;
  const VisualAssetPack = window.VAW_VISUAL_ASSET_PACK_V1 || null;
  const PackageExporter = window.VAW_PACKAGE_EXPORTER || null;
  const ProjectFilesReport = window.VAW_PROJECT_FILES_REPORT || null;
  const LayoutManager = window.VAW_LAYOUT_MANAGER || null;
  const AnimationReport = window.VAW_ANIMATION_REPORT || null;
  const isMinimalPage = !document.getElementById('texture-list') || !VisualAssetPack;

  const SAMPLE_UV = [
    'assets/uv_checker_cube_gltf/uv_checker_cube.gltf',
    'assets/uv_checker_cube_gltf/uv_checker_cube.bin',
    'assets/uv_checker_cube_gltf/textures/uv_checker.png',
  ];
  const SAMPLE_OFFSET = [
    'assets/axis_scale_offset_gltf/axis_scale_offset.gltf',
    'assets/axis_scale_offset_gltf/axis_scale_offset.bin',
    'assets/axis_scale_offset_gltf/textures/uv_checker.png',
  ];
  const SAMPLE_REGRESSION = [
    'assets/regression_embedded_blockbench_like/test_model_alfa_anim_BaA.gltf',
  ];
  const SAMPLE_VISUAL_PACK_V1 = [
    { url: 'assets/sample_visual_asset_pack_v1/models/test_anim.gltf', relativePath: 'models/test_anim.gltf' },
    { url: 'assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json', relativePath: 'VAW_VISUAL_ASSET_PACK_V1.json' },
  ];
  const AUTHORING_PREFS_KEY = 'vaw.blockbench_import_studio.authoring_prefs.v1';
  const INSTALL_ENDPOINT_PREFS_KEY = 'vaw.blockbench_import_studio.install_endpoint.v1';
  const INSTALL_ENDPOINT_PATH = '/__vaw/install_visual_block';
  const INSTALL_ENDPOINT_CANDIDATE_PORTS = ['8765', '8095'];

  const el = Object.fromEntries([
    'workbench-layout', 'left-panel', 'right-panel', 'bottom-log', 'reset-layout', 'toggle-left-panel', 'toggle-right-panel', 'toggle-bottom-panel',
    'dropzone', 'model-input', 'folder-input', 'load-uv-sample', 'load-offset-sample', 'load-regression-sample', 'load-visual-pack-sample', 'reset',
    'viewer-status', 'viewer-facts', 'project-files-summary', 'project-files-list', 'project-files-search', 'project-files-category-filter', 'project-files-status-filter', 'clear-file-filters', 'dependency-list',
    'animation-select', 'play-animation', 'pause-animation', 'stop-animation', 'animation-loop', 'animation-speed', 'animation-time', 'animation-time-label', 'animation-list',
    'fit-view', 'reset-camera', 'toggle-grid', 'toggle-axes', 'toggle-bounds', 'pixel-textures', 'force-double-sided', 'checker-material',
    'viewer', 'event-log', 'texture-summary', 'texture-list', 'mesh-list', 'vaw-status', 'sidecar-status', 'sidecar-json', 'infer-sidecar',
    'vaw-block-type', 'vaw-node-visual-root-picker', 'vaw-use-suggested-root', 'vaw-node-visual-root', 'vaw-node-flame', 'vaw-node-flame-glow', 'vaw-node-gimbal', 'vaw-node-control-flap',
    'vaw-transform-pos-x', 'vaw-transform-pos-y', 'vaw-transform-pos-z', 'vaw-transform-rot-x', 'vaw-transform-rot-y', 'vaw-transform-rot-z', 'vaw-transform-scale-x', 'vaw-transform-scale-y', 'vaw-transform-scale-z',
    'vaw-transform-center', 'vaw-transform-fit', 'vaw-transform-reset',
    'vaw-material-alpha', 'vaw-material-double-sided', 'vaw-material-pixelated', 'vaw-material-overrides', 'vaw-material-use-doctor', 'vaw-material-clear-overrides', 'vaw-material-reset-auto', 'vaw-material-override-list', 'vaw-material-doctor',
    'vaw-fire-split-enabled', 'vaw-fire-split-nodes', 'vaw-fire-split-suggest',
    'vaw-install-endpoint', 'vaw-install-probe',
    'format-sidecar', 'apply-sidecar', 'validate-vaw', 'download-sidecar', 'download-debug-package', 'download-package', 'install-block-visual', 'install-status', 'diagnostics'
  ].map(id => [id, document.getElementById(id)]));

  const state = {
    viewer: null,
    layout: null,
    bundle: null,
    modelRecord: null,
    basePath: '',
    importKind: null,
    gltfJson: null,
    gltf: null,
    dependencies: [],
    textureReport: null,
    animationReport: null,
    projectFilesReport: null,
    sidecar: null,
    sidecarRecordPath: '',
    sidecarBasePath: '',
    sidecarParseReport: { recognizedPaths: [], invalidPaths: [], diagnostics: [] },
    checkerMaterial: null,
    originalMaterials: new Map(),
    projectFileFilters: { search: '', category: 'all', status: 'all' },
    animationUiLastPaint: 0,
    events: [],
    lastLoaderError: null,
    lastValidation: null,
    activePrefsBlockType: '',
    authoringPrefsRestored: false,
  };

  function init() {
    state.viewer = new ViewerApi.MinimalGltfViewer({ element: el.viewer, statusCallback: event => addEvent(`${event.code}: ${event.message}`), animationCallback: facts => handleAnimationTick(facts) });
    if (!isMinimalPage && LayoutManager && el['workbench-layout']) {
      state.layout = LayoutManager.createWorkbenchLayout({ root: el['workbench-layout'], onResize: () => state.viewer?.resize() });
    }
    wireEvents();
    applyStoredAuthoringPrefs();
    applyStoredInstallEndpoint();
    renderAll();
    setViewerStatus('neutral', 'Gotowy do importu', 'Wrzuć komplet .gltf + .bin + tekstury.');
  }

  function selectedBlockTypes() {
    const value = String(el['vaw-block-type']?.value || '').trim();
    return value ? [value] : [];
  }

  function nodeField(id) {
    const value = String(el[id]?.value || '').trim();
    return value || null;
  }

  function numericField(id, fallback) {
    const number = Number(el[id]?.value);
    return Number.isFinite(number) ? number : fallback;
  }

  function currentTransformFields() {
    return {
      position: {
        x: numericField('vaw-transform-pos-x', 0),
        y: numericField('vaw-transform-pos-y', 0),
        z: numericField('vaw-transform-pos-z', 0),
      },
      rotationDegrees: {
        x: numericField('vaw-transform-rot-x', 0),
        y: numericField('vaw-transform-rot-y', 0),
        z: numericField('vaw-transform-rot-z', 0),
      },
      scale: {
        x: numericField('vaw-transform-scale-x', 1),
        y: numericField('vaw-transform-scale-y', 1),
        z: numericField('vaw-transform-scale-z', 1),
      },
    };
  }

  function parseMaterialOverrideLines(text) {
    const overrides = [];
    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/[=:]/);
      if (parts.length < 2) continue;
      const materialName = parts.shift().trim();
      const alpha = parts.join(':').split(',')[0].trim().toLowerCase();
      if (!materialName || !alpha) continue;
      overrides.push({ materialName, alpha });
    }
    return overrides;
  }

  function formatMaterialOverrideLines(overrides) {
    if (!Array.isArray(overrides) || !overrides.length) return '';
    return overrides
      .map(item => {
        const materialName = String(item?.materialName || item?.name || '').trim();
        const alpha = String(item?.alpha || '').trim();
        return materialName && alpha ? `${materialName}=${alpha}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  function parseMultilineValues(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }

  function currentFireSplitNodePaths() {
    return parseMultilineValues(el['vaw-fire-split-nodes']?.value || '');
  }

  function setFireSplitNodePaths(paths = []) {
    if (!el['vaw-fire-split-nodes']) return;
    const unique = [];
    const seen = new Set();
    for (const path of paths) {
      const text = String(path || '').trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      unique.push(text);
    }
    el['vaw-fire-split-nodes'].value = unique.join('\n');
  }

  function currentNodeFields() {
    return {
      visualRoot: nodeField('vaw-node-visual-root'),
      flame: nodeField('vaw-node-flame'),
      flameGlow: nodeField('vaw-node-flame-glow'),
      gimbalAssembly: nodeField('vaw-node-gimbal'),
      controlFlapPivot: nodeField('vaw-node-control-flap'),
    };
  }

  function syncNodeFields(nodes = {}) {
    for (const [alias, id] of [
      ['visualRoot', 'vaw-node-visual-root'],
      ['flame', 'vaw-node-flame'],
      ['flameGlow', 'vaw-node-flame-glow'],
      ['gimbalAssembly', 'vaw-node-gimbal'],
      ['controlFlapPivot', 'vaw-node-control-flap']
    ]) {
      if (el[id]) el[id].value = nodes?.[alias] || '';
    }
    refreshNodePathPicker();
  }

  function currentFireSplitFields() {
    return {
      enabled: Boolean(el['vaw-fire-split-enabled']?.checked),
      nodes: currentFireSplitNodePaths(),
    };
  }

  function syncFireSplitFields(fireSplit = {}) {
    if (el['vaw-fire-split-enabled']) el['vaw-fire-split-enabled'].checked = Boolean(fireSplit?.enabled);
    setFireSplitNodePaths(Array.isArray(fireSplit?.nodes) ? fireSplit.nodes : []);
  }

  function materialOverrideMap() {
    const map = new Map();
    for (const item of parseMaterialOverrideLines(el['vaw-material-overrides']?.value || '')) {
      const key = String(item.materialName || '').trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, item);
    }
    return map;
  }

  function setMaterialOverride(materialName, alpha) {
    const targetName = String(materialName || '').trim();
    const targetKey = targetName.toLowerCase();
    if (!targetKey || !el['vaw-material-overrides']) return;
    const next = [];
    let replaced = false;
    for (const item of parseMaterialOverrideLines(el['vaw-material-overrides'].value || '')) {
      const itemName = String(item.materialName || '').trim();
      if (itemName.toLowerCase() === targetKey) {
        replaced = true;
        if (alpha && alpha !== 'auto') next.push({ materialName: itemName || targetName, alpha });
      } else {
        next.push(item);
      }
    }
    if (!replaced && alpha && alpha !== 'auto') next.push({ materialName: targetName, alpha });
    el['vaw-material-overrides'].value = formatMaterialOverrideLines(next);
    updateAuthoringDraftFromForm();
  }

  function setMaterialOverrides(overrides = []) {
    if (!el['vaw-material-overrides']) return;
    el['vaw-material-overrides'].value = formatMaterialOverrideLines(overrides);
    updateAuthoringDraftFromForm();
  }

  function clearMaterialOverrides() {
    setMaterialOverrides([]);
    addEvent('material policy: overrides cleared');
  }

  function resetMaterialPolicyToAuto() {
    if (el['vaw-material-alpha']) el['vaw-material-alpha'].value = 'auto';
    if (el['vaw-material-double-sided']) el['vaw-material-double-sided'].value = 'from-gltf';
    clearMaterialOverrides();
    addEvent('material policy: reset to auto');
  }

  function finalMaterialPolicyFor(material, overrides = materialOverrideMap()) {
    const materialName = String(material.name || `material_${material.index}`).trim();
    const override = overrides.get(materialName.toLowerCase());
    const globalAlpha = String(el['vaw-material-alpha']?.value || 'auto');
    const finalAlpha = override?.alpha || globalAlpha;
    const reason = override ? `override ${materialName}` : 'global default';
    return { materialName, override, globalAlpha, finalAlpha, reason };
  }

  function currentMaterialPolicyFields() {
    const policy = {
      pixelated: Boolean(el['vaw-material-pixelated']?.checked),
      alpha: String(el['vaw-material-alpha']?.value || 'auto'),
      doubleSided: String(el['vaw-material-double-sided']?.value || 'from-gltf'),
    };
    const materialOverrides = parseMaterialOverrideLines(el['vaw-material-overrides']?.value || '');
    if (materialOverrides.length) policy.materialOverrides = materialOverrides;
    return policy;
  }

  function setNumberField(id, value, fallback) {
    if (el[id]) el[id].value = String(Number.isFinite(Number(value)) ? Number(value) : fallback);
  }

  function syncTransformFieldsFromManifest(manifest) {
    const transform = manifest?.assets?.[0]?.model?.transform || {};
    const position = transform.position || {};
    const rotation = transform.rotationDegrees || {};
    const scale = transform.scale || {};
    setNumberField('vaw-transform-pos-x', position.x, 0);
    setNumberField('vaw-transform-pos-y', position.y, 0);
    setNumberField('vaw-transform-pos-z', position.z, 0);
    setNumberField('vaw-transform-rot-x', rotation.x, 0);
    setNumberField('vaw-transform-rot-y', rotation.y, 0);
    setNumberField('vaw-transform-rot-z', rotation.z, 0);
    setNumberField('vaw-transform-scale-x', scale.x, 1);
    setNumberField('vaw-transform-scale-y', scale.y, 1);
    setNumberField('vaw-transform-scale-z', scale.z, 1);
  }

  function syncMaterialPolicyFieldsFromManifest(manifest) {
    const policy = manifest?.assets?.[0]?.materialPolicy || {};
    if (el['vaw-material-alpha']) el['vaw-material-alpha'].value = policy.alpha || 'auto';
    if (el['vaw-material-double-sided']) el['vaw-material-double-sided'].value = String(policy.doubleSided ?? 'from-gltf');
    if (el['vaw-material-pixelated']) el['vaw-material-pixelated'].checked = policy.pixelated !== false;
    if (el['vaw-material-overrides']) el['vaw-material-overrides'].value = formatMaterialOverrideLines(policy.materialOverrides);
  }

  function suggestedVisualRootPath() {
    const records = VisualAssetPack?.collectNodePathRecords ? VisualAssetPack.collectNodePathRecords(state.gltfJson || {}) : [];
    const roots = records.filter(record => record.isTopologicalRoot);
    const candidates = roots.length ? roots : records;
    return (candidates.find(record => /root|body|mesh|cube|model/i.test(record.name)) || candidates[0] || {}).path || '';
  }

  function refreshNodePathPicker() {
    const picker = el['vaw-node-visual-root-picker'];
    if (!picker || !VisualAssetPack?.collectNodePathRecords) return;
    const current = nodeField('vaw-node-visual-root') || '';
    const records = VisualAssetPack.collectNodePathRecords(state.gltfJson || {});
    picker.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = records.length ? 'choose node path' : 'no nodes';
    picker.appendChild(empty);
    for (const record of records) {
      const option = document.createElement('option');
      option.value = record.path;
      option.textContent = `${record.path}${record.isTopologicalRoot ? ' (root)' : ''}`;
      picker.appendChild(option);
    }
    picker.value = current;
  }

  function ensureDraftManifest() {
    if (!VisualAssetPack || !state.gltfJson) return null;
    const canApplyStoredPrefs = !state.sidecarRecordPath;
    if (!state.sidecar) {
      state.sidecar = inferVisualAssetManifest();
      state.sidecarRecordPath = '';
      state.sidecarBasePath = '';
      state.sidecarParseReport = { recognizedPaths: [], invalidPaths: [], diagnostics: [{ severity: 'info', code: 'visualAssetPack.autoDrafted', message: 'Visual asset manifest draft created automatically after import.' }] };
    } else {
      state.sidecar = applyAuthoringFields(state.sidecar, { preserveEmpty: true });
    }
    if (el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(state.sidecar, null, 2) + '\n';
    syncAuthoringFieldsFromManifest(state.sidecar);
    if (canApplyStoredPrefs && applyAuthoringPrefsForBlock(selectedBlockTypes()[0] || state.activePrefsBlockType, { includeDefaults: true })) {
      state.authoringPrefsRestored = true;
      state.sidecar = applyAuthoringFields(state.sidecar, { preserveEmpty: true });
      if (el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(state.sidecar, null, 2) + '\n';
      addEvent(`authoring prefs: restored ${selectedBlockTypes()[0] || 'default'} settings`);
    }
    refreshNodePathPicker();
    return state.sidecar;
  }

  function applyAuthoringFields(manifest, { preserveEmpty = false } = {}) {
    const asset = manifest?.assets?.[0];
    if (!asset) return manifest;
    asset.model = asset.model || {};
    asset.model.transform = currentTransformFields();
    asset.bindings = asset.bindings || {};
    const blockTypes = selectedBlockTypes();
    if (blockTypes.length || !preserveEmpty) asset.bindings.blockTypes = blockTypes;
    asset.bindings.nodes = asset.bindings.nodes || {};
    const visualRoot = nodeField('vaw-node-visual-root');
    if (visualRoot || !preserveEmpty) asset.bindings.nodes.visualRoot = visualRoot;
    for (const [alias, id] of [
      ['flame', 'vaw-node-flame'],
      ['flameGlow', 'vaw-node-flame-glow'],
      ['gimbalAssembly', 'vaw-node-gimbal'],
      ['controlFlapPivot', 'vaw-node-control-flap']
    ]) {
      const value = nodeField(id);
      if (value || !preserveEmpty) asset.bindings.nodes[alias] = value;
    }
    asset.materialPolicy = currentMaterialPolicyFields();
    return manifest;
  }

  function inferVisualAssetManifest() {
    return applyAuthoringFields(VisualAssetPack.inferManifest(state.gltfJson || {}, state.modelRecord, { blockTypes: selectedBlockTypes() }));
  }

  function syncAuthoringFieldsFromManifest(manifest) {
    const asset = manifest?.assets?.[0];
    const blockType = asset?.bindings?.blockTypes?.[0] || '';
    if (el['vaw-block-type']) el['vaw-block-type'].value = blockType;
    if (blockType) state.activePrefsBlockType = blockType;
    syncNodeFields(asset?.bindings?.nodes || {});
    syncTransformFieldsFromManifest(manifest);
    syncMaterialPolicyFieldsFromManifest(manifest);
    refreshNodePathPicker();
  }

  function loadAuthoringPrefs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUTHORING_PREFS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function currentAuthoringPrefsSnapshot() {
    return {
      nodes: currentNodeFields(),
      transform: currentTransformFields(),
      materialPolicy: currentMaterialPolicyFields(),
      fireSplit: currentFireSplitFields(),
    };
  }

  function applyAuthoringPrefsSnapshot(snapshot = {}) {
    if (snapshot.nodes) syncNodeFields(snapshot.nodes);
    if (snapshot.transform) syncTransformFieldsFromManifest({ assets: [{ model: { transform: snapshot.transform } }] });
    if (snapshot.materialPolicy) syncMaterialPolicyFieldsFromManifest({ assets: [{ materialPolicy: snapshot.materialPolicy }] });
    if (snapshot.fireSplit) syncFireSplitFields(snapshot.fireSplit);
    refreshNodePathPicker();
  }

  function saveAuthoringPrefsForBlock(blockType, snapshot = currentAuthoringPrefsSnapshot()) {
    const normalizedBlockType = String(blockType || '').trim();
    const prefs = loadAuthoringPrefs();
    const next = {
      ...prefs,
      lastBlockType: normalizedBlockType || prefs.lastBlockType || '',
      defaults: snapshot,
      byBlock: {
        ...(prefs.byBlock && typeof prefs.byBlock === 'object' ? prefs.byBlock : {})
      }
    };
    if (normalizedBlockType) next.byBlock[normalizedBlockType] = snapshot;
    try { localStorage.setItem(AUTHORING_PREFS_KEY, JSON.stringify(next)); }
    catch (_) { /* Preferences are optional; Studio must work without localStorage. */ }
  }

  function saveAuthoringPrefs() {
    saveAuthoringPrefsForBlock(selectedBlockTypes()[0] || state.activePrefsBlockType || '');
  }

  function getAuthoringPrefsForBlock(blockType, { includeDefaults = false } = {}) {
    const prefs = loadAuthoringPrefs();
    const normalizedBlockType = String(blockType || '').trim();
    if (normalizedBlockType && prefs.byBlock && typeof prefs.byBlock === 'object' && prefs.byBlock[normalizedBlockType]) {
      return prefs.byBlock[normalizedBlockType];
    }
    return includeDefaults ? prefs.defaults || null : null;
  }

  function applyAuthoringPrefsForBlock(blockType, { includeDefaults = false } = {}) {
    const source = getAuthoringPrefsForBlock(blockType, { includeDefaults });
    if (!source) return false;
    applyAuthoringPrefsSnapshot(source);
    return true;
  }

  function applyStoredAuthoringPrefs() {
    const prefs = loadAuthoringPrefs();
    const blockType = String(prefs.lastBlockType || '').trim();
    if (blockType && el['vaw-block-type'] && !el['vaw-block-type'].value) el['vaw-block-type'].value = blockType;
    state.activePrefsBlockType = selectedBlockTypes()[0] || blockType || '';
    applyAuthoringPrefsForBlock(state.activePrefsBlockType, { includeDefaults: true });
  }

  function handleBlockTypeChange() {
    const previousBlockType = state.activePrefsBlockType;
    if (previousBlockType) saveAuthoringPrefsForBlock(previousBlockType, currentAuthoringPrefsSnapshot());
    const nextBlockType = selectedBlockTypes()[0] || '';
    state.activePrefsBlockType = nextBlockType;
    applyAuthoringPrefsForBlock(nextBlockType, { includeDefaults: true });
    if (!state.gltfJson) {
      saveAuthoringPrefsForBlock(nextBlockType, currentAuthoringPrefsSnapshot());
      return;
    }
    updateAuthoringDraftFromForm();
  }

  function commitAuthoringFieldsToManifest({ allowInfer = false, preserveEmpty = true, updateEditor = true } = {}) {
    const parsed = parseSidecarFromEditor({ allowInfer });
    if (parsed.error) return parsed;
    const sidecar = parsed.sidecar ? applyAuthoringFields(parsed.sidecar, { preserveEmpty }) : null;
    state.sidecar = sidecar;
    if (sidecar && updateEditor && el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(sidecar, null, 2) + '\n';
    syncAuthoringFieldsFromManifest(sidecar);
    return { sidecar, error: null, inferred: parsed.inferred };
  }

  function setNumberInput(id, value) {
    if (el[id]) el[id].value = String(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function nudgeRotation(axis, delta) {
    const id = `vaw-transform-rot-${axis}`;
    setNumberInput(id, numericField(id, 0) + delta);
    updateAuthoringDraftFromForm();
  }

  function resetTransformFields() {
    for (const [id, value] of [
      ['vaw-transform-pos-x', 0], ['vaw-transform-pos-y', 0], ['vaw-transform-pos-z', 0],
      ['vaw-transform-rot-x', 0], ['vaw-transform-rot-y', 0], ['vaw-transform-rot-z', 0],
      ['vaw-transform-scale-x', 1], ['vaw-transform-scale-y', 1], ['vaw-transform-scale-z', 1],
    ]) setNumberInput(id, value);
    updateAuthoringDraftFromForm();
  }

  function centerTransformToBounds() {
    const center = state.viewer?.lastBounds?.center;
    if (!center) return;
    setNumberInput('vaw-transform-pos-x', -Number(center.x || 0));
    setNumberInput('vaw-transform-pos-y', -Number(center.y || 0));
    setNumberInput('vaw-transform-pos-z', -Number(center.z || 0));
    updateAuthoringDraftFromForm();
  }

  function fitTransformToBlock() {
    const size = state.viewer?.lastBounds?.size;
    if (!size) return;
    const maxSize = Math.max(Number(size.x || 0), Number(size.y || 0), Number(size.z || 0));
    if (!(maxSize > 0)) return;
    const scale = 1 / maxSize;
    setNumberInput('vaw-transform-scale-x', scale);
    setNumberInput('vaw-transform-scale-y', scale);
    setNumberInput('vaw-transform-scale-z', scale);
    updateAuthoringDraftFromForm();
  }

  function materialReportHasAlphaSignal(material) {
    return Boolean(
      material?.hasTransparencySignal ||
      String(material?.alphaMode || '').toUpperCase() === 'BLEND' ||
      String(material?.alphaMode || '').toUpperCase() === 'MASK' ||
      Number(material?.baseColorAlpha ?? 1) < 1 ||
      material?.alphaTexture ||
      material?.alphaMap
    );
  }

  function suggestedMaterialAlpha(material) {
    const alphaMode = String(material?.alphaMode || '').toUpperCase();
    if (!materialReportHasAlphaSignal(material)) return 'opaque';
    return alphaMode === 'MASK' ? 'mask' : 'blend';
  }

  function suggestedMaterialOverrides() {
    const seen = new Set();
    const overrides = [];
    for (const material of state.textureReport?.materials || []) {
      const materialName = String(material.name || `material_${material.index}`).trim();
      if (!materialName || seen.has(materialName.toLowerCase())) continue;
      seen.add(materialName.toLowerCase());
      overrides.push({ materialName, alpha: suggestedMaterialAlpha(material) });
    }
    return overrides;
  }

  function applyMaterialDoctorPolicy() {
    if (el['vaw-material-alpha']) el['vaw-material-alpha'].value = 'auto';
    if (el['vaw-material-overrides']) el['vaw-material-overrides'].value = '';
    suggestFireSplitNodes({ enable: true });
    updateAuthoringDraftFromForm();
  }

  function suggestFireSplitNodes({ enable = false } = {}) {
    if (!MaterialTools || !state.gltfJson) return [];
    const paths = MaterialTools.suggestFireNodePaths(state.gltfJson);
    if (paths.length) {
      setFireSplitNodePaths(paths);
      if (enable && el['vaw-fire-split-enabled']) el['vaw-fire-split-enabled'].checked = true;
      addEvent(`material split: suggested fire/glow nodes ${paths.join(', ')}`);
    } else {
      addEvent('material split: no fire/glow node names found');
    }
    renderMaterialDoctor();
    return paths;
  }

  function prepareMaterialSplitDefaults() {
    if (!MaterialTools || !state.gltfJson) return;
    if (!currentFireSplitNodePaths().length) {
      const paths = MaterialTools.suggestFireNodePaths(state.gltfJson);
      if (paths.length) setFireSplitNodePaths(paths);
    }
    const sharedWarnings = MaterialTools.sharedAlphaMaterialWarnings(state.gltfJson || {});
    if (sharedWarnings.length && el['vaw-fire-split-enabled'] && !state.authoringPrefsRestored) {
      el['vaw-fire-split-enabled'].checked = true;
      addEvent('material split: enabled because one alpha material is shared by fire/glow and body/nozzle nodes');
    }
  }

  function wireEvents() {
    if (el.dropzone) {
      el.dropzone.addEventListener('dragover', event => { event.preventDefault(); el.dropzone.classList.add('drag'); });
      el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('drag'));
      el.dropzone.addEventListener('drop', async event => {
        event.preventDefault();
        el.dropzone.classList.remove('drag');
        try { await loadFiles(await Bundle.filesFromDataTransfer(event.dataTransfer)); }
        catch (error) { handleImportError(error); }
      });
    }
    el['model-input']?.addEventListener('change', async event => { try { await loadFiles(event.target.files); event.target.value = ''; } catch (error) { handleImportError(error); } });
    el['folder-input']?.addEventListener('change', async event => { try { await loadFiles(event.target.files); event.target.value = ''; } catch (error) { handleImportError(error); } });
    el['load-uv-sample']?.addEventListener('click', async () => loadFiles(await fetchSampleFiles(SAMPLE_UV)).catch(handleImportError));
    el['load-offset-sample']?.addEventListener('click', async () => loadFiles(await fetchSampleFiles(SAMPLE_OFFSET)).catch(handleImportError));
    el['load-regression-sample']?.addEventListener('click', async () => loadFiles(await fetchSampleFiles(SAMPLE_REGRESSION)).catch(handleImportError));
    el['load-visual-pack-sample']?.addEventListener('click', async () => loadFiles(await fetchSampleFiles(SAMPLE_VISUAL_PACK_V1)).catch(handleImportError));
    el.reset?.addEventListener('click', resetAll);
    el['fit-view']?.addEventListener('click', () => { state.viewer.fit(); renderViewerFacts(); });
    el['reset-camera']?.addEventListener('click', () => { state.viewer.resetCamera(); renderViewerFacts(); });
    for (const id of ['toggle-grid', 'toggle-axes', 'toggle-bounds']) el[id]?.addEventListener('change', updateViewerOptions);
    el['pixel-textures']?.addEventListener('change', updateViewerOptions);
    el['force-double-sided']?.addEventListener('change', updateViewerOptions);
    el['checker-material']?.addEventListener('change', updateTextureOverride);
    for (const id of ['project-files-search', 'project-files-category-filter', 'project-files-status-filter']) el[id]?.addEventListener('input', updateProjectFileFilters);
    el['clear-file-filters']?.addEventListener('click', clearProjectFileFilters);
    const authoringInputIds = [
      'vaw-node-visual-root', 'vaw-node-flame', 'vaw-node-flame-glow', 'vaw-node-gimbal', 'vaw-node-control-flap',
      'vaw-transform-pos-x', 'vaw-transform-pos-y', 'vaw-transform-pos-z', 'vaw-transform-rot-x', 'vaw-transform-rot-y', 'vaw-transform-rot-z',
      'vaw-transform-scale-x', 'vaw-transform-scale-y', 'vaw-transform-scale-z', 'vaw-material-alpha', 'vaw-material-double-sided', 'vaw-material-pixelated', 'vaw-material-overrides',
      'vaw-fire-split-enabled', 'vaw-fire-split-nodes'
    ];
    for (const id of authoringInputIds) el[id]?.addEventListener('input', updateAuthoringDraftFromForm);
    el['vaw-block-type']?.addEventListener('change', handleBlockTypeChange);
    el['vaw-install-endpoint']?.addEventListener('input', () => rememberInstallEndpoint(el['vaw-install-endpoint'].value.trim()));
    el['vaw-install-probe']?.addEventListener('click', () => { checkInstallEndpoint(); });
    for (const button of document.querySelectorAll('[data-vaw-rotate-axis]')) {
      button.addEventListener('click', () => nudgeRotation(button.dataset.vawRotateAxis, Number(button.dataset.vawRotateDelta || 0)));
    }
    el['vaw-transform-reset']?.addEventListener('click', resetTransformFields);
    el['vaw-transform-center']?.addEventListener('click', centerTransformToBounds);
    el['vaw-transform-fit']?.addEventListener('click', fitTransformToBlock);
    el['vaw-material-use-doctor']?.addEventListener('click', applyMaterialDoctorPolicy);
    el['vaw-material-clear-overrides']?.addEventListener('click', clearMaterialOverrides);
    el['vaw-material-reset-auto']?.addEventListener('click', resetMaterialPolicyToAuto);
    el['vaw-fire-split-suggest']?.addEventListener('click', () => suggestFireSplitNodes({ enable: true }));
    el['vaw-node-visual-root-picker']?.addEventListener('change', () => {
      if (el['vaw-node-visual-root']) el['vaw-node-visual-root'].value = el['vaw-node-visual-root-picker'].value || '';
      updateAuthoringDraftFromForm();
    });
    el['vaw-use-suggested-root']?.addEventListener('click', () => {
      const suggested = suggestedVisualRootPath();
      if (suggested && el['vaw-node-visual-root']) el['vaw-node-visual-root'].value = suggested;
      updateAuthoringDraftFromForm();
    });
    el['play-animation']?.addEventListener('click', playSelectedAnimation);
    el['pause-animation']?.addEventListener('click', toggleAnimationPause);
    el['stop-animation']?.addEventListener('click', stopAnimationPreview);
    el['animation-select']?.addEventListener('change', updateAnimationTimeUi);
    el['animation-speed']?.addEventListener('change', () => { state.viewer.setAnimationSpeed(el['animation-speed'].value); updateAnimationTimeUi(); addEvent(`animation: speed ${el['animation-speed'].value}x`); });
    el['animation-time']?.addEventListener('input', scrubAnimationPreview);
    el['infer-sidecar']?.addEventListener('click', () => {
      state.sidecar = inferVisualAssetManifest();
      state.sidecarRecordPath = '';
      state.sidecarBasePath = '';
      state.sidecarParseReport = { recognizedPaths: [], invalidPaths: [], diagnostics: [{ severity: 'info', code: 'visualAssetPack.inferred', message: 'Visual asset manifest inferred inside UI; no manifest file was loaded.' }] };
      if (el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(state.sidecar, null, 2) + '\n';
      syncAuthoringFieldsFromManifest(state.sidecar);
      buildProjectFilesReport();
      validateVawReadiness();
      renderProjectFilesReport();
    });
    el['format-sidecar']?.addEventListener('click', formatSidecarEditor);
    el['apply-sidecar']?.addEventListener('click', applySidecarEditor);
    el['validate-vaw']?.addEventListener('click', () => {
      const committed = commitAuthoringFieldsToManifest({ allowInfer: false, preserveEmpty: true });
      if (committed.error) {
        state.lastValidation = { viewerOk: true, vawReady: false, diagnostics: [{ domain: 'vaw-readiness', severity: 'error', code: 'visualAssetPack.manifestJsonInvalid', message: committed.error.message }] };
        renderDiagnostics();
        renderVawStatus();
        renderSidecarStatus();
        renderUiAvailability();
        return;
      }
      validateVawReadiness();
    });
    el['download-sidecar']?.addEventListener('click', downloadSidecar);
    el['download-debug-package']?.addEventListener('click', downloadDebugPackageZip);
    el['download-package']?.addEventListener('click', downloadPackageZip);
    el['install-block-visual']?.addEventListener('click', installBlockVisual);
    window.addEventListener('keydown', event => {
      if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
      if (event.key.toLowerCase() === 'f') { state.viewer.fit(); renderViewerFacts(); }
      if (event.key.toLowerCase() === 'r') { state.viewer.resetCamera(); renderViewerFacts(); }
    });
  }

  function updateAuthoringDraftFromForm() {
    if (!VisualAssetPack || !state.gltfJson) return;
    const parsed = commitAuthoringFieldsToManifest({ allowInfer: true, preserveEmpty: true });
    if (!parsed.error) {
      saveAuthoringPrefs();
      validateVawReadiness();
      renderMaterialDoctor();
    }
  }

  async function fetchSampleFiles(paths) {
    const files = [];
    for (const spec of paths) {
      const url = typeof spec === 'string' ? spec : spec.url;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Nie można pobrać sample: ${url}. Uruchom Studio przez python tools/serve.py, nie przez dwuklik/file://.`);
      const blob = await response.blob();
      const rel = typeof spec === 'string' ? url.replace(/^assets\//, '') : spec.relativePath;
      const file = new File([blob], rel.split('/').pop(), { type: blob.type || 'application/octet-stream' });
      try {
        Object.defineProperty(file, '__vawRelativePath', { value: rel, configurable: true });
      } catch (error) {
        // Some browser/security contexts make File objects non-extensible. Preserve the
        // user-facing error instead of silently loading a sample with broken relative paths.
        throw new Error(`Nie można ustawić ścieżki sample '${rel}'. Uruchom Studio przez lokalny serwer i odśwież stronę.`);
      }
      files.push(file);
    }
    return files;
  }

  function resetAll() {
    if (state.bundle) state.bundle.revokeObjectURLs?.();
    state.viewer.clearModel();
    state.bundle = null;
    state.modelRecord = null;
    state.basePath = '';
    state.importKind = null;
    state.gltfJson = null;
    state.gltf = null;
    state.dependencies = [];
    state.textureReport = null;
    state.animationReport = null;
    state.projectFilesReport = null;
    state.sidecar = null;
    state.sidecarRecordPath = '';
    state.sidecarBasePath = '';
    state.sidecarParseReport = { recognizedPaths: [], invalidPaths: [], diagnostics: [] };
    state.lastLoaderError = null;
    state.lastValidation = null;
    state.authoringPrefsRestored = false;
    state.originalMaterials.clear();
    if (el['sidecar-json']) el['sidecar-json'].value = '';
    if (el['vaw-fire-split-enabled']) el['vaw-fire-split-enabled'].checked = false;
    setFireSplitNodePaths([]);
    syncAuthoringFieldsFromManifest(null);
    applyStoredAuthoringPrefs();
    refreshNodePathPicker();
    if (el['install-status']) el['install-status'].textContent = 'Local install waits for a model, block type and visualRoot.';
    setViewerStatus('neutral', 'Gotowy do importu', 'Wrzuć komplet .gltf + .bin + tekstury.');
    renderAll();
  }

  async function loadFiles(filesLike) {
    const files = [...filesLike].filter(Boolean);
    if (!files.length) return;
    resetAll();
    state.bundle = Bundle.createBundle(files);
    state.modelRecord = state.bundle.mainModel;
    buildProjectFilesReport();
    renderProjectFilesReport();
    if (!state.modelRecord) throw new Error('Nie znaleziono .gltf ani .glb. Wybierz cały eksport z Blockbench.');
    state.basePath = Bundle.dirname(state.modelRecord.normalizedPath);
    state.importKind = state.modelRecord.extension;
    setViewerStatus('neutral', 'Ładowanie modelu…', state.modelRecord.normalizedPath);

    if (state.importKind === 'gltf') await loadGltfRecord(state.modelRecord);
    else await loadGlbRecord(state.modelRecord);

    state.viewer.setModel(state.gltf.scene);
    state.viewer.applyPixelMode(Boolean(el['pixel-textures']?.checked));
    state.viewer.forceDoubleSided(Boolean(el['force-double-sided']?.checked));
    updateViewerOptions();
    analyzeTextures();
    analyzeAnimations();
    await loadSidecarFromBundle();
    ensureDraftManifest();
    prepareMaterialSplitDefaults();
    buildProjectFilesReport();
    renderAll();
    setViewerStatus('ok', 'Model załadowany i dodany do sceny', `${state.modelRecord.basename} · meshes: ${countMeshes(state.gltf.scene)} · nodes: ${countNodes(state.gltf.scene)}`);

    if (!isMinimalPage) validateVawReadiness();
    state.viewer.resize();
  }

  async function loadGltfRecord(record) {
    const text = await record.file.text();
    state.gltfJson = JSON.parse(text);
    state.dependencies = state.bundle.dependencyReport(state.gltfJson, state.basePath);
    const missingCritical = state.dependencies.filter(dep => (dep.kind === 'buffer') && (dep.status === 'missing' || dep.status === 'ambiguous'));
    if (missingCritical.length) addEvent(`dependency warning: buffer issue ${missingCritical.map(dep => dep.uri).join(', ')}`);
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      if (Bundle.isDataUri && Bundle.isDataUri(url)) return url;
      const resolved = state.bundle.resolveObjectURL(url, state.basePath) || state.bundle.resolveObjectURL(Bundle.basename(url), state.basePath);
      if (resolved) return resolved;
      if (!isViewerGeneratedBlobUrl(url)) addEvent(`resolver: unresolved ${compactUri(url)}`);
      return url;
    });
    const loader = new THREE.GLTFLoader(manager);
    const url = state.bundle.objectURLFor(record);
    state.gltf = await loader.loadAsync(url);
  }

  async function loadGlbRecord(record) {
    state.gltfJson = null;
    state.dependencies = [];
    const loader = new THREE.GLTFLoader();
    const url = state.bundle.objectURLFor(record);
    state.gltf = await loader.loadAsync(url);
    state.gltfJson = { asset: { version: '2.0' }, nodes: collectRuntimeNodeNames(state.gltf.scene).map(name => ({ name })), animations: (state.gltf.animations || []).map(clip => ({ name: clip.name || 'clip' })) };
  }

  async function loadSidecarFromBundle() {
    state.sidecar = null;
    state.sidecarRecordPath = '';
    state.sidecarBasePath = '';
    state.sidecarParseReport = { recognizedPaths: [], invalidPaths: [], diagnostics: [] };
    const records = state.bundle && Array.isArray(state.bundle.records) ? state.bundle.records : [];
    const manifestRecords = records.filter(record => VisualAssetPack.isManifestFilename(record.normalizedPath || record.basename));
    const legacySidecars = state.bundle?.sidecarFiles || [];
    const candidates = manifestRecords.length ? manifestRecords : legacySidecars;
    if (!candidates.length) {
      if (el['sidecar-json']) el['sidecar-json'].value = '';
      return;
    }
    for (const record of candidates) {
      try {
        const text = await record.file.text();
        const parsed = JSON.parse(text);
        state.sidecarParseReport.recognizedPaths.push(record.normalizedPath);
        const isLegacy = !VisualAssetPack.isManifestFilename(record.normalizedPath || record.basename);
        state.sidecarParseReport.diagnostics.push({ severity: isLegacy ? 'warning' : 'info', code: isLegacy ? 'manifest.legacySidecarLoaded' : 'manifest.loaded', message: `${isLegacy ? 'Loaded legacy .vaw.json sidecar, not a V1 visual asset manifest' : 'Loaded V1 visual asset manifest'}: ${record.normalizedPath}` });
        if (!state.sidecar) {
          state.sidecar = parsed;
          state.sidecarRecordPath = record.normalizedPath || '';
          state.sidecarBasePath = Bundle.dirname(record.normalizedPath || '') || '';
          if (el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(parsed, null, 2) + '\n';
          syncAuthoringFieldsFromManifest(parsed);
        }
      } catch (error) {
        state.sidecarParseReport.invalidPaths.push(record.normalizedPath);
        state.sidecarParseReport.diagnostics.push({ severity: 'error', code: 'manifest.invalidJson', message: `${record.normalizedPath}: ${error.message}` });
      }
    }
  }

  function analyzeTextures() {
    state.textureReport = TextureReport.analyzeTextures({ gltfJson: state.gltfJson || {}, gltfScene: state.gltf?.scene || null, bundle: state.bundle, basePath: state.basePath });
  }

  function analyzeAnimations() {
    state.animationReport = AnimationReport ? AnimationReport.analyzeAnimations({ gltfJson: state.gltfJson || {}, runtimeClips: state.gltf?.animations || [] }) : null;
  }

  function buildProjectFilesReport() {
    if (!ProjectFilesReport) return;
    state.projectFilesReport = ProjectFilesReport.buildProjectFilesReport({ bundle: state.bundle, dependencies: state.dependencies || [], textureReport: state.textureReport, sidecarParseReport: state.sidecarParseReport });
  }

  function updateViewerOptions() {
    if (!state.viewer) return;
    state.viewer.applyPixelMode(Boolean(el['pixel-textures']?.checked));
    state.viewer.forceDoubleSided(Boolean(el['force-double-sided']?.checked));
    state.viewer.updateHelpers({ grid: Boolean(el['toggle-grid']?.checked), axes: Boolean(el['toggle-axes']?.checked), bounds: Boolean(el['toggle-bounds']?.checked) });
    analyzeTextures();
    buildProjectFilesReport();
    renderTextureReport();
    renderProjectFilesReport();
    renderViewerFacts();
  }

  function updateTextureOverride() {
    if (!state.viewer.root) return;
    restoreMaterials();
    if (el['checker-material']?.checked) {
      if (!state.checkerMaterial) state.checkerMaterial = TextureReport.makeCheckerMaterial();
      state.viewer.root.traverse(object => {
        if (!object.isMesh || !object.material) return;
        if (!state.originalMaterials.has(object)) state.originalMaterials.set(object, object.material);
        object.material = state.checkerMaterial;
      });
      addEvent('texture diagnostic: checker override ON');
    } else {
      addEvent('texture diagnostic: checker override OFF');
    }
    renderTextureReport();
  }

  function restoreMaterials() {
    for (const [mesh, material] of state.originalMaterials.entries()) mesh.material = material;
    state.originalMaterials.clear();
  }

  function validateVawReadiness() {
    if (isMinimalPage || !VisualAssetPack) return null;
    const sidecarText = el['sidecar-json']?.value?.trim();
    let sidecar = state.sidecar;
    if (sidecarText) {
      try { sidecar = JSON.parse(sidecarText); }
      catch (error) {
        state.lastValidation = { viewerOk: true, packReady: false, vawReady: false, diagnostics: [{ domain: 'visual-asset-pack-v1', severity: 'error', code: 'visualAssetPack.manifestJsonInvalid', message: error.message }] };
        renderDiagnostics();
        renderVawStatus();
        renderSidecarStatus();
        renderUiAvailability();
        return state.lastValidation;
      }
    }
    state.sidecar = sidecar || null;
    state.lastValidation = VisualAssetPack.validateManifest({ manifest: state.sidecar, gltfJson: state.gltfJson || {}, dependencies: state.dependencies || [], modelRecord: state.modelRecord, manifestBasePath: state.sidecarBasePath || '' });
    for (const item of state.sidecarParseReport.diagnostics || []) {
      state.lastValidation.diagnostics.push({ domain: 'visual-asset-manifest', severity: item.severity || 'info', code: item.code, message: item.message });
    }
    renderDiagnostics();
    renderVawStatus();
    renderSidecarStatus();
    renderUiAvailability();
    return state.lastValidation;
  }

  function renderAll() {
    renderViewerFacts();
    renderProjectFilesReport();
    renderDependencyList();
    renderAnimations();
    renderTextureReport();
    renderMaterialDoctor();
    renderDiagnostics();
    renderVawStatus();
    renderSidecarStatus();
    renderUiAvailability();
  }

  function renderViewerFacts() {
    if (!el['viewer-facts']) return;
    const facts = getViewerFactsObject();
    const rows = [
      ['renderer', facts.renderer], ['render loop', facts.renderLoop], ['model', facts.model], ['scene objects', String(facts.sceneObjects)],
      ['meshes', String(facts.meshes)], ['bounds', facts.bounds], ['camera', facts.camera], ['controls', facts.controls]
    ];
    el['viewer-facts'].innerHTML = rows.map(([key, value]) => `<div class="fact"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  }

  function renderMaterialDoctor() {
    if (!el['vaw-material-doctor']) return;
    const materials = Array.isArray(state.textureReport?.materials) ? state.textureReport.materials : [];
    if (!materials.length) {
      el['vaw-material-doctor'].innerHTML = '<div class="fact"><strong>Material Doctor</strong><span>Load a model to inspect alpha.</span></div>';
      renderMaterialOverrideList(materials);
      return;
    }
    const alphaSignals = materials.filter(materialReportHasAlphaSignal);
    const opaqueCount = materials.length - alphaSignals.length;
    const modes = [...new Set(materials.map(material => material.alphaMode).filter(Boolean))].join(', ') || 'none';
    const doubleSided = materials.filter(material => material.doubleSided).length;
    const overrides = materialOverrideMap();
    const sharedWarnings = MaterialTools ? MaterialTools.sharedAlphaMaterialWarnings(state.gltfJson || {}) : [];
    const fireSuggestions = MaterialTools ? MaterialTools.suggestFireNodePaths(state.gltfJson || {}) : [];
    const recommendation = sharedWarnings.length
      ? 'Use Split fire/glow material. One shared blend/mask material cannot keep body/nozzle opaque and fire soft-transparent.'
      : alphaSignals.length && opaqueCount
        ? 'Use auto plus per-material rows only when materials are already separated.'
        : alphaSignals.length
          ? 'Use auto or blend for semi-transparent materials.'
          : 'auto, from-gltf or opaque is usually enough.';
    el['vaw-material-doctor'].innerHTML = [
      ['alpha signals', `${alphaSignals.length}/${materials.length}`],
      ['opaque candidates', `${opaqueCount}/${materials.length}`],
      ['alphaMode', modes],
      ['doubleSided', `${doubleSided}/${materials.length}`],
      ['global default', String(el['vaw-material-alpha']?.value || 'auto')],
      ['active overrides', String(overrides.size)],
      ['fire/glow suggestions', fireSuggestions.length ? fireSuggestions.join(', ') : 'none'],
      ['shared alpha warning', sharedWarnings.length ? sharedWarnings.map(item => item.materialName).join(', ') : 'none'],
      ['recommendation', recommendation],
    ].map(([key, value]) => `<div class="fact"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
    renderMaterialOverrideList(materials);
  }

  function renderMaterialOverrideList(materials = []) {
    const container = el['vaw-material-override-list'];
    if (!container) return;
    if (!materials.length) {
      container.className = 'material-override-list scroll-list empty';
      container.textContent = 'Load a model to edit material overrides.';
      return;
    }
    container.className = 'material-override-list scroll-list';
    const overrides = materialOverrideMap();
    const counts = new Map();
    for (const material of materials) {
      const key = String(material.name || `material_${material.index}`).trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    container.innerHTML = materials.map(material => {
      const materialName = String(material.name || `material_${material.index}`).trim();
      const key = materialName.toLowerCase();
      const effective = finalMaterialPolicyFor(material, overrides);
      const override = effective.override;
      const selected = override?.alpha || 'auto';
      const suggestion = suggestedMaterialAlpha(material);
      const duplicate = counts.get(key) > 1;
      const alphaMode = String(material.alphaMode || 'OPAQUE');
      const baseAlpha = material.baseColorAlpha ?? (Array.isArray(material.baseColorFactor) ? material.baseColorFactor[3] : 1);
      const slots = (material.slots || []).map(slot => `${slot.slot}:${slot.imageStatus}`).join(', ') || 'none';
      const options = ['auto', 'opaque', 'mask', 'blend'].map(value => `<option value="${value}"${selected === value ? ' selected' : ''}>${value}</option>`).join('');
      return `<div class="material-override-row ${duplicate || override ? 'warning' : ''}">
        <div>
          <strong>${escapeHtml(materialName)}</strong>
          <small>final=${escapeHtml(effective.finalAlpha)} via ${escapeHtml(effective.reason)} - global=${escapeHtml(effective.globalAlpha)}</small>
          <small>suggest ${escapeHtml(suggestion)} · alphaMode=${escapeHtml(alphaMode)} · base alpha=${escapeHtml(String(baseAlpha ?? 1))} · slots=${escapeHtml(slots)}${duplicate ? ' · duplicate name: override applies to every match' : ''}</small>
        </div>
        <select data-vaw-material-override="${escapeHtml(materialName)}">${options}</select>
      </div>`;
    }).join('');
    for (const select of container.querySelectorAll?.('[data-vaw-material-override]') || []) {
      select.addEventListener('change', () => setMaterialOverride(select.dataset.vawMaterialOverride, select.value));
    }
  }

  function getViewerFactsObject() {
    const bounds = state.viewer?.lastBounds;
    const controls = state.viewer?.controls;
    return {
      renderer: state.viewer?.renderer ? 'ok' : `fail${state.viewer?.webglError ? ': ' + state.viewer.webglError.message : ''}`,
      renderLoop: state.viewer?.frameId ? `alive · frames ${state.viewer.frameCount}` : 'not running',
      viewerOk: !state.viewer?.webglError && Boolean(state.viewer?.renderer),
      model: state.gltf ? state.modelRecord?.normalizedPath || 'loaded' : 'none',
      importKind: state.importKind || 'none',
      sceneObjects: state.gltf ? countNodes(state.gltf.scene) : 0,
      meshes: state.gltf ? countMeshes(state.gltf.scene) : 0,
      bounds: bounds?.valid ? `${fmtVec(bounds.size)} @ ${fmtVec(bounds.center)}` : 'not available',
      camera: state.viewer?.camera ? `${fmtVec(state.viewer.camera.position)} → ${controls?.target ? fmtVec(controls.target) : 'target ?'}` : 'none',
      controls: controls?.stats ? `rotate ${controls.stats.rotateEvents}, pan ${controls.stats.panEvents}, zoom ${controls.stats.zoomEvents}, ignored L/R ${controls.stats.ignoredLeftRight}` : 'none',
      frameResetMeaning: 'F preserves camera orientation and frames model; R resets to default orientation for model.',
    };
  }


  function updateProjectFileFilters() {
    state.projectFileFilters = {
      search: (el['project-files-search']?.value || '').trim().toLowerCase(),
      category: el['project-files-category-filter']?.value || 'all',
      status: el['project-files-status-filter']?.value || 'all',
    };
    renderProjectFilesReport();
  }

  function clearProjectFileFilters() {
    if (el['project-files-search']) el['project-files-search'].value = '';
    if (el['project-files-category-filter']) el['project-files-category-filter'].value = 'all';
    if (el['project-files-status-filter']) el['project-files-status-filter'].value = 'all';
    updateProjectFileFilters();
  }

  function filterProjectFiles(files) {
    const filters = state.projectFileFilters || { search: '', category: 'all', status: 'all' };
    return files.filter(file => {
      if (filters.category !== 'all' && file.category !== filters.category) return false;
      if (filters.status !== 'all' && file.status !== filters.status) return false;
      if (filters.search) {
        const haystack = `${file.name} ${file.relativePath} ${file.extension} ${file.category} ${file.status}`.toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
    });
  }

  function renderProjectFilesReport() {
    if (!el['project-files-list']) return;
    const report = state.projectFilesReport;
    if (el['project-files-summary']) {
      const summary = report ? report.summary : null;
      el['project-files-summary'].innerHTML = summary ? [
        ['loaded', summary.totalLoadedFiles], ['shown', filterProjectFiles(report.files).length], ['used', summary.used], ['unused', summary.unused], ['missing', summary.missing], ['ambiguous', summary.ambiguous], ['textures', summary.textures]
      ].map(([key, value]) => `<div class="fact"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('') : '';
    }
    if (!report || !report.files.length) {
      el['project-files-list'].className = 'scroll-list tall empty';
      el['project-files-list'].textContent = 'Brak plików.';
      return;
    }
    const files = filterProjectFiles(report.files);
    if (!files.length) {
      el['project-files-list'].className = 'scroll-list tall empty';
      el['project-files-list'].textContent = 'Brak plików pasujących do filtrów.';
      return;
    }
    el['project-files-list'].className = 'scroll-list tall';
    el['project-files-list'].innerHTML = files.map(file => {
      const css = file.status.replace(/\s+/g, '-');
      const tags = [
        file.category,
        file.extension ? `.${file.extension}` : 'no extension',
        file.status,
        file.virtual ? 'virtual dependency' : file.sizeLabel,
        file.includeInDebugExport ? 'debug export: yes' : 'debug export: no',
        file.includeInVawExport ? 'VAW export: yes' : 'VAW export: no',
        file.textureUsedByMaterial ? `material slots: ${file.materialSlots.map(slot => slot.slot).join(', ')}` : '',
        file.sidecarRecognized ? 'manifest recognized' : '',
        file.sidecarInvalid ? 'manifest invalid' : '',
      ].filter(Boolean).map(tag => `<span class="file-tag">${escapeHtml(tag)}</span>`).join('');
      const deps = (file.dependencyRefs || []).map(dep => `${dep.kind || 'dep'}#${dep.index ?? '?'} ${dep.displayUri || compactUri(dep.uri || '')}`.trim()).join(' · ');
      return `<div class="row ${escapeHtml(css)}"><strong>${escapeHtml(file.name)}</strong><code>${escapeHtml(file.relativePath)}</code><div class="file-tags">${tags}</div>${deps ? `<small>refs: ${escapeHtml(deps)}</small>` : ''}${file.warning ? `<small>${escapeHtml(file.warning)}</small>` : ''}</div>`;
    }).join('');
  }

  function renderDependencyList() {
    if (!el['dependency-list']) return;
    if (!state.dependencies.length) {
      el['dependency-list'].className = 'scroll-list empty';
      el['dependency-list'].textContent = state.importKind === 'glb' ? 'GLB: dependencies embedded albo brak raportu JSON.' : 'Brak modelu / brak zewnętrznych zależności.';
      return;
    }
    el['dependency-list'].className = 'scroll-list';
    el['dependency-list'].innerHTML = state.dependencies.map(dep => `<div class="row ${escapeHtml(dep.status)}"><strong>${escapeHtml(dep.kind)}</strong><code>${escapeHtml(dep.displayUri || compactUri(dep.uri || '(embedded)'))}</code><small>${escapeHtml(dep.status)}${dep.path ? ` · ${escapeHtml(dep.path)} · ${Math.round(dep.size / 1024)} KB` : ''}${dep.reason ? ` · ${escapeHtml(dep.reason)}` : ''}</small></div>`).join('');
  }

  function renderAnimations() {
    const clips = state.gltf?.animations || [];
    const report = state.animationReport;
    if (el['animation-select']) {
      el['animation-select'].innerHTML = clips.map((clip, index) => `<option value="${index}">${escapeHtml(clip.name || `clip_${index}`)}</option>`).join('');
      el['animation-select'].disabled = clips.length === 0;
    }
    for (const id of ['play-animation', 'pause-animation', 'stop-animation', 'animation-loop', 'animation-speed']) if (el[id]) el[id].disabled = clips.length === 0;
    updateAnimationTimeUi();
    if (!el['animation-list']) return;
    if (!clips.length) {
      el['animation-list'].className = 'scroll-list empty';
      el['animation-list'].textContent = state.gltf ? 'Model nie zawiera animacji. Preview animacji jest gotowy, ale nie ma clipów do odtworzenia.' : 'Brak modelu.';
      return;
    }
    el['animation-list'].className = 'scroll-list';
    const rows = (report?.clips || []).map(row => `<div class="row ${row.status}"><strong>${escapeHtml(row.name)}</strong><small>duration ${row.duration !== null ? row.duration.toFixed(3) + ' s' : '?'} · tracks ${row.trackCount} · channels ${row.channels} · props ${escapeHtml(row.animatedProperties.join(', ') || 'runtime')}${row.animatedNodes.length ? ' · nodes ' + escapeHtml(row.animatedNodes.slice(0, 6).join(', ')) : ''}</small></div>`).join('');
    const warnings = (report?.warnings || []).map(item => `<div class="row ${item.severity}"><strong>${escapeHtml(item.code)}</strong><small>${escapeHtml(item.message)}</small></div>`).join('');
    el['animation-list'].innerHTML = rows + warnings;
  }

  function selectedAnimationClip() {
    const clips = state.gltf?.animations || [];
    return clips[Number(el['animation-select']?.value) || 0] || null;
  }

  function playSelectedAnimation() {
    const clip = selectedAnimationClip();
    if (!clip) return;
    const options = { loop: Boolean(el['animation-loop']?.checked), speed: Number(el['animation-speed']?.value || 1) };
    if (state.viewer.playAnimation(clip, options)) {
      addEvent(`animation: play ${clip.name || '(unnamed)'} · loop=${options.loop} · speed=${options.speed}x`);
      updateAnimationTimeUi();
    }
  }

  function toggleAnimationPause() {
    const facts = state.viewer.getAnimationFacts ? state.viewer.getAnimationFacts() : { paused: false };
    if (!facts.activeClip) return;
    const paused = state.viewer.pauseAnimation(!facts.paused);
    if (el['pause-animation']) el['pause-animation'].textContent = paused ? 'Resume' : 'Pause';
    addEvent(paused ? 'animation: pause' : 'animation: resume');
    updateAnimationTimeUi();
  }

  function stopAnimationPreview() {
    state.viewer.stopAnimation();
    if (el['pause-animation']) el['pause-animation'].textContent = 'Pause';
    if (el['animation-time']) el['animation-time'].value = '0';
    updateAnimationTimeUi();
    addEvent('animation: stop');
  }

  function scrubAnimationPreview() {
    const time = Number(el['animation-time']?.value || 0);
    state.viewer.setAnimationTime(time);
    if (el['animation-time-label']) el['animation-time-label'].textContent = `${time.toFixed(2)}s`;
  }

  function updateAnimationTimeUi(facts = null) {
    if (!el['animation-time']) return;
    const clip = selectedAnimationClip();
    const durationFromFacts = facts && Number.isFinite(Number(facts.duration)) && Number(facts.duration) > 0 ? Number(facts.duration) : null;
    const duration = durationFromFacts || (clip && Number.isFinite(clip.duration) ? Math.max(0.01, clip.duration) : 1);
    const active = Boolean(clip);
    el['animation-time'].max = String(duration);
    el['animation-time'].step = String(Math.max(0.01, duration / 200));
    el['animation-time'].disabled = !active;
    const timeFromFacts = facts && facts.activeClip && Number.isFinite(Number(facts.currentTime)) ? Number(facts.currentTime) : null;
    const current = Math.max(0, Math.min(timeFromFacts !== null ? timeFromFacts : Number(el['animation-time'].value || 0), duration));
    el['animation-time'].value = String(current);
    if (el['animation-time-label']) el['animation-time-label'].textContent = `${current.toFixed(2)}s / ${duration.toFixed(2)}s`;
  }

  function handleAnimationTick(facts) {
    if (!facts || !facts.activeClip) return;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (now - state.animationUiLastPaint < 80) return;
    state.animationUiLastPaint = now;
    updateAnimationTimeUi(facts);
  }

  function renderTextureReport() {
    if (!el['texture-list'] && !el['texture-summary'] && !el['mesh-list']) return;
    const report = state.textureReport;
    if (el['texture-summary']) {
      const summary = report ? report.summary : null;
      el['texture-summary'].innerHTML = summary ? [
        ['images', summary.imageCount], ['textures', summary.textureCount], ['materials', summary.materialCount],
        ['runtime meshes', summary.runtimeMeshCount], ['missing/ambiguous images', summary.missingOrAmbiguousImageCount], ['diag', summary.diagnosticCount || 0], ['warnings', summary.warningCount || 0]
      ].map(([key, value]) => `<div class="fact"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('') : '';
    }
    if (el['texture-list']) {
      if (!report || (!report.images.length && !report.materials.length)) {
        el['texture-list'].className = 'scroll-list empty';
        el['texture-list'].textContent = state.gltf ? 'Brak tekstur w glTF.' : 'Brak modelu.';
      } else {
        el['texture-list'].className = 'scroll-list';
        const imageRows = report.images.map(image => `<div class="row ${escapeHtml(image.status)}"><strong>image[${image.index}] ${escapeHtml(image.name)}</strong><code>${escapeHtml(image.uri || image.mimeType || '(embedded)')}</code><small>${escapeHtml(image.status)}${image.path ? ` · ${escapeHtml(image.path)}` : ''}</small></div>`).join('');
        const materialRows = report.materials.map(material => `<div class="row ${material.slots.length ? 'ok' : 'warning'}"><strong>material[${material.index}] ${escapeHtml(material.name)}</strong><small>alpha=${escapeHtml(material.alphaMode)} · doubleSided=${material.doubleSided} · baseColor=${escapeHtml((material.baseColorFactor || []).join(', '))} · emissive=${escapeHtml((material.emissiveFactor || []).join(', '))} · slots=${material.slots.map(slot => `${slot.slot}:${slot.imageStatus}`).join(', ') || 'none'}</small></div>`).join('');
        const diagnosticRows = (report.diagnostics || []).map(item => `<div class="row ${escapeHtml(item.severity)}"><strong>${escapeHtml(item.code)}</strong><small>${escapeHtml(item.message)}</small></div>`).join('');
        el['texture-list'].innerHTML = imageRows + materialRows + diagnosticRows;
      }
    }
    if (el['mesh-list']) {
      if (!report || !report.meshes.length) {
        el['mesh-list'].className = 'scroll-list empty';
        el['mesh-list'].textContent = state.gltf ? 'Brak runtime meshów.' : 'Brak modelu.';
      } else {
        el['mesh-list'].className = 'scroll-list';
        el['mesh-list'].innerHTML = report.meshes.map(mesh => `<div class="row ${mesh.warningCodes && mesh.warningCodes.length ? 'warning' : (mesh.visible ? 'ok' : 'warning')}"><strong>${escapeHtml(mesh.name)}</strong><small>vertices ${mesh.vertexCount} · tris ${mesh.triangleCount} · uv0=${mesh.hasUv0} · uv1=${mesh.hasUv1} · materials=${escapeHtml(mesh.materialNames.join(', ') || 'none')} · material types=${escapeHtml((mesh.materialTypes || []).join(', ') || 'none')} · textures=${escapeHtml(mesh.textureSlots.map(slot => slot.runtimeSlot).join(', ') || 'none')}${mesh.warningCodes && mesh.warningCodes.length ? ' · warnings=' + escapeHtml(mesh.warningCodes.join(', ')) : ''}</small></div>`).join('');
      }
    }
  }

  function collectWorkbenchDiagnostics() {
    const diagnostics = [];
    for (const item of state.lastValidation?.diagnostics || []) diagnostics.push(item);
    for (const item of state.textureReport?.diagnostics || []) diagnostics.push({ domain: 'texture-diagnostic', ...item });
    for (const item of state.animationReport?.warnings || []) diagnostics.push({ domain: 'animation-diagnostic', ...item });
    return diagnostics;
  }

  function renderDiagnostics() {
    if (!el.diagnostics) return;
    const diagnostics = collectWorkbenchDiagnostics();
    if (!diagnostics.length) {
      el.diagnostics.className = 'scroll-list empty';
      el.diagnostics.textContent = state.gltf ? 'Brak aktywnych problemów Workbench. Preview działa niezależnie.' : 'Brak diagnostyki.';
      return;
    }
    const errors = diagnostics.filter(item => item.severity === 'error').length;
    const warnings = diagnostics.filter(item => item.severity === 'warning').length;
    const summary = `<div class="row ${errors ? 'error' : warnings ? 'warning' : 'info'}"><strong>${errors ? 'Export V1 blocked' : warnings ? 'Preview OK · export has warnings' : 'Preview OK · informational notices only'}</strong><small>${errors} blocking errors · ${warnings} warnings · ${diagnostics.length - errors - warnings} info. Debug Export remains available after a model loads.</small></div>`;
    el.diagnostics.className = 'scroll-list';
    el.diagnostics.innerHTML = summary + diagnostics.map(item => {
      const label = item.severity === 'error' ? 'blokuje export V1' : item.severity === 'warning' ? 'nie blokuje preview; sprawdź przed exportem' : 'informacja / normalny stan';
      return `<div class="row ${escapeHtml(item.severity)}"><strong>${escapeHtml(item.code)} · ${escapeHtml(item.domain || 'workbench')}</strong><small>${escapeHtml(item.severity)} · ${escapeHtml(label)} · ${escapeHtml(item.message)}</small></div>`;
    }).join('');
  }

  function renderVawStatus() {
    if (!el['vaw-status']) return;
    if (!state.gltf) {
      el['vaw-status'].className = 'status neutral';
      el['vaw-status'].textContent = 'Brak modelu.';
      return;
    }
    const result = state.lastValidation;
    if (!result) {
      el['vaw-status'].className = 'status neutral';
      el['vaw-status'].textContent = 'Preview modelu jest osobne. Walidacja kontraktu V1 jeszcze nieuruchomiona.';
      return;
    }
    const errors = result.diagnostics.filter(item => item.severity === 'error').length;
    const warnings = result.diagnostics.filter(item => item.severity === 'warning').length;
    const hasNoManifest = result.diagnostics.some(item => item.code === 'pack.noManifest');
    if (result.vawReady) {
      el['vaw-status'].className = warnings ? 'status warn' : 'status ok';
      el['vaw-status'].textContent = warnings ? 'Visual Asset Pack V1 jest eksportowalny, ale ma nieblokujące ostrzeżenia. Preview działa.' : 'Visual Asset Pack V1 OK. Preview działa.';
    } else if (hasNoManifest && !errors) {
      el['vaw-status'].className = 'status neutral';
      el['vaw-status'].textContent = 'Preview OK. To zwykły import bez manifestu V1, więc Export Visual Asset Pack V1 jest celowo zablokowany do czasu Infer/Load manifest.';
    } else {
      el['vaw-status'].className = errors ? 'status bad' : 'status warn';
      el['vaw-status'].textContent = errors ? 'Preview może działać, ale Export Visual Asset Pack V1 jest zablokowany przez błędy kontraktu.' : 'Preview działa. Export V1 ma tylko nieblokujące ostrzeżenia/uwagi.';
    }
  }

  function renderSidecarStatus() {
    if (!el['sidecar-status']) return;
    const facts = state.lastValidation?.facts || {};
    const recognized = state.sidecarParseReport?.recognizedPaths || [];
    const invalid = state.sidecarParseReport?.invalidPaths || [];
    const rows = [
      ['loaded manifests', recognized.length ? recognized.join(', ') : 'none'],
      ['manifest base path', state.sidecarBasePath || '(pack root / inferred)'],
      ['invalid manifests', invalid.length ? invalid.join(', ') : 'none'],
      ['active packId / assetId', [facts.packId, state.sidecar?.assets?.[0]?.assetId].filter(Boolean).join(' / ') || state.sidecar?.assetId || 'none'],
      ['visualRoot', facts.visualRoot || state.sidecar?.assets?.[0]?.bindings?.nodes?.visualRoot || state.sidecar?.semantics?.visualRoot?.node || 'none'],
      ['clip bindings', String(facts.clipCount ?? Object.values(state.sidecar?.assets?.[0]?.bindings?.clips || {}).filter(Boolean).length)],
    ];
    el['sidecar-status'].innerHTML = rows.map(([key, value]) => `<div class="fact"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  }

  function renderUiAvailability() {
    const hasModel = Boolean(state.gltf && state.bundle);
    const vawReady = Boolean(state.lastValidation && state.lastValidation.vawReady);
    setDisabled(el['download-debug-package'], !hasModel, hasModel ? 'Export Debug Package działa bez kontraktu VAW.' : 'Załaduj model, aby wyeksportować debug package.');
    setDisabled(el['download-package'], !vawReady, vawReady ? 'Export Visual Asset Pack V1 gotowy.' : 'Export Visual Asset Pack V1 wymaga poprawnego kontraktu. Debug export jest dostępny osobno.');
    setDisabled(el['download-sidecar'], !hasModel, 'Najpierw załaduj model.');
    setDisabled(el['infer-sidecar'], !hasModel, 'Najpierw załaduj model.');
    setDisabled(el['validate-vaw'], !hasModel, 'Najpierw załaduj model.');
    setDisabled(el['format-sidecar'], !hasModel, 'Najpierw załaduj model.');
    setDisabled(el['apply-sidecar'], !hasModel, 'Najpierw załaduj model.');
    setDisabled(el['install-block-visual'], !hasModel, hasModel ? 'Installs or updates one block visual in local_working_visuals.' : 'Najpierw załaduj model.');
  }

  function setDisabled(element, disabled, title) {
    if (!element) return;
    element.disabled = Boolean(disabled);
    if (title) element.title = title;
  }

  function parseSidecarFromEditor({ allowInfer = false } = {}) {
    if (!VisualAssetPack) return { sidecar: {}, error: null, inferred: false };
    const text = el['sidecar-json']?.value?.trim() || '';
    if (text) {
      try { return { sidecar: JSON.parse(text), error: null, inferred: false }; }
      catch (error) { return { sidecar: null, error, inferred: false }; }
    }
    if (state.sidecar) return { sidecar: state.sidecar, error: null, inferred: false };
    if (allowInfer && state.gltfJson) return { sidecar: inferVisualAssetManifest(), error: null, inferred: true };
    return { sidecar: null, error: null, inferred: false };
  }

  function formatSidecarEditor() {
    const parsed = parseSidecarFromEditor({ allowInfer: false });
    if (parsed.error) {
      state.sidecarParseReport.diagnostics.push({ severity: 'error', code: 'manifest.editorInvalidJson', message: parsed.error.message });
      addEvent(`manifest: format failed ${parsed.error.message}`);
      validateVawReadiness();
      return;
    }
    if (!parsed.sidecar) return;
    state.sidecar = parsed.sidecar;
    if (el['sidecar-json']) el['sidecar-json'].value = JSON.stringify(parsed.sidecar, null, 2) + '\n';
    addEvent('manifest: JSON formatted');
    validateVawReadiness();
  }

  function applySidecarEditor() {
    const parsed = commitAuthoringFieldsToManifest({ allowInfer: false, preserveEmpty: true });
    if (parsed.error) {
      state.lastValidation = { viewerOk: true, vawReady: false, diagnostics: [{ domain: 'vaw-readiness', severity: 'error', code: 'visualAssetPack.manifestJsonInvalid', message: parsed.error.message }] };
      addEvent(`manifest: apply failed ${parsed.error.message}`);
      renderDiagnostics();
      renderVawStatus();
      renderSidecarStatus();
      renderUiAvailability();
      return;
    }
    state.sidecarParseReport.diagnostics.push({ severity: 'info', code: 'visualAssetPack.editorApplied', message: parsed.sidecar ? 'Visual asset manifest editor content applied.' : 'Manifest editor is empty; active manifest cleared.' });
    addEvent(parsed.sidecar ? 'manifest: applied from editor' : 'manifest: cleared from editor');
    buildProjectFilesReport();
    validateVawReadiness();
    renderProjectFilesReport();
  }

  function downloadSidecar() {
    if (!VisualAssetPack || !state.gltfJson) return;
    const parsed = commitAuthoringFieldsToManifest({ allowInfer: true, preserveEmpty: true });
    if (parsed.error) {
      alert('Visual asset manifest JSON jest niepoprawny. Napraw go albo wyczyść pole i wygeneruj ponownie.');
      addEvent(`manifest download blocked: ${parsed.error.message}`);
      return;
    }
    const sidecar = parsed.sidecar;
    validateVawReadiness();
    downloadText(`${sidecar.packId || sidecar.assetId || 'visual_asset_pack'}_VAW_VISUAL_ASSET_PACK_V1.json`, JSON.stringify(sidecar, null, 2) + '\n');
  }

  async function downloadDebugPackageZip() {
    if (!PackageExporter || !state.bundle || !state.gltf) return;
    buildProjectFilesReport();
    if (!state.lastValidation && VisualAssetPack) validateVawReadiness();
    const entries = await PackageExporter.buildDebugPackageEntries({
      bundle: state.bundle,
      projectFilesReport: state.projectFilesReport,
      textureReport: state.textureReport,
      viewerFacts: getViewerFactsObject(),
      validation: state.lastValidation,
      dependencies: state.dependencies,
      sidecarParseReport: state.sidecarParseReport,
      animationReport: state.animationReport,
      eventLog: state.events,
      sessionReport: getSessionReportObject(),
      prefix: 'vaw_debug_package',
    });
    const blob = PackageExporter.buildStoreZip(entries);
    downloadBlob(`${(state.modelRecord?.basename || 'asset').replace(/\.[^.]+$/, '')}_debug_package.zip`, blob);
    addEvent('debug export: package built without requiring VAW readiness');
  }

  function localBlockSlug(blockType) {
    return String(blockType || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  function normalizeInstallEntryPath(value) {
    const raw = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
    const parts = [];
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') throw new Error(`Unsafe install path: ${value}`);
      if (part.includes(':') || part.includes('?') || part.includes('#')) throw new Error(`Unsafe install path: ${value}`);
      parts.push(part);
    }
    if (!parts.length) throw new Error(`Unsafe install path: ${value}`);
    return parts.join('/');
  }

  function findBundleRecord(pathValue) {
    const wanted = normalizeInstallEntryPath(pathValue).toLowerCase();
    return (state.bundle?.records || []).find(record => normalizeInstallEntryPath(record.normalizedPath).toLowerCase() === wanted) || null;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return btoa(binary);
  }

  async function recordToInstallFile(record, pathValue) {
    return {
      path: normalizeInstallEntryPath(pathValue),
      dataBase64: bytesToBase64(new Uint8Array(await record.file.arrayBuffer()))
    };
  }

  function textToInstallFile(text, pathValue) {
    return {
      path: normalizeInstallEntryPath(pathValue),
      dataBase64: bytesToBase64(new TextEncoder().encode(String(text || '')))
    };
  }

  function mergeMaterialOverrides(policy, overrides) {
    const byName = new Map();
    for (const item of policy.materialOverrides || []) {
      const name = String(item.materialName || item.name || '').trim();
      if (name) byName.set(name.toLowerCase(), { ...item, materialName: name });
    }
    for (const item of overrides || []) {
      const name = String(item.materialName || item.name || '').trim();
      if (!name) continue;
      byName.set(name.toLowerCase(), { ...item, materialName: name });
    }
    const next = [...byName.values()].filter(item => item.alpha && item.alpha !== 'auto');
    if (next.length) policy.materialOverrides = next;
    else delete policy.materialOverrides;
    return policy;
  }

  function buildInstallGltfPatch(asset) {
    if (!MaterialTools || !state.gltfJson || state.importKind !== 'gltf') return null;
    let gltfJson = state.gltfJson;
    let changed = false;
    const events = [];
    const overrides = [];
    const normalized = MaterialTools.normalizeMaterialNames(gltfJson);
    if (normalized.changed) {
      gltfJson = normalized.gltfJson;
      changed = true;
      events.push('normalized unnamed glTF materials');
    }

    if (el['vaw-fire-split-enabled']?.checked) {
      let selectors = currentFireSplitNodePaths();
      if (!selectors.length) selectors = MaterialTools.suggestFireNodePaths(gltfJson);
      const split = MaterialTools.splitNodeMaterialsForBlend(gltfJson, selectors, { doubleSided: true });
      gltfJson = split.gltfJson;
      changed = changed || split.changed;
      if (split.patchedPrimitiveCount > 0) {
        events.push(`split ${split.patchedPrimitiveCount} fire/glow primitives`);
        for (const name of split.sourceMaterialNames || []) overrides.push({ materialName: name, alpha: 'mask' });
        for (const name of split.newMaterialNames || []) overrides.push({ materialName: name, alpha: 'blend' });
      } else {
        events.push(`split requested but no fire/glow primitives matched (${selectors.join(', ') || 'no selectors'})`);
      }
      if (split.missingSelectors?.length) events.push(`missing fire/glow selectors: ${split.missingSelectors.join(', ')}`);
    }

    if (!changed) return null;
    asset.materialPolicy = mergeMaterialOverrides(asset.materialPolicy || {}, overrides);
    return {
      gltfText: JSON.stringify(gltfJson, null, 2) + '\n',
      events,
    };
  }

  async function buildLocalInstallFiles(blockType, installPatch = null) {
    const slug = localBlockSlug(blockType);
    const prefix = `models/blocks/${slug}/`;
    const files = [];
    const seen = new Set();
    if (installPatch?.gltfText) files.push(textToInstallFile(installPatch.gltfText, `${prefix}model.gltf`));
    else files.push(await recordToInstallFile(state.modelRecord, `${prefix}model.gltf`));
    seen.add(`${prefix}model.gltf`);
    for (const dep of state.dependencies || []) {
      if (dep.status !== 'found' || !dep.path || !dep.uri || /^data:/i.test(dep.uri) || /^[a-z][a-z0-9+.-]*:/i.test(dep.uri)) continue;
      const record = findBundleRecord(dep.path);
      if (!record) continue;
      const targetPath = normalizeInstallEntryPath(`${prefix}${dep.uri}`);
      if (seen.has(targetPath.toLowerCase())) continue;
      seen.add(targetPath.toLowerCase());
      files.push(await recordToInstallFile(record, targetPath));
    }
    return files;
  }

  function installStatus(kind, text) {
    if (el['install-status']) {
      el['install-status'].className = `status ${kind}`;
      el['install-status'].textContent = text;
    }
  }

  function applyStoredInstallEndpoint() {
    if (!el['vaw-install-endpoint']) return;
    try {
      el['vaw-install-endpoint'].value = localStorage.getItem(INSTALL_ENDPOINT_PREFS_KEY) || '';
    } catch (_) {
      el['vaw-install-endpoint'].value = '';
    }
  }

  function rememberInstallEndpoint(value) {
    try {
      if (value) localStorage.setItem(INSTALL_ENDPOINT_PREFS_KEY, value);
      else localStorage.removeItem(INSTALL_ENDPOINT_PREFS_KEY);
    } catch (_) {
      // Endpoint preference is optional; local install must still work without storage.
    }
  }

  function addUniqueEndpoint(list, value) {
    const text = String(value || '').trim();
    if (!text) return;
    let url = '';
    try { url = new URL(text, window.location.href).toString(); }
    catch (_) { return; }
    if (!list.includes(url)) list.push(url);
  }

  function localHostCandidates() {
    const hosts = [];
    const current = String(window.location.hostname || '').replace(/^\[|\]$/g, '');
    if (current && ['127.0.0.1', 'localhost', '::1'].includes(current)) hosts.push(current);
    for (const host of ['127.0.0.1', 'localhost']) {
      if (!hosts.includes(host)) hosts.push(host);
    }
    return hosts;
  }

  function installEndpointCandidates() {
    const candidates = [];
    addUniqueEndpoint(candidates, el['vaw-install-endpoint']?.value || '');
    try { addUniqueEndpoint(candidates, localStorage.getItem(INSTALL_ENDPOINT_PREFS_KEY) || ''); } catch (_) {}
    addUniqueEndpoint(candidates, INSTALL_ENDPOINT_PATH);
    const protocol = /^https?:$/.test(window.location.protocol) ? window.location.protocol : 'http:';
    for (const host of localHostCandidates()) {
      for (const port of INSTALL_ENDPOINT_CANDIDATE_PORTS) {
        addUniqueEndpoint(candidates, `${protocol}//${host}:${port}${INSTALL_ENDPOINT_PATH}`);
      }
    }
    return candidates;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, { ...options, signal: controller?.signal });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function installFetchErrorMessage(error) {
    const text = String(error?.message || error || 'unknown error');
    if (error?.name === 'AbortError') return 'timeout';
    if (/failed to fetch/i.test(text)) return 'not reachable or blocked by browser/CORS';
    return text;
  }

  async function probeInstallEndpoint(url) {
    const response = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store' }, 1800);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok || result.endpoint !== 'install_visual_block') {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }
    return result;
  }

  async function resolveInstallEndpoint() {
    const failures = [];
    for (const endpoint of installEndpointCandidates()) {
      try {
        await probeInstallEndpoint(endpoint);
        if (el['vaw-install-endpoint']) el['vaw-install-endpoint'].value = endpoint;
        rememberInstallEndpoint(endpoint);
        return { ok: true, endpoint, failures };
      } catch (error) {
        failures.push(`${endpoint}: ${installFetchErrorMessage(error)}`);
      }
    }
    return { ok: false, endpoint: '', failures };
  }

  async function checkInstallEndpoint() {
    installStatus('neutral', 'Checking VAW install endpoint...');
    const resolved = await resolveInstallEndpoint();
    if (resolved.ok) {
      installStatus('ok', `Install endpoint ready: ${resolved.endpoint}`);
      addEvent(`local install endpoint ready: ${resolved.endpoint}`);
    } else {
      const tried = resolved.failures.slice(0, 4).join(' | ');
      installStatus('bad', `Install endpoint unavailable. Start: npm run studio:serve. Tried: ${tried}`);
      addEvent(`local install endpoint unavailable: ${tried}`);
    }
    return resolved;
  }

  function requestGameVisualReload(result, installEndpoint) {
    if (typeof BroadcastChannel !== 'function') return false;
    try {
      if (installEndpoint && new URL(installEndpoint, window.location.href).origin !== window.location.origin) return false;
    } catch (_) {
      return false;
    }
    try {
      const channel = new BroadcastChannel('vaw-visual-assets');
      channel.postMessage({
        type: 'visual-block-installed',
        packId: result.packId || 'local_working_visuals',
        blockType: result.blockType,
        assetId: result.assetId,
        modelPath: result.modelPath,
        revision: result.revision
      });
      channel.close?.();
      return true;
    } catch (error) {
      addEvent(`local install: reload broadcast unavailable ${error.message || error}`);
      return false;
    }
  }

  async function installBlockVisual() {
    if (!state.bundle || !state.modelRecord || !state.gltfJson) {
      installStatus('bad', 'Load a glTF model before installing a block visual.');
      return;
    }
    const blockTypes = selectedBlockTypes();
    if (!blockTypes.length) {
      installStatus('bad', 'Choose a block type before install.');
      return;
    }
    const parsed = commitAuthoringFieldsToManifest({ allowInfer: true, preserveEmpty: true });
    if (parsed.error || !parsed.sidecar?.assets?.[0]) {
      installStatus('bad', `Manifest is not valid JSON: ${parsed.error?.message || 'missing asset'}`);
      return;
    }
    const sidecar = parsed.sidecar;
    validateVawReadiness();
    if (!sidecar.assets[0].bindings?.nodes?.visualRoot) {
      installStatus('bad', 'visualRoot is required. Use suggested root or choose a node path.');
      return;
    }
    const blockType = blockTypes[0];
    const asset = JSON.parse(JSON.stringify(sidecar.assets[0]));
    asset.bindings.blockTypes = [blockType];
    asset.assetId = `local_${localBlockSlug(blockType)}_visual`;
    asset.model.path = `models/blocks/${localBlockSlug(blockType)}/model.gltf`;
    const installPatch = buildInstallGltfPatch(asset);
    for (const event of installPatch?.events || []) addEvent(`material install patch: ${event}`);
    const payload = {
      format: 'VAW_LOCAL_VISUAL_BLOCK_INSTALL_V1',
      packId: 'local_working_visuals',
      blockType,
      asset,
      files: await buildLocalInstallFiles(blockType, installPatch)
    };
    installStatus('neutral', `Installing ${blockType} into local_working_visuals...`);
    try {
      const resolvedEndpoint = await resolveInstallEndpoint();
      if (!resolvedEndpoint.ok) {
        const tried = resolvedEndpoint.failures.slice(0, 4).join(' | ');
        throw new Error(`VAW install endpoint unavailable. Start the integrated server with "npm run studio:serve" or "python tools/serve.py --studio". Tried: ${tried}`);
      }
      const response = await fetchWithTimeout(resolvedEndpoint.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 20000);
      const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
      if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
      const reloadRequested = requestGameVisualReload(result, resolvedEndpoint.endpoint);
      installStatus('ok', `Installed ${result.blockType} ${result.assetId} rev ${result.revision}. ${reloadRequested ? 'Game reload requested.' : 'In game: Reload Visuals or Shift+V.'}`);
      addEvent(`local install: ${result.blockType} ${result.assetId} rev ${result.revision}${reloadRequested ? ' reload requested' : ''}`);
    } catch (error) {
      installStatus('bad', `Install failed: ${error.message || error}`);
      addEvent(`local install failed: ${error.message || error}`);
    }
  }

  async function downloadPackageZip() {
    if (!PackageExporter || !state.bundle || !state.gltfJson) return;
    let sidecar = null;
    try { sidecar = parseOrInferSidecar(); }
    catch (error) {
      alert(`Visual asset manifest JSON jest niepoprawny: ${error.message}`);
      addEvent(`VAW Visual Asset Pack export blocked: invalid manifest JSON ${error.message}`);
      return;
    }
    const validation = VisualAssetPack.validateManifest({ manifest: sidecar, gltfJson: state.gltfJson, dependencies: state.dependencies, modelRecord: state.modelRecord, manifestBasePath: state.sidecarBasePath || '' });
    state.lastValidation = validation;
    renderDiagnostics();
    renderVawStatus();
    renderSidecarStatus();
    renderUiAvailability();
    if (!validation.vawReady) {
      addEvent('VAW Visual Asset Pack export blocked: contract errors remain. Debug export is still allowed.');
      alert('Preview działa, ale Export VAW Visual Asset Pack jest zablokowany przez kontrakt V1. Użyj Export Debug Package do zgłaszania problemów.');
      return;
    }
    const entries = await PackageExporter.buildVisualAssetPackEntries({ bundle: state.bundle, manifest: sidecar, validation, projectFilesReport: state.projectFilesReport, textureReport: state.textureReport, animationReport: state.animationReport, dependencies: state.dependencies, manifestBasePath: state.sidecarBasePath || '', prefix: sidecar.packId || 'visual_asset_pack' });
    const blob = PackageExporter.buildStoreZip(entries);
    downloadBlob(`${sidecar.packId || 'visual_asset_pack'}_visual_asset_pack_v1.zip`, blob);
  }

  function parseOrInferSidecar() {
    const parsed = commitAuthoringFieldsToManifest({ allowInfer: false, preserveEmpty: true });
    if (parsed.error) throw parsed.error;
    return state.sidecar;
  }

  function getSessionReportObject() {
    return {
      schemaVersion: 1,
      generatedBy: 'VAW Blockbench Import Studio M4A Visual Asset Contract',
      model: state.modelRecord ? { path: state.modelRecord.normalizedPath, name: state.modelRecord.basename, size: state.modelRecord.size } : null,
      importKind: state.importKind,
      dependencyCount: state.dependencies.length,
      loadedFileCount: state.bundle?.records?.length || 0,
      projectFileFilters: state.projectFileFilters,
      layout: state.layout?.layout || null,
      viewerFacts: getViewerFactsObject(),
      textureSummary: state.textureReport?.summary || null,
      animationSummary: state.animationReport?.summary || null,
      vawReady: Boolean(state.lastValidation?.vawReady),
      viewerOk: Boolean(state.lastValidation?.viewerOk ?? getViewerFactsObject().viewerOk),
    };
  }

  function handleImportError(error) {
    state.lastLoaderError = error;
    buildProjectFilesReport();
    setViewerStatus('bad', 'Import/viewer error', error.stack || error.message || String(error));
    addEvent(`error: ${error.stack || error.message || error}`);
    renderAll();
  }

  function setViewerStatus(kind, title, detail) {
    if (!el['viewer-status']) return;
    el['viewer-status'].className = `status ${kind}`;
    el['viewer-status'].textContent = detail ? `${title}: ${detail}` : title;
  }

  function addEvent(line) {
    state.events.unshift(`[${new Date().toLocaleTimeString()}] ${line}`);
    state.events = state.events.slice(0, 120);
    if (el['event-log']) el['event-log'].textContent = state.events.join('\n') || 'brak eventów';
  }

  function countMeshes(root) { let count = 0; root?.traverse?.(object => { if (object.isMesh) count += 1; }); return count; }
  function countNodes(root) { let count = 0; root?.traverse?.(() => { count += 1; }); return count; }
  function collectRuntimeNodeNames(root) { const names = []; root?.traverse?.(object => names.push(object.name || `node_${names.length}`)); return names; }
  function fmtVec(vector) { if (!vector) return '?'; return `${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)}`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
  function compactUri(value) { return Bundle.summarizeUri ? Bundle.summarizeUri(value) : String(value || '').replace(/^(.{96}).+$/, '$1…'); }
  function isViewerGeneratedBlobUrl(value) {
    const raw = String(value || '');
    // GLTFLoader can emit internal blob:http://... URLs while resolving object URLs.
    // Real missing external dependencies are already visible in GLTF_DEPENDENCY_REPORT / Project Files,
    // so the event log should not scare users with viewer-generated blob noise.
    return /^blob:/i.test(raw);
  }
  function downloadText(filename, text) { downloadBlob(filename, new Blob([text], { type: 'application/json;charset=utf-8' })); }
  function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  async function autoLoadFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get('sample');
    if (!sample) return;
    const map = { uv: SAMPLE_UV, offset: SAMPLE_OFFSET, regression: SAMPLE_REGRESSION, visual: SAMPLE_VISUAL_PACK_V1, v1: SAMPLE_VISUAL_PACK_V1 };
    if (!map[sample]) return;
    try { await loadFiles(await fetchSampleFiles(map[sample])); }
    catch (error) { handleImportError(error); }
  }

  window.VAW_IMPORT_STUDIO_RECOVERY_APP = { state, loadFilesForTest: loadFiles, resetAll, validateVawReadiness, fetchSampleFiles, getViewerFactsObject };
  init();
  autoLoadFromQuery();
})();
