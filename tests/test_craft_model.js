const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/blueprint.js',
  'src/foundation/craft_model.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const CraftModel = global.VAW.require('foundation.craft-model');
const Blueprint = global.VAW.require('foundation.blueprint');
const Config = global.VAW.require('foundation.config');

function block(x, y, z, type = 'Hull', extra = {}) {
  return { x, y, z, type, orientation: 0, controlAxis: 'pitch', controlSign: 0, ...extra };
}

const craft = CraftModel.create();
const events = [];
craft.subscribe(event => events.push(event));

assert.strictEqual(craft.size, 0);
assert.strictEqual(craft.revision, 0);
assert(craft.isContiguous(), 'An empty workbench is a valid editable state.');

let result = craft.add(block(0, 0, 0, 'Thruster'), 'first-module');
assert(result.ok, 'Any module may be the first block.');
assert.strictEqual(craft.revision, 1);
assert(Object.isFrozen(craft.get('0,0,0')));
const firstBlockId = craft.get('0,0,0').blockId;
assert(firstBlockId);
assert.strictEqual(craft.getById(firstBlockId).key, '0,0,0');
assert(!('mesh' in craft.get('0,0,0')), 'Domain records must not contain renderer objects.');

result = craft.add(block(0, 1, 0, 'Hull'), 'rocket-body');
assert(result.ok);
result = craft.add(block(0, 2, 0, 'Core'), 'movable-core');
assert(result.ok, 'Core may be placed away from the origin.');
assert.strictEqual(craft.get('0,2,0').type, 'Core');

const revisionBeforeSecondCore = craft.revision;
result = craft.add(block(1, 2, 0, 'Core'), 'duplicate-core');
assert(!result.ok);
assert.strictEqual(result.reason, 'multiple-cores');
assert.strictEqual(craft.revision, revisionBeforeSecondCore, 'Rejected edits must remain atomic.');

result = craft.add(block(5, 0, 0, 'Fuel'), 'detached-subassembly');
assert(result.ok, 'Disconnected work-in-progress is allowed in the editor.');
assert.strictEqual(craft.isContiguous(), false);
assert.strictEqual(craft.remove('0,2,0', 'remove-core').ok, true, 'Core is removable during editing.');
assert.strictEqual(craft.values().filter(value => value.type === 'Core').length, 0);

const revisionBeforeDuplicate = craft.revision;
result = craft.addMany([block(6, 0, 0), block(5, 0, 0)], 'invalid-duplicate');
assert(!result.ok);
assert.strictEqual(craft.revision, revisionBeforeDuplicate);
assert.strictEqual(craft.has('6,0,0'), false, 'Atomic placement must not partially apply.');

const snapshot = craft.snapshot();
assert(Object.isFrozen(snapshot));
assert(Object.isFrozen(snapshot.blocks));
assert.strictEqual(snapshot.revision, craft.revision);
assert.throws(() => snapshot.blocks.push(block(9, 9, 9)), TypeError);

const unchangedRevision = craft.revision;
result = craft.replace(craft.values(), 'same-craft');
assert(result.ok);
assert.strictEqual(result.reason, 'unchanged');
assert.strictEqual(craft.revision, unchangedRevision);

result = craft.replace([
  block(0, 0, 0, 'Thruster'),
  block(0, 1, 0, 'Fuel'),
  block(0, 2, 0, 'Core'),
  block(0, 3, 0, 'ControlSurface', { orientation: 7, controlAxis: 'roll', controlSign: -1 })
], 'replace-rocket');
assert(result.ok);
assert.strictEqual(craft.size, 4);
assert.strictEqual(craft.get('0,3,0').controlAxis, 'roll');
assert.strictEqual(craft.get('0,3,0').controlSign, -1);
const movedId = craft.get('0,3,0').blockId;
assert(craft.move(movedId, 1, 3, 0, 'move-control-surface').ok);
assert.strictEqual(craft.getById(movedId).key, '1,3,0', 'Moving a block must preserve its persistent identity.');

const document = craft.toDocument({
  selectedBlock: 'Core', selectedOrientation: 3, symmetry: 'X',
  thrusterPower: 0.8, balloonPower: 0.4, stabilityAssist: 0.2,
  controlAxis: 'yaw', controlSign: 1
});
assert.strictEqual(document.version, Config.SAVE_VERSION);
assert.strictEqual(document.blocks.length, craft.size);
assert.strictEqual(document.selectedBlock, 'Core');
assert(Blueprint.normalize(document));
assert(Blueprint.normalize({ version: 8, selectedBlock: 'Hull', blocks: [] }), 'Empty v8 workspaces must round-trip.');
assert(Blueprint.normalize({ version: 8, blocks: [block(0, 0, 0), block(5, 0, 0)] }), 'Disconnected v8 workspaces must remain saveable.');

