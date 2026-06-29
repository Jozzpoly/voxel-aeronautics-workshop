(() => {
  'use strict';

  window.VAW.define('game.visual-asset-registry', ['foundation.visual-asset-manifest', 'foundation.catalog'], (VisualAssetManifest, Catalog) => {
    const DEFAULT_BLOCK_TYPES = Object.freeze(Object.keys(Catalog.BLOCKS || {}));

    function create({ manifests = [] } = {}) {
      const assetsById = new Map();
      const assetIdByBlockType = new Map();
      const diagnostics = [];

      function record(item) {
        diagnostics.push(Object.freeze({ ...item }));
      }

      function normalizedSourceMetadata(source, options = {}) {
        const text = String(source || 'runtime');
        const base = options.packBaseUrl == null ? '' : String(options.packBaseUrl).trim();
        return Object.freeze({
          source: text,
          packId: options.packId == null ? null : String(options.packId),
          version: options.version == null ? null : String(options.version),
          revision: options.revision == null ? null : String(options.revision),
          manifestUrl: options.manifestUrl == null ? null : String(options.manifestUrl),
          packBaseUrl: base ? (base.endsWith('/') ? base : `${base}/`) : ''
        });
      }

      function assetWithSourceMetadata(asset, metadata) {
        return Object.freeze({
          ...asset,
          source: metadata,
          packId: metadata.packId,
          packVersion: metadata.version,
          packRevision: metadata.revision,
          packBaseUrl: metadata.packBaseUrl
        });
      }

      function registerValidated(validation, source = 'runtime', options = {}) {
        if (!validation || !validation.ok) {
          for (const error of validation?.errors || []) record({ source, severity: 'error', ...error });
          for (const warning of validation?.warnings || []) record({ source, severity: 'warning', ...warning });
          return Object.freeze({ ok: false, registered: 0, errors: validation?.errors || [], warnings: validation?.warnings || [] });
        }

        const metadata = normalizedSourceMetadata(source, options);
        let registered = 0;
        const warnings = [...(validation.warnings || [])];
        for (const asset of validation.assets || []) {
          if (assetsById.has(asset.assetId)) {
            const warning = { severity: 'warning', code: 'visualAssetRegistry.duplicateAssetId', path: asset.assetId, message: `Asset "${asset.assetId}" is already registered; keeping the first asset.` };
            warnings.push(warning);
            record({ source, ...warning });
            continue;
          }
          const registeredAsset = assetWithSourceMetadata(asset, metadata);
          assetsById.set(asset.assetId, registeredAsset);
          registered += 1;
          for (const blockType of asset.bindings.blockTypes || []) {
            if (assetIdByBlockType.has(blockType)) {
              const existing = assetIdByBlockType.get(blockType);
              const warning = { severity: 'warning', code: 'visualAssetRegistry.duplicateBlockType', path: blockType, message: `Block type "${blockType}" already maps to "${existing}"; keeping the first asset.` };
              warnings.push(warning);
              record({ source, ...warning });
              continue;
            }
            assetIdByBlockType.set(blockType, asset.assetId);
          }
        }
        for (const warning of validation.warnings || []) record({ source, severity: 'warning', ...warning });
        return Object.freeze({ ok: true, registered, errors: [], warnings });
      }

      function registerManifest(manifest, source = 'runtime', options = {}) {
        try {
          return registerValidated(VisualAssetManifest.validateManifest(manifest), source, {
            ...options,
            packId: options.packId ?? manifest?.packId,
            version: options.version ?? manifest?.version
          });
        } catch (error) {
          const item = { severity: 'error', code: 'visualAssetRegistry.unexpectedFailure', path: '', message: error?.message || String(error), source };
          record(item);
          return Object.freeze({ ok: false, registered: 0, errors: [item], warnings: [] });
        }
      }

      function assetForBlockType(blockType) {
        const assetId = assetIdByBlockType.get(String(blockType || ''));
        return assetId ? (assetsById.get(assetId) || null) : null;
      }

      function assetById(assetId) {
        return assetsById.get(String(assetId || '')) || null;
      }

      function registeredBlockTypes() {
        return Object.freeze(Array.from(assetIdByBlockType.keys()).sort());
      }

      function coverage(blockTypes = DEFAULT_BLOCK_TYPES) {
        const list = Array.isArray(blockTypes) ? blockTypes : DEFAULT_BLOCK_TYPES;
        return Object.freeze(list.map(blockType => {
          const type = String(blockType || '');
          const asset = assetForBlockType(type);
          return Object.freeze({
            blockType: type,
            assetId: asset?.assetId || null,
            packId: asset?.packId || null,
            modelPath: asset?.model?.path || null,
            revision: asset?.packRevision || null,
            status: asset ? 'registered-fallback' : 'procedural-fallback'
          });
        }));
      }

      function clear() {
        assetsById.clear();
        assetIdByBlockType.clear();
        diagnostics.length = 0;
      }

      const api = Object.freeze({
        registerManifest,
        registerValidated,
        assetForBlockType,
        assetById,
        registeredBlockTypes,
        coverage,
        clear,
        get size() { return assetsById.size; },
        diagnostics: () => Object.freeze(diagnostics.map(item => Object.freeze({ ...item })))
      });

      for (const manifest of manifests) registerManifest(manifest, 'constructor');
      return api;
    }

    return Object.freeze({ create });
  });
})();
