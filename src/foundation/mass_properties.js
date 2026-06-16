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
      const mass = Math.max(0, finite(raw?.mass));
      return Object.freeze({
        id: raw?.id == null ? String(index) : String(raw.id),
        mass,
        center: Object.freeze(vector(raw?.center || raw?.position)),
        halfExtents: Object.freeze(positiveVector(raw?.halfExtents))
      });
    }

    function compute(rawElements) {
      if (!Array.isArray(rawElements)) throw new TypeError('Mass properties require an array of elements.');
      const elements = rawElements.map(normalizeElement).filter(element => element.mass > 0);
      let mass = 0;
      const weighted = [0, 0, 0];
      for (const element of elements) {
        mass += element.mass;
        weighted[0] += element.center[0] * element.mass;
        weighted[1] += element.center[1] * element.mass;
        weighted[2] += element.center[2] * element.mass;
      }
      const centerOfMass = mass > EPSILON
        ? [weighted[0] / mass, weighted[1] / mass, weighted[2] / mass]
        : [0, 0, 0];
      const inertiaDiagonal = [0, 0, 0];
      const resolvedElements = elements.map(element => {
        const offset = [
          element.center[0] - centerOfMass[0],
          element.center[1] - centerOfMass[1],
          element.center[2] - centerOfMass[2]
        ];
        const local = boxInertiaDiagonal(element.mass, element.halfExtents);
        inertiaDiagonal[0] += local[0] + element.mass * (offset[1] ** 2 + offset[2] ** 2);
        inertiaDiagonal[1] += local[1] + element.mass * (offset[0] ** 2 + offset[2] ** 2);
        inertiaDiagonal[2] += local[2] + element.mass * (offset[0] ** 2 + offset[1] ** 2);
        return Object.freeze({ ...element, offset: Object.freeze(offset), localInertiaDiagonal: Object.freeze(local) });
      });
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
      approximatelyEqual
    });
  });
})();
