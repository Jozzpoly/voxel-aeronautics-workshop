const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const THREE = require(path.join(ROOT, 'vendor/three-r128/three.min.js'));
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/kernel.js'), 'utf8'), { filename: 'kernel.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/game/camera_controller.js'), 'utf8'), { filename: 'camera_controller.js' });

const CameraController = VAW.require('game.camera-controller');
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
const state = {
  mode: 'BUILD',
  camera: {
    target: new THREE.Vector3(0, 0, 0),
    targetOffset: new THREE.Vector3(0, 0, 0),
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    distance: 18,
    defaultTarget: new THREE.Vector3(0, 0, 0),
    defaultYaw: Math.PI / 4,
    defaultPitch: Math.PI / 6,
    defaultDistance: 18,
    mode: 'static',
    followStrength: 0.08
  }
};
const statuses = [];
const controller = CameraController.create({
  state, camera, THREE,
  document: { getElementById() { return null; } },
  showStatus(message) { statuses.push(message); }
});
const assemblySpaceRoot = new THREE.Group();
assemblySpaceRoot.position.set(20, 5, -9);
const visual = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
visual.position.set(3, 2, 4);
assemblySpaceRoot.add(visual);
const beforeYaw = state.camera.yaw, beforePitch = state.camera.pitch;

assert.strictEqual(controller.frameWorkshopObject(visual), true);
assert(state.camera.target.distanceTo(new THREE.Vector3(23, 7, -5)) < 1e-6,
  'Frame must respect nested assembly-space world translation rather than using local block coordinates.');
assert.strictEqual(state.camera.yaw, beforeYaw, 'Framing must not unexpectedly rotate the view.');
assert.strictEqual(state.camera.pitch, beforePitch);
assert(state.camera.distance >= 6 && state.camera.distance <= 160);
assert(Math.abs(camera.position.distanceTo(state.camera.target) - state.camera.distance) < 1e-6,
  'Framing must update the actual Three camera, not merely change stored coordinates.');
assert(statuses.includes('FRAME SELECTED PART'));

const sameTarget = state.camera.target.clone();
state.mode = 'FLIGHT';
assert.strictEqual(controller.frameWorkshopObject(visual), false, 'Build framing may not override a running flight camera.');
assert(state.camera.target.equals(sameTarget));
state.mode = 'BUILD';
assert.strictEqual(controller.frameWorkshopObject(new THREE.Group()), false, 'Empty visuals cannot be framed.');

camera.aspect = 0.7;
const largeVisual = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 10), new THREE.MeshBasicMaterial());
largeVisual.position.set(-20, 3, 2);
assert.strictEqual(controller.frameWorkshopObject(largeVisual), true);
assert(state.camera.distance > 6, 'Larger geometry and narrow view should push the camera farther away.');

console.log({ cameraFrame: 'world-space-nested-assembly', flightGuard: 'ok', visualBoundsFit: 'ok' });
