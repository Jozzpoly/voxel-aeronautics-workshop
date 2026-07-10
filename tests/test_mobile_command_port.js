'use strict';

const assert = require('assert');

function freshPort() {
  const path = require.resolve('../src/game/mobile-command-port.js');
  delete require.cache[path];
  return require(path);
}

function implementation(calls) {
  return {
    build: {
      catalog() { calls.push(['catalog']); return ['Core', 'Wing']; },
      selectPart(partId) { calls.push(['selectPart', partId]); return partId; },
      placeAtScreen(x, y) { calls.push(['placeAtScreen', x, y]); return true; },
      removeAtScreen(x, y) { calls.push(['removeAtScreen', x, y]); return true; },
      rotate(direction) { calls.push(['rotate', direction]); return direction; },
      setDirection(direction) { calls.push(['setDirection', direction]); return direction; },
      undo() { calls.push(['undo']); return true; },
      redo() { calls.push(['redo']); return true; }
    },
    session: {
      snapshot() { calls.push(['snapshot']); return { mode: 'BUILD' }; },
      launch() { calls.push(['launch']); return true; },
      returnToWorkshop() { calls.push(['returnToWorkshop']); return true; },
      reset() { calls.push(['reset']); return true; }
    },
    flight: {
      setAction(action, active) { calls.push(['setAction', action, active]); return true; },
      clearActions() { calls.push(['clearActions']); return true; }
    }
  };
}

function run() {
  {
    const Port = freshPort();
    assert.equal(Port.current(), null);
    assert.throws(() => Port.build.catalog(), /not registered/);
    assert.throws(() => Port.register(null), /must be an object/);
    assert.throws(() => Port.register({}), /build section/);
    assert.throws(() => Port.register({ build: {}, session: {}, flight: {} }), /build\.catalog/);
    assert.throws(() => Port.subscribeActivity(null), /must be a function/);
  }

  {
    const Port = freshPort();
    const calls = [];
    const notifications = [];
    const activities = [];
    const unsubscribe = Port.subscribe(value => notifications.push(value), { emitCurrent: true });
    const unsubscribeActivity = Port.subscribeActivity(value => activities.push(value));
    assert.deepEqual(notifications, [null]);

    const registered = Port.register(implementation(calls));
    assert.equal(Port.current(), registered);
    assert.equal(notifications.length, 2);
    assert.equal(notifications[1], registered);
    assert(Object.isFrozen(registered));

    assert.deepEqual(Port.build.catalog(), ['Core', 'Wing']);
    assert.equal(activities.length, 0, 'read-only catalog must not publish command activity');
    assert.equal(Port.build.selectPart('Wing'), 'Wing');
    assert.equal(Port.build.placeAtScreen(12, 34), true);
    assert.equal(Port.build.removeAtScreen(56, 78), true);
    assert.equal(Port.build.rotate(-1), -1);
    assert.equal(Port.build.setDirection(2), 2);
    assert.equal(Port.build.undo(), true);
    assert.equal(Port.build.redo(), true);
    assert.deepEqual(Port.session.snapshot(), { mode: 'BUILD' });
    assert.equal(activities.length, 7, 'read-only session snapshot must not publish command activity');
    assert.equal(Port.session.launch(), true);
    assert.equal(Port.session.returnToWorkshop(), true);
    assert.equal(Port.session.reset(), true);
    assert.equal(Port.flight.setAction('pitch-up', true), true);
    assert.equal(Port.flight.clearActions(), true);

    assert.deepEqual(calls, [
      ['catalog'], ['selectPart', 'Wing'], ['placeAtScreen', 12, 34], ['removeAtScreen', 56, 78],
      ['rotate', -1], ['setDirection', 2], ['undo'], ['redo'], ['snapshot'], ['launch'],
      ['returnToWorkshop'], ['reset'], ['setAction', 'pitch-up', true], ['clearActions']
    ]);
    assert.equal(activities.length, 12);
    assert(Object.isFrozen(activities[0]));
    assert(Object.isFrozen(activities[0].args));
    assert.deepEqual(activities[7], { section: 'session', method: 'launch', args: [], result: true });
    assert.deepEqual(activities[10], { section: 'flight', method: 'setAction', args: ['pitch-up', true], result: true });

    assert.throws(() => Port.register(implementation([])), /already registered/);
    assert.equal(Port.unregister({}), false);
    assert.equal(Port.unregister(registered), true);
    assert.equal(Port.current(), null);
    assert.equal(notifications.length, 3);
    assert.equal(notifications[2], null);
    unsubscribe();
    unsubscribeActivity();
  }

  {
    const Port = freshPort();
    const calls = [];
    let secondRegistrationListenerCalled = false;
    let secondActivityListenerCalled = false;
    Port.subscribe(() => { throw new Error('listener failure'); }, { emitCurrent: false });
    Port.subscribe(() => { secondRegistrationListenerCalled = true; }, { emitCurrent: false });
    Port.subscribeActivity(() => { throw new Error('activity listener failure'); });
    Port.subscribeActivity(() => { secondActivityListenerCalled = true; });
    const originalError = console.error;
    console.error = () => {};
    try {
      Port.register(implementation(calls));
      Port.session.launch();
    } finally {
      console.error = originalError;
    }
    assert.equal(secondRegistrationListenerCalled, true, 'one registration listener failure must not block other listeners');
    assert.equal(secondActivityListenerCalled, true, 'one activity listener failure must not block other listeners');
  }

  console.log('OK mobile command port');
}

run();
