(() => {
  'use strict';

  window.VAW.define('foundation.transform-math', [], () => {
    function finite(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }
    function vec3(value = [0, 0, 0]) {
      if (Array.isArray(value)) return [finite(value[0]), finite(value[1]), finite(value[2])];
      return [finite(value?.x), finite(value?.y), finite(value?.z)];
    }
    function quaternion(value = [0, 0, 0, 1]) {
      const raw = Array.isArray(value)
        ? [finite(value[0]), finite(value[1]), finite(value[2]), finite(value[3], 1)]
        : [finite(value?.x), finite(value?.y), finite(value?.z), finite(value?.w, 1)];
      const length = Math.hypot(...raw) || 1;
      return raw.map(component => component / length);
    }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function multiplyQuaternion(aValue, bValue) {
      const a = quaternion(aValue); const b = quaternion(bValue);
      return quaternion([
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
      ]);
    }
    function rotateVector(qValue, vectorValue) {
      const q = quaternion(qValue); const v = vec3(vectorValue);
      const qv = [q[0], q[1], q[2]];
      const uv = [
        qv[1] * v[2] - qv[2] * v[1],
        qv[2] * v[0] - qv[0] * v[2],
        qv[0] * v[1] - qv[1] * v[0]
      ];
      const uuv = [
        qv[1] * uv[2] - qv[2] * uv[1],
        qv[2] * uv[0] - qv[0] * uv[2],
        qv[0] * uv[1] - qv[1] * uv[0]
      ];
      return [
        v[0] + 2 * (uv[0] * q[3] + uuv[0]),
        v[1] + 2 * (uv[1] * q[3] + uuv[1]),
        v[2] + 2 * (uv[2] * q[3] + uuv[2])
      ];
    }
    function composePose(parentValue = {}, localValue = {}) {
      const parentPosition = vec3(parentValue.position);
      const parentQuaternion = quaternion(parentValue.quaternion);
      const localPosition = vec3(localValue.position);
      const localQuaternion = quaternion(localValue.quaternion);
      return Object.freeze({
        position: Object.freeze(add(parentPosition, rotateVector(parentQuaternion, localPosition))),
        quaternion: Object.freeze(multiplyQuaternion(parentQuaternion, localQuaternion))
      });
    }
    function inversePose(value = {}) {
      const position = vec3(value.position);
      const q = quaternion(value.quaternion);
      const inverseQ = [-q[0], -q[1], -q[2], q[3]];
      return Object.freeze({
        position: Object.freeze(rotateVector(inverseQ, [-position[0], -position[1], -position[2]])),
        quaternion: Object.freeze(inverseQ)
      });
    }
    function transformPoint(pose, point) { return add(vec3(pose?.position), rotateVector(pose?.quaternion, point)); }
    function inverseTransformPoint(pose, point) { return transformPoint(inversePose(pose), point); }

    return Object.freeze({ vec3, quaternion, add, sub, rotateVector, composePose, inversePose, transformPoint, inverseTransformPoint });
  });
})();
