'use strict';

const assert = require('assert');
const Runtime = require('../src/game/mobile-camera-input-runtime.js');

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    style: { touchAction: 'manipulation' },
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
  let mobile = true;
  const calls = [];
  const runtime = Runtime.create({
    surface,
    window: windowLike,
    document: documentLike,
    mobileContext: { currentProfile: () => ({ mobilePresentation: mobile }) },
    cameraController: {
      orbitCameraByPixels(dx, dy, sensitivity) { calls.push(['orbit', dx, dy, sensitivity]); return true; },
      panCameraTargetByPixels(dx, dy) { calls.push(['pan', dx, dy]); },
      zoomCameraByPixels(delta, sensitivity, minimum, maximum) { calls.push(['zoom', delta, sensitivity, minimum, maximum]); return true; }
    },
    onCameraChanged: kind => calls.push(['changed', kind]),
    onTap: sample => calls.push(['tap', sample]),
    tapEnabled: () => false
  });

  assert.equal(runtime.bind(), true);
  assert.equal(surface.style.touchAction, 'none');
  dispatch(surface, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dispatch(surface, 'pointermove', { pointerId: 1, clientX: 12, clientY: 0 });
  dispatch(surface, 'pointerup', { pointerId: 1, clientX: 12, clientY: 0 });
  assert(calls.some(call => call[0] === 'orbit' && call[1] === 12 && call[2] === 0));
  assert(calls.some(call => call[0] === 'changed' && call[1] === 'orbit'));
  assert(!calls.some(call => call[0] === 'tap'), 'tap routing is disabled by policy');

  mobile = false;
  runtime.refreshEnabled();
  assert.equal(surface.style.touchAction, 'manipulation');
  const orbitCount = calls.filter(call => call[0] === 'orbit').length;
  dispatch(surface, 'pointerdown', { pointerId: 2, clientX: 0, clientY: 0 });
  dispatch(surface, 'pointermove', { pointerId: 2, clientX: 20, clientY: 0 });
  assert.equal(calls.filter(call => call[0] === 'orbit').length, orbitCount, 'desktop presentation must not consume touch through mobile runtime');

  mobile = true;
  runtime.refreshEnabled();
  assert.equal(surface.style.touchAction, 'none');
  runtime.cancel('mode-change');
  assert.equal(runtime.destroy(), true);
  assert.equal(surface.style.touchAction, 'manipulation');
  assert.equal(surface.listeners.size, 0);

  assert.throws(() => Runtime.create({}), /surface/);
  console.log('OK mobile camera input runtime');
}

run();
