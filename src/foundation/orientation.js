(() => {
  'use strict';

  window.VAW.define('foundation.orientation', ['foundation.config'], config => {
    const AXES = config.AXIS_VECTORS.map(([x, y, z]) => Object.freeze(new THREE.Vector3(x, y, z)));
    const ORIENTATION_BASES = [];

    for (const forwardSource of AXES) {
      for (const upSource of AXES) {
        if (Math.abs(forwardSource.dot(upSource)) > 0.001) continue;
        const forward = forwardSource.clone();
        const up = upSource.clone();
        const span = forward.clone().cross(up).normalize();
        const matrix = new THREE.Matrix4().makeBasis(forward, up, span);
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
        Object.freeze(forward);
        Object.freeze(up);
        Object.freeze(span);
        Object.freeze(quaternion);
        ORIENTATION_BASES.push(Object.freeze({ forward, up, span, quaternion }));
      }
    }

    if (ORIENTATION_BASES.length !== 24) {
      throw new Error(`Orientation basis generation produced ${ORIENTATION_BASES.length}, expected 24.`);
    }

    function axisLabelForVector(vector) {
      let bestIndex = 0;
      let bestDot = -Infinity;
      for (let index = 0; index < AXES.length; index++) {
        const dot = vector.dot(AXES[index]);
        if (dot > bestDot) { bestDot = dot; bestIndex = index; }
      }
      return config.AXIS_LABELS[bestIndex];
    }

    function findOrientationId(forward, up) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < ORIENTATION_BASES.length; index++) {
        const basis = ORIENTATION_BASES[index];
        const score = basis.forward.dot(forward) * 2 + basis.up.dot(up);
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      return bestIndex;
    }

    function normalizeOrientationId(index) {
      const count = ORIENTATION_BASES.length;
      const numeric = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
      return ((numeric % count) + count) % count;
    }

    const DEFAULT_ORIENTATION = findOrientationId(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0)
    );
    const LEGACY_ORIENTATION_MAP = [
      findOrientationId(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)),
      findOrientationId(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)),
      findOrientationId(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
      findOrientationId(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)),
      findOrientationId(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)),
      findOrientationId(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0))
    ];

    function normalizeSavedOrientation(rawOrientation, version, type = 'Wing') {
      const raw = Number(rawOrientation);
      if (!Number.isFinite(raw)) return DEFAULT_ORIENTATION;
      const orientation = Math.trunc(raw);
      if (version <= 4 && orientation >= 0 && orientation < LEGACY_ORIENTATION_MAP.length) {
        return LEGACY_ORIENTATION_MAP[orientation];
      }
      if (type === 'Core' && version <= 8) return DEFAULT_ORIENTATION;
      return normalizeOrientationId(orientation);
    }

    return {
      AXES: Object.freeze(AXES),
      ORIENTATION_BASES: Object.freeze(ORIENTATION_BASES),
      DEFAULT_ORIENTATION,
      LEGACY_ORIENTATION_MAP: Object.freeze(LEGACY_ORIENTATION_MAP),
      axisLabelForVector,
      findOrientationId,
      normalizeOrientationId,
      normalizeSavedOrientation
    };
  });
})();