const migrated = CraftModel.create();
result = migrated.loadDocument({
  version: 3,
  selectedBlock: 'Hull',
  blocks: [block(1, 0, 0)]
}, 'migrate-v3');
assert(result.ok);
assert(migrated.has('0,0,0'));
assert.strictEqual(migrated.get('0,0,0').type, 'Core');
assert(migrated.has('1,0,0'));

// Deterministic property-style stress: accepted operations preserve storage invariants,
// while readiness constraints are intentionally deferred to CraftCompiler.
let seed = 0xC0FFEE;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
const stress = CraftModel.create();
const directions = Config.NEIGHBOR_DIRECTIONS;
for (let step = 0; step < 600; step += 1) {
  const values = stress.values();
  if (values.length === 0 || (values.length < 180 && random() < 0.70)) {
    let candidate;
    if (values.length === 0 || random() < 0.08) {
      candidate = block(Math.floor(random() * 9) - 4, 0, Math.floor(random() * 9) - 4, random() < 0.08 ? 'Core' : 'Hull');
    } else {
      const anchor = values[Math.floor(random() * values.length)];
      const [dx, dy, dz] = directions[Math.floor(random() * directions.length)];
      candidate = block(anchor.x + dx, anchor.y + dy, anchor.z + dz, random() < 0.12 ? 'Frame' : 'Hull');
    }
    stress.add(candidate, 'stress-add');
  } else if (values.length) {
    stress.remove(values[Math.floor(random() * values.length)].key, 'stress-remove');
  }

  assert(stress.size <= Config.GRID.maxBlocks);
  assert.strictEqual(new Set(stress.keys()).size, stress.size);
  assert(stress.values().filter(value => value.type === 'Core').length <= 1);
  for (const value of stress.values()) {
    assert(Blueprint.isWithinGrid(value.x, value.y, value.z));
    assert(Object.isFrozen(value));
  }
}

const maximumBlocks = [];
outer: for (let y = Config.GRID.minY; y <= Config.GRID.maxY; y += 1) {
  for (let x = -Config.GRID.halfExtent; x <= Config.GRID.halfExtent; x += 1) {
    for (let z = -Config.GRID.halfExtent; z <= Config.GRID.halfExtent; z += 1) {
      maximumBlocks.push(block(x, y, z, maximumBlocks.length === 137 ? 'Core' : 'Hull'));
      if (maximumBlocks.length === Config.GRID.maxBlocks) break outer;
    }
  }
}
const maxCraft = CraftModel.create();
const scaleStarted = process.hrtime.bigint();
const maxResult = maxCraft.replace(maximumBlocks, 'maximum-size-craft');
const scaleMilliseconds = Number(process.hrtime.bigint() - scaleStarted) / 1e6;
assert(maxResult.ok);
assert.strictEqual(maxCraft.size, Config.GRID.maxBlocks);
assert(scaleMilliseconds < 5000, `Maximum-size model replacement took ${scaleMilliseconds.toFixed(1)} ms.`);
const overflow = [...maximumBlocks, block(0, Config.GRID.maxY, Config.GRID.halfExtent, 'Frame')];
assert.strictEqual(maxCraft.replace(overflow, 'overflow').ok, false);
assert.strictEqual(maxCraft.size, Config.GRID.maxBlocks, 'Rejected scale edits must be atomic.');

const independent = CraftModel.create([block(0, 4, 0, 'Core')]);
assert.notStrictEqual(independent, stress);
assert.strictEqual(independent.size, 1);
assert.notStrictEqual(independent.values(), stress.values());

console.log(JSON.stringify({
  atomicTransactions: 'ok',
  rendererIndependence: 'ok',
  freeformFirstBlock: 'ok',
  movableCore: 'ok',
  workInProgressStates: 'ok',
  immutableSnapshots: 'ok',
  documentRoundTrip: 'ok',
  persistentBlockIdentity: 'ok',
  deterministicStressSteps: 600,
  finalStressBlocks: stress.size,
  maximumCraftBlocks: maxCraft.size,
  maximumReplaceMs: Number(scaleMilliseconds.toFixed(2))
}, null, 2));
