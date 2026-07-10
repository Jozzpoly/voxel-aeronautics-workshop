'use strict';

const assert = require('assert');
const Runtime = require('../src/game/mobile-camera-input-runtime.js');

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
}

function dispatch(target, name, values = {}) {
  let prevented = false;
  target.listeners.get(name)?.({
    pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0,
    target,
    preventDefault() { prevented = true; },
    ...values
  });
  return prevented;
}

function run() {
  const surface = eventTarget();
  const windowLike = eventTarget();
  const documentLike = eventTarget();
  documentLike.hidden = false;
  const state = { camera: { yaw: 0, pitch: 0, distance: 20 } };
  let mobile = true;
  const calls = [];
  const runtime = Runtime.create({
    surface,
    window: windowLike,
    document: documentLike,
    state,
    mobileContext: { currentProfile: () => ({ mobilePresentation: mobile }) },
    cameraController: {
      clampCameraPitch: value => value,
      panCameraTargetByPixels: (dx, dy) => calls.push(['pan', dx, dy])
    },
    onCameraChanged: kind => calls.push(['changed', kind]),
    onTap: sample => calls.push(['tap', sample]),
    tapEnabled: () => false
  });

  assert.equal(runtime.bind(), true);
  dispatch(surface, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dispatch(surface, 'pointermove', { pointerId: 1, clientX: 12, clientY: 0 });
  dispatch(surface, 'pointerup', { pointerId: 1, clientX: 12, clientY: 0 });
  assert(state.camera.yaw < 0);
  assert(calls.some(call => call[0] === 'changed' && call[1] === 'orbit'));
  assert(!calls.some(call => call[0] === 'tap'), 'tap routing is disabled by policy');

  mobile = false;
  runtime.refreshEnabled();
  const yaw = state.camera.yaw;
  dispatch(surface, 'pointerdown', { pointerId: 2, clientX: 0, clientY: 0 });
  dispatch(surface, 'pointermove', { pointerId: 2, clientX: 20, clientY: 0 });
  assert.equal(state.camera.yaw, yaw, 'desktop presentation must not consume touch through mobile runtime');

  mobile = true;
  runtime.refreshEnabled();
  runtime.cancel('mode-change');
  assert.equal(runtime.destroy(), true);
  assert.equal(surface.listeners.size, 0);

  assert.throws(() => Runtime.create({}), /surface/);
  console.log('OK mobile camera input runtime');
}

run();
