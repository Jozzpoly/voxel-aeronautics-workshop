(() => {
  'use strict';

  window.VAW.define('game.visual-asset-loader', [], () => {
    const DEFAULT_PACK_INDEX_URL = 'assets/visual_packs/installed_visual_packs.json';
    const DEFAULT_DEV_PACKS = Object.freeze([
      Object.freeze({
        source: 'dev:test_anim_preview_visual_pack',
        manifestUrl: 'assets/visual_packs/test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json',
        packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/'
      })
    ]);

    function create({
      THREE = window.THREE,
      visualAssetRegistry,
      disposeObjectTree = () => {},
      logger = console
    } = {}) {
      if (!visualAssetRegistry?.registerManifest || !visualAssetRegistry?.assetForBlockType) {
        throw new TypeError('Visual asset loader requires a visual asset registry.');
      }

      const diagnostics = [];
      const trackedRoots = new Set();
      const loadPromisesByAssetId = new Map();
      const materialWarningKeys = new Set();
      let debugVisualsVisible = false;

      function record(item) {
        const entry = Object.freeze({
          severity: item.severity || 'warning',
          code: item.code || 'visualAssetLoader.diagnostic',
          message: item.message || '',
          source: item.source || 'visual-asset-loader',
          assetId: item.assetId || null,
          path: item.path || ''
        });
        diagnostics.push(entry);
        if (entry.severity === 'error') logger?.error?.(entry.message, entry);
        else if (entry.severity === 'warning') logger?.warn?.(entry.message, entry);
        return entry;
      }

      function documentBaseUrl() {
        return typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'http://127.0.0.1/';
      }

      function canFetchPackResources() {
        return typeof fetch === 'function' && typeof URL === 'function';
      }

      function resolveUrl(path, base = documentBaseUrl()) {
        try { return new URL(path, new URL(base, documentBaseUrl())).toString(); }
        catch (_) { return `${String(base || '').replace(/\/?$/, '/')}${String(path || '')}`; }
      }

      function packBaseFromManifestUrl(manifestUrl) {
        try { return new URL('.', resolveUrl(manifestUrl)).toString(); }
        catch (_) {
          const text = String(manifestUrl || '');
          const index = text.lastIndexOf('/');
          return index >= 0 ? text.slice(0, index + 1) : '';
        }
      }

      function indexBaseFromUrl(indexUrl) {
        try { return new URL('.', resolveUrl(indexUrl)).toString(); }
        catch (_) {
          const text = String(indexUrl || '');
          const index = text.lastIndexOf('/');
          return index >= 0 ? text.slice(0, index + 1) : '';
        }
      }

      function normalizePackEntry(entry, indexUrl, index) {
        const base = indexBaseFromUrl(indexUrl);
        if (typeof entry === 'string') {
          return Object.freeze({
            source: `index:${entry}`,
            manifestUrl: resolveUrl(entry, base)
          });
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          record({ severity: 'warning', code: 'visualAssetLoader.invalidPackIndexEntry', source: indexUrl, path: `packs[${index}]`, message: 'Visual pack index entries must be objects or manifest URL strings.' });
          return null;
        }
        const manifestUrl = String(entry.manifestUrl || '').trim();
        if (!manifestUrl) {
          record({ severity: 'warning', code: 'visualAssetLoader.indexManifestUrlMissing', source: indexUrl, path: `packs[${index}].manifestUrl`, message: 'Visual pack index entry has no manifestUrl.' });
          return null;
        }
        const normalized = {
          source: String(entry.source || `index:${manifestUrl}`),
          manifestUrl: resolveUrl(manifestUrl, base)
        };
        if (entry.revision != null) normalized.revision = String(entry.revision);
        if (entry.version != null) normalized.version = String(entry.version);
        if (entry.packBaseUrl != null && String(entry.packBaseUrl).trim()) {
          normalized.packBaseUrl = resolveUrl(String(entry.packBaseUrl).trim(), base);
        }
        return Object.freeze(normalized);
      }

      function normalizePackIndex(index, indexUrl) {
        if (!index || typeof index !== 'object' || Array.isArray(index)) {
          record({ severity: 'warning', code: 'visualAssetLoader.invalidPackIndex', source: indexUrl, message: 'Visual pack index must be an object.' });
          return Object.freeze([]);
        }
        if (index.format !== 'VAW_VISUAL_PACK_INDEX_V1') {
          record({ severity: 'warning', code: 'visualAssetLoader.packIndexFormatInvalid', source: indexUrl, path: 'format', message: 'Visual pack index format must be VAW_VISUAL_PACK_INDEX_V1.' });
          return Object.freeze([]);
        }
        if (!Array.isArray(index.packs)) {
          record({ severity: 'warning', code: 'visualAssetLoader.packIndexPacksInvalid', source: indexUrl, path: 'packs', message: 'Visual pack index packs must be an array.' });
          return Object.freeze([]);
        }
        return Object.freeze(index.packs.map((entry, entryIndex) => normalizePackEntry(entry, indexUrl, entryIndex)).filter(Boolean));
      }

      async function bootstrapPack(pack) {
        const manifestUrl = String(pack?.manifestUrl || '');
        const source = String(pack?.source || manifestUrl || 'dev-visual-pack');
        if (!manifestUrl) {
          record({ severity: 'warning', code: 'visualAssetLoader.manifestUrlMissing', source, message: 'Visual asset pack entry has no manifestUrl.' });
          return Object.freeze({ ok: false, registered: 0, source });
        }
        if (!canFetchPackResources()) {
          record({ severity: 'info', code: 'visualAssetLoader.fetchUnavailable', source, message: 'fetch()/URL is unavailable; visual asset pack skipped.' });
          return Object.freeze({ ok: false, registered: 0, source });
        }

        try {
          const response = await fetch(manifestUrl, { cache: 'no-store' });
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response?.status || 0} while loading ${manifestUrl}`);
          }
          const manifest = await response.json();
          const packBaseUrl = pack?.packBaseUrl || packBaseFromManifestUrl(manifestUrl);
          const result = visualAssetRegistry.registerManifest(manifest, source, {
            packBaseUrl,
            manifestUrl,
            revision: pack?.revision ?? manifest?.metadata?.revision ?? manifest?.revision ?? pack?.version
          });
          if (!result.ok) {
            record({ severity: 'warning', code: 'visualAssetLoader.packRejected', source, message: `Visual asset pack "${source}" failed validation.` });
          }
          await upgradeRoots();
          return Object.freeze({ ok: result.ok, registered: result.registered || 0, source, warnings: result.warnings || [], errors: result.errors || [] });
        } catch (error) {
          record({ severity: 'warning', code: 'visualAssetLoader.packLoadFailed', source, message: error?.message || String(error) });
          return Object.freeze({ ok: false, registered: 0, source, errors: [error] });
        }
      }

      async function bootstrapDevPacks(packs = DEFAULT_DEV_PACKS) {
        const list = Array.isArray(packs) ? packs : [];
        const results = [];
        for (const pack of list) results.push(await bootstrapPack(pack));
        return Object.freeze({
          ok: results.every(result => result.ok),
          registered: results.reduce((sum, result) => sum + (result.registered || 0), 0),
          packs: Object.freeze(results)
        });
      }

      async function bootstrapInstalledPacks(indexUrl = DEFAULT_PACK_INDEX_URL) {
        const source = String(indexUrl || DEFAULT_PACK_INDEX_URL);
        if (!canFetchPackResources()) {
          record({ severity: 'info', code: 'visualAssetLoader.fetchUnavailable', source, message: 'fetch()/URL is unavailable; visual asset pack index skipped.' });
          return Object.freeze({ ok: false, registered: 0, source, packs: Object.freeze([]) });
        }

        try {
          const resolvedIndexUrl = resolveUrl(source);
          const response = await fetch(resolvedIndexUrl, { cache: 'no-store' });
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response?.status || 0} while loading ${source}`);
          }
          const index = await response.json();
          return bootstrapDevPacks(normalizePackIndex(index, resolvedIndexUrl));
        } catch (error) {
          record({ severity: 'warning', code: 'visualAssetLoader.packIndexLoadFailed', source, message: error?.message || String(error) });
          return Object.freeze({ ok: false, registered: 0, source, packs: Object.freeze([]), errors: Object.freeze([error]) });
        }
      }

      function appendCacheBust(url, token) {
        if (!token) return url;
        try {
          const parsed = new URL(url, documentBaseUrl());
          parsed.searchParams.set('vaw_visual_rev', String(token));
          return parsed.toString();
        } catch (_) {
          const separator = String(url).includes('?') ? '&' : '?';
          return `${url}${separator}vaw_visual_rev=${encodeURIComponent(String(token))}`;
        }
      }

      function cacheBustToken(asset) {
        return asset?.packRevision || asset?.source?.revision || asset?.packVersion || asset?.source?.version || '';
      }

      function modelUrl(asset, { cacheBust = false } = {}) {
        const base = asset?.packBaseUrl || asset?.source?.packBaseUrl || '';
        if (!base || !asset?.model?.path) return '';
        const resolved = resolveUrl(asset.model.path, base);
        return cacheBust ? appendCacheBust(resolved, cacheBustToken(asset)) : resolved;
      }

      function loadImportedAsset(asset) {
        const assetId = String(asset?.assetId || '');
        if (!assetId) return Promise.reject(new Error('Visual asset has no assetId.'));
        const cacheKey = `${assetId}@${cacheBustToken(asset)}:${asset?.model?.path || ''}`;
        if (loadPromisesByAssetId.has(cacheKey)) return loadPromisesByAssetId.get(cacheKey);
        const promise = new Promise((resolve, reject) => {
          if (!THREE?.GLTFLoader) {
            reject(new Error('THREE.GLTFLoader is unavailable.'));
            return;
          }
          const url = modelUrl(asset, { cacheBust: true });
          if (!url) {
            reject(new Error(`Visual asset "${assetId}" has no resolvable model URL.`));
            return;
          }
          const loader = new THREE.GLTFLoader();
          loader.load(url, resolve, undefined, reject);
        }).catch(error => {
          loadPromisesByAssetId.delete(cacheKey);
          throw error;
        });
        loadPromisesByAssetId.set(cacheKey, promise);
        return promise;
      }

      function clearModelCache() {
        loadPromisesByAssetId.clear();
      }

      function cloneTextureLike(texture) {
        if (!texture || typeof texture !== 'object' || typeof texture.clone !== 'function') return texture;
        const looksLikeTexture = texture.isTexture || texture.image || texture.source || texture.mapping !== undefined || texture.wrapS !== undefined || texture.wrapT !== undefined;
        if (!looksLikeTexture) return texture;
        const clone = texture.clone();
        clone.needsUpdate = true;
        return clone;
      }

      function cloneMaterial(material) {
        if (!material || typeof material !== 'object') return material;
        const clone = typeof material.clone === 'function' ? material.clone() : material;
        if (clone === material) return clone;
        for (const key of [
          'map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'displacementMap', 'emissiveMap',
          'envMap', 'lightMap', 'metalnessMap', 'roughnessMap', 'specularMap', 'gradientMap',
          'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap',
          'sheenRoughnessMap', 'transmissionMap', 'thicknessMap'
        ]) {
          if (clone[key]) clone[key] = cloneTextureLike(clone[key]);
        }
        return clone;
      }

      function cloneScene(gltf) {
        const scene = gltf?.scene || gltf?.scenes?.[0] || null;
        if (!scene?.clone) throw new Error('Loaded glTF has no cloneable scene.');
        const clone = scene.clone(true);
        clone.traverse?.(object => {
          if (object.geometry?.clone) object.geometry = object.geometry.clone();
          if (Array.isArray(object.material)) object.material = object.material.map(cloneMaterial);
          else if (object.material) object.material = cloneMaterial(object.material);
          if (object.skeleton?.clone) object.skeleton = object.skeleton.clone();
        });
        return clone;
      }

      function pathSegments(binding) {
        if (typeof binding !== 'string' || !binding.trim()) return [];
        return binding.split('/').map(part => part.trim()).filter(Boolean);
      }

      function objectNamePath(object, root) {
        const names = [];
        let current = object;
        while (current) {
          if (current.name) names.unshift(current.name);
          if (current === root) break;
          current = current.parent;
        }
        return names;
      }

      function pathMatchesSuffix(names, segments) {
        if (!segments.length || names.length < segments.length) return false;
        const offset = names.length - segments.length;
        return segments.every((segment, index) => names[offset + index] === segment);
      }

      function findNodeByBinding(root, binding) {
        const segments = pathSegments(binding);
        if (!segments.length) return null;
        const normalized = `/${segments.join('/')}`;
        let found = null;
        root?.traverse?.(object => {
          if (found) return;
          if (object.userData?.visualAssetOriginalPath === normalized) {
            found = object;
            return;
          }
          if (segments.length === 1) {
            if (object.name === segments[0]) found = object;
            return;
          }
          if (pathMatchesSuffix(objectNamePath(object, root), segments)) found = object;
        });
        return found;
      }

      function axisVector(axis) {
        const value = String(axis || '+X').toUpperCase();
        const sign = value.startsWith('-') ? -1 : 1;
        const axisName = value.replace(/^[+-]/, '');
        if (axisName === 'X') return new THREE.Vector3(sign, 0, 0);
        if (axisName === 'Y') return new THREE.Vector3(0, sign, 0);
        if (axisName === 'Z') return new THREE.Vector3(0, 0, sign);
        return null;
      }

      function applyModelTransform(importedRoot, asset) {
        const unitMeters = Number(asset.model?.unitMeters);
        importedRoot.scale.setScalar(Number.isFinite(unitMeters) && unitMeters > 0 ? unitMeters : 1);

        const forward = axisVector(asset.model?.forwardAxis);
        const up = axisVector(asset.model?.upAxis);
        if (forward && up && Math.abs(forward.dot(up)) <= 1e-6 && THREE.Matrix4 && importedRoot.quaternion?.setFromRotationMatrix) {
          const side = forward.clone().cross(up).normalize();
          const matrix = new THREE.Matrix4().makeBasis(
            new THREE.Vector3(forward.x, up.x, side.x),
            new THREE.Vector3(forward.y, up.y, side.y),
            new THREE.Vector3(forward.z, up.z, side.z)
          );
          importedRoot.quaternion.setFromRotationMatrix(matrix);
        }

        const transform = asset.model?.transform || {};
        const position = transform.position || {};
        importedRoot.position.set(
          Number.isFinite(Number(position.x)) ? Number(position.x) : 0,
          Number.isFinite(Number(position.y)) ? Number(position.y) : 0,
          Number.isFinite(Number(position.z)) ? Number(position.z) : 0
        );
        const scale = transform.scale || {};
        importedRoot.scale.set(
          importedRoot.scale.x * (Number.isFinite(Number(scale.x)) ? Number(scale.x) : 1),
          importedRoot.scale.y * (Number.isFinite(Number(scale.y)) ? Number(scale.y) : 1),
          importedRoot.scale.z * (Number.isFinite(Number(scale.z)) ? Number(scale.z) : 1)
        );
        applyRotationDegrees(importedRoot, transform.rotationDegrees || {});
      }

      function multiplyQuaternionInto(target, source) {
        if (!target || !source) return;
        const ax = target.x || 0, ay = target.y || 0, az = target.z || 0, aw = target.w ?? 1;
        const bx = source.x || 0, by = source.y || 0, bz = source.z || 0, bw = source.w ?? 1;
        target.set(
          aw * bx + ax * bw + ay * bz - az * by,
          aw * by - ax * bz + ay * bw + az * bx,
          aw * bz + ax * by - ay * bx + az * bw,
          aw * bw - ax * bx - ay * by - az * bz
        );
      }

      function quaternionFromEulerDegrees(rotationDegrees) {
        const x = THREE.MathUtils?.degToRad ? THREE.MathUtils.degToRad(Number(rotationDegrees.x) || 0) : (Number(rotationDegrees.x) || 0) * Math.PI / 180;
        const y = THREE.MathUtils?.degToRad ? THREE.MathUtils.degToRad(Number(rotationDegrees.y) || 0) : (Number(rotationDegrees.y) || 0) * Math.PI / 180;
        const z = THREE.MathUtils?.degToRad ? THREE.MathUtils.degToRad(Number(rotationDegrees.z) || 0) : (Number(rotationDegrees.z) || 0) * Math.PI / 180;
        const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
        const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
        return {
          x: s1 * c2 * c3 + c1 * s2 * s3,
          y: c1 * s2 * c3 - s1 * c2 * s3,
          z: c1 * c2 * s3 + s1 * s2 * c3,
          w: c1 * c2 * c3 - s1 * s2 * s3
        };
      }

      function applyRotationDegrees(importedRoot, rotationDegrees) {
        if (!importedRoot?.quaternion?.set) return;
        const hasRotation = ['x', 'y', 'z'].some(axis => Math.abs(Number(rotationDegrees[axis]) || 0) > 1e-8);
        if (!hasRotation) return;
        multiplyQuaternionInto(importedRoot.quaternion, quaternionFromEulerDegrees(rotationDegrees));
      }

      function annotateOriginalNodePaths(scene) {
        function walk(object, parentPath) {
          if (!object) return;
          object.userData = object.userData || {};
          const segment = String(object.name || '').replace(/\//g, '_');
          const path = segment ? `${parentPath}/${segment}` : parentPath;
          if (path) object.userData.visualAssetOriginalPath = path;
          for (const child of object.children || []) walk(child, path);
        }
        for (const child of scene?.children || []) walk(child, '');
      }

      function prepareImportedTree(root) {
        root.traverse?.(object => {
          object.raycast = () => {};
          object.userData = object.userData || {};
          object.userData.isImportedVisualPart = true;
          if (object.material) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
      }

      function eachMaterial(root, fn) {
        root?.traverse?.(object => {
          const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
          for (const material of materials) if (material) fn(material, object);
        });
      }

      function eachTexture(material, fn) {
        for (const key of [
          'map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'displacementMap', 'emissiveMap',
          'envMap', 'lightMap', 'metalnessMap', 'roughnessMap', 'metalnessMap', 'specularMap'
        ]) {
          if (material?.[key]) fn(material[key], key);
        }
      }

      function applyPixelMaterialPolicy(root) {
        if (!THREE?.NearestFilter) return;
        eachMaterial(root, material => {
          eachTexture(material, texture => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestMipMapNearestFilter || THREE.NearestFilter;
            texture.needsUpdate = true;
          });
        });
      }

      function normalizeAlphaPolicy(value, fallback = 'auto') {
        const text = String(value || fallback).toLowerCase();
        return ['auto', 'from-gltf', 'blend', 'mask', 'mask-or-blend', 'opaque'].includes(text) ? text : fallback;
      }

      function normalizedMaterialOverrides(policy = {}) {
        const rows = [];
        if (Array.isArray(policy.materialOverrides)) {
          for (const item of policy.materialOverrides) {
            if (!item || typeof item !== 'object') continue;
            const materialName = String(item.materialName || item.name || '').trim();
            if (!materialName) continue;
            rows.push({ materialName, alpha: item.alpha, doubleSided: item.doubleSided });
          }
        }
        if (policy.materials && typeof policy.materials === 'object' && !Array.isArray(policy.materials)) {
          for (const [materialName, item] of Object.entries(policy.materials)) {
            if (!item || typeof item !== 'object') continue;
            rows.push({ materialName, alpha: item.alpha, doubleSided: item.doubleSided });
          }
        }
        return rows;
      }

      function createMaterialOverrideResolver(policy = {}, root = null, asset = null) {
        const byName = new Map();
        const duplicateOverrideNames = new Set();
        for (const item of normalizedMaterialOverrides(policy)) {
          const key = String(item.materialName || '').trim().toLowerCase();
          if (!key) continue;
          if (byName.has(key)) duplicateOverrideNames.add(key);
          else byName.set(key, item);
        }
        for (const key of duplicateOverrideNames) {
          const warningKey = `override:${asset?.assetId || 'asset'}:${key}`;
          if (materialWarningKeys.has(warningKey)) continue;
          materialWarningKeys.add(warningKey);
          record({
            severity: 'warning',
            code: 'visualAssetLoader.materialOverrideDuplicate',
            source: asset?.source?.source || asset?.packId || 'visual-asset',
            assetId: asset?.assetId || null,
            path: 'materialPolicy.materialOverrides',
            message: `Material override for "${key}" is declared more than once; the first renderer-only override is used.`
          });
        }
        if (root && byName.size) {
          const counts = new Map();
          const labels = new Map();
          eachMaterial(root, material => {
            const label = String(material?.name || '').trim();
            const key = label.toLowerCase();
            if (!key) return;
            counts.set(key, (counts.get(key) || 0) + 1);
            if (!labels.has(key)) labels.set(key, label);
          });
          for (const [key, count] of counts.entries()) {
            if (count <= 1 || !byName.has(key)) continue;
            const warningKey = `ambiguous:${asset?.assetId || 'asset'}:${key}`;
            if (materialWarningKeys.has(warningKey)) continue;
            materialWarningKeys.add(warningKey);
            record({
              severity: 'warning',
              code: 'visualAssetLoader.materialNameAmbiguous',
              source: asset?.source?.source || asset?.packId || 'visual-asset',
              assetId: asset?.assetId || null,
              path: labels.get(key) || key,
              message: `Material override "${labels.get(key) || key}" matches ${count} imported materials; the override applies to all matching names.`
            });
          }
        }
        return material => {
          const name = String(material?.name || '').trim().toLowerCase();
          return name ? (byName.get(name) || null) : null;
        };
      }

      function materialOverrideFor(resolveOverride, material) {
        if (typeof resolveOverride !== 'function') return null;
        const name = String(material?.name || '').trim().toLowerCase();
        if (!name) return null;
        return resolveOverride(material);
      }

      function materialHasAlphaSignal(material) {
        return Boolean(
          material?.transparent ||
          material?.alphaMap ||
          Number(material?.alphaTest || 0) > 0 ||
          (Number.isFinite(Number(material?.opacity)) && Number(material.opacity) < 1)
        );
      }

      function applyAlphaPolicy(material, alpha, alphaTest, blendAlphaTest = 0.001) {
        const policy = normalizeAlphaPolicy(alpha);
        const resolved = policy === 'auto' || policy === 'mask-or-blend'
          ? (materialHasAlphaSignal(material) ? (Number(material.alphaTest || 0) > 0 && !material.transparent ? 'mask' : 'blend') : 'opaque')
          : policy;
        if (resolved === 'from-gltf') return;
        if (resolved === 'blend') {
          material.transparent = true;
          material.alphaTest = blendAlphaTest;
          material.depthWrite = false;
          material.depthTest = true;
          if (!Number.isFinite(Number(material.opacity))) material.opacity = 1;
        } else if (resolved === 'mask') {
          material.transparent = false;
          material.alphaTest = alphaTest;
          material.depthWrite = true;
          material.depthTest = true;
          if (!Number.isFinite(Number(material.opacity))) material.opacity = 1;
        } else if (resolved === 'opaque') {
          material.transparent = false;
          material.alphaTest = 0;
          material.opacity = 1;
          material.depthWrite = true;
          material.depthTest = true;
        }
      }

      function applyMaterialPolicy(root, policy = {}, asset = null) {
        const alpha = normalizeAlphaPolicy(policy.alpha || policy.mode || 'auto');
        const alphaTest = Number.isFinite(Number(policy.alphaTest)) ? Number(policy.alphaTest) : 0.35;
        const blendAlphaTest = Number.isFinite(Number(policy.blendAlphaTest)) ? Number(policy.blendAlphaTest) : 0.001;
        const resolveOverride = createMaterialOverrideResolver(policy, root, asset);
        eachMaterial(root, material => {
          const override = materialOverrideFor(resolveOverride, material);
          if (override?.alpha && override.alpha !== alpha) {
            const warningKey = `override-applied:${asset?.assetId || 'asset'}:${String(material?.name || '').toLowerCase()}:${override.alpha}`;
            if (!materialWarningKeys.has(warningKey)) {
              materialWarningKeys.add(warningKey);
              record({
                severity: 'info',
                code: 'visualAssetLoader.materialOverrideApplied',
                source: asset?.source?.source || asset?.packId || 'visual-asset',
                assetId: asset?.assetId || null,
                path: material?.name || '',
                message: `Material override "${material?.name || '(unnamed)'}" uses alpha "${override.alpha}" instead of global "${alpha}".`
              });
            }
          }
          applyAlphaPolicy(material, override?.alpha ?? alpha, alphaTest, blendAlphaTest);

          const doubleSided = override?.doubleSided ?? policy.doubleSided;
          if (doubleSided === true || doubleSided === 'force') material.side = THREE.DoubleSide ?? 2;
          if (doubleSided === false || doubleSided === 'never') material.side = THREE.FrontSide ?? 0;
          material.needsUpdate = true;
        });
        if (policy.pixelated === true) applyPixelMaterialPolicy(root);
      }

      function restoreHitProxy(proxy) {
        const materials = Array.isArray(proxy?.material) ? proxy.material : (proxy?.material ? [proxy.material] : []);
        for (const material of materials) {
          const original = material?.userData?.vawHitProxyOriginalMaterial;
          if (!original) continue;
          material.transparent = original.transparent;
          material.opacity = original.opacity;
          material.depthWrite = original.depthWrite;
          material.depthTest = original.depthTest;
          material.colorWrite = original.colorWrite;
          material.needsUpdate = true;
          delete material.userData.vawHitProxyOriginalMaterial;
        }
      }

      function restoreProceduralFallback(root) {
        for (const child of root?.children || []) {
          if (child.userData?.isImportedVisual) continue;
          if (child.userData?.isVoxelHitProxy || child.name === 'vawHitProxy') {
            restoreHitProxy(child);
            continue;
          }
          child.traverse?.(object => {
            if (object.userData?.vawHiddenByImportedVisual) {
              object.visible = true;
              delete object.userData.vawHiddenByImportedVisual;
            }
          });
        }
      }

      function markHiddenFallback(root) {
        root.traverse?.(object => {
          object.userData = object.userData || {};
          object.userData.vawHiddenByImportedVisual = true;
        });
        root.visible = false;
      }

      function transparentHitProxy(proxy) {
        const materials = Array.isArray(proxy?.material) ? proxy.material : (proxy?.material ? [proxy.material] : []);
        for (const material of materials) {
          material.userData = material.userData || {};
          if (!material.userData.vawHitProxyOriginalMaterial) {
            material.userData.vawHitProxyOriginalMaterial = {
              transparent: material.transparent,
              opacity: material.opacity,
              depthWrite: material.depthWrite,
              depthTest: material.depthTest,
              colorWrite: material.colorWrite
            };
          }
          material.transparent = true;
          material.opacity = debugVisualsVisible ? 0.22 : 0;
          material.depthWrite = false;
          material.depthTest = true;
          material.colorWrite = debugVisualsVisible;
          material.needsUpdate = true;
        }
        if (proxy?.userData) proxy.userData.visualDebugVisible = debugVisualsVisible;
      }

      function hideProceduralFallback(root, importedRoot) {
        for (const child of root.children || []) {
          if (child === importedRoot) continue;
          if (child.userData?.isVoxelHitProxy || child.name === 'vawHitProxy') {
            transparentHitProxy(child);
            continue;
          }
          markHiddenFallback(child);
        }
      }

      function vectorClone(value, fallback = { x: 0, y: 0, z: 0 }) {
        return value?.clone ? value.clone() : new THREE.Vector3(value?.x ?? fallback.x, value?.y ?? fallback.y, value?.z ?? fallback.z);
      }

      function multiplyVectorComponents(target, source) {
        target.x *= source.x;
        target.y *= source.y;
        target.z *= source.z;
        return target;
      }

      function worldTransformSnapshot(object, root) {
        if (object?.updateWorldMatrix && object.getWorldPosition && object.getWorldQuaternion && object.getWorldScale) {
          object.updateWorldMatrix(true, false);
          return {
            position: object.getWorldPosition(new THREE.Vector3()),
            quaternion: object.getWorldQuaternion(new THREE.Quaternion()),
            scale: object.getWorldScale(new THREE.Vector3())
          };
        }
        const chain = [];
        let current = object;
        while (current) {
          chain.unshift(current);
          if (current === root) break;
          current = current.parent;
        }
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        for (const item of chain) {
          const localPosition = vectorClone(item.position);
          multiplyVectorComponents(localPosition, scale);
          localPosition.applyQuaternion?.(quaternion);
          position.add(localPosition);
          multiplyQuaternionInto(quaternion, item.quaternion || { x: 0, y: 0, z: 0, w: 1 });
          multiplyVectorComponents(scale, item.scale || { x: 1, y: 1, z: 1 });
        }
        return { position, quaternion, scale };
      }

      function mountVisualRoot(importedRoot, scene, mountedScene) {
        if (mountedScene === scene) {
          importedRoot.add(scene);
          return;
        }
        const snapshot = worldTransformSnapshot(mountedScene, scene);
        mountedScene.parent?.remove?.(mountedScene);
        mountedScene.parent = null;
        importedRoot.add(mountedScene);
        mountedScene.position?.copy?.(snapshot.position);
        mountedScene.quaternion?.copy?.(snapshot.quaternion);
        mountedScene.scale?.copy?.(snapshot.scale);
      }

      function attachImportedScene(root, asset, gltf) {
        const importedRoot = new THREE.Group();
        importedRoot.name = `vawImportedVisual:${asset.assetId}`;
        importedRoot.userData.isImportedVisual = true;
        importedRoot.userData.visualAssetId = asset.assetId;
        importedRoot.userData.visualAssetPackId = asset.packId || null;
        importedRoot.userData.visualAssetPackRevision = asset.packRevision || null;
        importedRoot.userData.visualAssetNodeBindings = asset.bindings?.nodes || {};
        importedRoot.userData.visualAssetClipBindings = asset.bindings?.clips || {};
        importedRoot.userData.visualAssetRigBindings = asset.bindings?.rig || {};
        importedRoot.userData.visualAssetModelPath = asset.model?.path || '';

        const scene = cloneScene(gltf);
        scene.name = scene.name || 'importedVisualScene';
        annotateOriginalNodePaths(scene);
        prepareImportedTree(scene);
        applyMaterialPolicy(scene, asset.materialPolicy || {}, asset);
        applyModelTransform(importedRoot, asset);
        const visualRootBinding = asset.bindings?.nodes?.visualRoot;
        const mountedScene = findNodeByBinding(scene, visualRootBinding) || scene;
        if (mountedScene === scene && visualRootBinding) {
          record({
            severity: 'warning',
            code: 'visualAssetLoader.visualRootNotFound',
            source: asset.source?.source || asset.packId || 'visual-asset',
            assetId: asset.assetId,
            path: visualRootBinding,
            message: `Visual root binding "${visualRootBinding}" was not found in the loaded glTF; mounting the full scene as a renderer-only fallback.`
          });
        }
        mountVisualRoot(importedRoot, scene, mountedScene);

        root.add(importedRoot);
        root.userData.visualAssetNodeBindings = asset.bindings?.nodes || {};
        root.userData.visualAssetClipBindings = asset.bindings?.clips || {};
        root.userData.visualAssetRigBindings = asset.bindings?.rig || {};
        root.userData.importedVisualAssetId = asset.assetId;
        root.userData.importedVisualPackId = asset.packId || null;
        root.userData.importedVisualPackRevision = asset.packRevision || null;
        root.userData.importedVisualModelPath = asset.model?.path || '';
        root.userData.visualAssetStatus = 'imported-visual';
        hideProceduralFallback(root, importedRoot);
        return importedRoot;
      }

      function detachImportedVisual(root) {
        if (!root?.userData?.isVoxelRoot) return 0;
        const importedChildren = (root.children || []).filter(child => child.userData?.isImportedVisual);
        for (const imported of importedChildren) {
          root.remove(imported);
          imported.parent = null;
          disposeObjectTree(imported);
        }
        restoreProceduralFallback(root);
        delete root.userData.importedVisualAssetId;
        delete root.userData.importedVisualPackId;
        delete root.userData.importedVisualPackRevision;
        delete root.userData.importedVisualModelPath;
        delete root.userData.visualAssetRigBindings;
        delete root.userData.visualAssetPromise;
        const asset = assetForRoot(root);
        root.userData.visualAssetStatus = asset ? 'registered-fallback' : 'procedural-fallback';
        return importedChildren.length;
      }

      function assetForRoot(root) {
        const type = root?.userData?.type;
        const asset = visualAssetRegistry.assetForBlockType(type);
        if (asset) return asset;
        const id = root?.userData?.visualAssetId;
        return id ? visualAssetRegistry.assetById?.(id) || null : null;
      }

      function attachImportedVisual(root) {
        if (!root?.userData?.isVoxelRoot) return Promise.resolve(false);
        trackedRoots.add(root);
        if (root.userData.visualAssetStatus === 'imported-visual') return Promise.resolve(true);
        if (root.userData.visualAssetStatus === 'loading-imported' && root.userData.visualAssetPromise) {
          return root.userData.visualAssetPromise;
        }

        const asset = assetForRoot(root);
        if (!asset) {
          root.userData.visualAssetStatus = 'procedural-fallback';
          delete root.userData.visualAssetId;
          root.userData.visualAssetNodeBindings = {};
          root.userData.visualAssetClipBindings = {};
          root.userData.visualAssetRigBindings = {};
          return Promise.resolve(false);
        }
        root.userData.visualAssetId = asset.assetId;
        root.userData.visualAssetNodeBindings = asset.bindings?.nodes || {};
        root.userData.visualAssetClipBindings = asset.bindings?.clips || {};
        root.userData.visualAssetRigBindings = asset.bindings?.rig || {};
        if (!modelUrl(asset)) {
          root.userData.visualAssetStatus = 'registered-fallback';
          return Promise.resolve(false);
        }

        root.userData.visualAssetStatus = 'loading-imported';
        const promise = loadImportedAsset(asset)
          .then(gltf => {
            if (!root.parent) return false;
            attachImportedScene(root, asset, gltf);
            return true;
          })
          .catch(error => {
            root.userData.visualAssetStatus = 'import-failed-fallback';
            record({
              severity: 'warning',
              code: 'visualAssetLoader.modelLoadFailed',
              source: asset.source?.source || asset.packId || 'visual-asset',
              assetId: asset.assetId,
              path: asset.model?.path || '',
              message: error?.message || String(error)
            });
            return false;
          })
          .finally(() => {
            if (root.userData.visualAssetPromise === promise) delete root.userData.visualAssetPromise;
          });
        root.userData.visualAssetPromise = promise;
        return promise;
      }

      function upgradeRoots(roots = trackedRoots) {
        const list = Array.from(roots || []);
        return Promise.allSettled(list.map(root => attachImportedVisual(root)));
      }

      function setDebugVisualsVisible(enabled) {
        debugVisualsVisible = Boolean(enabled);
        for (const root of trackedRoots) {
          if (!root?.userData?.isVoxelRoot) continue;
          const hasImportedVisual = (root.children || []).some(child => child.userData?.isImportedVisual);
          if (!hasImportedVisual) continue;
          for (const child of root.children || []) {
            if (child.userData?.isVoxelHitProxy || child.name === 'vawHitProxy') transparentHitProxy(child);
          }
        }
        return debugVisualsVisible;
      }

      async function reloadInstalledPacks(indexUrl = DEFAULT_PACK_INDEX_URL) {
        const roots = Array.from(trackedRoots).filter(root => root?.userData?.isVoxelRoot);
        let detached = 0;
        for (const root of roots) detached += detachImportedVisual(root);
        clearModelCache();
        visualAssetRegistry.clear?.();
        const result = await bootstrapInstalledPacks(indexUrl);
        const upgraded = await upgradeRoots(roots);
        return Object.freeze({
          ...result,
          detached,
          roots: roots.length,
          upgraded: upgraded.filter(item => item.status === 'fulfilled' && item.value === true).length
        });
      }

      function coverage(blockTypes) {
        if (visualAssetRegistry.coverage) return blockTypes === undefined ? visualAssetRegistry.coverage() : visualAssetRegistry.coverage(blockTypes);
        const list = Array.isArray(blockTypes) ? blockTypes : [];
        return Object.freeze(list.map(blockType => {
          const asset = visualAssetRegistry.assetForBlockType(blockType);
          return Object.freeze({
            blockType: String(blockType || ''),
            assetId: asset?.assetId || null,
            packId: asset?.packId || null,
            status: asset ? 'registered-fallback' : 'procedural-fallback'
          });
        }));
      }

      return Object.freeze({
        DEFAULT_PACK_INDEX_URL,
        DEFAULT_DEV_PACKS,
        bootstrapDevPacks,
        bootstrapInstalledPacks,
        reloadInstalledPacks,
        attachImportedVisual,
        detachImportedVisual,
        upgradeRoots,
        clearModelCache,
        setDebugVisualsVisible,
        debugVisualsVisible: () => debugVisualsVisible,
        coverage,
        diagnostics: () => Object.freeze(diagnostics.map(item => Object.freeze({ ...item })))
      });
    }

    return Object.freeze({ DEFAULT_PACK_INDEX_URL, DEFAULT_DEV_PACKS, create });
  });
})();
