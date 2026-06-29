(function (global, factory) {
  const api = factory(global.THREE || null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_FIT_CAMERA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (THREE) {
  'use strict';

  function plainBoundsFromBox(box, THREERef = THREE) {
    const size = box.getSize(new THREERef.Vector3());
    const center = box.getCenter(new THREERef.Vector3());
    return { box, size, center, maxDim: Math.max(size.x, size.y, size.z, 0.001), valid: Number.isFinite(box.min.x) && Number.isFinite(box.max.x) && !box.isEmpty() };
  }

  function computeObjectBounds(root, THREERef = THREE) {
    if (!root || !THREERef) return { valid: false, reason: 'no-root' };
    root.updateWorldMatrix?.(true, true);
    const box = new THREERef.Box3().setFromObject(root);
    const bounds = plainBoundsFromBox(box, THREERef);
    if (!bounds.valid) return { valid: false, reason: 'empty-or-non-finite-box', box };
    return bounds;
  }

  function distanceForBounds(camera, bounds, options = {}, THREERef = THREE) {
    const margin = options.margin || 1.75;
    const fov = THREERef.MathUtils ? THREERef.MathUtils.degToRad(camera.fov || 50) : ((camera.fov || 50) * Math.PI / 180);
    return Math.max(bounds.maxDim / (2 * Math.tan(fov / 2)) * margin, 0.05);
  }

  function applyCameraClip(camera, distance, bounds) {
    camera.near = Math.max(distance / 2000, 0.001);
    camera.far = Math.max(distance * 2000, bounds.maxDim * 1000, 1000);
    camera.updateProjectionMatrix?.();
  }

  function fitCameraToBounds(camera, controls, bounds, options = {}, THREERef = THREE) {
    if (!camera || !bounds || !bounds.valid || !THREERef) return null;
    const distance = distanceForBounds(camera, bounds, options, THREERef);
    const direction = new THREERef.Vector3(0.85, 0.55, 1.15).normalize();
    camera.position.copy(bounds.center).addScaledVector(direction, distance);
    applyCameraClip(camera, distance, bounds);
    if (controls && typeof controls.setTarget === 'function') controls.setTarget(bounds.center);
    else camera.lookAt?.(bounds.center);
    return { mode: 'reset-default-orientation', distance, near: camera.near, far: camera.far, center: bounds.center, size: bounds.size, maxDim: bounds.maxDim };
  }

  function frameCameraToBounds(camera, controls, bounds, options = {}, THREERef = THREE) {
    if (!camera || !bounds || !bounds.valid || !THREERef) return null;
    const distance = distanceForBounds(camera, bounds, options, THREERef);
    const currentTarget = controls && controls.target ? controls.target : bounds.center;
    const direction = new THREERef.Vector3().subVectors(camera.position, currentTarget);
    if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 0.000001) direction.set(0.85, 0.55, 1.15);
    direction.normalize();
    camera.position.copy(bounds.center).addScaledVector(direction, distance);
    applyCameraClip(camera, distance, bounds);
    if (controls && typeof controls.setTarget === 'function') controls.setTarget(bounds.center);
    else camera.lookAt?.(bounds.center);
    return { mode: 'frame-preserve-orientation', distance, near: camera.near, far: camera.far, center: bounds.center, size: bounds.size, maxDim: bounds.maxDim };
  }

  return Object.freeze({ computeObjectBounds, fitCameraToBounds, frameCameraToBounds, distanceForBounds });
});
