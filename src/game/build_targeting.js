(() => {
  'use strict';

  window.VAW.define('game.build-targeting', [], () => {
    const DEFAULT_SNAP_OPTIONS = Object.freeze({ minLengthSq: 1e-8, minDominance: 0.55 });

    function targetOk(payload = {}) {
      return Object.freeze({ ...payload, ok: true });
    }

    function targetFail(reason, details = {}) {
      return Object.freeze({ ok: false, reason: String(reason || 'target-failed'), details: Object.freeze({ ...details }) });
    }

    function vectorArray(vectorLike) {
      const normalize = value => (Object.is(Number(value), -0) ? 0 : Number(value));
      if (Array.isArray(vectorLike)) return vectorLike.map(normalize);
      return [normalize(vectorLike?.x), normalize(vectorLike?.y), normalize(vectorLike?.z)];
    }

    function snapDominantAxis3(vectorLike, options = {}) {
      const [x, y, z] = vectorArray(vectorLike);
      if (![x, y, z].every(Number.isFinite)) return targetFail('invalid-normal', { vector: [x, y, z] });
      const lengthSq = x * x + y * y + z * z;
      const settings = { ...DEFAULT_SNAP_OPTIONS, ...options };
      if (lengthSq < settings.minLengthSq) return targetFail('invalid-normal', { vector: [x, y, z], lengthSq });
      const length = Math.sqrt(lengthSq);
      const values = [x, y, z];
      let axisIndex = 0;
      for (let index = 1; index < 3; index += 1) {
        if (Math.abs(values[index]) > Math.abs(values[axisIndex])) axisIndex = index;
      }
      if (Math.abs(values[axisIndex]) / length < settings.minDominance) return targetFail('invalid-normal', { vector: [x, y, z], lengthSq });
      const axis = [0, 0, 0];
      axis[axisIndex] = values[axisIndex] < 0 ? -1 : 1;
      return targetOk({ axis: Object.freeze(axis), gridNormal: Object.freeze(axis), source: Object.freeze([x, y, z]) });
    }

    function placementCellFromNormal(clickedBlock, gridNormal) {
      const [dx, dy, dz] = vectorArray(gridNormal);
      return Object.freeze({
        assemblySpaceId: clickedBlock?.assemblySpaceId,
        x: Number(clickedBlock?.x) + dx,
        y: Number(clickedBlock?.y) + dy,
        z: Number(clickedBlock?.z) + dz
      });
    }

    function sceneNormalToActiveGridNormal(sceneNormal, activeAssemblySpaceId, rootVectorToSpace, options = {}) {
      if (typeof rootVectorToSpace !== 'function') return targetFail('invalid-normal', { reason: 'missing-rootVectorToSpace' });
      const sceneNormalArray = vectorArray(sceneNormal);
      let activeSpaceNormal;
      try {
        activeSpaceNormal = vectorArray(rootVectorToSpace(activeAssemblySpaceId, sceneNormalArray));
      } catch (error) {
        return targetFail('invalid-normal', { reason: error?.message || String(error), sceneNormal: sceneNormalArray });
      }
      const snapped = snapDominantAxis3(activeSpaceNormal, options);
      if (!snapped.ok) return targetFail(snapped.reason, { ...snapped.details, sceneNormal: sceneNormalArray, activeSpaceNormal });
      return targetOk({
        sceneNormal: Object.freeze(sceneNormalArray),
        activeSpaceNormal: Object.freeze(activeSpaceNormal),
        gridNormal: snapped.gridNormal,
        axis: snapped.axis
      });
    }

    return Object.freeze({
      snapDominantAxis3,
      placementCellFromNormal,
      targetOk,
      targetFail,
      sceneNormalToActiveGridNormal
    });
  });
})();
