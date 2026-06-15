(() => {
  'use strict';

  window.VAW.define(
    'foundation.flight-control',
    ['foundation.input-profile', 'foundation.control-frame'],
    (InputProfile, ControlFrame) => {
    const KEY_BINDINGS = Object.freeze({
      w: 'surge+',
      s: 'surge-',
      arrowup: 'pitch+',
      arrowdown: 'pitch-',
      a: 'yaw+',
      arrowleft: 'yaw+',
      d: 'yaw-',
      arrowright: 'yaw-',
      q: 'roll-',
      e: 'roll+',
      z: 'sway-',
      c: 'sway+'
    });
    const CODE_BINDINGS = Object.freeze({
      Space: 'lift+',
      ControlLeft: 'lift-',
      ControlRight: 'lift-'
    });

    function actionForInput(key = '', code = '') {
      return CODE_BINDINGS[code] || KEY_BINDINGS[String(key).toLowerCase()] || null;
    }

    function pilotFromActions(actions, profile) {
      return InputProfile.pilotFromActions(actions, profile);
    }

    function pilotToBodyFrame(intent, controlFrame) {
      return ControlFrame.toBodyPilot(intent, controlFrame);
    }

    function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

    // The slider defines passive thrust only for engines pointing toward local +Y.
    // It is not a player-input ceiling. Horizontal and downward-facing engines
    // stay idle until the pilot or rotational mixer explicitly requests them.
    function neutralCommand(localAxis, passivePower = 1) {
      const axisVector = Array.isArray(localAxis)
        ? localAxis
        : [Number(localAxis?.x) || 0, Number(localAxis?.y) || 0, Number(localAxis?.z) || 0];
      const passive = clamp01(passivePower);
      return Math.max(0, axisVector[1]) * passive;
    }

    function applyTranslationMix(localAxis, pilot, baseCommand, gain = 1) {
      const axisVector = Array.isArray(localAxis)
        ? localAxis
        : [Number(localAxis?.x) || 0, Number(localAxis?.y) || 0, Number(localAxis?.z) || 0];
      const desired = [Number(pilot?.surge) || 0, Number(pilot?.lift) || 0, Number(pilot?.sway) || 0];
      const length = Math.hypot(desired[0], desired[1], desired[2]);
      const base = clamp01(baseCommand);
      if (length < 0.0001) return base;
      const divisor = Math.max(1, length);
      const score = Math.max(-1, Math.min(1,
        axisVector[0] * desired[0] / divisor +
        axisVector[1] * desired[1] / divisor +
        axisVector[2] * desired[2] / divisor
      ));
      const authority = clamp01(gain);
      const headroom = score >= 0 ? (1 - base) : base;
      return clamp01(base + score * headroom * authority);
    }

    return Object.freeze({
      KEY_BINDINGS, CODE_BINDINGS, actionForInput, pilotFromActions, pilotToBodyFrame,
      neutralCommand, applyTranslationMix
    });
  });
})();
