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

    function reportError(error, phase) {
      try {
        if (typeof options.onError === 'function') options.onError(error, { phase });
        else console.error(`[mobile-camera-autobind] ${phase} failed.`, error);
      } catch (reportingError) {
        console.error('[mobile-camera-autobind] error reporter failed.', reportingError, error);
      }
    }

    function stopSurfaceObserver() {
      try {
        surfaceObserver?.disconnect?.();
      } catch (error) {
        reportError(error, 'surface-observer-disconnect');
      }
      surfaceObserver = null;
    }

    function destroyRuntime() {
      if (!currentRuntime) return false;
      const runtime = currentRuntime;
      currentRuntime = null;
      try {
        runtime.destroy?.();
      } catch (error) {
        reportError(error, 'runtime-destroy');
      }
      return true;
    }

    function observeSurface() {
      if (surfaceObserver || !MutationObserverClass) return false;
      try {
        surfaceObserver = new MutationObserverClass(() => {
          let available = false;
          try { available = Boolean(resolveSurface()); }
          catch (error) { reportError(error, 'surface-resolve'); }
          if (available) {
            stopSurfaceObserver();
            bindController(currentController);
          }
        });
        surfaceObserver.observe(documentLike.documentElement || documentLike.body, { childList: true, subtree: true });
        return true;
      } catch (error) {
        surfaceObserver = null;
        reportError(error, 'surface-observer-start');
        return false;
      }
    }

    function bindController(controller) {
      if (!started || destroyed || !controller) return false;
      currentController = controller;
      let surface = null;
      try {
        surface = resolveSurface();
      } catch (error) {
        reportError(error, 'surface-resolve');
        return false;
      }
      if (!surface) {
        observeSurface();
        return false;
      }

      stopSurfaceObserver();
      destroyRuntime();
      let candidateRuntime = null;
      try {
        candidateRuntime = runtimeModule.create({
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
        if (!candidateRuntime || typeof candidateRuntime.bind !== 'function') {
          throw new TypeError('Mobile camera runtime factory returned an invalid runtime.');
        }
        if (candidateRuntime.bind() === false) {
          throw new Error('Mobile camera runtime refused its initial bind.');
        }
        currentRuntime = candidateRuntime;
      } catch (error) {
        try { candidateRuntime?.destroy?.(); }
        catch (cleanupError) { reportError(cleanupError, 'failed-runtime-cleanup'); }
        currentRuntime = null;
        reportError(error, 'runtime-bind');
        return false;
      }

      try {
        options.onBound?.({ controller, runtime: currentRuntime, surface });
      } catch (error) {
        reportError(error, 'on-bound-callback');
      }
      return true;
    }

    function refreshProfile(profile) {
      try {
        currentRuntime?.refreshEnabled?.();
      } catch (error) {
        reportError(error, 'profile-refresh');
      }
      try {
        options.onProfileChanged?.(profile || mobileContext.currentProfile());
      } catch (error) {
        reportError(error, 'profile-callback');
      }
    }

    function start() {
      if (destroyed) throw new Error('Destroyed mobile camera autobind cannot be restarted.');
      if (started) return false;
      started = true;
      try {
        unsubscribeCamera = cameraControllerModule.onCreated(bindController);
        if (typeof mobileContext.subscribe === 'function') {
          unsubscribeProfile = mobileContext.subscribe(refreshProfile);
        }
      } catch (error) {
        reportError(error, 'subscription-start');
      }
      return true;
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      started = false;
      try { unsubscribeCamera?.(); } catch (error) { reportError(error, 'camera-unsubscribe'); }
      unsubscribeCamera = null;
      try { unsubscribeProfile?.(); } catch (error) { reportError(error, 'profile-unsubscribe'); }
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
