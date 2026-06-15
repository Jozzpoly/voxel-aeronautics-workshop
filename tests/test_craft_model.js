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
assert.strictEqual(craft.add(block(1, 0, 0)).ok, false, 'A craft cannot start without the command core.');
assert.strictEqual(craft.revision, 0, 'Rejected edits must not advance revision.');

let result = craft.add(block(0, 0, 0, 'Core'), 'seed');
assert(result.ok);
assert.strictEqual(craft.size, 1);
assert.strictEqual(craft.revision, 1);
assert(Object.isFrozen(craft.get('0,0,0')));
assert(!('mesh' in craft.get('0,0,0')), 'Domain records must not contain renderer objects.');

result = craft.addMany([block(1, 0, 0), block(-1, 0, 0)], 'symmetric-place');
assert(result.ok);
assert.strictEqual(result.blocks.length, 2);
assert.strictEqual(craft.size, 3);
assert.strictEqual(events.length, 2, 'An atomic multi-place must publish one event.');
assert.strictEqual(events[1].added.length, 2);
assert(Object.isFrozen(events[1]));
assert(Object.isFrozen(events[1].added));

const revisionBeforeDuplicate = craft.revision;
result = craft.addMany([block(2, 0, 0), block(1, 0, 0)], 'invalid-duplicate');
assert(!result.ok);
assert.strictEqual(craft.revision, revisionBeforeDuplicate);
assert.strictEqual(craft.has('2,0,0'), false, 'Atomic placement must not partially apply.');

result = craft.addMany([block(2, 0, 0), block(3, 0, 0)], 'branch');
assert(result.ok);
assert.strictEqual(craft.size, 5);
assert.strictEqual(craft.remove('1,0,0', 'break-branch').ok, false, 'Removing an articulation block must be rejected.');
assert.strictEqual(craft.has('1,0,0'), true);
assert.strictEqual(craft.remove('3,0,0', 'remove-leaf').ok, true);
assert.strictEqual(craft.has('3,0,0'), false);
assert(craft.isContiguous());
assert.strictEqual(craft.neighborCount('0,0,0'), 2);

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
  block(0, 0, 0, 'Core'),
  block(0, 1, 0, 'Fuel'),
  block(0, 2, 0, 'ControlSurface', { orientation: 7, controlAxis: 'roll', controlSign: -1 })
], 'replace-craft');
assert(result.ok);
assert.strictEqual(craft.size, 3);
assert.strictEqual(craft.get('0,2,0').controlAxis, 'roll');
assert.strictEqual(craft.get('0,2,0').controlSign, -1);

const document = craft.toDocument({
  selectedBlock: 'Wing', selectedOrientation: 3, symmetry: 'X',
  thrusterPower: 0.8, balloonPower: 0.4, stabilityAssist: 0.2,
  controlAxis: 'yaw', controlSign: 1
});
assert.strictEqual(document.version, Config.SAVE_VERSION);
assert.strictEqual(document.blocks.length, craft.size);
assert(Blueprint.normalize(document));

const migrated = CraftModel.create();
result = migrated.loadDocument({
  version: 3,
  selectedBlock: 'Hull',
  blocks: [block(1, 0, 0)]
}, 'migrate-v3');
assert(result.ok);
assert(migrated.has('0,0,0'));
assert(migrated.has('1,0,0'));

// Deterministic property-style stress: every accepted operation preserves all invariants.
let seed = 0xC0FFEE;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
const stress = CraftModel.create([block(0, 0, 0, 'Core')]);
const directions = Config.NEIGHBOR_DIRECTIONS;
for (let step = 0; step < 600; step += 1) {
  const values = stress.values();
  if (values.length < 180 && (values.length <= 1 || random() < 0.68)) {
    const anchor = values[Math.floor(random() * values.length)];
    const [dx, dy, dz] = directions[Math.floor(random() * directions.length)];
    const candidate = block(anchor.x + dx, anchor.y + dy, anchor.z + dz, random() < 0.12 ? 'Frame' : 'Hull');
    stress.add(candidate, 'stress-add');
  } else {
    const removable = values.filter(value => value.type !== 'Core');
    if (removable.length) stress.remove(removable[Math.floor(random() * removable.length)].key, 'stress-remove');
  }

  assert(stress.has('0,0,0'));
  assert(stress.isContiguous());
  assert(stress.size <= Config.GRID.maxBlocks);
  assert.strictEqual(new Set(stress.keys()).size, stress.size);
  for (const value of stress.values()) {
    assert(Blueprint.isWithinGrid(value.x, value.y, value.z));
    assert(Object.isFrozen(value));
  }
}


// Maximum-size replacement remains linear enough for editor use and preserves invariants.
const maximumBlocks = [];
outer: for (let y = Config.GRID.minY; y <= Config.GRID.maxY; y += 1) {
  for (let x = -Config.GRID.halfExtent; x <= Config.GRID.halfExtent; x += 1) {
    for (let z = -Config.GRID.halfExtent; z <= Config.GRID.halfExtent; z += 1) {
      maximumBlocks.push(block(x, y, z, x === 0 && y === 0 && z === 0 ? 'Core' : 'Hull'));
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
assert(maxCraft.isContiguous());
assert(scaleMilliseconds < 5000, `Maximum-size model replacement took ${scaleMilliseconds.toFixed(1)} ms.`);
const overflow = [...maximumBlocks, block(0, Config.GRID.maxY, Config.GRID.halfExtent, 'Frame')];
assert.strictEqual(maxCraft.replace(overflow, 'overflow').ok, false);
assert.strictEqual(maxCraft.size, Config.GRID.maxBlocks, 'Rejected scale edits must be atomic.');

const independent = CraftModel.create([block(0, 0, 0, 'Core')]);
assert.notStrictEqual(independent, stress);
assert.strictEqual(independent.size, 1);
assert.notStrictEqual(independent.values(), stress.values());

console.log(JSON.stringify({
  atomicTransactions: 'ok',
  rendererIndependence: 'ok',
  connectivityGuards: 'ok',
  immutableSnapshots: 'ok',
  documentRoundTrip: 'ok',
  deterministicStressSteps: 600,
  finalStressBlocks: stress.size,
  maximumCraftBlocks: maxCraft.size,
  maximumReplaceMs: Number(scaleMilliseconds.toFixed(2))
}, null, 2));
