(() => {
  'use strict';

  window.VAW.define('foundation.visual-asset-manifest', ['foundation.config', 'foundation.catalog'], (Config, Catalog) => {
    const FORMAT = 'VAW_VISUAL_ASSET_PACK_V1';
    const NODE_ALIASES = Object.freeze(['visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot']);
    const CLIP_ALIASES = Object.freeze(['idle', 'thrust', 'damage']);
    const FORBIDDEN_GAMEPLAY_FIELDS = Object.freeze([
      'mass', 'force', 'fuelRate', 'durability', 'dragArea', 'wingArea',
      'collider', 'collision', 'controlAxis', 'blueprint', 'craftModel'
    ]);
    const AXIS_LABELS = Object.freeze(['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
    const RIG_PROFILE_NAMES = Object.freeze(['vectorThruster']);
    const RIG_CHANNEL_INPUTS = Object.freeze(['gimbalA', 'gimbalB', 'roll']);
    const RIG_ROTATION_AXES = Object.freeze(['x', 'y', 'z']);
    const ALPHA_POLICIES = Object.freeze(['auto', 'opaque', 'mask', 'blend', 'mask-or-blend', 'from-gltf']);
    const DOUBLE_SIDED_POLICIES = Object.freeze(['from-gltf', 'force', 'never', true, false]);

    function diagnostic(severity, code, path, message) {
      return Object.freeze({ severity, code, path, message });
    }

    function isPlainObject(value) {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isNonEmptyString(value) {
      return typeof value === 'string' && value.trim().length > 0;
    }

    function axisFamily(axis) {
      return isNonEmptyString(axis) ? axis.slice(1) : '';
    }

    function isPackRelativePath(value) {
      if (!isNonEmptyString(value)) return false;
      const text = value.trim();
      if (text.includes('\\')) return false;
      if (text.includes('?') || text.includes('#')) return false;
      if (text.startsWith('/') || text.startsWith('./')) return false;
      if (/^[A-Za-z]:/.test(text) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(text)) return false;
      return text.split('/').every(segment => segment && segment !== '.' && segment !== '..');
    }

    function walkForbiddenFields(value, path, errors) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => walkForbiddenFields(item, `${path}[${index}]`, errors));
        return;
      }
      for (const [key, nested] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key;
        if (FORBIDDEN_GAMEPLAY_FIELDS.includes(key)) {
          errors.push(diagnostic('error', 'visualAsset.gameplayFieldForbidden', childPath, `Visual asset manifests must not define gameplay field "${key}".`));
        }
        walkForbiddenFields(nested, childPath, errors);
      }
    }

    function validateNodeBindings(nodes, path, errors) {
      if (!isPlainObject(nodes)) {
        errors.push(diagnostic('error', 'visualAsset.nodesMissing', path, 'bindings.nodes must be an object.'));
        return Object.freeze({});
      }
      const normalized = {};
      for (const key of Object.keys(nodes)) {
        if (!NODE_ALIASES.includes(key)) {
          errors.push(diagnostic('error', 'visualAsset.unknownNodeAlias', `${path}.${key}`, `Unknown node alias "${key}".`));
          continue;
        }
        const value = nodes[key];
        if (value !== null && !isNonEmptyString(value)) {
          errors.push(diagnostic('error', 'visualAsset.invalidNodeBinding', `${path}.${key}`, `Node alias "${key}" must be a non-empty string or null.`));
          continue;
        }
        normalized[key] = value;
      }
      if (!isNonEmptyString(nodes.visualRoot)) {
        errors.push(diagnostic('error', 'visualAsset.visualRootMissing', `${path}.visualRoot`, 'bindings.nodes.visualRoot is required for VAW export.'));
      }
      return Config.deepFreeze(normalized);
    }

    function validateClipBindings(clips, path, errors) {
      if (!isPlainObject(clips)) {
        errors.push(diagnostic('error', 'visualAsset.clipsMissing', path, 'bindings.clips must be an object.'));
        return Object.freeze({});
      }
      const normalized = {};
      for (const key of Object.keys(clips)) {
        if (!CLIP_ALIASES.includes(key)) {
          errors.push(diagnostic('error', 'visualAsset.unknownClipAlias', `${path}.${key}`, `Unknown clip alias "${key}".`));
          continue;
        }
        const value = clips[key];
        if (value !== null && !isNonEmptyString(value)) {
          errors.push(diagnostic('error', 'visualAsset.invalidClipBinding', `${path}.${key}`, `Clip alias "${key}" must be a non-empty string or null.`));
          continue;
        }
        normalized[key] = value;
      }
      return Config.deepFreeze(normalized);
    }

    function validateVectorThrusterRig(profile, path, blockTypes, nodes, errors, warnings) {
      if (!isPlainObject(profile)) {
        errors.push(diagnostic('error', 'visualAsset.rigProfileInvalid', path, 'bindings.rig.vectorThruster must be an object.'));
        return Config.deepFreeze({ channels: Object.freeze([]) });
      }
      if (!blockTypes.includes('VectorThruster')) {
        warnings.push(diagnostic('warning', 'visualAsset.rigProfileBlockTypeMismatch', path, 'VectorThruster rig profile is renderer-only and should only be declared on VectorThruster assets.'));
      }
      if (!Array.isArray(profile.channels) || !profile.channels.length) {
        errors.push(diagnostic('error', 'visualAsset.rigChannelsMissing', `${path}.channels`, 'bindings.rig.vectorThruster.channels must list at least one renderer channel.'));
        return Config.deepFreeze({ channels: Object.freeze([]) });
      }
      const channels = [];
      profile.channels.forEach((channel, index) => {
        const channelPath = `${path}.channels[${index}]`;
        if (!isPlainObject(channel)) {
          errors.push(diagnostic('error', 'visualAsset.rigChannelInvalid', channelPath, 'Rig channel entries must be objects.'));
          return;
        }
        const input = String(channel.input || '').trim();
        const node = String(channel.node || '').trim();
        const axis = String(channel.axis || '').trim().toLowerCase();
        const direction = channel.direction === undefined ? 1 : Number(channel.direction);
        if (!RIG_CHANNEL_INPUTS.includes(input)) {
          errors.push(diagnostic('error', 'visualAsset.rigInputInvalid', `${channelPath}.input`, `Rig input must be one of ${RIG_CHANNEL_INPUTS.join(', ')}.`));
        }
        if (!NODE_ALIASES.includes(node)) {
          errors.push(diagnostic('error', 'visualAsset.rigNodeInvalid', `${channelPath}.node`, `Rig node must reference one of the bindings.nodes aliases: ${NODE_ALIASES.join(', ')}.`));
        } else if (!isNonEmptyString(nodes?.[node])) {
          errors.push(diagnostic('error', 'visualAsset.rigNodeBindingMissing', `${channelPath}.node`, `Rig channel references "${node}", but bindings.nodes.${node} is empty.`));
        }
        if (!RIG_ROTATION_AXES.includes(axis)) {
          errors.push(diagnostic('error', 'visualAsset.rigAxisInvalid', `${channelPath}.axis`, `Rig axis must be one of ${RIG_ROTATION_AXES.join(', ')}.`));
        }
        if (direction !== 1 && direction !== -1) {
          errors.push(diagnostic('error', 'visualAsset.rigDirectionInvalid', `${channelPath}.direction`, 'Rig direction must be 1 or -1.'));
        }
        channels.push(Object.freeze({
          input,
          node,
          axis,
          direction: direction === -1 ? -1 : 1
        }));
      });
      return Config.deepFreeze({ channels: Object.freeze(channels) });
    }

    function validateRigBindings(rig, path, blockTypes, nodes, errors, warnings) {
      if (rig === undefined) return undefined;
      if (!isPlainObject(rig)) {
        errors.push(diagnostic('error', 'visualAsset.rigInvalid', path, 'bindings.rig must be an object when present.'));
        return Config.deepFreeze({});
      }
      const normalized = {};
      for (const key of Object.keys(rig)) {
        if (!RIG_PROFILE_NAMES.includes(key)) {
          errors.push(diagnostic('error', 'visualAsset.unknownRigProfile', `${path}.${key}`, `Unknown renderer rig profile "${key}".`));
          continue;
        }
        if (key === 'vectorThruster') normalized.vectorThruster = validateVectorThrusterRig(rig[key], `${path}.vectorThruster`, blockTypes, nodes, errors, warnings);
      }
      return Config.deepFreeze(normalized);
    }

    function validateVector3Object(value, path, errors, fallback) {
      if (value === undefined) return Object.freeze({ ...fallback });
      if (!isPlainObject(value)) {
        errors.push(diagnostic('error', 'visualAsset.transformVectorInvalid', path, `${path} must be an object with finite x, y, z numbers.`));
        return Object.freeze({ ...fallback });
      }
      const normalized = {};
      for (const axis of ['x', 'y', 'z']) {
        const number = Number(value[axis]);
        if (!Number.isFinite(number)) {
          errors.push(diagnostic('error', 'visualAsset.transformVectorInvalid', `${path}.${axis}`, `${path}.${axis} must be a finite number.`));
          normalized[axis] = fallback[axis];
        } else {
          normalized[axis] = number;
        }
      }
      return Object.freeze(normalized);
    }

    function validateModelTransform(transform, path, errors) {
      if (transform === undefined) return undefined;
      if (!isPlainObject(transform)) {
        errors.push(diagnostic('error', 'visualAsset.transformInvalid', path, 'model.transform must be an object when present.'));
        return undefined;
      }
      return Config.deepFreeze({
        position: validateVector3Object(transform.position, `${path}.position`, errors, { x: 0, y: 0, z: 0 }),
        rotationDegrees: validateVector3Object(transform.rotationDegrees, `${path}.rotationDegrees`, errors, { x: 0, y: 0, z: 0 }),
        scale: validateVector3Object(transform.scale, `${path}.scale`, errors, { x: 1, y: 1, z: 1 })
      });
    }

    function validateMaterialOverride(value, path, errors) {
      if (!isPlainObject(value)) {
        errors.push(diagnostic('error', 'visualAsset.materialOverrideInvalid', path, 'materialPolicy.materialOverrides entries must be objects.'));
        return null;
      }
      const materialName = String(value.materialName || value.name || '').trim();
      if (!materialName) {
        errors.push(diagnostic('error', 'visualAsset.materialOverrideNameMissing', `${path}.materialName`, 'material override must name a glTF material.'));
      }
      if (value.alpha !== undefined && !ALPHA_POLICIES.includes(value.alpha)) {
        errors.push(diagnostic('error', 'visualAsset.alphaPolicyInvalid', `${path}.alpha`, `material override alpha must be one of ${ALPHA_POLICIES.join(', ')}.`));
      }
      if (value.doubleSided !== undefined && !DOUBLE_SIDED_POLICIES.includes(value.doubleSided)) {
        errors.push(diagnostic('error', 'visualAsset.doubleSidedPolicyInvalid', `${path}.doubleSided`, 'material override doubleSided must be from-gltf, force, never, true or false.'));
      }
      return Config.deepFreeze({
        materialName,
        ...(value.alpha !== undefined ? { alpha: value.alpha } : {}),
        ...(value.doubleSided !== undefined ? { doubleSided: value.doubleSided } : {})
      });
    }

    function validateMaterialPolicy(policy, path, errors) {
      if (!isPlainObject(policy)) {
        errors.push(diagnostic('error', 'visualAsset.materialPolicyMissing', path, 'materialPolicy must be an object.'));
        return Object.freeze({});
      }
      if (policy.pixelated !== undefined && typeof policy.pixelated !== 'boolean') {
        errors.push(diagnostic('error', 'visualAsset.pixelatedPolicyInvalid', `${path}.pixelated`, 'materialPolicy.pixelated must be boolean when present.'));
      }
      if (policy.alpha !== undefined && !ALPHA_POLICIES.includes(policy.alpha)) {
        errors.push(diagnostic('error', 'visualAsset.alphaPolicyInvalid', `${path}.alpha`, `materialPolicy.alpha must be one of ${ALPHA_POLICIES.join(', ')}.`));
      }
      if (policy.doubleSided !== undefined && !DOUBLE_SIDED_POLICIES.includes(policy.doubleSided)) {
        errors.push(diagnostic('error', 'visualAsset.doubleSidedPolicyInvalid', `${path}.doubleSided`, 'materialPolicy.doubleSided must be from-gltf, force, never, true or false.'));
      }
      let materialOverrides = undefined;
      if (policy.materialOverrides !== undefined) {
        if (!Array.isArray(policy.materialOverrides)) {
          errors.push(diagnostic('error', 'visualAsset.materialOverridesInvalid', `${path}.materialOverrides`, 'materialPolicy.materialOverrides must be an array when present.'));
        } else {
          materialOverrides = Object.freeze(policy.materialOverrides.map((item, index) => validateMaterialOverride(item, `${path}.materialOverrides[${index}]`, errors)).filter(Boolean));
        }
      }
      return Config.deepFreeze({
        ...policy,
        ...(materialOverrides !== undefined ? { materialOverrides } : {})
      });
    }

    function validateBlockTypes(blockTypes, path, errors, warnings) {
      if (!Array.isArray(blockTypes) || !blockTypes.length) {
        errors.push(diagnostic('error', 'visualAsset.blockTypesMissing', path, 'bindings.blockTypes must list at least one Catalog block type.'));
        return Object.freeze([]);
      }
      const knownTypes = new Set(Object.keys(Catalog.BLOCKS || {}));
      const seen = new Set();
      const normalized = [];
      for (const [index, value] of blockTypes.entries()) {
        const itemPath = `${path}[${index}]`;
        if (!isNonEmptyString(value)) {
          errors.push(diagnostic('error', 'visualAsset.invalidBlockType', itemPath, 'Block type must be a non-empty string.'));
          continue;
        }
        if (!knownTypes.has(value)) {
          errors.push(diagnostic('error', 'visualAsset.unknownBlockType', itemPath, `Unknown Catalog block type "${value}".`));
          continue;
        }
        if (seen.has(value)) {
          warnings.push(diagnostic('warning', 'visualAsset.duplicateBlockType', itemPath, `Duplicate block type "${value}" ignored.`));
          continue;
        }
        seen.add(value);
        normalized.push(value);
      }
      return Object.freeze(normalized);
    }

    function validateAsset(asset, index, errors, warnings) {
      const path = `assets[${index}]`;
      if (!isPlainObject(asset)) {
        errors.push(diagnostic('error', 'visualAsset.assetInvalid', path, 'Asset entry must be an object.'));
        return null;
      }
      if (!isNonEmptyString(asset.assetId)) errors.push(diagnostic('error', 'visualAsset.assetIdMissing', `${path}.assetId`, 'assetId is required.'));
      if (asset.kind !== 'blockVisual') errors.push(diagnostic('error', 'visualAsset.kindUnsupported', `${path}.kind`, 'Only kind "blockVisual" is supported in M4A.'));

      const model = asset.model;
      let modelTransform = undefined;
      if (!isPlainObject(model)) {
        errors.push(diagnostic('error', 'visualAsset.modelMissing', `${path}.model`, 'model must be an object.'));
      } else {
        if (!isNonEmptyString(model.path)) errors.push(diagnostic('error', 'visualAsset.modelPathMissing', `${path}.model.path`, 'model.path is required.'));
        else if (!isPackRelativePath(model.path)) errors.push(diagnostic('error', 'visualAsset.modelPathInvalid', `${path}.model.path`, 'model.path must be a forward-slash relative path inside the asset pack.'));
        if (!(Number.isFinite(Number(model.unitMeters)) && Number(model.unitMeters) > 0)) {
          errors.push(diagnostic('error', 'visualAsset.unitMetersInvalid', `${path}.model.unitMeters`, 'model.unitMeters must be a positive number.'));
        }
        if (!AXIS_LABELS.includes(model.forwardAxis)) errors.push(diagnostic('error', 'visualAsset.forwardAxisInvalid', `${path}.model.forwardAxis`, 'model.forwardAxis must be one of +X, -X, +Y, -Y, +Z, -Z.'));
        if (!AXIS_LABELS.includes(model.upAxis)) errors.push(diagnostic('error', 'visualAsset.upAxisInvalid', `${path}.model.upAxis`, 'model.upAxis must be one of +X, -X, +Y, -Y, +Z, -Z.'));
        if (AXIS_LABELS.includes(model.forwardAxis) && AXIS_LABELS.includes(model.upAxis) && axisFamily(model.forwardAxis) === axisFamily(model.upAxis)) {
          errors.push(diagnostic('error', 'visualAsset.axesNotOrthogonal', `${path}.model`, 'model.forwardAxis and model.upAxis must use different axes.'));
        }
        modelTransform = validateModelTransform(model.transform, `${path}.model.transform`, errors);
      }

      const bindings = asset.bindings;
      let blockTypes = Object.freeze([]);
      let nodes = Object.freeze({});
      let clips = Object.freeze({});
      let rig = undefined;
      if (!isPlainObject(bindings)) {
        errors.push(diagnostic('error', 'visualAsset.bindingsMissing', `${path}.bindings`, 'bindings must be an object.'));
      } else {
        blockTypes = validateBlockTypes(bindings.blockTypes, `${path}.bindings.blockTypes`, errors, warnings);
        nodes = validateNodeBindings(bindings.nodes, `${path}.bindings.nodes`, errors);
        clips = validateClipBindings(bindings.clips, `${path}.bindings.clips`, errors);
        rig = validateRigBindings(bindings.rig, `${path}.bindings.rig`, blockTypes, nodes, errors, warnings);
      }

      const materialPolicy = validateMaterialPolicy(asset.materialPolicy, `${path}.materialPolicy`, errors);

      return Config.deepFreeze({
        assetId: String(asset.assetId || ''),
        kind: asset.kind,
        model: {
          path: model?.path || '',
          unitMeters: Number(model?.unitMeters || 0),
          forwardAxis: model?.forwardAxis || '',
          upAxis: model?.upAxis || '',
          ...(modelTransform ? { transform: modelTransform } : {})
        },
        bindings: {
          blockTypes,
          nodes,
          clips,
          ...(rig !== undefined ? { rig } : {})
        },
        materialPolicy
      });
    }

    function validateManifest(manifest) {
      const errors = [];
      const warnings = [];
      if (!isPlainObject(manifest)) {
        return Config.deepFreeze({
          ok: false,
          errors: [diagnostic('error', 'visualAsset.manifestInvalid', '', 'Manifest must be an object.')],
          warnings,
          assets: []
        });
      }

      walkForbiddenFields(manifest, '', errors);
      if (manifest.format !== FORMAT) errors.push(diagnostic('error', 'visualAsset.formatInvalid', 'format', `format must be "${FORMAT}".`));
      if (!isNonEmptyString(manifest.packId)) errors.push(diagnostic('error', 'visualAsset.packIdMissing', 'packId', 'packId is required.'));
      if (!isNonEmptyString(manifest.version)) errors.push(diagnostic('error', 'visualAsset.versionMissing', 'version', 'version is required.'));
      if (!Array.isArray(manifest.assets)) {
        errors.push(diagnostic('error', 'visualAsset.assetsMissing', 'assets', 'assets must be an array.'));
      }

      const assetIds = new Set();
      const assets = Array.isArray(manifest.assets)
        ? manifest.assets.map((asset, index) => {
            const normalized = validateAsset(asset, index, errors, warnings);
            if (normalized?.assetId) {
              if (assetIds.has(normalized.assetId)) errors.push(diagnostic('error', 'visualAsset.duplicateAssetId', `assets[${index}].assetId`, `Duplicate assetId "${normalized.assetId}".`));
              assetIds.add(normalized.assetId);
            }
            return normalized;
          }).filter(Boolean)
        : [];

      return Config.deepFreeze({
        ok: errors.length === 0,
        errors,
        warnings,
        assets: errors.length === 0 ? assets : []
      });
    }

    return Config.deepFreeze({
      FORMAT,
      NODE_ALIASES,
      CLIP_ALIASES,
      FORBIDDEN_GAMEPLAY_FIELDS,
      AXIS_LABELS,
      RIG_PROFILE_NAMES,
      RIG_CHANNEL_INPUTS,
      RIG_ROTATION_AXES,
      ALPHA_POLICIES,
      validateManifest
    });
  });
})();
