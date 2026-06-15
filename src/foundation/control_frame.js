(() => {
  'use strict';

  window.VAW.define('foundation.control-frame', ['foundation.orientation'], orientation => {
    function vec(value, fallback = [0, 0, 0]) {
      if (Array.isArray(value)) return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
      if (value && typeof value === 'object') return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
      return [...fallback];
    }

    function basisForOrientation(orientationId) {
      const basis = orientation.ORIENTATION_BASES[orientation.normalizeOrientationId(orientationId)];
      return Object.freeze({
        forward: Object.freeze(vec(basis.forward)),
        up: Object.freeze(vec(basis.up)),
        right: Object.freeze(vec(basis.span))
      });
    }

    function fromCore(corePart) {
      const basis = basisForOrientation(corePart?.orientation ?? orientation.DEFAULT_ORIENTATION);
      return Object.freeze({
        source: corePart ? 'core' : 'default',
        sourcePartKey: corePart?.key || null,
        origin: Object.freeze(vec(corePart?.grid || corePart?.position || [0, 0, 0])),
        forward: basis.forward,
        up: basis.up,
        right: basis.right
      });
    }

    function combine(a, scalarA, b, scalarB, c, scalarC) {
      return [
        a[0] * scalarA + b[0] * scalarB + c[0] * scalarC,
        a[1] * scalarA + b[1] * scalarB + c[1] * scalarC,
        a[2] * scalarA + b[2] * scalarB + c[2] * scalarC
      ];
    }

    function toBodyPilot(intent, frame = fromCore(null)) {
      const controlFrame = frame || fromCore(null);
      const angular = combine(
        controlFrame.forward, Number(intent?.roll) || 0,
        controlFrame.up, Number(intent?.yaw) || 0,
        controlFrame.right, Number(intent?.pitch) || 0
      );
      const linear = combine(
        controlFrame.forward, Number(intent?.surge) || 0,
        controlFrame.up, Number(intent?.lift) || 0,
        controlFrame.right, Number(intent?.sway) || 0
      );
      return Object.freeze({
        pitch: angular[2],
        yaw: angular[1],
        roll: angular[0],
        surge: linear[0],
        lift: linear[1],
        sway: linear[2]
      });
    }

    return Object.freeze({ basisForOrientation, fromCore, toBodyPilot });
  });
})();
