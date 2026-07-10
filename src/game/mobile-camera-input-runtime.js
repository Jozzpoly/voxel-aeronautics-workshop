'use strict';

(function registerMobileCameraInputRuntime(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./mobile-touch-controller.js'),
      require('./mobile-pointer-adapter.js'),
      require('./mobile-camera-gesture-bridge.js')
    );
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-camera-input-runtime.js.');
  root.VAW.define(
    'game.mobile-camera-input-runtime',
    ['game.mobile-touch-controller', 'game.mobile-pointer-adapter', 'game.mobile-camera-gesture-bridge'],
    factory
  );
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileCameraInputRuntimeModule(TouchController, PointerAdapter, CameraBridge) {
  function create(options = {}) {
    const surface = options.surface;
    if (!surface) throw new TypeError('Mobile camera input runtime requires a surface.');
    const mobileContext = options.mobileContext;
    const cameraController = options.cameraController;
    if (!mobileContext || typeof mobileContext.currentProfile !== 'function') {
      throw new TypeError('Mobile camera input runtime requires mobileContext.currentProfile().');
    }
    if (!cameraController) throw new TypeError('Mobile camera input runtime requires cameraController.');

    const onTap = typeof options.onTap === 'function' ? options.onTap : () => {};
    const tapEnabled = typeof options.tapEnabled === 'function' ? options.tapEnabled : () => false;
    const onCameraChanged = typeof options.onCameraChanged === 'function' ? options.onCameraChanged : () => {};
    let enabled = Boolean(mobileContext.currentProfile()?.mobilePresentation);

    const bridge = CameraBridge.create({
      cameraController,
      orbitSensitivity: options.orbitSensitivity,
      zoomSensitivity: options.zoomSensitivity,
      minDistance: options.minDistance,
      maxDistance: options.maxDistance,
      onChanged: onCameraChanged
    });

    const controller = TouchController.create({
      movementThreshold: options.movementThreshold,
      maxCanvasPointers: 2,
      onOrbit: bridge.orbit,
      onPan: bridge.pan,
      onZoom: bridge.zoom,
      onTap(sample) {
        if (enabled && tapEnabled()) onTap(sample);
      },
      onCancel: options.onCancel,
      onStateChanged: options.onStateChanged
    });

    const adapter = PointerAdapter.create({
      surface,
      window: options.window,
      document: options.document,
      controller,
      enabled: () => enabled,
      resolveOwner: options.resolveOwner || (() => 'canvas'),
      manageTouchAction: options.manageTouchAction !== false
    });

    function refreshEnabled() {
      const next = Boolean(mobileContext.currentProfile()?.mobilePresentation);
      enabled = next;
      adapter.setEnabled(next);
      return enabled;
    }

    function cancel(reason = 'external-cancel') {
      return controller.cancelAll(reason);
    }

    return Object.freeze({
      bind: adapter.bind,
      destroy: adapter.destroy,
      cancel,
      refreshEnabled,
      enabled: () => enabled,
      snapshot: controller.snapshot
    });
  }

  return Object.freeze({ create });
});
