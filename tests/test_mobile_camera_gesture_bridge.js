'use strict';

const assert = require('assert');
const CameraBridge = require('../src/game/mobile-camera-gesture-bridge.js');

function run() {
  const calls = [];
  const cameraController = {
    orbitCameraByPixels(dx, dy, sensitivity) {
      calls.push(['orbit', dx, dy, sensitivity]);
      return true;
    },
    panCameraTargetByPixels(dx, dy) {
      calls.push(['pan', dx, dy]);
    },
    zoomCameraByPixels(delta, sensitivity, minimum, maximum) {
      calls.push(['zoom', delta, sensitivity, minimum, maximum]);
      return true;
    }
  };
  const bridge = CameraBridge.create({
    cameraController,
    orbitSensitivity: 0.008,
    zoomSensitivity: 0.02,
    minDistance: 6,
    maxDistance: 55,
    onChanged(kind) { calls.push(['changed', kind]); }
  });

  assert.equal(bridge.orbit({ dx: 10, dy: -5 }), true);
  assert.deepEqual(calls[0], ['orbit', 10, -5, 0.008]);
  assert.deepEqual(calls[1], ['changed', 'orbit']);

  assert.equal(bridge.pan({ dx: 3, dy: 4 }), true);
  assert.deepEqual(calls[2], ['pan', 3, 4]);
  assert.deepEqual(calls[3], ['changed', 'pan']);

  assert.equal(bridge.zoom({ delta: 100 }), true);
  assert.deepEqual(calls[4], ['zoom', 100, 0.02, 6, 55]);
  assert.deepEqual(calls[5], ['changed', 'zoom']);

  assert.equal(bridge.orbit({ dx: 0, dy: 0 }), false);
  assert.equal(bridge.pan({ dx: 0, dy: 0 }), false);
  assert.equal(bridge.zoom({ delta: 0 }), false);

  const rejected = CameraBridge.create({
    cameraController: {
      orbitCameraByPixels() { return false; },
      panCameraTargetByPixels() { return false; },
      zoomCameraByPixels() { return false; }
    },
    onChanged() { throw new Error('must not be called'); }
  });
  assert.equal(rejected.orbit({ dx: 1, dy: 1 }), false);
  assert.equal(rejected.pan({ dx: 1, dy: 1 }), false);
  assert.equal(rejected.zoom({ delta: 1 }), false);

  assert.throws(() => CameraBridge.create({}), /cameraController/);
  assert.throws(() => CameraBridge.create({ cameraController: {} }), /orbitCameraByPixels/);
  assert.throws(() => CameraBridge.create({ cameraController: { orbitCameraByPixels() {} } }), /panCameraTargetByPixels/);
  assert.throws(() => CameraBridge.create({ cameraController: { orbitCameraByPixels() {}, panCameraTargetByPixels() {} } }), /zoomCameraByPixels/);
  assert.throws(() => CameraBridge.create({ cameraController, minDistance: 10, maxDistance: 5 }), /distance range/);

  console.log('OK mobile camera gesture bridge');
}

run();
