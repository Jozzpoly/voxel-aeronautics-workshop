const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/kernel.js'), 'utf8'), { filename: 'kernel.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/game/workshop_selection_controller.js'), 'utf8'), { filename: 'workshop_selection_controller.js' });

const WorkshopSelectionController = VAW.require('game.workshop-selection-controller');

function fakeElement(dataset = {}) {
  const listeners = new Map();
  return {
    textContent: '',
    disabled: false,
    dataset: { ...dataset },
    addEventListener(type, fn) { listeners.set(type, fn); },
    click() { listeners.get('click')?.({ currentTarget: this }); }
  };
}

const ids = [
  'ui-selected-part-title',
  'ui-selected-part-meta',
  'ui-selected-part-test',
  'btn-clear-selected-part',
  'btn-select-hovered-part',
  'btn-select-last-failure'
];
const elements = Object.fromEntries(ids.map(id => [id, fakeElement()]));
const nudgeButtons = [
  fakeElement({ selectedNudge: '-1,0,0' }),
  fakeElement({ selectedNudge: '1,0,0' })
];
const documentRef = {
  getElementById(id) { return elements[id] || null; },
  querySelectorAll(selector) { return selector === '[data-selected-nudge]' ? nudgeButtons : []; }
};

const moves = [];
const blocks = new Map([
  ['root-a', { blockId: 'root-a', type: 'Hull', assemblySpaceId: 'space:root', x: 0, y: 0, z: 0 }],
  ['child-failed', { blockId: 'child-failed', type: 'Thruster', assemblySpaceId: 'space:child', x: 2, y: 1, z: -1 }]
]);
const linkedIds = new Set();
const craft = {
  getById(id) { return blocks.get(id) || null; },
  linksForBlock(id) { return linkedIds.has(id) ? [{ mechanicalLinkId: 'hinge-1' }] : []; },
  move(blockId, x, y, z) {
    const before = blocks.get(blockId);
    if (!before) return { ok: false, reason: 'missing-block' };
    const after = { ...before, x, y, z };
    blocks.set(blockId, after);
    moves.push([blockId, x, y, z]);
    return { ok: true, block: after };
  }
};
const state = {
  workshop: { selectedBlockId: null },
  lastTestResult: {
    firstFailureEvent: { blockId: 'child-failed', type: 'Thruster', reason: 'hard landing' },
    lostBlockIds: ['child-failed']
  }
};

let hovered = 'root-a';
let activeSpace = null;
let highlighted = null;
let historyCommits = 0;
let autosaves = 0;
const statuses = [];

const controller = WorkshopSelectionController.create({
  state,
  craft,
  workshop: { meshesByKey: new Map() },
  document: documentRef,
  callbacks: {
    hoveredBlockId: () => hovered,
    setActiveAssemblySpace(id) { activeSpace = id; return true; },
    collectBlueprint() { return { before: true }; },
    commitHistory() { historyCommits += 1; },
    updateTelemetry() {},
    updateGhost() {},
    autoSave() { autosaves += 1; },
    onSelectionChanged(block) { highlighted = block?.blockId || null; },
    showStatus(message) { statuses.push(message); }
  }
});

controller.wire();
assert.strictEqual(elements['ui-selected-part-title'].textContent, 'No part selected');
assert.strictEqual(elements['btn-select-last-failure'].disabled, false);

const failed = controller.selectLastFailure();
assert.strictEqual(failed.ok, true);
assert.strictEqual(state.workshop.selectedBlockId, 'child-failed');
assert.strictEqual(activeSpace, 'space:child');
assert.strictEqual(highlighted, 'child-failed');
assert(elements['ui-selected-part-title'].textContent.includes('Thruster'));
assert(elements['ui-selected-part-test'].textContent.includes('FIRST FAILURE'));
assert(elements['ui-selected-part-test'].textContent.includes('LOST DURING TEST'));


linkedIds.add('child-failed');
const blockedMoveCount = moves.length;
const linkedMove = controller.nudge(1, 0, 0);
assert.strictEqual(linkedMove.ok, false);
assert.strictEqual(linkedMove.reason, 'mechanically-linked');
assert.strictEqual(moves.length, blockedMoveCount, 'mechanically linked selection must not be moved by the primitive nudge editor');
assert.strictEqual(historyCommits, 0, 'blocked move must not enter blueprint history');
linkedIds.delete('child-failed');

const moved = controller.nudge(1, 0, 0);
assert.strictEqual(moved.ok, true);
assert.deepStrictEqual(moves.at(-1), ['child-failed', 3, 1, -1]);
assert.strictEqual(historyCommits, 1, 'successful existing-part edit must enter blueprint history');
assert.strictEqual(autosaves, 1, 'successful existing-part edit must schedule persistence');
assert.strictEqual(state.workshop.selectedBlockId, 'child-failed', 'move must preserve stable selected block identity');
assert(elements['ui-selected-part-meta'].textContent.includes('[3, 1, -1]'));

controller.clear();
assert.strictEqual(state.workshop.selectedBlockId, null);
assert.strictEqual(highlighted, null);

const autoFailure = controller.sync({ preferLastFailure: true });
assert.strictEqual(autoFailure.ok, true);
assert.strictEqual(state.workshop.selectedBlockId, 'child-failed');
assert.strictEqual(activeSpace, 'space:child');
controller.clear();

const hoverResult = controller.selectHovered();
assert.strictEqual(hoverResult.ok, true);
assert.strictEqual(state.workshop.selectedBlockId, 'root-a');
assert.strictEqual(activeSpace, 'space:root', 'manual selection should activate the selected part assembly space');
assert.strictEqual(highlighted, 'root-a');

hovered = null;
controller.clear();
const noHover = controller.selectHovered();
assert.strictEqual(noHover.ok, false);
assert.strictEqual(statuses.at(-1), 'HOVER A PART TO SELECT IT');

state.workshop.selectedBlockId = 'missing';
controller.sync();
assert.strictEqual(state.workshop.selectedBlockId, null);

console.log({
  workshopSelection: 'stable-block-id',
  failedPartMapping: 'ok',
  assemblySpaceActivation: 'ok',
  selectedPartMove: 'ok',
  manualHoverSelection: 'ok'
});
