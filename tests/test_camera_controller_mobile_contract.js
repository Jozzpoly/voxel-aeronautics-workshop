'use strict';

const assert = require('assert');

function createVaw() {
  const definitions = new Map();
  const instances = new Map();
  return {
    define(id, dependencies, factory) {
      definitions.set(id, { dependencies, factory });
    },
    require(id) {
      if (instances.has(id)) return instances.get(id);
      const definition = definitions.get(id);
      if (!definition) throw new Error(`Unknown module ${id}`);
      const value = definition.factory(...definition.dependencies.map(dependency => this.require(dependency)));
      instances.set(id, value);
      return value;
    }
  };
}

global.window = {
  document: { getElementById() { return null; } },
  VAW: createVaw()
};

require('../src/game/camera_controller.js');
const CameraController = window.VAW.require('game.camera-controller');

function makeState() {
  return {
    mode: 'BUILD',
    camera: {
      mode: 'follow-position',
      followStrength: 0.08,
      yaw: 1,
      pitch: 0.5,
      distance: 20,
      targetOffset: {},
      target: {},
      defaultTarget: {},
      defaultYaw: 1,
      defaultPitch: 0.5,
      defaultDistance: 20
    }
  };
}

function run() {
  const THREE = {
    MathUtils: { clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); } },
    Vector3: class {},
    Quaternion: class {}
  };
  const camera = {};
  const state = makeState();
  const published = [];
  const unsubscribe = CameraController.onCreated(controller => published.push(controller));

  const controller = CameraController.create({ state, camera, THREE, document: window.document });
  assert.equal(published.length, 1);
  assert.strictEqual(published[0], controller);
  assert.strictEqual(CameraController.current(), controller);

  assert.equal(controller.orbitCameraByPixels(10, -5), true);
  assert.equal(state.camera.yaw, 0.92);
  assert.equal(state.camera.pitch, 0.54);
  assert.equal(controller.orbitCameraByPixels(0, 0), false);

  assert.equal(controller.zoomCameraByPixels(100), true);
  assert.equal(state.camera.distance, 18);
  controller.zoomCameraByPixels(-10000);
  assert.equal(state.camera.distance, 55);
  controller.zoomCameraByPixels(10000);
  assert.equal(state.camera.distance, 6);
  assert.equal(controller.zoomCameraByPixels(0), false);

  const immediate = [];
  const unsubscribeImmediate = CameraController.onCreated(value => immediate.push(value));
  assert.deepEqual(immediate, [controller]);
  unsubscribeImmediate();

  unsubscribe();
  CameraController.create({ state: makeState(), camera, THREE, document: window.document });
  assert.equal(published.length, 1, 'unsubscribed listener must not receive later controllers');

  assert.throws(() => CameraController.onCreated(null), /listener/);
  assert.throws(() => controller.orbitCameraByPixels(Number.NaN, 0), /finite/);
  assert.throws(() => controller.orbitCameraByPixels(0, 0, -1), /finite/);
  assert.throws(() => controller.zoomCameraByPixels(1, -1), /distance range|arguments/);
  assert.throws(() => controller.zoomCameraByPixels(1, 1, 10, 5), /distance range|arguments/);

  console.log('OK camera controller mobile contract');
}

run();
