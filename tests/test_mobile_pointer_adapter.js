'use strict';

const assert = require('assert');
const PointerAdapter = require('../src/game/mobile-pointer-adapter.js');

function makeTarget() {
  const listeners = new Map();
  const captures = [];
  const releases = [];
  return {
    listeners, captures, releases,
    style: { touchAction: 'pan-x' },
    addEventListener(name, callback, options) { listeners.set(name, { callback, options }); },
    removeEventListener(name, callback) {
      const current = listeners.get(name);
      if (current?.callback === callback) listeners.delete(name);
    },
    setPointerCapture(id) { captures.push(id); },
    releasePointerCapture(id) { releases.push(id); },
    contains(node) { return node === this; }
  };
}

function dispatch(target, name, event = {}) {
  const entry = target.listeners.get(name);
  assert(entry, `missing listener ${name}`);
  let prevented = false;
  entry.callback({
    pointerType: 'touch',
    pointerId: 1,
    clientX: 10,
    clientY: 20,
    target,
    preventDefault() { prevented = true; },
    ...event
  });
  return prevented;
}

function run() {
  const surface = makeTarget();
  const windowLike = makeTarget();
  const documentLike = makeTarget();
  documentLike.hidden = false;
  const calls = [];
  const controller = {
    pointerDown(sample) { calls.push(['down', sample]); return true; },
    pointerMove(sample) { calls.push(['move', sample]); return true; },
    pointerUp(sample) { calls.push(['up', sample]); return true; },
    cancelAll(reason) { calls.push(['cancel', reason]); return true; }
  };

  const adapter = PointerAdapter.create({
    surface,
    window: windowLike,
    document: documentLike,
    controller,
    enabled: () => true,
    resolveOwner: event => event.owner || 'canvas'
  });
  assert.equal(adapter.bind(), true);
  assert.equal(surface.style.touchAction, 'none');
  assert.equal(adapter.bind(), false, 'bind must be idempotent');

  assert.equal(dispatch(surface, 'pointerdown'), true);
  assert.deepEqual(calls[0], ['down', { pointerId: 1, x: 10, y: 20, owner: 'canvas' }]);
  assert.deepEqual(surface.captures, [1]);

  assert.equal(dispatch(surface, 'pointermove', { clientX: 14, clientY: 25 }), true);
  assert.deepEqual(calls[1], ['move', { pointerId: 1, x: 14, y: 25 }]);

  assert.equal(dispatch(surface, 'pointerup', { clientX: 15, clientY: 26 }), true);
  assert.deepEqual(calls[2], ['up', { pointerId: 1, x: 15, y: 26 }]);
  assert.deepEqual(surface.releases, [1]);

  dispatch(surface, 'pointercancel', { pointerId: 2 });
  assert.deepEqual(calls.at(-1), ['cancel', 'pointercancel']);
  dispatch(surface, 'lostpointercapture', { pointerId: 2 });
  assert.deepEqual(calls.at(-1), ['cancel', 'lostpointercapture']);
  dispatch(windowLike, 'blur', { pointerType: undefined });
  assert.deepEqual(calls.at(-1), ['cancel', 'window-blur']);
  documentLike.hidden = true;
  dispatch(documentLike, 'visibilitychange', { pointerType: undefined });
  assert.deepEqual(calls.at(-1), ['cancel', 'document-hidden']);

  const callCount = calls.length;
  dispatch(surface, 'pointerdown', { pointerType: 'mouse', pointerId: 9 });
  assert.equal(calls.length, callCount, 'mouse input must remain owned by desktop handlers');

  adapter.setEnabled(false);
  assert.equal(surface.style.touchAction, 'pan-x');
  dispatch(surface, 'pointerdown', { pointerId: 10 });
  assert.deepEqual(calls.at(-1), ['cancel', 'disabled']);
  adapter.setEnabled(true);
  assert.equal(surface.style.touchAction, 'none');

  assert.equal(adapter.destroy(), true);
  assert.equal(surface.style.touchAction, 'pan-x');
  assert.equal(adapter.destroy(), false);
  assert.equal(surface.listeners.size, 0);
  assert.equal(windowLike.listeners.size, 0);
  assert.equal(documentLike.listeners.size, 0);
  assert.deepEqual(calls.at(-1), ['cancel', 'destroy']);

  console.log('OK mobile pointer adapter');
}

run();
