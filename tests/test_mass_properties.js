const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of ['src/foundation/kernel.js', 'src/foundation/mass_properties.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}
const MassProperties = global.VAW.require('foundation.mass-properties');
const near = (actual, expected, epsilon = 1e-9) => assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const cube = MassProperties.compute([{ id: 'cube', mass: 6, center: [4, -2, 9], halfExtents: [0.5, 0.5, 0.5] }]);
assert.strictEqual(cube.mass, 6);
assert.deepStrictEqual(cube.centerOfMass, [4, -2, 9]);
for (const component of cube.inertiaDiagonal) near(component, 1);

const pair = MassProperties.compute([
  { id: 'left', mass: 1, center: [-1, 0, 0], halfExtents: [0.5, 0.5, 0.5] },
  { id: 'right', mass: 1, center: [1, 0, 0], halfExtents: [0.5, 0.5, 0.5] }
]);
assert.deepStrictEqual(pair.centerOfMass, [0, 0, 0]);
near(pair.inertiaDiagonal[0], 1 / 3);
near(pair.inertiaDiagonal[1], 7 / 3);
near(pair.inertiaDiagonal[2], 7 / 3);

const translated = MassProperties.compute([
  { id: 'left', mass: 1, center: [9, 5, -2], halfExtents: [0.5, 0.5, 0.5] },
  { id: 'right', mass: 1, center: [11, 5, -2], halfExtents: [0.5, 0.5, 0.5] }
]);
assert.deepStrictEqual(translated.centerOfMass, [10, 5, -2]);
for (let i = 0; i < 3; i++) near(translated.inertiaDiagonal[i], pair.inertiaDiagonal[i]);

const asymmetric = MassProperties.compute([
  { id: 'core', mass: 6, center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] },
  { id: 'payload', mass: 12, center: [0, -2, 0], halfExtents: [0.42, 0.42, 0.42] }
]);
near(asymmetric.centerOfMass[1], -4 / 3);
assert(asymmetric.inertiaDiagonal.every(Number.isFinite));
assert(Object.isFrozen(asymmetric));
assert(Object.isFrozen(asymmetric.elements));

const empty = MassProperties.compute([]);
assert.deepStrictEqual(empty.centerOfMass, [0, 0, 0]);
assert.deepStrictEqual(empty.inertiaDiagonal, [0, 0, 0]);

console.log(JSON.stringify({
  cuboidInertia: 'ok',
  parallelAxis: 'ok',
  translationInvariant: 'ok',
  payloadMassProperties: 'ok',
  emptyAssembly: 'ok'
}, null, 2));
