(() => {
  'use strict';

  window.VAW.define('foundation.transform-math', [], () => {
    const EPSILON = 1e-12;
    function finite(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }
    function clean(value) {
      const number = finite(value);
      return Object.is(number, -0) || Math.abs(number) < EPSILON ? 0 : number;
    }
    function vec3(value = [0, 0, 0]) {
      if (Array.isArray(value)) return [clean(value[0]), clean(value[1]), clean(value[2])];
      return [clean(value?.x), clean(value?.y), clean(value?.z)];
    }
    function quaternion(value = [0, 0, 0, 1]) {
      const raw = Array.isArray(value)
        ? [finite(value[0]), finite(value[1]), finite(value[2]), finite(value[3], 1)]
        : [finite(value?.x), finite(value?.y), finite(value?.z), finite(value?.w, 1)];
      const length = Math.hypot(...raw) || 1;
      const normalized = raw.map(component => clean(component / length));
      const pivot = [...normalized].reverse().find(component => Math.abs(component) > EPSILON) ?? 1;
      const sign = pivot < 0 ? -1 : 1;
      return normalized.map(component => clean(component * sign));
    }

    function requireVec3(value, label = 'Vector') {
      const raw = Array.isArray(value)
        ? [value[0], value[1], value[2]]
        : [value?.x, value?.y, value?.z];
      if (!value || raw.some(component => !Number.isFinite(Number(component)))) {
        throw new TypeError(`${label} must be a finite 3D vector.`);
      }
      return Object.freeze(raw.map(component => clean(Number(component))));
    }

    function requireQuaternion(value, label = 'Quaternion') {
      const raw = Array.isArray(value)
        ? [value[0], value[1], value[2], value[3]]
        : [value?.x, value?.y, value?.z, value?.w];
      if (!value || raw.some(component => !Number.isFinite(Number(component)))) {
        throw new TypeError(`${label} must contain four finite components.`);
      }
      const numeric = raw.map(Number);
      if (!(Math.hypot(...numeric) > EPSILON)) throw new RangeError(`${label} must have non-zero length.`);
      return Object.freeze(quaternion(numeric));
    }

    function requirePose(value, label = 'Pose') {
      if (!value || typeof value !== 'object') throw new TypeError(`${label} must be an object.`);
      return Object.freeze({
        position: requireVec3(value.position, `${label}.position`),
        quaternion: requireQuaternion(value.quaternion, `${label}.quaternion`)
      });
    }
    function add(a, b) { return [clean(a[0] + b[0]), clean(a[1] + b[1]), clean(a[2] + b[2])]; }
    function sub(a, b) { return [clean(a[0] - b[0]), clean(a[1] - b[1]), clean(a[2] - b[2])]; }
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
        clean(v[0] + 2 * (uv[0] * q[3] + uuv[0])),
        clean(v[1] + 2 * (uv[1] * q[3] + uuv[1])),
        clean(v[2] + 2 * (uv[2] * q[3] + uuv[2]))
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
      const inverseQ = quaternion([-q[0], -q[1], -q[2], q[3]]);
      return Object.freeze({
        position: Object.freeze(rotateVector(inverseQ, [-position[0], -position[1], -position[2]])),
        quaternion: Object.freeze(inverseQ)
      });
    }
    function transformPoint(pose, point) { return add(vec3(pose?.position), rotateVector(pose?.quaternion, point)); }
    function inverseTransformPoint(pose, point) { return transformPoint(inversePose(pose), point); }

    return Object.freeze({ EPSILON, clean, vec3, quaternion, requireVec3, requireQuaternion, requirePose, add, sub, rotateVector, composePose, inversePose, transformPoint, inverseTransformPoint });
  });
})();
