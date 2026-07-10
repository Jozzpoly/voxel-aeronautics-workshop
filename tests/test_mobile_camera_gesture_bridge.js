'use strict';

const assert = require('assert');
const CameraBridge = require('../src/game/mobile-camera-gesture-bridge.js');

function run() {
  const calls = [];
  const state = { camera: { yaw: 1, pitch: 0.5, distance: 20 } };
  const bridge = CameraBridge.create({
    state,
    orbitSensitivity: 0.008,
    zoomSensitivity: 0.02,
    minDistance: 6,
    maxDistance: 55,
    clampPitch(value) { calls.push(['clamp', value]); return Math.max(-1, Math.min(1, value)); },
    panByPixels(dx, dy) { calls.push(['pan', dx, dy]); },
    onChanged(kind) { calls.push(['changed', kind]); }
  });

  bridge.orbit({ dx: 10, dy: -5 });
  assert.equal(state.camera.yaw, 0.92);
  assert.equal(state.camera.pitch, 0.54);
  assert.deepEqual(calls[0], ['clamp', 0.54]);
  assert.deepEqual(calls[1], ['changed', 'orbit']);

  bridge.pan({ dx: 3, dy: 4 });
  assert.deepEqual(calls[2], ['pan', 3, 4]);
  assert.deepEqual(calls[3], ['changed', 'pan']);

  bridge.zoom({ delta: 100 });
  assert.equal(state.camera.distance, 18);
  assert.deepEqual(calls[4], ['changed', 'zoom']);

  bridge.zoom({ delta: -10000 });
  assert.equal(state.camera.distance, 55);
  bridge.zoom({ delta: 10000 });
  assert.equal(state.camera.distance, 6);

  assert.throws(() => CameraBridge.create({ state: {} }), /camera state/);
  assert.throws(() => CameraBridge.create({ state, clampPitch: null }), /clampPitch/);
  assert.throws(() => CameraBridge.create({ state, clampPitch() {}, panByPixels: null }), /panByPixels/);
  assert.throws(() => CameraBridge.create({ state, clampPitch() {}, panByPixels() {}, minDistance: 10, maxDistance: 5 }), /distance range/);

  console.log('OK mobile camera gesture bridge');
}

run();
