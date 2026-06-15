(() => {
  'use strict';

  window.VAW.define(
    'foundation.flight-control',
    ['foundation.input-profile', 'foundation.control-frame'],
    (InputProfile, ControlFrame) => {
    const AUXILIARY_ACTIONS = Object.freeze({
      'balloonPower-': Object.freeze({ target: 'balloonPower', direction: -1 }),
      'balloonPower+': Object.freeze({ target: 'balloonPower', direction: 1 })
    });

    function actionForInput(code = '', profile = InputProfile.createDefault()) {
      const action = InputProfile.actionForCode(profile, code);
      return action && !AUXILIARY_ACTIONS[action] ? action : null;
    }

    function adjustmentForInput(code = '', profile = InputProfile.createDefault()) {
      const action = InputProfile.actionForCode(profile, code);
      return AUXILIARY_ACTIONS[action] || null;
    }

    function keyboardLockCodes(profile = InputProfile.createDefault()) {
      return InputProfile.allBoundCodes(profile);
    }

    function pilotFromActions(actions, profile) {
      return InputProfile.pilotFromActions(actions, profile);
    }

    function pilotToBodyFrame(intent, controlFrame) {
      return ControlFrame.toBodyPilot(intent, controlFrame);
    }

    function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

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
      AUXILIARY_ACTIONS, actionForInput, adjustmentForInput, keyboardLockCodes,
      pilotFromActions, pilotToBodyFrame, neutralCommand, applyTranslationMix
    });
  });
})();
