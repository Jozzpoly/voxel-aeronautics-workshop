(() => {
  'use strict';

  window.VAW.define('foundation.input-profile', [], () => {
    const AXES = Object.freeze(['pitch', 'yaw', 'roll', 'surge', 'sway', 'lift']);
    const PROFILE_VERSION = 1;

    const DEFAULT_AXIS_SETTINGS = Object.freeze({
      pitch: Object.freeze({ invert: true, sensitivity: 1, deadzone: 0, expo: 0 }),
      yaw: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      roll: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      surge: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      sway: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      lift: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 })
    });

    function clamp(value, min, max) {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
    }

    function normalizeAxisSettings(raw, fallback) {
      return Object.freeze({
        invert: typeof raw?.invert === 'boolean' ? raw.invert : fallback.invert,
        sensitivity: clamp(raw?.sensitivity ?? fallback.sensitivity, 0.1, 2),
        deadzone: clamp(raw?.deadzone ?? fallback.deadzone, 0, 0.5),
        expo: clamp(raw?.expo ?? fallback.expo, 0, 1)
      });
    }

    function normalize(raw) {
      const axes = {};
      for (const axis of AXES) {
        axes[axis] = normalizeAxisSettings(raw?.axes?.[axis], DEFAULT_AXIS_SETTINGS[axis]);
      }
      return Object.freeze({
        version: PROFILE_VERSION,
        name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Default',
        axes: Object.freeze(axes)
      });
    }

    function createDefault() { return normalize(null); }

    function actionValue(actions, axis) {
      return (actions.has(`${axis}+`) ? 1 : 0) - (actions.has(`${axis}-`) ? 1 : 0);
    }

    function processAxis(value, settings) {
      let result = clamp(value, -1, 1);
      if (Math.abs(result) <= settings.deadzone) result = 0;
      else {
        const magnitude = (Math.abs(result) - settings.deadzone) / Math.max(0.0001, 1 - settings.deadzone);
        const curved = magnitude * (1 - settings.expo) + magnitude ** 3 * settings.expo;
        result = Math.sign(result) * curved;
      }
      result *= settings.sensitivity;
      if (settings.invert) result *= -1;
      if (Object.is(result, -0) || result === 0) return 0;
      return clamp(result, -1, 1);
    }

    function pilotFromActions(actions, profile = createDefault()) {
      const active = actions instanceof Set ? actions : new Set(actions || []);
      const normalized = normalize(profile);
      const result = {};
      for (const axis of AXES) {
        result[axis] = processAxis(actionValue(active, axis), normalized.axes[axis]);
      }
      return Object.freeze(result);
    }

    function updateAxis(profile, axis, patch) {
      if (!AXES.includes(axis)) return normalize(profile);
      const normalized = normalize(profile);
      return normalize({
        ...normalized,
        axes: {
          ...normalized.axes,
          [axis]: { ...normalized.axes[axis], ...(patch || {}) }
        }
      });
    }

    return Object.freeze({
      AXES, PROFILE_VERSION, DEFAULT_AXIS_SETTINGS,
      createDefault, normalize, processAxis, pilotFromActions, updateAxis
    });
  });
})();
