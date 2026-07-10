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
    const state = options.state;
    if (!state?.camera) throw new TypeError('Mobile camera gesture bridge requires camera state.');
    const clampPitch = requireFunction(options.clampPitch, 'clampPitch');
    const panByPixels = requireFunction(options.panByPixels, 'panByPixels');
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
      state.camera.yaw = finite(state.camera.yaw, 0, 'camera yaw') - dx * orbitSensitivity;
      state.camera.pitch = clampPitch(finite(state.camera.pitch, 0, 'camera pitch') - dy * orbitSensitivity);
      onChanged('orbit');
      return true;
    }

    function pan(event = {}) {
      const dx = finite(event.dx, 0, 'pan dx');
      const dy = finite(event.dy, 0, 'pan dy');
      if (dx === 0 && dy === 0) return false;
      panByPixels(dx, dy);
      onChanged('pan');
      return true;
    }

    function zoom(event = {}) {
      const delta = finite(event.delta, 0, 'zoom delta');
      if (delta === 0) return false;
      const current = finite(state.camera.distance, minDistance, 'camera distance');
      state.camera.distance = Math.max(minDistance, Math.min(maxDistance, current - delta * zoomSensitivity));
      onChanged('zoom');
      return true;
    }

    return Object.freeze({ orbit, pan, zoom });
  }

  return Object.freeze({ create });
});
