(() => {
  'use strict';

  window.VAW.define('game.visual-asset-composition', [
    'game.visual-asset-registry',
    'game.visual-asset-loader',
    'game.visual-asset-dev-controls',
    'game.visual-runtime-adapter',
    'game.module-visual-factory'
  ], (
    VisualAssetRegistry,
    VisualAssetLoader,
    VisualAssetDevControls,
    VisualRuntimeAdapter,
    ModuleVisualFactory
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
      const visualAssetRegistry = VisualAssetRegistry.create();
      const visualAssetLoader = VisualAssetLoader.create({
        THREE,
        visualAssetRegistry,
        disposeObjectTree,
        logger
      });
      const warn = typeof logger?.warn === 'function'
        ? logger.warn.bind(logger)
        : console.warn.bind(console);
      visualAssetLoader.bootstrapInstalledPacks().catch(warn);
      const visualRuntimeAdapter = VisualRuntimeAdapter.create();
      const moduleVisualFactory = ModuleVisualFactory.create({
        THREE,
        sharedGeometry,
        cloneMaterial,
        visualAssetRegistry
      });
      const visualAssetDevControls = VisualAssetDevControls.create({
        visualAssetLoader,
        showStatus,
        document,
        window
      });

      return Object.freeze({
        visualAssetRegistry,
        visualAssetLoader,
        visualRuntimeAdapter,
        moduleVisualFactory,
        visualAssetDevControls,
        createModuleVisual: moduleVisualFactory.createModuleVisual
      });
    }

    return Object.freeze({ create });
  });
})();
