'use strict';

(function registerMobileCameraGestureBridge(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-camera-gesture-bridge.js.');
  root.VAW.define('game.mobile-camera-gesture-bridge', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileCameraGestureBridgeModule() {
  function finite(value, fallback, name) {
    const numeric = value == null ? fallback : Number(value);
    if (!Number.isFinite(numeric)) throw new TypeError(`${name} must be a finite number.`);
    return numeric;
  }

  function requireFunction(value, name) {
    if (typeof value !== 'function') throw new TypeError(`${name} must be a function.`);
    return value;
  }

  function create(options = {}) {
    const cameraController = options.cameraController;
    if (!cameraController) throw new TypeError('Mobile camera gesture bridge requires a cameraController.');
    const orbitByPixels = requireFunction(cameraController.orbitCameraByPixels, 'cameraController.orbitCameraByPixels');
    const panByPixels = requireFunction(cameraController.panCameraTargetByPixels, 'cameraController.panCameraTargetByPixels');
    const zoomByPixels = requireFunction(cameraController.zoomCameraByPixels, 'cameraController.zoomCameraByPixels');
    const onChanged = typeof options.onChanged === 'function' ? options.onChanged : () => {};
    const orbitSensitivity = finite(options.orbitSensitivity, 0.008, 'orbitSensitivity');
    const zoomSensitivity = finite(options.zoomSensitivity, 0.02, 'zoomSensitivity');
    const minDistance = finite(options.minDistance, 6, 'minDistance');
    const maxDistance = finite(options.maxDistance, 55, 'maxDistance');
    if (orbitSensitivity < 0 || zoomSensitivity < 0) {
      throw new RangeError('Gesture sensitivities must be non-negative.');
    }
    if (minDistance <= 0 || maxDistance < minDistance) {
      throw new RangeError('Invalid camera distance range.');
    }

    function orbit(event = {}) {
      const dx = finite(event.dx, 0, 'orbit dx');
      const dy = finite(event.dy, 0, 'orbit dy');
      if (dx === 0 && dy === 0) return false;
      const changed = orbitByPixels(dx, dy, orbitSensitivity) !== false;
      if (changed) onChanged('orbit');
      return changed;
    }

    function pan(event = {}) {
      const dx = finite(event.dx, 0, 'pan dx');
      const dy = finite(event.dy, 0, 'pan dy');
      if (dx === 0 && dy === 0) return false;
      const changed = panByPixels(dx, dy) !== false;
      if (changed) onChanged('pan');
      return changed;
    }

    function zoom(event = {}) {
      const delta = finite(event.delta, 0, 'zoom delta');
      if (delta === 0) return false;
      const changed = zoomByPixels(delta, zoomSensitivity, minDistance, maxDistance) !== false;
      if (changed) onChanged('zoom');
      return changed;
    }

    return Object.freeze({ orbit, pan, zoom });
  }

  return Object.freeze({ create });
});
