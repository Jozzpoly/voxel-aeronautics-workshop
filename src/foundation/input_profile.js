(() => {
  'use strict';

  window.VAW.define('foundation.input-profile', [], () => {
    const AXES = Object.freeze(['pitch', 'yaw', 'roll', 'surge', 'sway', 'lift']);
    const PROFILE_VERSION = 2;
    const BINDING_SLOTS = 2;

    const BINDABLE_ACTIONS = Object.freeze([
      'surge+', 'surge-', 'sway-', 'sway+', 'lift+', 'lift-',
      'pitch+', 'pitch-', 'yaw+', 'yaw-', 'roll-', 'roll+',
      'balloonPower-', 'balloonPower+'
    ]);

    const ACTION_LABELS = Object.freeze({
      'surge+': 'Forward',
      'surge-': 'Reverse',
      'sway-': 'Strafe left',
      'sway+': 'Strafe right',
      'lift+': 'Ascend',
      'lift-': 'Descend',
      'pitch+': 'Pitch up',
      'pitch-': 'Pitch down',
      'yaw+': 'Yaw left',
      'yaw-': 'Yaw right',
      'roll-': 'Roll left',
      'roll+': 'Roll right',
      'balloonPower-': 'Balloon power −',
      'balloonPower+': 'Balloon power +'
    });

    const DEFAULT_BINDINGS = Object.freeze({
      'surge+': Object.freeze(['KeyW']),
      'surge-': Object.freeze(['KeyS']),
      'sway-': Object.freeze(['KeyZ']),
      'sway+': Object.freeze(['KeyC']),
      'lift+': Object.freeze(['Space']),
      'lift-': Object.freeze(['ControlLeft']),
      'pitch+': Object.freeze(['ArrowUp']),
      'pitch-': Object.freeze(['ArrowDown']),
      'yaw+': Object.freeze(['KeyA', 'ArrowLeft']),
      'yaw-': Object.freeze(['KeyD', 'ArrowRight']),
      'roll-': Object.freeze(['KeyQ']),
      'roll+': Object.freeze(['KeyE']),
      'balloonPower-': Object.freeze(['Comma']),
      'balloonPower+': Object.freeze(['Period'])
    });

    const DEFAULT_AXIS_SETTINGS = Object.freeze({
      pitch: Object.freeze({ invert: true, sensitivity: 1, deadzone: 0, expo: 0 }),
      yaw: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      roll: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      surge: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      sway: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 }),
      lift: Object.freeze({ invert: false, sensitivity: 1, deadzone: 0, expo: 0 })
    });

    const CODE_LABELS = Object.freeze({
      Space: 'Space', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
      ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
      AltLeft: 'Left Alt', AltRight: 'Right Alt',
      MetaLeft: 'Left Meta', MetaRight: 'Right Meta',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
      Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Slash: '/', Backslash: '\\',
      BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
      Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
      PageUp: 'Page Up', PageDown: 'Page Down', Home: 'Home', End: 'End'
    });

    const MODIFIER_CODES = new Set([
      'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
      'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'
    ]);

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

    function isValidCode(code) {
      return typeof code === 'string' && code.length > 0 && code.length <= 40 && /^[A-Za-z0-9]+$/.test(code);
    }

    function normalizeBindingList(raw, fallback = []) {
      const source = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : fallback);
      const result = [];
      for (const code of source) {
        if (!isValidCode(code) || result.includes(code)) continue;
        result.push(code);
        if (result.length >= BINDING_SLOTS) break;
      }
      return result;
    }

    function normalizeBindings(raw) {
      const bindings = {};
      const claimed = new Set();
      for (const action of BINDABLE_ACTIONS) {
        const requested = normalizeBindingList(raw?.[action], DEFAULT_BINDINGS[action]);
        const accepted = [];
        for (const code of requested) {
          if (claimed.has(code)) continue;
          accepted.push(code);
          claimed.add(code);
        }
        bindings[action] = Object.freeze(accepted);
      }
      return Object.freeze(bindings);
    }

    function normalize(raw) {
      const axes = {};
      for (const axis of AXES) axes[axis] = normalizeAxisSettings(raw?.axes?.[axis], DEFAULT_AXIS_SETTINGS[axis]);
      return Object.freeze({
        version: PROFILE_VERSION,
        name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Default',
        axes: Object.freeze(axes),
        bindings: normalizeBindings(raw?.bindings)
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
      for (const axis of AXES) result[axis] = processAxis(actionValue(active, axis), normalized.axes[axis]);
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

    function actionForCode(profile, code) {
      if (!isValidCode(code)) return null;
      const normalized = normalize(profile);
      for (const action of BINDABLE_ACTIONS) {
        if (normalized.bindings[action].includes(code)) return action;
      }
      return null;
    }

    function updateBinding(profile, action, slot, code) {
      if (!BINDABLE_ACTIONS.includes(action)) return normalize(profile);
      const normalized = normalize(profile);
      const slotIndex = Math.max(0, Math.min(BINDING_SLOTS - 1, Number(slot) || 0));
      const next = {};
      for (const candidate of BINDABLE_ACTIONS) next[candidate] = [...normalized.bindings[candidate]];

      if (isValidCode(code)) {
        for (const candidate of BINDABLE_ACTIONS) {
          next[candidate] = next[candidate].filter(existing => existing !== code);
        }
      }

      while (next[action].length <= slotIndex) next[action].push('');
      next[action][slotIndex] = isValidCode(code) ? code : '';
      next[action] = next[action].filter(Boolean).slice(0, BINDING_SLOTS);
      return normalize({ ...normalized, bindings: next });
    }

    function clearBinding(profile, action, slot) {
      return updateBinding(profile, action, slot, '');
    }

    function formatCode(code) {
      if (!code) return 'Unbound';
      if (CODE_LABELS[code]) return CODE_LABELS[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit[0-9]$/.test(code)) return code.slice(5);
      if (/^Numpad/.test(code)) return code.replace('Numpad', 'Num ');
      return code;
    }

    function allBoundCodes(profile) {
      const normalized = normalize(profile);
      return Object.freeze([...new Set(BINDABLE_ACTIONS.flatMap(action => normalized.bindings[action]))]);
    }

    function bindingWarnings(profile) {
      const normalized = normalize(profile);
      const warnings = [];
      const descentCodes = normalized.bindings['lift-'];
      if (descentCodes.some(code => code === 'ShiftLeft' || code === 'ShiftRight')) {
        warnings.push('Shift used for descent can trigger Windows Sticky Keys when tapped repeatedly.');
      }
      if (descentCodes.some(code => code === 'ControlLeft' || code === 'ControlRight')) {
        warnings.push('Ctrl works as descent, but Ctrl+W and other browser-reserved chords are only reliable in Flight Focus.');
      }
      const modifierBindings = BINDABLE_ACTIONS.filter(action => normalized.bindings[action].some(code => MODIFIER_CODES.has(code)));
      if (modifierBindings.some(action => action !== 'lift-')) {
        warnings.push('Modifier keys can collide with browser or operating-system shortcuts.');
      }
      const unbound = BINDABLE_ACTIONS.filter(action => normalized.bindings[action].length === 0);
      if (unbound.length) warnings.push(`${unbound.length} flight command${unbound.length === 1 ? ' is' : 's are'} unbound.`);
      return Object.freeze(warnings);
    }

    return Object.freeze({
      AXES, PROFILE_VERSION, BINDING_SLOTS, BINDABLE_ACTIONS, ACTION_LABELS,
      DEFAULT_AXIS_SETTINGS, DEFAULT_BINDINGS, MODIFIER_CODES,
      createDefault, normalize, processAxis, pilotFromActions, updateAxis,
      actionForCode, updateBinding, clearBinding, formatCode, allBoundCodes, bindingWarnings
    });
  });
})();
