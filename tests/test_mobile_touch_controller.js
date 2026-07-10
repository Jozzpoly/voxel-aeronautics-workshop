'use strict';

const assert = require('assert');
const TouchController = require('../src/game/mobile-touch-controller.js');

function createHarness(options = {}) {
  const events = [];
  const controller = TouchController.create({
    movementThreshold: options.movementThreshold ?? 8,
    onOrbit: event => events.push(['orbit', event]),
    onPan: event => events.push(['pan', event]),
    onZoom: event => events.push(['zoom', event]),
    onTap: event => events.push(['tap', event]),
    onCancel: event => events.push(['cancel', event]),
    onStateChanged: snapshot => events.push(['state', snapshot])
  });
  return { controller, events };
}

function ofType(events, type) {
  return events.filter(([eventType]) => eventType === type).map(([, payload]) => payload);
}

function run() {
  {
    const { controller, events } = createHarness();
    assert.equal(controller.pointerDown({ pointerId: 1, x: 10, y: 20, owner: 'canvas' }), true);
    assert.equal(controller.pointerUp({ pointerId: 1, x: 10, y: 20 }), true);
    assert.equal(ofType(events, 'tap').length, 1);
    assert.deepEqual(ofType(events, 'tap')[0], { x: 10, y: 20, pointerId: 1 });
    assert.equal(controller.snapshot().mode, 'IDLE');
  }

  {
    const { controller, events } = createHarness();
    controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' });
    controller.pointerMove({ pointerId: 1, x: 5, y: 5 });
    controller.pointerUp({ pointerId: 1, x: 5, y: 5 });
    assert.equal(ofType(events, 'tap').length, 1, 'movement below radial threshold remains a tap');
    assert.equal(ofType(events, 'orbit').length, 0);
  }

  {
    const { controller, events } = createHarness();
    controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' });
    controller.pointerMove({ pointerId: 1, x: 9, y: 0 });
    controller.pointerMove({ pointerId: 1, x: 12, y: 2 });
    controller.pointerUp({ pointerId: 1, x: 12, y: 2 });
    const orbit = ofType(events, 'orbit');
    assert.equal(orbit.length, 2);
    assert.deepEqual({ dx: orbit[0].dx, dy: orbit[0].dy }, { dx: 9, dy: 0 });
    assert.deepEqual({ dx: orbit[1].dx, dy: orbit[1].dy }, { dx: 3, dy: 2 });
    assert.equal(ofType(events, 'tap').length, 0, 'orbit permanently suppresses tap');
  }

  {
    const { controller, events } = createHarness();
    controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' });
    controller.pointerDown({ pointerId: 2, x: 10, y: 0, owner: 'canvas' });
    assert.equal(controller.snapshot().mode, 'MULTI');
    controller.pointerMove({ pointerId: 1, x: 2, y: 2 });
    controller.pointerMove({ pointerId: 2, x: 14, y: 2 });
    const pans = ofType(events, 'pan');
    const zooms = ofType(events, 'zoom');
    assert(pans.length >= 1);
    assert(zooms.length >= 1);
    assert.equal(zooms.at(-1).delta, 2);
    assert.equal(zooms.at(-1).scale, 1.2);
    controller.pointerUp({ pointerId: 2, x: 14, y: 2 });
    assert.equal(controller.snapshot().mode, 'MULTI', 'multi gesture must not demote while one participant remains');
    controller.pointerUp({ pointerId: 1, x: 2, y: 2 });
    assert.equal(controller.snapshot().mode, 'IDLE');
    assert.equal(ofType(events, 'tap').length, 0);
  }

  {
    const { controller, events } = createHarness();
    controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' });
    controller.pointerDown({ pointerId: 2, x: 100, y: 100, owner: 'ui' });
    controller.pointerMove({ pointerId: 2, x: 120, y: 120 });
    assert.equal(controller.snapshot().mode, 'TAP_CANDIDATE');
    controller.pointerUp({ pointerId: 2, x: 120, y: 120 });
    controller.pointerUp({ pointerId: 1, x: 0, y: 0 });
    assert.equal(ofType(events, 'tap').length, 1);
    assert.equal(ofType(events, 'pan').length, 0);
    assert.equal(ofType(events, 'zoom').length, 0);
  }

  {
    const { controller, events } = createHarness();
    assert.equal(controller.pointerDown({ pointerId: 7, x: 1, y: 1, owner: 'ui' }), true);
    controller.pointerMove({ pointerId: 7, x: 20, y: 20 });
    controller.pointerUp({ pointerId: 7, x: 20, y: 20 });
    assert.equal(ofType(events, 'tap').length, 0);
    assert.equal(ofType(events, 'orbit').length, 0);
    assert.equal(controller.snapshot().mode, 'IDLE');
  }

  {
    const { controller, events } = createHarness();
    assert.equal(controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' }), true);
    assert.equal(controller.pointerDown({ pointerId: 1, x: 2, y: 2, owner: 'canvas' }), false);
    assert.equal(controller.pointerMove({ pointerId: 99, x: 0, y: 0 }), false);
    assert.equal(controller.pointerUp({ pointerId: 99, x: 0, y: 0 }), false);
    assert.equal(controller.cancelAll('blur'), true);
    assert.equal(ofType(events, 'cancel').length, 1);
    assert.deepEqual(ofType(events, 'cancel')[0], { reason: 'blur', pointerIds: [1] });
    assert.equal(controller.cancelAll('again'), false);
    assert.equal(ofType(events, 'cancel').length, 1);
  }

  {
    const { controller } = createHarness();
    controller.pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'canvas' });
    const snapshot = controller.snapshot();
    assert(Object.isFrozen(snapshot));
    assert(Object.isFrozen(snapshot.pointerIds));
    assert.throws(() => snapshot.pointerIds.push(2));
  }

  assert.throws(() => TouchController.create({ movementThreshold: -1 }), /movementThreshold/);
  assert.throws(() => TouchController.create({ movementThreshold: Number.NaN }), /movementThreshold/);
  assert.throws(() => TouchController.create().pointerDown({ pointerId: 1, x: 0, y: 0, owner: 'other' }), /owner/);

  console.log('OK mobile touch controller');
}

run();
