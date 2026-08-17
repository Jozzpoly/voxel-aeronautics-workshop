(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_VISUAL_ASSET_PACK_V1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FORMAT = 'VAW_VISUAL_ASSET_PACK_V1';
  const ALLOWED_ASSET_KINDS = new Set(['blockVisual']);
  const ALLOWED_BLOCK_TYPES = new Set([
    'Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel'
  ]);
  const ALLOWED_NODE_ALIASES = new Set(['visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot']);
  const ALLOWED_CLIP_ALIASES = new Set(['idle', 'thrust', 'damage']);
  const ALLOWED_RIG_PROFILES = new Set(['vectorThruster']);
  const ALLOWED_RIG_INPUTS = new Set(['gimbalA', 'gimbalB', 'roll']);
  const ALLOWED_RIG_AXES = new Set(['x', 'y', 'z']);
  const STABLE_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
  const ALLOWED_AXES = new Set(['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
  const ALLOWED_ALPHA_POLICIES = new Set(['auto', 'opaque', 'mask', 'blend', 'mask-or-blend', 'from-gltf']);
  const ALLOWED_DOUBLE_SIDED_POLICIES = new Set(['from-gltf', true, false, 'force', 'never']);

  // These fields would make the visual pack a gameplay-authoritative format. They are intentionally blocked.
  const FORBIDDEN_GAMEPLAY_FIELDS = new Set([
    'gameplay', 'gameplayauthority', 'foundation', 'catalog', 'blueprint', 'craftmodel', 'craftcompiler', 'runtimeassemblyplan',
    'mass', 'masskg', 'density', 'inertia', 'physics', 'force', 'forcen', 'maxforce', 'thrustpower', 'maxthrust',
    'fuelrate', 'dragarea', 'wingarea', 'controlaxis', 'liftcoefficient', 'dragcoefficient', 'aerodynamics',
    'collision', 'collider', 'hitbox', 'health', 'hp', 'durability',
    'fuel', 'energy', 'powerdraw', 'recipe', 'crafting', 'damageamount', 'explosion', 'inventory'
  ]);

  function diagnostic(severity, code, message, extra = {}) {
    return { domain: 'visual-asset-pack-v1', severity, code, message, ...extra };
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isDataUri(value) {
    return /^data:/i.test(String(value || ''));
  }

  function isStableId(value) {
    return typeof value === 'string' && STABLE_ID_PATTERN.test(value);
  }

  function normalizePackPath(value) {
    const raw = String(value || '').replace(/\\/g, '/').trim();
    const parts = [];
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return parts.join('/');
  }

  function joinPackPath(base, relative) {
    const b = normalizePackPath(base);
    const r = normalizePackPath(relative);
    return b ? normalizePackPath(`${b}/${r}`) : r;
  }

  function isSafeRelativePath(path) {
    if (typeof path !== 'string') return false;
    const value = path.trim();
    if (!value || value !== path) return false;
    if (isDataUri(value)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
    if (/^[a-z]:[\/]/i.test(value)) return false;
    if (value.startsWith('/') || value.startsWith('./')) return false;
    if (value.includes('\\')) return false;
    if (value.includes('?') || value.includes('#')) return false;
    if (value.includes('//')) return false;
    const segments = value.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) return false;
    return true;
  }

  function collectNodeNames(gltfJson = {}) {
    return (gltfJson.nodes || []).map((node, index) => node.name || `node_${index}`);
  }

  function collectAnimationNames(gltfJson = {}) {
    return (gltfJson.animations || []).map((clip, index) => clip.name || `clip_${index}`);
  }

  function safeSegment(name, index) {
    const raw = String(name || `node_${index}`).trim() || `node_${index}`;
    return raw.replace(/\//g, '_');
  }

  function collectNodePathRecords(gltfJson = {}) {
    const nodes = Array.isArray(gltfJson.nodes) ? gltfJson.nodes : [];
    const childSet = new Set();
    for (const node of nodes) for (const child of node.children || []) childSet.add(child);
    const roots = nodes.map((_, index) => index).filter(index => !childSet.has(index));
    const rootSet = new Set(roots);
    const startIndexes = roots.length ? roots : nodes.map((_, index) => index);
    const records = [];
    const visited = new Set();

    function walk(index, parentPath, depth = 0) {
      if (!nodes[index]) return;
      const segment = safeSegment(nodes[index].name, index);
      const path = `${parentPath}/${segment}`;
      records.push({ index, name: nodes[index].name || `node_${index}`, path, normalizedPath: path.toLowerCase(), depth, isTopologicalRoot: depth === 0 && rootSet.has(index) });
      if (visited.has(index)) return;
      visited.add(index);
      for (const child of nodes[index].children || []) walk(child, path, depth + 1);
    }

    for (const index of startIndexes) walk(index, '');
    return records;
  }

  function buildNodeLookup(gltfJson = {}) {
    const records = collectNodePathRecords(gltfJson);
    const byName = new Map();
    const byPath = new Map();
    function addPath(key, record) {
      if (!byPath.has(key)) byPath.set(key, []);
      byPath.get(key).push(record);
    }
    for (const record of records) {
      const nameKey = String(record.name || '').toLowerCase();
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(record);
      addPath(record.normalizedPath, record);
      addPath(record.normalizedPath.replace(/^\//, ''), record);
    }
    const duplicateNames = [...byName.entries()].filter(([, list]) => list.length > 1).map(([name]) => name).filter(Boolean);
    const duplicatePaths = [...byPath.entries()].filter(([, list]) => list.length > 1).map(([path]) => path).filter(Boolean);
    return { records, byName, byPath, duplicateNames, duplicatePaths };
  }

  function resolveNodeBinding(binding, lookup) {
    if (binding === null || binding === undefined || binding === '') return { ok: true, optional: true, value: binding };
    if (typeof binding !== 'string') return { ok: false, code: 'binding.nodeNotString', reason: 'Node binding must be a string path/name or null.' };
    const raw = binding.trim();
    if (!raw) return { ok: true, optional: true, value: raw };
    if (raw.includes('/')) {
      const key = raw.toLowerCase().replace(/^\//, '');
      const matches = lookup.byPath.get(key) || lookup.byPath.get(`/${key}`) || [];
      if (matches.length === 1) return { ok: true, record: matches[0], value: raw };
      if (matches.length > 1) return { ok: false, code: 'binding.nodePathAmbiguous', reason: `Node path '${raw}' is ambiguous in the loaded glTF. Rename duplicate sibling nodes before VAW export.` };
      return { ok: false, code: 'binding.nodePathNotFound', reason: `Node path '${raw}' does not exist in the loaded glTF.` };
    }
    const matches = lookup.byName.get(raw.toLowerCase()) || [];
    if (matches.length === 1) return { ok: true, record: matches[0], value: raw };
    if (matches.length > 1) return { ok: false, code: 'binding.nodeNameAmbiguous', reason: `Node name '${raw}' is duplicated. Use a stable path such as '${matches[0].path}'.` };
    return { ok: false, code: 'binding.nodeNameNotFound', reason: `Node '${raw}' does not exist in the loaded glTF.` };
  }

  function buildAnimationLookup(gltfJson = {}) {
    const names = collectAnimationNames(gltfJson);
    const byName = new Map();
    names.forEach((name, index) => {
      const key = String(name || '').toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push({ name, index });
    });
    const duplicateNames = [...byName.entries()].filter(([, list]) => list.length > 1).map(([name]) => name).filter(Boolean);
    return { names, byName, duplicateNames };
  }

  function resolveClipBinding(binding, lookup) {
    if (binding === null || binding === undefined || binding === '') return { ok: true, optional: true, value: binding };
    if (typeof binding !== 'string') return { ok: false, code: 'binding.clipNotString', reason: 'Clip binding must be a clip name or null.' };
    const raw = binding.trim();
    if (!raw) return { ok: true, optional: true, value: raw };
    const matches = lookup.byName.get(raw.toLowerCase()) || [];
    if (matches.length === 1) return { ok: true, record: matches[0], value: raw };
    if (matches.length > 1) return { ok: false, code: 'binding.clipNameAmbiguous', reason: `Clip name '${raw}' is duplicated. Rename clips or use unique aliases before VAW export.` };
    return { ok: false, code: 'binding.clipNotFound', reason: `Clip '${raw}' does not exist in the loaded glTF.` };
  }

  function collectForbiddenGameplayFields(value, path = '$', results = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectForbiddenGameplayFields(item, `${path}[${index}]`, results));
      return results;
    }
    if (!isPlainObject(value)) return results;
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.replace(/[^a-z0-9]/ig, '').toLowerCase();
      if (FORBIDDEN_GAMEPLAY_FIELDS.has(normalized)) results.push(`${path}.${key}`);
      collectForbiddenGameplayFields(child, `${path}.${key}`, results);
    }
    return results;
  }

  function validateModel(model, diagnostics, assetPath, modelRecord = null, manifestBasePath = '') {
    if (!isPlainObject(model)) {
      diagnostics.push(diagnostic('error', 'asset.modelMissing', `${assetPath}.model must be an object.`));
      return;
    }
    if (!isSafeRelativePath(model.path)) diagnostics.push(diagnostic('error', 'asset.modelPathInvalid', `${assetPath}.model.path must be a safe relative path inside the pack root.`));
    if (modelRecord && model.path) {
      const loadedPath = normalizePackPath(modelRecord.normalizedPath);
      const manifestPath = normalizePackPath(model.path);
      const allowedLoadedPaths = new Set([manifestPath]);
      if (manifestBasePath) allowedLoadedPaths.add(joinPackPath(manifestBasePath, manifestPath));
      if (!allowedLoadedPaths.has(loadedPath)) {
        diagnostics.push(diagnostic('error', 'asset.modelPathMismatch', `${assetPath}.model.path '${model.path}' does not point at the loaded model '${modelRecord.normalizedPath}'. Expected '${manifestPath}' inside pack${manifestBasePath ? ` or '${joinPackPath(manifestBasePath, manifestPath)}' in the loaded folder` : ''}.`));
      }
    }
    if (typeof model.unitMeters !== 'number' || model.unitMeters <= 0) diagnostics.push(diagnostic('error', 'asset.unitMetersInvalid', `${assetPath}.model.unitMeters must be a positive number.`));
    if (!ALLOWED_AXES.has(model.forwardAxis)) diagnostics.push(diagnostic('error', 'asset.forwardAxisInvalid', `${assetPath}.model.forwardAxis must be one of ${[...ALLOWED_AXES].join(', ')}.`));
    if (!ALLOWED_AXES.has(model.upAxis)) diagnostics.push(diagnostic('error', 'asset.upAxisInvalid', `${assetPath}.model.upAxis must be one of ${[...ALLOWED_AXES].join(', ')}.`));
    if (model.forwardAxis && model.upAxis && model.forwardAxis.replace(/[+-]/, '') === model.upAxis.replace(/[+-]/, '')) diagnostics.push(diagnostic('error', 'asset.axesCollinear', `${assetPath}.model.forwardAxis and upAxis cannot share the same axis.`));
    validateModelTransform(model.transform, diagnostics, `${assetPath}.model.transform`);
  }

  function validateVector3Object(value, diagnostics, path) {
    if (!isPlainObject(value)) {
      diagnostics.push(diagnostic('error', 'asset.transformVectorInvalid', `${path} must be an object with finite x, y, z numbers.`));
      return;
    }
    for (const axis of ['x', 'y', 'z']) {
      if (!Number.isFinite(Number(value[axis]))) diagnostics.push(diagnostic('error', 'asset.transformVectorInvalid', `${path}.${axis} must be a finite number.`));
    }
  }

  function validateModelTransform(transform, diagnostics, path) {
    if (transform === undefined) return;
    if (!isPlainObject(transform)) {
      diagnostics.push(diagnostic('error', 'asset.transformInvalid', `${path} must be an object when present.`));
      return;
    }
    if (transform.position !== undefined) validateVector3Object(transform.position, diagnostics, `${path}.position`);
    if (transform.rotationDegrees !== undefined) validateVector3Object(transform.rotationDegrees, diagnostics, `${path}.rotationDegrees`);
    if (transform.scale !== undefined) validateVector3Object(transform.scale, diagnostics, `${path}.scale`);
  }

  function validateMaterialPolicy(policy, diagnostics, assetPath) {
    if (policy === undefined) {
      diagnostics.push(diagnostic('error', 'asset.materialPolicyMissing', `${assetPath}.materialPolicy is required and must be an object.`));
      return;
    }
    if (!isPlainObject(policy)) {
      diagnostics.push(diagnostic('error', 'asset.materialPolicyInvalid', `${assetPath}.materialPolicy must be an object.`));
      return;
    }
    if (policy.pixelated !== undefined && typeof policy.pixelated !== 'boolean') diagnostics.push(diagnostic('error', 'asset.pixelatedInvalid', `${assetPath}.materialPolicy.pixelated must be boolean when present.`));
    if (policy.alpha !== undefined && !ALLOWED_ALPHA_POLICIES.has(policy.alpha)) diagnostics.push(diagnostic('error', 'asset.alphaPolicyInvalid', `${assetPath}.materialPolicy.alpha has unsupported value '${policy.alpha}'.`));
    if (policy.doubleSided !== undefined && !ALLOWED_DOUBLE_SIDED_POLICIES.has(policy.doubleSided)) diagnostics.push(diagnostic('error', 'asset.doubleSidedPolicyInvalid', `${assetPath}.materialPolicy.doubleSided has unsupported value '${policy.doubleSided}'.`));
    if (policy.materialOverrides !== undefined) {
      if (!Array.isArray(policy.materialOverrides)) {
        diagnostics.push(diagnostic('error', 'asset.materialOverridesInvalid', `${assetPath}.materialPolicy.materialOverrides must be an array when present.`));
      } else {
        policy.materialOverrides.forEach((item, index) => {
          const overridePath = `${assetPath}.materialPolicy.materialOverrides[${index}]`;
          if (!isPlainObject(item)) {
            diagnostics.push(diagnostic('error', 'asset.materialOverrideInvalid', `${overridePath} must be an object.`));
            return;
          }
          const name = String(item.materialName || item.name || '').trim();
          if (!name) diagnostics.push(diagnostic('error', 'asset.materialOverrideNameMissing', `${overridePath}.materialName must name a glTF material.`));
          if (item.alpha !== undefined && !ALLOWED_ALPHA_POLICIES.has(item.alpha)) diagnostics.push(diagnostic('error', 'asset.materialOverrideAlphaInvalid', `${overridePath}.alpha has unsupported value '${item.alpha}'.`));
          if (item.doubleSided !== undefined && !ALLOWED_DOUBLE_SIDED_POLICIES.has(item.doubleSided)) diagnostics.push(diagnostic('error', 'asset.materialOverrideDoubleSidedInvalid', `${overridePath}.doubleSided has unsupported value '${item.doubleSided}'.`));
        });
      }
    }
  }

  function validateVectorThrusterRig(profile, diagnostics, assetPath, blockTypes, nodes) {
    const rigPath = `${assetPath}.bindings.rig.vectorThruster`;
    if (!isPlainObject(profile)) {
      diagnostics.push(diagnostic('error', 'binding.rigProfileInvalid', `${rigPath} must be an object.`));
      return;
    }
    if (!blockTypes.includes('VectorThruster')) {
      diagnostics.push(diagnostic('warning', 'binding.rigProfileBlockTypeMismatch', `${rigPath} is renderer-only and should only be declared on VectorThruster assets.`));
    }
    if (!Array.isArray(profile.channels) || profile.channels.length === 0) {
      diagnostics.push(diagnostic('error', 'binding.rigChannelsMissing', `${rigPath}.channels must list at least one renderer channel.`));
      return;
    }
    profile.channels.forEach((channel, index) => {
      const channelPath = `${rigPath}.channels[${index}]`;
      if (!isPlainObject(channel)) {
        diagnostics.push(diagnostic('error', 'binding.rigChannelInvalid', `${channelPath} must be an object.`));
        return;
      }
      if (!ALLOWED_RIG_INPUTS.has(channel.input)) diagnostics.push(diagnostic('error', 'binding.rigInputInvalid', `${channelPath}.input must be one of ${[...ALLOWED_RIG_INPUTS].join(', ')}.`));
      if (!ALLOWED_NODE_ALIASES.has(channel.node)) {
        diagnostics.push(diagnostic('error', 'binding.rigNodeInvalid', `${channelPath}.node must reference a bindings.nodes alias.`));
      } else if (!nodes?.[channel.node]) {
        diagnostics.push(diagnostic('error', 'binding.rigNodeBindingMissing', `${channelPath}.node references '${channel.node}', but bindings.nodes.${channel.node} is empty.`));
      }
      if (!ALLOWED_RIG_AXES.has(channel.axis)) diagnostics.push(diagnostic('error', 'binding.rigAxisInvalid', `${channelPath}.axis must be one of ${[...ALLOWED_RIG_AXES].join(', ')}.`));
      if (channel.direction !== undefined && channel.direction !== 1 && channel.direction !== -1) diagnostics.push(diagnostic('error', 'binding.rigDirectionInvalid', `${channelPath}.direction must be 1 or -1.`));
    });
  }

  function validateRigBindings(rig, diagnostics, assetPath, blockTypes, nodes) {
    if (rig === undefined) return;
    if (!isPlainObject(rig)) {
      diagnostics.push(diagnostic('error', 'binding.rigInvalid', `${assetPath}.bindings.rig must be an object when present.`));
      return;
    }
    for (const [key, value] of Object.entries(rig)) {
      if (!ALLOWED_RIG_PROFILES.has(key)) {
        diagnostics.push(diagnostic('error', 'binding.unknownRigProfile', `${assetPath}.bindings.rig.${key} is not a V1 renderer rig profile.`));
        continue;
      }
      if (key === 'vectorThruster') validateVectorThrusterRig(value, diagnostics, assetPath, blockTypes, nodes);
    }
  }

  function validateAsset(asset, index, context) {
    const diagnostics = [];
    const assetPath = `assets[${index}]`;
    if (!isPlainObject(asset)) {
      diagnostics.push(diagnostic('error', 'asset.notObject', `${assetPath} must be an object.`));
      return diagnostics;
    }
    if (!asset.assetId || typeof asset.assetId !== 'string') diagnostics.push(diagnostic('error', 'asset.assetIdMissing', `${assetPath}.assetId is required.`));
    else if (!isStableId(asset.assetId)) diagnostics.push(diagnostic('error', 'asset.assetIdInvalid', `${assetPath}.assetId must be a stable lower-case id using letters, numbers, '_' or '-'.`));
    if (!ALLOWED_ASSET_KINDS.has(asset.kind)) diagnostics.push(diagnostic('error', 'asset.kindInvalid', `${assetPath}.kind must be 'blockVisual' for V1.`));
    validateModel(asset.model, diagnostics, assetPath, context.modelRecord, context.manifestBasePath || '');

    const bindings = asset.bindings;
    if (!isPlainObject(bindings)) {
      diagnostics.push(diagnostic('error', 'asset.bindingsMissing', `${assetPath}.bindings is required.`));
    } else {
      const blockTypes = bindings.blockTypes;
      const normalizedBlockTypes = Array.isArray(blockTypes) ? blockTypes.filter(blockType => ALLOWED_BLOCK_TYPES.has(blockType)) : [];
      if (!Array.isArray(blockTypes) || blockTypes.length === 0) diagnostics.push(diagnostic('error', 'binding.blockTypesMissing', `${assetPath}.bindings.blockTypes must list at least one VAW block type.`));
      else {
        for (const blockType of blockTypes) {
          if (!ALLOWED_BLOCK_TYPES.has(blockType)) diagnostics.push(diagnostic('error', 'binding.unknownBlockType', `Unknown blockType '${blockType}' in ${assetPath}.bindings.blockTypes. Contract draft must be updated before export.`));
        }
      }

      const nodes = isPlainObject(bindings.nodes) ? bindings.nodes : null;
      if (!nodes) diagnostics.push(diagnostic('error', 'binding.nodesMissing', `${assetPath}.bindings.nodes is required.`));
      else {
        if (!nodes.visualRoot) diagnostics.push(diagnostic('error', 'binding.visualRootMissing', `${assetPath}.bindings.nodes.visualRoot is required and blocks VAW export.`));
        for (const [key, value] of Object.entries(nodes)) {
          if (!ALLOWED_NODE_ALIASES.has(key)) {
            diagnostics.push(diagnostic('error', 'binding.unknownNodeAlias', `${assetPath}.bindings.nodes.${key} is not a V1 node alias.`));
            continue;
          }
          const resolved = resolveNodeBinding(value, context.nodeLookup);
          if (!resolved.ok) diagnostics.push(diagnostic('error', resolved.code, `${assetPath}.bindings.nodes.${key}: ${resolved.reason}`));
        }
      }
      validateRigBindings(bindings.rig, diagnostics, assetPath, normalizedBlockTypes, nodes || {});

      const clips = isPlainObject(bindings.clips) ? bindings.clips : null;
      if (!clips) diagnostics.push(diagnostic('error', 'binding.clipsMissing', `${assetPath}.bindings.clips is required and must be an object.`));
      else {
        for (const [key, value] of Object.entries(clips)) {
          if (!ALLOWED_CLIP_ALIASES.has(key)) {
            diagnostics.push(diagnostic('error', 'binding.unknownClipAlias', `${assetPath}.bindings.clips.${key} is not a V1 clip alias.`));
            continue;
          }
          const resolved = resolveClipBinding(value, context.animationLookup);
          if (!resolved.ok) diagnostics.push(diagnostic('error', resolved.code, `${assetPath}.bindings.clips.${key}: ${resolved.reason}`));
        }
      }
    }
    validateMaterialPolicy(asset.materialPolicy, diagnostics, assetPath);
    return diagnostics;
  }

  function validateManifest({ manifest = null, gltfJson = {}, dependencies = [], modelRecord = null, manifestBasePath = '' } = {}) {
    const diagnostics = [];
    const nodeLookup = buildNodeLookup(gltfJson);
    const animationLookup = buildAnimationLookup(gltfJson);
    const duplicateSeverity = manifest ? 'warning' : 'info';
    if (nodeLookup.duplicateNames.length) diagnostics.push(diagnostic(duplicateSeverity, 'gltf.duplicateNodeNames', `Duplicate node names detected: ${nodeLookup.duplicateNames.join(', ')}. This is common in Blockbench. Preview is allowed; VAW export only blocks if a binding uses an ambiguous name/path.`));
    if (nodeLookup.duplicatePaths.length) diagnostics.push(diagnostic(duplicateSeverity, 'gltf.duplicateNodePaths', `Duplicate node paths detected: ${nodeLookup.duplicatePaths.join(', ')}. Preview is allowed; export blocks only ambiguous bindings.`));
    if (animationLookup.duplicateNames.length) diagnostics.push(diagnostic('warning', 'gltf.duplicateClipNames', `Duplicate clip names detected: ${animationLookup.duplicateNames.join(', ')}. Rename clips before binding them for export.`));
    const missingDeps = (dependencies || []).filter(dep => dep.status === 'missing' || dep.status === 'ambiguous' || dep.status === 'external');
    for (const dep of missingDeps) diagnostics.push(diagnostic(dep.status === 'missing' ? 'error' : 'warning', `dependency.${dep.status}`, `${dep.kind || 'dependency'} '${dep.displayUri || dep.uri || '(empty)'}' is ${dep.status}.`));

    if (!manifest) {
      diagnostics.push(diagnostic('info', 'pack.noManifest', 'No VAW_VISUAL_ASSET_PACK_V1 manifest loaded. This is normal after a plain Blockbench import: preview/debug export are allowed, but VAW pack export waits for a loaded or inferred manifest.'));
      return { viewerOk: true, packReady: false, vawReady: false, diagnostics, facts: { format: null, packId: null, assetCount: 0, nodePathCount: nodeLookup.records.length, clipCount: animationLookup.names.length } };
    }
    if (!isPlainObject(manifest)) {
      diagnostics.push(diagnostic('error', 'pack.notObject', 'Visual asset manifest must be a JSON object.'));
      return { viewerOk: true, packReady: false, vawReady: false, diagnostics, facts: { format: null, packId: null, assetCount: 0 } };
    }

    const forbidden = collectForbiddenGameplayFields(manifest);
    for (const path of forbidden) diagnostics.push(diagnostic('error', 'pack.forbiddenGameplayField', `Forbidden gameplay-authority field in visual asset pack: ${path}.`));

    if (manifest.format !== FORMAT) diagnostics.push(diagnostic('error', 'pack.formatInvalid', `manifest.format must be '${FORMAT}'.`));
    if (!manifest.packId || typeof manifest.packId !== 'string') diagnostics.push(diagnostic('error', 'pack.packIdMissing', 'manifest.packId is required.'));
    else if (!isStableId(manifest.packId)) diagnostics.push(diagnostic('error', 'pack.packIdInvalid', "manifest.packId must be a stable lower-case id using letters, numbers, '_' or '-'."));
    if (!manifest.version || typeof manifest.version !== 'string') diagnostics.push(diagnostic('error', 'pack.versionMissing', 'manifest.version is required.'));
    if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) diagnostics.push(diagnostic('error', 'pack.assetsMissing', 'manifest.assets must contain at least one visual asset.'));
    else {
      const seenAssetIds = new Set();
      manifest.assets.forEach((asset, index) => {
        if (asset && typeof asset.assetId === 'string') {
          if (seenAssetIds.has(asset.assetId)) diagnostics.push(diagnostic('error', 'asset.assetIdDuplicate', `Duplicate assetId '${asset.assetId}' in assets[${index}].`));
          seenAssetIds.add(asset.assetId);
        }
        diagnostics.push(...validateAsset(asset, index, { nodeLookup, animationLookup, modelRecord, manifestBasePath }));
      });
    }

    const errors = diagnostics.filter(item => item.severity === 'error');
    return {
      viewerOk: true,
      packReady: errors.length === 0,
      vawReady: errors.length === 0,
      diagnostics,
      facts: {
        format: manifest.format || null,
        packId: manifest.packId || null,
        version: manifest.version || null,
        assetCount: Array.isArray(manifest.assets) ? manifest.assets.length : 0,
        nodePathCount: nodeLookup.records.length,
        clipCount: animationLookup.names.length,
        visualRoot: manifest.assets?.[0]?.bindings?.nodes?.visualRoot || null,
        blockTypes: manifest.assets?.flatMap(asset => asset?.bindings?.blockTypes || []) || [],
      },
    };
  }

  function inferManifest(gltfJson = {}, modelRecord = null, options = {}) {
    const nodeLookup = buildNodeLookup(gltfJson);
    const animationNames = collectAnimationNames(gltfJson);
    const baseName = modelRecord && modelRecord.basename ? modelRecord.basename.replace(/\.[^.]+$/, '') : 'imported_asset';
    const assetId = (options.assetId || baseName).replace(/[^a-z0-9_\-]+/ig, '_').toLowerCase() || 'imported_asset';
    const rootCandidates = nodeLookup.records.filter(record => record.isTopologicalRoot);
    const rootsFirst = rootCandidates.length ? rootCandidates : nodeLookup.records;
    const rootRecord = rootsFirst.find(record => /root|body|mesh|cube|model/i.test(record.name)) || rootsFirst[0] || null;
    const blockTypes = Array.isArray(options.blockTypes) ? options.blockTypes.filter(Boolean) : [];
    const chooseClip = patterns => animationNames.find(name => patterns.some(pattern => pattern.test(name))) || null;
    return {
      format: FORMAT,
      packId: options.packId || `${assetId}_preview_pack`,
      version: options.version || '0.1.0-preview',
      metadata: {
        status: 'preview-test-asset',
        generatedBy: 'VAW Blockbench Import Studio',
        authority: 'visual-only',
        note: 'Generated as a visual asset pack draft. It is not final gameplay data.',
        inference: {
          visualRootStrategy: 'topological-root-first',
          blockTypesExplicit: blockTypes.length > 0,
        },
      },
      assets: [{
        assetId,
        kind: 'blockVisual',
        model: {
          path: modelRecord ? modelRecord.normalizedPath : '',
          unitMeters: 1,
          forwardAxis: '+X',
          upAxis: '+Y',
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotationDegrees: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
        },
        bindings: {
          blockTypes,
          nodes: {
            visualRoot: rootRecord ? rootRecord.path : null,
            flame: findNodeBinding(nodeLookup, /^flame$/i) || findNodeBinding(nodeLookup, /flame/i),
            flameGlow: findNodeBinding(nodeLookup, /^flameglow$/i) || findNodeBinding(nodeLookup, /glow/i),
            gimbalAssembly: findNodeBinding(nodeLookup, /gimbal/i),
            controlFlapPivot: findNodeBinding(nodeLookup, /flap|control/i),
          },
          clips: {
            idle: chooseClip([/idle/i]),
            thrust: chooseClip([/thrust/i, /loop/i, /anim/i]) || animationNames[0] || null,
            damage: chooseClip([/damage/i]),
          },
          ...(blockTypes.includes('VectorThruster') && findNodeBinding(nodeLookup, /gimbal/i) ? {
            rig: {
              vectorThruster: defaultVectorThrusterRig(),
            },
          } : {}),
        },
        materialPolicy: {
          pixelated: true,
          alpha: 'auto',
          doubleSided: 'from-gltf',
        },
      }],
    };
  }

  function findNodeBinding(nodeLookup, pattern) {
    const record = nodeLookup.records.find(item => pattern.test(item.name));
    return record ? record.path : null;
  }

  function defaultVectorThrusterRig() {
    return {
      channels: [
        { input: 'gimbalA', node: 'gimbalAssembly', axis: 'z', direction: 1 },
        { input: 'gimbalB', node: 'gimbalAssembly', axis: 'y', direction: -1 },
        { input: 'roll', node: 'gimbalAssembly', axis: 'x', direction: 1 },
      ],
    };
  }

  function isManifestFilename(name = '') {
    return /(^|\/)(VAW_VISUAL_ASSET_PACK_V1|visual_asset_pack_v1|visual_asset_manifest)(\.manifest)?\.json$/i.test(String(name)) || /\.visual\.vaw\.json$/i.test(String(name));
  }

  return Object.freeze({
    FORMAT,
    ALLOWED_BLOCK_TYPES: Object.freeze([...ALLOWED_BLOCK_TYPES]),
    ALLOWED_NODE_ALIASES: Object.freeze([...ALLOWED_NODE_ALIASES]),
    ALLOWED_CLIP_ALIASES: Object.freeze([...ALLOWED_CLIP_ALIASES]),
    ALLOWED_RIG_PROFILES: Object.freeze([...ALLOWED_RIG_PROFILES]),
    ALLOWED_RIG_INPUTS: Object.freeze([...ALLOWED_RIG_INPUTS]),
    ALLOWED_RIG_AXES: Object.freeze([...ALLOWED_RIG_AXES]),
    FORBIDDEN_GAMEPLAY_FIELDS: Object.freeze([...FORBIDDEN_GAMEPLAY_FIELDS]),
    validateManifest,
    inferManifest,
    defaultVectorThrusterRig,
    collectNodeNames,
    collectAnimationNames,
    collectNodePathRecords,
    resolveNodeBinding,
    resolveClipBinding,
    isManifestFilename,
  });
});
