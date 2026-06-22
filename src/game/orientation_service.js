(() => {
  'use strict';

  window.VAW.define('game.orientation-service', [
    'foundation.orientation', 'foundation.blueprint', 'foundation.catalog'
  ], (Orientation, Blueprint, Catalog) => {
    const { ORIENTATION_BASES, DEFAULT_ORIENTATION, axisLabelForVector, findOrientationId } = Orientation;
    const { BLOCKS } = Catalog;

    function create({ THREE = window.THREE } = {}) {
      if (!THREE?.Vector3) throw new TypeError('Orientation service requires THREE.');

      function normalizeOrientationId(index) { return Orientation.normalizeOrientationId(index); }
      function partUsesOrientation(type) { return !!BLOCKS[type] && BLOCKS[type].orientationMode !== 'none'; }
      function partUsesRoll(type) { return !!BLOCKS[type] && BLOCKS[type].orientationMode === 'basis'; }
      function getModuleBasis(index) {
        const basis = ORIENTATION_BASES[normalizeOrientationId(index)];
        return {
          chord: basis.forward.clone(),
          normal: basis.up.clone(),
          span: basis.span.clone(),
          quaternion: basis.quaternion.clone()
        };
      }
      function getOrientationVector(index) { return getModuleBasis(index).chord; }
      function getOrientationUpVector(index) { return getModuleBasis(index).normal; }
      function getOrientationLabel(index) {
        const basis = getModuleBasis(index);
        return `${axisLabelForVector(basis.chord)} / UP ${axisLabelForVector(basis.normal)}`;
      }
      function axisColor(orientation) {
        const axis = getOrientationVector(orientation);
        if (Math.abs(axis.y) > 0.5) return 0x34d399;
        if (Math.abs(axis.z) > 0.5) return 0x60a5fa;
        return 0xff6b6b;
      }
      function normalizeControlAxis(value) { return Blueprint.normalizeControlAxis(value); }
      function normalizeControlSign(value) { return Blueprint.normalizeControlSign(value); }
      function controlAxisVector(axis) {
        if (axis === 'roll') return new THREE.Vector3(1, 0, 0);
        if (axis === 'yaw') return new THREE.Vector3(0, 1, 0);
        return new THREE.Vector3(0, 0, 1);
      }
      function controlSignLabel(sign) { return sign === 1 ? 'POSITIVE' : (sign === -1 ? 'NEGATIVE' : 'AUTO'); }
      function semanticOrientationReadout(type, index, controlAxis = 'pitch', controlSign = 0) {
        if (!partUsesOrientation(type)) return Object.freeze({ axisLabel: 'Axis', axis: 'N/A', upLabel: 'Up', up: 'N/A', hint: 'No orientation used' });
        const basis = getModuleBasis(index); const axis = axisLabelForVector(basis.chord); const up = axisLabelForVector(basis.normal);
        if (type === 'Core') return Object.freeze({ axisLabel: 'Forward', axis: `Forward ${axis}`, upLabel: 'Up', up: `Up ${up}`, hint: `Control frame • Forward ${axis} • Up ${up}` });
        if (type === 'Thruster') return Object.freeze({ axisLabel: 'Thrust', axis: `Thrust ${axis}`, upLabel: 'Up', up: 'N/A', hint: `Engine pushes along ${axis}` });
        if (type === 'Wing') return Object.freeze({ axisLabel: 'Chord', axis: `Chord ${axis}`, upLabel: 'Lift normal', up: `Lift ${up}`, hint: `Wing chord ${axis} • lift normal ${up}` });
        if (type === 'ControlSurface') return Object.freeze({ axisLabel: 'Chord', axis: `Chord ${axis}`, upLabel: 'Lift normal', up: `Lift ${up}`, hint: `${controlAxis.toUpperCase()} • ${controlSignLabel(controlSign)} • chord ${axis}` });
        if (type === 'VectorThruster') return Object.freeze({ axisLabel: 'Thrust', axis: `Thrust ${axis}`, upLabel: 'Gimbal normal', up: `Gimbal ${up}`, hint: `Vector thrust ${axis} • gimbal normal ${up}` });
        return Object.freeze({ axisLabel: 'Axis', axis, upLabel: 'Up', up, hint: `${axis} / up ${up}` });
      }
      function normalizeSavedOrientation(rawOrientation, version, type = 'Wing') {
        return Orientation.normalizeSavedOrientation(rawOrientation, version, type);
      }
      function mirrorOrientation(orientation, mirrorX, mirrorZ, type) {
        if (!partUsesOrientation(type)) return DEFAULT_ORIENTATION;
        const basis = getModuleBasis(orientation);
        if (mirrorX) {
          basis.chord.x *= -1;
          basis.normal.x *= -1;
        }
        if (mirrorZ) {
          basis.chord.z *= -1;
          basis.normal.z *= -1;
        }
        return findOrientationId(basis.chord, basis.normal);
      }

      return Object.freeze({
        normalizeOrientationId, partUsesOrientation, partUsesRoll,
        getModuleBasis, getOrientationVector, getOrientationUpVector, getOrientationLabel,
        axisColor, normalizeControlAxis, normalizeControlSign, controlAxisVector,
        controlSignLabel, semanticOrientationReadout, normalizeSavedOrientation, mirrorOrientation
      });
    }

    return Object.freeze({ create });
  });
})();
