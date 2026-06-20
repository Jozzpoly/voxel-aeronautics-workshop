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
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/blueprint.js',
  'src/foundation/craft_history.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const Blueprint = global.VAW.require('foundation.blueprint');
const CraftHistory = global.VAW.require('foundation.craft-history');

function documentWith(size, power = 0.7) {
  const blocks = [{ x: 0, y: 0, z: 0, type: 'Core', orientation: 0 }];
  for (let index = 1; index < size; index += 1) {
    blocks.push({ x: index, y: 0, z: 0, type: 'Hull', orientation: 0 });
  }
  return Blueprint.createDocument({
    blocks,
    selectedBlock: 'Hull', selectedOrientation: 0, symmetry: 'NONE',
    thrusterPower: power, balloonPower: 0.7, stabilityAssist: 0.18,
    controlAxis: 'pitch', controlSign: 0
  });
}

const history = CraftHistory.create({ maxSnapshots: 3, maxStoredParts: 7 });
const a = documentWith(1);
const b = documentWith(2);
const c = documentWith(3);
const d = documentWith(4);

assert.strictEqual(history.canUndo, false);
assert.strictEqual(history.canRedo, false);
assert.strictEqual(history.commit(a, a), false);
assert.strictEqual(history.revision, 0);
assert(history.commit(a, b));
assert(history.commit(b, c));
assert.strictEqual(history.undoCount, 2);
assert.strictEqual(history.redoCount, 0);

let target = history.undo(c);
assert.deepStrictEqual(target, b);
assert.strictEqual(history.undoCount, 1);
assert.strictEqual(history.redoCount, 1);
target.blocks[0].type = 'Hull';
let redoTarget = history.redo(b);
assert.deepStrictEqual(redoTarget, c, 'Returned snapshots must not expose internal history storage.');

const beforeRollback = history.inspect();
target = history.undo(c);
assert.deepStrictEqual(target, b);
assert(history.rollbackUndo(c, target));
assert.strictEqual(history.undoCount, beforeRollback.undoCount);
assert.strictEqual(history.redoCount, beforeRollback.redoCount);

target = history.undo(c);
assert.deepStrictEqual(target, b);
redoTarget = history.redo(b);
assert.deepStrictEqual(redoTarget, c);
assert(history.rollbackRedo(b, redoTarget));
assert.strictEqual(history.canRedo, true);

history.clear();
assert.strictEqual(history.canUndo, false);
assert.strictEqual(history.canRedo, false);

history.commit(a, b);
history.commit(b, c);
history.commit(c, d);
const bounded = history.inspect();
assert(bounded.undoCount <= 3);
assert(bounded.undoParts <= 7 || bounded.undoCount === 1);
assert(Object.isFrozen(bounded));

const independent = CraftHistory.create();
assert.strictEqual(independent.undoCount, 0);
assert.notStrictEqual(independent, history);

console.log(JSON.stringify({
  commitDeduplication: 'ok',
  undoRedo: 'ok',
  rollback: 'ok',
  snapshotIsolation: 'ok',
  boundedStorage: bounded
}, null, 2));
