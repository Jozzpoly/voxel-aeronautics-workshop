const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, FOUNDATION_SOURCES, RUNTIME_SOURCES, load } = require('./load_runtime');

load([...FOUNDATION_SOURCES, ...RUNTIME_SOURCES], { stubs: true });
global.CANNON = require(path.join(ROOT, 'vendor/cannon-0.6.2/cannon.min.js'));
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/game/flight_session.js'), 'utf8'), { filename: 'src/game/flight_session.js' });

const CraftModel = VAW.require('foundation.craft-model');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const AssemblyBuilder = VAW.require('runtime.assembly-builder');
const Physics = VAW.require('runtime.cannon-physics-backend').create(global.CANNON);
const FlightSession = VAW.require('game.flight-session');
const DT = 1 / 120;

const document = {
  version: 11,
  blocks: [
    { blockId: 'core', x: 0, y: 0, z: 0, type: 'Core' },
    { blockId: 'root-frame', x: 1, y: 0, z: 0, type: 'Frame' },
    { blockId: 'arm', x: 2, y: 0, z: 0, type: 'Frame' },
    { blockId: 'arm-tip', x: 3, y: 0, z: 0, type: 'Hull' }
  ],
  mechanicalLinks: [{
    mechanicalLinkId: 'mechanical:arm', kind: 'hinge',
    endpointA: { blockId: 'root-frame', face: 'PX' }, endpointB: { blockId: 'arm', face: 'NX' },
    axis: 'PY', collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null
  }]
};
const model = CraftModel.create(document);
const compiled = CraftCompiler.compile(model);
assert(compiled.ready, compiled.errors.join(', '));
const plan = RuntimeAssembly.createPlan(compiled);
assert.strictEqual(plan.rigidBodies.length, 2);
assert.strictEqual(plan.constraints.length, 1);
assert.deepStrictEqual(plan.bodyIdToPartBlockIds['body:core'], ['core', 'root-frame']);
assert.deepStrictEqual(plan.bodyIdToPartBlockIds['body:arm'], ['arm', 'arm-tip']);

function vector(values) { return { x: values[0], y: values[1], z: values[2] }; }
function quaternion(values) { return { x: values[0], y: values[1], z: values[2], w: values[3] }; }
const spawn = { position: [10, 5, -3], quaternion: [0, 0, 0, 1] };
function descriptor(bodyPlan) {
  const pose = RuntimeAssembly.worldBodyPose(spawn, bodyPlan);
  return {
    position: vector(pose.position), quaternion: quaternion(pose.quaternion),
    allowSleep: false, linearDamping: 0, angularDamping: 0
  };
}
function root() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
  };
}

const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false, solverIterations: 40, solverTolerance: 1e-7 });
const state = { flight: {} };
let disposedVisuals = 0;
const session = FlightSession.create({ state, RuntimeAssembly, AssemblyBuilder, Physics, world, removeVisualRoot: () => { disposedVisuals += 1; } });

const started = session.start({ snapshot: compiled, bodyDescriptor: descriptor });
assert.strictEqual(started.plan.format, 'VAW_RUNTIME_ASSEMBLY_PLAN_V3');
assert.strictEqual(started.primaryBodyId, 'body:core');
assert.deepStrictEqual(session.bodyIds(), ['body:arm', 'body:core']);
assert.strictEqual(world.bodies.length, 2);
assert.strictEqual(world.constraints.length, 1);
for (const bodyId of session.bodyIds()) session.registerVisualRoot(bodyId, root());
session.syncVisuals();
for (const bodyPlan of plan.rigidBodies) {
  const expected = RuntimeAssembly.worldBodyPose(spawn, bodyPlan).position;
  const visual = session.getVisualRoot(bodyPlan.bodyId);
  assert.deepStrictEqual([visual.position.x, visual.position.y, visual.position.z], expected);
}
assert.throws(() => session.recenterBody('body:core', { x: 0.1, y: 0, z: 0 }), /active constraints/);
session.setConstraintControl('mechanical:arm', { mode: 'motor', targetSpeed: 1, maxSpeed: 2, maxTorque: 40 });
for (let step = 0; step < 360; step += 1) Physics.step(world, DT);
const motorState = session.getConstraintState('mechanical:arm');
assert(Number.isFinite(motorState.angle) && Number.isFinite(motorState.angularVelocity));
assert(Math.abs(motorState.angularVelocity) > 0.25, `Compiled hinge motor did not move: ${motorState.angularVelocity}`);
const broken = session.breakConstraintsForEndpointBlock('arm', 'test endpoint failure');
assert.deepStrictEqual(broken, ['mechanical:arm']);
assert.strictEqual(world.constraints.length, 0);
assert.strictEqual(session.constraintIdsForBody('body:arm').length, 0);
assert(session.stop());
assert.strictEqual(world.bodies.length, 0);
assert.strictEqual(world.constraints.length, 0);
assert.strictEqual(disposedVisuals, 2);

// Repeated normal compiled lifecycle, including independent visual roots.
for (let cycle = 0; cycle < 50; cycle += 1) {
  session.start({ snapshot: compiled, bodyDescriptor: descriptor });
  for (const bodyId of session.bodyIds()) session.registerVisualRoot(bodyId, root());
  Physics.step(world, DT);
  session.syncVisuals();
  assert(session.stop());
  assert.strictEqual(world.bodies.length, 0, `orphan body after cycle ${cycle}`);
  assert.strictEqual(world.constraints.length, 0, `orphan constraint after cycle ${cycle}`);
}
assert.strictEqual(disposedVisuals, 102);

// Single-body craft still uses the same production path and keeps the Core body primary.
const single = CraftCompiler.compile(CraftModel.create({ version: 11, blocks: [
  { blockId: 'core-single', x: 0, y: 0, z: 0, type: 'Core' },
  { blockId: 'thruster-single', x: 0, y: 1, z: 0, type: 'Thruster' }
], mechanicalLinks: [] }));
assert(single.ready, single.errors.join(', '));
const singlePlan = RuntimeAssembly.createPlan(single);
assert.strictEqual(singlePlan.rigidBodies.length, 1);
session.start({ snapshot: single, bodyDescriptor: bodyPlan => {
  const pose = RuntimeAssembly.worldBodyPose({ position: [0, 2, 0], quaternion: [0, 0, 0, 1] }, bodyPlan);
  return { position: vector(pose.position), quaternion: quaternion(pose.quaternion), allowSleep: false };
} });
assert.strictEqual(session.primaryBodyId(), 'body:core-single');
assert(session.stop());
assert.strictEqual(world.bodies.length, 0);

console.log(JSON.stringify({
  normalCompiledArticulatedPath: 'ok', realCannonHinge: 'ok', neutralMotorCommand: 'ok',
  endpointFailure: 'ok', constrainedRebaseGuard: 'ok', visualRoots: 2,
  articulatedLifecycleCycles: 50, singleBodyRegression: 'ok', orphanBodies: world.bodies.length, orphanConstraints: world.constraints.length
}, null, 2));
