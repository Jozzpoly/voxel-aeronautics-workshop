'use strict';

const assert = require('assert');
const Adapter = require('../src/game/mobile-game-command-adapter.js');

function createHarness() {
  const calls = [];
  const state = { mode: 'BUILD', selectedBlock: 'Core', orientation: 'PX_UY', symmetry: 'NONE' };
  const craft = new Map();
  let revision = 0;
  const axes = [{ id: 'PX' }, { id: 'NX' }];
  const blocks = {
    Core: { color: 0x9f7aea, desc: 'Command core' },
    VectorThruster: { color: 0xc084fc, desc: 'Gimballed engine' }
  };
  const implementation = Adapter.create({
    blocks,
    axes,
    state,
    craft,
    selectPart(id) { calls.push(['selectPart', id]); state.selectedBlock = id; },
    targetScreen(x, y) { calls.push(['target', x, y]); },
    buildAction(button) {
      calls.push(['buildAction', button]);
      if (button === 0) craft.set(`part-${craft.size}`, {});
      if (button === 2 && craft.size) craft.delete([...craft.keys()].at(-1));
    },
    rotate(direction) { calls.push(['rotate', direction]); },
    setOrientation(axis) { calls.push(['orientation', axis]); },
    undo() { calls.push(['undo']); revision -= 1; },
    redo() { calls.push(['redo']); revision += 1; },
    collectBlueprint() { return { revision }; },
    blueprintSignature(value) { return JSON.stringify(value); },
    setMode(mode) { calls.push(['mode', mode]); state.mode = mode; },
    clearControlActions() { calls.push(['clear']); },
    bindableActions: ['pitch+', 'pitch-', 'surge+'],
    setControlAction(action, active) { calls.push(['action', action, active]); }
  });
  return { implementation, calls, state, craft, axes };
}

function run() {
  const { implementation, calls, state, craft, axes } = createHarness();
  assert(Object.isFrozen(implementation));
  assert(Object.isFrozen(implementation.build));

  assert.deepEqual(implementation.build.catalog(), [
    { id: 'Core', label: 'Core', description: 'Command core', color: '#9f7aea' },
    { id: 'VectorThruster', label: 'Vector Thruster', description: 'Gimballed engine', color: '#c084fc' }
  ]);
  assert.equal(implementation.build.selectPart('VectorThruster'), true);
  assert.equal(state.selectedBlock, 'VectorThruster');
  assert.equal(implementation.build.selectPart('Missing'), false);

  assert.equal(implementation.build.placeAtScreen(12, 34), true);
  assert.equal(craft.size, 1);
  assert.deepEqual(calls.slice(-2), [['target', 12, 34], ['buildAction', 0]]);
  assert.equal(implementation.build.placeAtScreen(Number.NaN, 34), false);

  assert.equal(implementation.build.removeAtScreen(56, 78), true);
  assert.equal(craft.size, 0);
  assert.deepEqual(calls.slice(-2), [['target', 56, 78], ['buildAction', 2]]);

  assert.equal(implementation.build.rotate(-100), true);
  assert.deepEqual(calls.at(-1), ['rotate', -1]);
  assert.equal(implementation.build.rotate(0), true);
  assert.deepEqual(calls.at(-1), ['rotate', 1]);
  assert.equal(implementation.build.setDirection(1), true);
  assert.deepEqual(calls.at(-1), ['orientation', axes[1]]);
  assert.equal(implementation.build.setDirection(99), false);

  assert.equal(implementation.build.undo(), true);
  assert.deepEqual(calls.at(-1), ['undo']);
  assert.equal(implementation.build.redo(), true);
  assert.deepEqual(calls.at(-1), ['redo']);

  assert.deepEqual(implementation.session.snapshot(), {
    mode: 'BUILD', selectedPart: 'VectorThruster', orientation: 'PX_UY', symmetry: 'NONE', craftSize: 0, resetMeaning: 'return-to-workshop'
  });
  assert.equal(implementation.session.launch(), true);
  assert.equal(state.mode, 'FLIGHT');
  assert.equal(implementation.build.placeAtScreen(1, 2), false, 'build commands must be disabled during flight');
  assert.equal(implementation.session.returnToWorkshop(), true);
  assert.equal(state.mode, 'BUILD');
  state.mode = 'FLIGHT';
  assert.equal(implementation.session.reset(), true);
  assert.equal(state.mode, 'BUILD');
  assert.deepEqual(calls.slice(-2), [['mode', 'BUILD'], ['clear']]);

  assert.equal(implementation.flight.setAction('pitch+', true), true);
  assert.deepEqual(calls.at(-1), ['action', 'pitch+', true]);
  assert.equal(implementation.flight.setAction('invalid', true), false);
  assert.equal(implementation.flight.clearActions(), true);
  assert.deepEqual(calls.at(-1), ['clear']);

  assert.throws(() => Adapter.create({}), /blocks/);
  assert.throws(() => Adapter.create({ blocks: {}, axes: [] }), /state/);
  assert.throws(() => Adapter.create({ blocks: {}, axes: [], state: {}, craft: {} }), /selectPart/);

  console.log('OK mobile game command adapter');
}

run();
