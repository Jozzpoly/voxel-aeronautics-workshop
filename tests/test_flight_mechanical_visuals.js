'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of ['src/foundation/kernel.js', 'src/game/flight_mechanical_visuals.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}
const Factory = window.VAW.require('game.flight-mechanical-visuals');

const bodies = new Map([
  ['body:a', { x: 0, y: 0, z: 0, angle: 0 }],
  ['body:b', { x: 4, y: 0, z: 0, angle: 0 }]
]);
const activeConstraints = new Set(['hinge:1']);
const plan = { constraints: [{
  constraintId: 'hinge:1', mechanicalLinkId: 'link:1', kind: 'hinge',
  bodyAId: 'body:a', bodyBId: 'body:b', pivotA: [1, 0, 0], pivotB: [-1, 0, 0]
}] };
const transients = [];
function worldPoint(bodyId, point) {
  const body = bodies.get(bodyId); const c = Math.cos(body.angle), s = Math.sin(body.angle);
  return { x: body.x + point.x * c - point.y * s, y: body.y + point.x * s + point.y * c, z: body.z + point.z };
}
const session = {
  getPlan: () => plan,
  hasBody: id => bodies.has(String(id)),
  pointToWorldFrame: (id, point) => worldPoint(String(id), point),
  getConstraintState(id) { if (!activeConstraints.has(id)) throw new Error(`Unknown assembly constraint: ${id}`); return { angle: 0 }; },
  registerTransient(dispose, label) {
    const entry = { dispose, label, active: true }; transients.push(entry);
    return () => { if (!entry.active) return false; entry.active = false; return dispose(); };
  }
};
const created = [], updated = [], disposed = [], diagnostics = [];
function visualFactory(overrides = {}) {
  return Factory.create({
    flightSession: session,
    createVisual(constraint) { const visual = { id: constraint.constraintId }; created.push(visual); return visual; },
    updateVisual(visual, state) { visual.last = state; updated.push({ visual, state }); },
    disposeVisual(visual, constraint, reason) { disposed.push({ visual, constraint, reason }); },
    onDiagnostic(value) { diagnostics.push(value); },
    ...overrides
  });
}

const visuals = visualFactory();
assert.strictEqual(visuals.start(), 1, 'An active runtime constraint must create one link visual.');
assert.strictEqual(visuals.size, 1);
assert.strictEqual(updated.length, 1);
assert.deepStrictEqual(updated.at(-1).state.endpointA, { x: 1, y: 0, z: 0 });
assert.deepStrictEqual(updated.at(-1).state.endpointB, { x: 3, y: 0, z: 0 });

bodies.get('body:a').x = 2;
visuals.sync();
assert.deepStrictEqual(updated.at(-1).state.endpointA, { x: 3, y: 0, z: 0 }, 'Body A movement must update endpoint A.');

bodies.get('body:b').angle = Math.PI / 2;
visuals.sync();
const rotatedB = updated.at(-1).state.endpointB;
assert(Math.abs(rotatedB.x - 4) < 1e-9 && Math.abs(rotatedB.y + 1) < 1e-9, 'Body B rotation must update endpoint B from pivotB.');

activeConstraints.delete('hinge:1');
assert.strictEqual(visuals.sync(), 0);
assert.strictEqual(visuals.size, 0, 'Removed runtime constraint must remove its visual.');
assert.strictEqual(disposed.at(-1).reason, 'constraint-inactive');
assert(diagnostics.some(item => item.code === 'mechanical-visual-constraint-inactive'));
assert.strictEqual(visuals.stop(), true, 'Transient registration must remain releasable after constraint removal.');
assert.strictEqual(visuals.stop(), false, 'Cleanup must be idempotent.');

activeConstraints.add('hinge:1');
assert.strictEqual(visuals.start(), 1);
assert.strictEqual(visuals.stop(), true);
assert.strictEqual(visuals.start(), 1, 'Stop/start must not retain duplicate visuals.');
assert.strictEqual(visuals.size, 1);
assert.strictEqual(visuals.stop(), true);
assert.strictEqual(disposed.length, created.length, 'Every created visual must be disposed exactly once.');

const brokenPlan = plan.constraints[0];
plan.constraints = [brokenPlan, { ...brokenPlan, constraintId: 'hinge:bad', pivotB: null }];
activeConstraints.add('hinge:bad');
const rollbackCreated = [], rollbackDisposed = [];
const rollback = visualFactory({
  createVisual(constraint) { const visual = { id: constraint.constraintId }; rollbackCreated.push(visual); return visual; },
  updateVisual() {},
  disposeVisual(visual) { rollbackDisposed.push(visual); }
});
assert.throws(() => rollback.start(), /pivotB must be a finite local pivot vector/);
assert.strictEqual(rollback.size, 0, 'Partial start failure must leave no visual entries.');
assert.deepStrictEqual(rollbackDisposed, rollbackCreated, 'Partial start failure must dispose already-created visuals.');

plan.constraints = [{ ...brokenPlan, bodyBId: 'body:missing' }];
assert.throws(() => visualFactory().start(), /missing runtime body/);

plan.constraints = [brokenPlan];
activeConstraints.add('hinge:1');
const noRootReferences = fs.readFileSync(path.join(ROOT, 'src/game/flight_mechanical_visuals.js'), 'utf8');
assert(!noRootReferences.includes('visualRoot'), 'Runtime mechanical links must not attach to a body visual root.');
const gameSource = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
assert(gameSource.includes('flightMechanicalVisuals.start();'));
assert(gameSource.includes('flightMechanicalVisuals.sync();'));

console.log(JSON.stringify({
  activeConstraintCreation: 'ok',
  bodyOwnedEndpoints: 'ok',
  movingAndRotatingBodies: 'ok',
  constraintRemoval: 'ok',
  stopStartIdempotence: 'ok',
  partialFailureCleanup: 'ok',
  missingBodyAndPivotErrors: 'ok',
  noVisualRootCoupling: 'ok'
}, null, 2));
