(() => {
  'use strict';

  window.VAW.define('game.visual-asset-composition', [
    'game.visual-asset-registry',
    'game.visual-asset-loader',
    'game.visual-asset-dev-controls',
    'game.visual-runtime-adapter',
    'game.module-visual-factory',
    'game.storage-capability'
  ], (
    VisualAssetRegistry,
    VisualAssetLoader,
    VisualAssetDevControls,
    VisualRuntimeAdapter,
    ModuleVisualFactory,
    StorageCapability
  ) => {
    function create(options = {}) {
      const {
        THREE = window.THREE,
        sharedGeometry,
        cloneMaterial,
        disposeObjectTree,
        showStatus = () => {},
        document = null,
        window = null,
        logger = console
      } = options;
      const storage = Object.prototype.hasOwnProperty.call(options, 'storage')
        ? StorageCapability.from(options.storage, { persistent: true })
        : StorageCapability.forWindow(window);
      const releaseMode = String(document?.documentElement?.dataset?.vawReleaseMode || '');
      const packResourceLoadingEnabled = Object.prototype.hasOwnProperty.call(options, 'packResourceLoadingEnabled')
        ? Boolean(options.packResourceLoadingEnabled)
        : releaseMode !== 'single-file';
      const visualAssetRegistry = VisualAssetRegistry.create();
      const visualAssetLoader = VisualAssetLoader.create({
        THREE,
        visualAssetRegistry,
        disposeObjectTree,
        logger,
        packResourceLoadingEnabled
      });
      const warn = typeof logger?.warn === 'function'
        ? logger.warn.bind(logger)
        : console.warn.bind(console);
      if (packResourceLoadingEnabled) visualAssetLoader.bootstrapInstalledPacks().catch(warn);
      const visualRuntimeAdapter = VisualRuntimeAdapter.create();
      const cellScale = ModuleVisualFactory.parseModuleVisualCellScaleDevFlag({
        search: window?.location?.search || '',
        storage
      });
      const moduleVisualFactory = ModuleVisualFactory.create({
        THREE,
        sharedGeometry,
        cloneMaterial,
        visualAssetRegistry,
        cellScale
      });
      const visualAssetDevControls = VisualAssetDevControls.create({
        visualAssetLoader,
        showStatus,
        document,
        window,
        storage
      });

      return Object.freeze({
        visualAssetRegistry,
        visualAssetLoader,
        visualRuntimeAdapter,
        moduleVisualFactory,
        visualAssetDevControls,
        createModuleVisual: moduleVisualFactory.createModuleVisual,
        moduleVisualCellScale: moduleVisualFactory.activeCellScale,
        packResourceLoadingEnabled
      });
    }

    return Object.freeze({ create });
  });
})();
