(() => {
  'use strict';

  window.VAW.define('foundation.mass-properties', [], () => {
    const EPSILON = 1e-12;

    function finite(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    function vector(value, fallback = [0, 0, 0]) {
      if (Array.isArray(value)) {
        return [finite(value[0], fallback[0]), finite(value[1], fallback[1]), finite(value[2], fallback[2])];
      }
      return [
        finite(value?.x, fallback[0]),
        finite(value?.y, fallback[1]),
        finite(value?.z, fallback[2])
      ];
    }

    function positiveVector(value, fallback = [0.5, 0.5, 0.5]) {
      const result = vector(value, fallback);
      return result.map((component, index) => component > 0 ? component : fallback[index]);
    }

    function requireFinite(value, label) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`);
      return numeric;
    }

    function requireVector(value, label) {
      const source = Array.isArray(value)
        ? { x: value[0], y: value[1], z: value[2] }
        : value;
      if (!source || typeof source !== 'object') throw new TypeError(`${label} must be a 3D vector.`);
      return [
        requireFinite(source.x, `${label}.x`),
        requireFinite(source.y, `${label}.y`),
        requireFinite(source.z, `${label}.z`)
      ];
    }

    function boxInertiaDiagonal(massValue, halfExtentsValue = [0.5, 0.5, 0.5]) {
      const mass = Math.max(0, finite(massValue));
      const [hx, hy, hz] = positiveVector(halfExtentsValue);
      return [
        mass * (hy * hy + hz * hz) / 3,
        mass * (hx * hx + hz * hz) / 3,
        mass * (hx * hx + hy * hy) / 3
      ];
    }

    function normalizeElement(raw, index) {
      if (!raw || typeof raw !== 'object') throw new TypeError(`Mass element ${index} must be an object.`);
      const mass = requireFinite(raw.mass, `Mass element ${index}.mass`);
      if (mass < 0) throw new RangeError(`Mass element ${index}.mass cannot be negative.`);
      const center = requireVector(raw.center ?? raw.position, `Mass element ${index}.center`);
      const halfExtents = requireVector(raw.halfExtents ?? [0.5, 0.5, 0.5], `Mass element ${index}.halfExtents`);
      if (halfExtents.some(component => component <= 0)) {
        throw new RangeError(`Mass element ${index}.halfExtents must be greater than zero.`);
      }
      return Object.freeze({
        id: raw.id == null ? String(index) : String(raw.id),
        mass,
        center: Object.freeze(center),
        halfExtents: Object.freeze(halfExtents)
      });
    }

    function compute(rawElements) {
      if (!Array.isArray(rawElements)) throw new TypeError('Mass properties require an array of elements.');
      const elements = rawElements.map(normalizeElement).filter(element => element.mass > 0);
      function kahanAdd(state, value) {
        const corrected = value - state.compensation;
        const next = state.sum + corrected;
        state.compensation = (next - state.sum) - corrected;
        state.sum = next;
      }
      const massState = { sum: 0, compensation: 0 };
      const weightedState = Array.from({ length: 3 }, () => ({ sum: 0, compensation: 0 }));
      for (const element of elements) {
        kahanAdd(massState, element.mass);
        kahanAdd(weightedState[0], element.center[0] * element.mass);
        kahanAdd(weightedState[1], element.center[1] * element.mass);
        kahanAdd(weightedState[2], element.center[2] * element.mass);
      }
      const mass = massState.sum;
      const weighted = weightedState.map(state => state.sum);
      const centerOfMass = mass > EPSILON
        ? [weighted[0] / mass, weighted[1] / mass, weighted[2] / mass]
        : [0, 0, 0];
      const inertiaState = Array.from({ length: 3 }, () => ({ sum: 0, compensation: 0 }));
      const resolvedElements = elements.map(element => {
        const offset = [
          element.center[0] - centerOfMass[0],
          element.center[1] - centerOfMass[1],
          element.center[2] - centerOfMass[2]
        ];
        const local = boxInertiaDiagonal(element.mass, element.halfExtents);
        kahanAdd(inertiaState[0], local[0] + element.mass * (offset[1] ** 2 + offset[2] ** 2));
        kahanAdd(inertiaState[1], local[1] + element.mass * (offset[0] ** 2 + offset[2] ** 2));
        kahanAdd(inertiaState[2], local[2] + element.mass * (offset[0] ** 2 + offset[1] ** 2));
        return Object.freeze({ ...element, offset: Object.freeze(offset), localInertiaDiagonal: Object.freeze(local) });
      });
      const inertiaDiagonal = inertiaState.map(state => state.sum);
      return Object.freeze({
        mass,
        centerOfMass: Object.freeze(centerOfMass),
        inertiaDiagonal: Object.freeze(inertiaDiagonal),
        elements: Object.freeze(resolvedElements)
      });
    }

    function approximatelyEqual(a, b, epsilon = 1e-9) {
      return Math.abs(finite(a) - finite(b)) <= Math.max(0, finite(epsilon, 1e-9));
    }

    return Object.freeze({
      EPSILON,
      vector,
      boxInertiaDiagonal,
      compute,
      approximatelyEqual,
      requireVector
    });
  });
})();
