const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of ['src/foundation/kernel.js','src/foundation/runtime_assembly.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}
const RuntimeAssembly = global.VAW.require('foundation.runtime-assembly');
const snapshot = {
  signature: 'sample', mass: 8, com: [0.25, 0, 0], inertia: [3, 4, 5],
  parts: [
    { blockId: 'engine-left', key: '0,0,0', type: 'Thruster', grid: [0,0,0], offset: [-0.25,0,0], orientation: 0, properties: { force: 42 } },
    { blockId: 'core', key: '1,0,0', type: 'Core', grid: [1,0,0], offset: [0.75,0,0], orientation: 0, properties: {} }
  ]
};
const plan = RuntimeAssembly.createPlan(snapshot);
assert(Object.isFrozen(plan));
assert.strictEqual(plan.format, 'VAW_RUNTIME_ASSEMBLY_PLAN_V1');
assert.strictEqual(plan.rigidBodies.length, 1);
assert.strictEqual(plan.constraints.length, 0);
assert.strictEqual(plan.signalLinks.length, 0);
assert.strictEqual(plan.parts.length, 2);
assert.strictEqual(plan.blockIdToBodyId['engine-left'], 'body:root');
assert.strictEqual(plan.rigidBodies[0].massProperties.mass, 8);
assert.deepStrictEqual(plan.rigidBodies[0].massProperties.inertiaDiagonal, [3,4,5]);
assert.strictEqual(plan.rigidBodies[0].colliders[0].blockId, 'engine-left');
assert.throws(() => RuntimeAssembly.createPlan({ mass: 1, inertia: [1,1,1], parts: [snapshot.parts[0], snapshot.parts[0]] }), /Duplicate runtime block id/);
console.log(JSON.stringify({ singleBodyCompatibility: 'ok', persistentBlockMapping: 'ok', massPropertyPlan: 'ok', futureConstraintSlot: 'ok', signalGraphSlot: 'ok' }, null, 2));
