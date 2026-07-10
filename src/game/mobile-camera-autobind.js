'use strict';

(function registerMobileCameraAutobind(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      null,
      require('./mobile-camera-input-runtime.js')
    );
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-camera-autobind.js.');
  root.VAW.define(
    'game.mobile-camera-autobind',
    ['game.camera-controller', 'game.mobile-camera-input-runtime'],
    factory
  );
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileCameraAutobindModule(DefaultCameraController, DefaultRuntimeModule) {
  function create(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const mobileContext = options.mobileContext;
    const cameraControllerModule = options.cameraControllerModule || DefaultCameraController;
    const runtimeModule = options.runtimeModule || DefaultRuntimeModule;
    if (!documentLike) throw new TypeError('Mobile camera autobind requires a document.');
    if (!mobileContext || typeof mobileContext.currentProfile !== 'function') {
      throw new TypeError('Mobile camera autobind requires mobileContext.currentProfile().');
    }
    if (!cameraControllerModule || typeof cameraControllerModule.onCreated !== 'function') {
      throw new TypeError('Mobile camera autobind requires cameraControllerModule.onCreated().');
    }
    if (!runtimeModule || typeof runtimeModule.create !== 'function') {
      throw new TypeError('Mobile camera autobind requires runtimeModule.create().');
    }

    const resolveSurface = typeof options.resolveSurface === 'function'
      ? options.resolveSurface
      : () => documentLike.querySelector?.('#canvas-container canvas') || null;
    const MutationObserverClass = options.MutationObserver || windowLike?.MutationObserver || null;
    let started = false;
    let destroyed = false;
    let currentController = null;
    let currentRuntime = null;
    let unsubscribeCamera = null;
    let unsubscribeProfile = null;
    let surfaceObserver = null;

    function stopSurfaceObserver() {
      surfaceObserver?.disconnect?.();
      surfaceObserver = null;
    }

    function destroyRuntime() {
      if (!currentRuntime) return false;
      const runtime = currentRuntime;
      currentRuntime = null;
      runtime.destroy?.();
      return true;
    }

    function bindController(controller) {
      if (!started || destroyed || !controller) return false;
      currentController = controller;
      const surface = resolveSurface();
      if (!surface) {
        if (!surfaceObserver && MutationObserverClass) {
          surfaceObserver = new MutationObserverClass(() => {
            if (resolveSurface()) {
              stopSurfaceObserver();
              bindController(currentController);
            }
          });
          surfaceObserver.observe(documentLike.documentElement || documentLike.body, { childList: true, subtree: true });
        }
        return false;
      }

      stopSurfaceObserver();
      destroyRuntime();
      currentRuntime = runtimeModule.create({
        surface,
        window: windowLike,
        document: documentLike,
        mobileContext,
        cameraController: controller,
        movementThreshold: options.movementThreshold,
        orbitSensitivity: options.orbitSensitivity,
        zoomSensitivity: options.zoomSensitivity,
        minDistance: options.minDistance,
        maxDistance: options.maxDistance,
        tapEnabled: () => false,
        onCameraChanged: options.onCameraChanged,
        onCancel: options.onCancel,
        onStateChanged: options.onStateChanged,
        manageTouchAction: true
      });
      currentRuntime.bind();
      options.onBound?.({ controller, runtime: currentRuntime, surface });
      return true;
    }

    function refreshProfile(profile) {
      currentRuntime?.refreshEnabled?.();
      options.onProfileChanged?.(profile || mobileContext.currentProfile());
    }

    function start() {
      if (destroyed) throw new Error('Destroyed mobile camera autobind cannot be restarted.');
      if (started) return false;
      started = true;
      unsubscribeCamera = cameraControllerModule.onCreated(bindController);
      if (typeof mobileContext.subscribe === 'function') {
        unsubscribeProfile = mobileContext.subscribe(refreshProfile);
      }
      return true;
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      started = false;
      unsubscribeCamera?.();
      unsubscribeCamera = null;
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      stopSurfaceObserver();
      destroyRuntime();
      currentController = null;
      return true;
    }

    return Object.freeze({
      start,
      destroy,
      bindController,
      refreshProfile,
      bound: () => Boolean(currentRuntime),
      currentRuntime: () => currentRuntime,
      currentController: () => currentController
    });
  }

  return Object.freeze({ create });
});
