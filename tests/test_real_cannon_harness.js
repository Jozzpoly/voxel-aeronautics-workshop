const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const CANNON = require(path.join(__dirname, '..', 'vendor/cannon-0.6.2/cannon.min.js'));
global.window = global;
for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/mass_properties.js',
  'src/runtime/physics_port.js',
  'src/runtime/cannon_physics_backend.js',
  'src/runtime/assembly_builder.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const MassProperties = global.VAW.require('foundation.mass-properties');
const Physics = global.VAW.require('runtime.cannon-physics-backend').create(CANNON);
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');
const DT = 1 / 120;
const near = (actual, expected, epsilon, label) => assert(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} != ${expected}`);
const finiteBody = body => [
  body.position.x, body.position.y, body.position.z,
  body.velocity.x, body.velocity.y, body.velocity.z,
  body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z,
  body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w
].every(Number.isFinite);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function makePlan(count = 1, options = {}) {
  const bodyId = options.bodyId || 'body:root';
  const colliders = [];
  const parts = [];
  const blockIds = [];
  for (let index = 0; index < count; index += 1) {
    const blockId = `block:${index}`;
    const x = (index % 25) - 12;
    const y = Math.floor(index / 25) % 10;
    const z = Math.floor(index / 250);
    blockIds.push(blockId);
    colliders.push({
      colliderId: `collider:${blockId}`,
      blockId,
      bodyId,
      kind: 'box',
      center: [x, y, z],
      halfExtents: [0.5, 0.5, 0.5]
    });
    parts.push({ blockId, bodyId, type: index === 0 ? 'Core' : 'Hull' });
  }
  return {
    format: 'REAL_CANNON_HARNESS_PLAN',
    rootBodyId: bodyId,
    rigidBodies: [{
      bodyId,
      role: 'root',
      blockIds,
      sourceAssemblyCenterOfMass: [0, 0, 0], assemblyPose: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
      massProperties: {
        mass: options.mass || Math.max(1, count),
        centerOfMass: [0, 0, 0],
        inertiaDiagonal: options.inertia || [2, 4, 8]
      },
      colliders
    }],
    constraints: [],
    signalLinks: [],
    parts
  };
}

function build(plan, world, bodyDescriptor = {}) {
  return AssemblyBuilder.build({
    plan,
    physics: Physics,
    world,
    bodyDescriptor: { allowSleep: false, linearDamping: 0, angularDamping: 0, ...bodyDescriptor }
  });
}

const report = { backend: `${Physics.id} ${Physics.version}` };

{
  const world = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 }, allowSleep: false });
  const runtime = build(makePlan(1, { mass: 2, inertia: [2, 3, 4] }), world);
  for (let step = 0; step < 120; step += 1) Physics.step(world, DT);
  near(runtime.rootBody.velocity.y, -9.81, 0.03, 'real Cannon free-fall velocity');
  near(runtime.rootBody.inertia.x, 2, 1e-12, 'real Cannon inertia X');
  near(runtime.rootBody.inertia.y, 3, 1e-12, 'real Cannon inertia Y');
  near(runtime.rootBody.inertia.z, 4, 1e-12, 'real Cannon inertia Z');
  runtime.dispose();
  assert.strictEqual(world.bodies.length, 0);
  report.freeFall = 'ok';
  report.inertiaParity = 'ok';
}

{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const runtime = build(makePlan(1, { mass: 2, inertia: [2, 4, 8] }), world);
  for (let step = 0; step < 120; step += 1) {
    Physics.addTorque(runtime.rootBody, { x: 1, y: 0, z: 0 });
    Physics.step(world, DT);
  }
  near(runtime.rootBody.angularVelocity.x, 0.5, 0.01, 'real Cannon torque response');
  runtime.dispose();
  report.torqueResponse = 'ok';
}

{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const halfSqrt = Math.sqrt(0.5);
  const runtime = build(makePlan(1, { mass: 2, inertia: [2, 4, 8] }), world, {
    quaternion: { x: 0, y: 0, z: halfSqrt, w: halfSqrt }
  });
  Physics.addTorque(runtime.rootBody, { x: 1, y: 0, z: 0 });
  Physics.step(world, DT);
  near(runtime.rootBody.angularVelocity.x, DT / 4, 2e-5, 'real Cannon rotated inertia response');
  runtime.dispose();
  report.rotatedInertia = 'ok';
}

{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const runtime = build(makePlan(1, { mass: 1, inertia: [1, 1, 1] }), world);
  Physics.applyForce(runtime.rootBody, { x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 });
  Physics.step(world, DT);
  assert(runtime.rootBody.velocity.y > 0);
  assert(runtime.rootBody.angularVelocity.z > 0);
  runtime.dispose();
  report.offsetThrust = 'ok';
}

{
  const loaded = MassProperties.compute([
    { id: 'core', mass: 2, center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] },
    { id: 'payload', mass: 3, center: [0, -2, 0], halfExtents: [0.42, 0.42, 0.42] }
  ]);
  const remaining = MassProperties.compute([
    { id: 'core', mass: 2, center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] }
  ]);
  const coreOffset = loaded.elements.find(element => element.id === 'core').offset;
  const payloadOffset = loaded.elements.find(element => element.id === 'payload').offset;
  const plan = {
    format: 'REAL_CANNON_PAYLOAD_PLAN',
    rootBodyId: 'body:root',
    rigidBodies: [{
      bodyId: 'body:root', role: 'root', blockIds: ['core'], sourceAssemblyCenterOfMass: loaded.centerOfMass, assemblyPose: { position: loaded.centerOfMass, quaternion: [0, 0, 0, 1] },
      massProperties: { mass: loaded.mass, centerOfMass: [0, 0, 0], inertiaDiagonal: loaded.inertiaDiagonal },
      colliders: [
        { colliderId: 'collider:core', blockId: 'core', bodyId: 'body:root', kind: 'box', center: coreOffset, halfExtents: [0.5, 0.5, 0.5] },
        { colliderId: 'collider:mission-payload', blockId: null, bodyId: 'body:root', kind: 'box', center: payloadOffset, halfExtents: [0.42, 0.42, 0.42], payload: true }
      ]
    }],
    constraints: [], signalLinks: [], parts: [{ blockId: 'core', bodyId: 'body:root', type: 'Core' }]
  };
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const halfSqrt = Math.sqrt(0.5);
  const runtime = build(plan, world, {
    position: { x: 5, y: 3, z: -2 },
    quaternion: { x: 0, y: 0, z: halfSqrt, w: halfSqrt }
  });
  Physics.setBodyVelocity(runtime.rootBody, {
    linear: { x: 1, y: -0.5, z: 0.25 },
    angular: { x: 0, y: 0, z: 2 }
  });
  const shift = { x: coreOffset[0], y: coreOffset[1], z: coreOffset[2] };
  const expectedPosition = Physics.pointToWorldFrame(runtime.rootBody, shift);
  const expectedVelocity = Physics.getPointVelocity(runtime.rootBody, shift);
  assert(runtime.removeCollider('collider:mission-payload'));
  const recentered = runtime.recenterBody('body:root', shift);
  near(recentered.worldPosition.x, expectedPosition.x, 1e-9, 'payload recenter position X');
  near(recentered.worldPosition.y, expectedPosition.y, 1e-9, 'payload recenter position Y');
  near(recentered.linearVelocity.x, expectedVelocity.x, 1e-9, 'payload recenter velocity X');
  near(recentered.linearVelocity.y, expectedVelocity.y, 1e-9, 'payload recenter velocity Y');
  runtime.setBodyMassProperties('body:root', {
    mass: remaining.mass,
    centerOfMass: { x: 0, y: 0, z: 0 },
    inertiaDiagonal: {
      x: remaining.inertiaDiagonal[0],
      y: remaining.inertiaDiagonal[1],
      z: remaining.inertiaDiagonal[2]
    }
  });
  assert.strictEqual(runtime.rootBody.shapes.length, 1);
  assert(finiteBody(runtime.rootBody));
  runtime.dispose();
  report.payloadDetachRecenterDuringRotation = 'ok';
}

{
  const world = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 }, allowSleep: false });
  const ground = Physics.createBody({ mass: 0 });
  Physics.addPlaneCollider(ground, {});
  Physics.setBodyTransform(ground, { axisAngle: { axis: { x: 1, y: 0, z: 0 }, angle: -Math.PI / 2 } });
  Physics.addBody(world, ground);
  let collisions = 0;
  let maximumImpact = 0;
  const runtime = AssemblyBuilder.build({
    plan: makePlan(1, { mass: 2, inertia: [1, 1, 1] }),
    physics: Physics,
    world,
    bodyDescriptor: { position: { x: 0, y: 2, z: 0 }, allowSleep: false, linearDamping: 0, angularDamping: 0 },
    collisionListener: ({ event }) => {
      collisions += 1;
      maximumImpact = Math.max(maximumImpact, event.impactSpeed);
      assert(event.otherBody);
    }
  });
  for (let step = 0; step < 360; step += 1) Physics.step(world, DT);
  assert(collisions > 0, 'Real Cannon contact scenario produced no collision events.');
  assert(Number.isFinite(maximumImpact));
  runtime.dispose();
  Physics.removeBody(world, ground);
  assert.strictEqual(world.bodies.length, 0);
  report.normalizedContactEvents = 'ok';
}

{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const runtime = build(makePlan(1, { mass: 3, inertia: [2, 4, 6] }), world);
  for (let step = 0; step < 12000; step += 1) {
    const phase = step * DT;
    Physics.applyForce(runtime.rootBody, {
      x: Math.sin(phase) * 2,
      y: Math.cos(phase * 0.7),
      z: Math.sin(phase * 0.3)
    }, runtime.rootBody.position);
    Physics.addTorque(runtime.rootBody, { x: 0.1, y: Math.sin(phase) * 0.2, z: -0.08 });
    Physics.step(world, DT);
  }
  assert(finiteBody(runtime.rootBody), 'Real Cannon soak produced a non-finite body state.');
  near(Math.hypot(runtime.rootBody.quaternion.x, runtime.rootBody.quaternion.y, runtime.rootBody.quaternion.z, runtime.rootBody.quaternion.w), 1, 1e-6, 'real Cannon normalized quaternion');
  runtime.dispose();
  report.longSoakSteps = 12000;
}

const benchmark = [];
for (const count of [100, 500, 1000, 2500]) {
  const buildSamples = [];
  const stepSamples = [];
  for (let run = 0; run < 3; run += 1) {
    const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false, broadphase: 'sap' });
    const start = performance.now();
    const runtime = build(makePlan(count, { mass: count, inertia: [count, count * 1.2, count * 1.4] }), world);
    buildSamples.push(performance.now() - start);
    for (let step = 0; step < 120; step += 1) {
      const stepStart = performance.now();
      Physics.step(world, DT);
      stepSamples.push(performance.now() - stepStart);
    }
    assert(finiteBody(runtime.rootBody));
    runtime.dispose();
    assert.strictEqual(world.bodies.length, 0);
  }
  const buildMax = Math.max(...buildSamples);
  assert(buildMax < 10000, `Real Cannon build exceeded safety ceiling for ${count} colliders: ${buildMax} ms`);
  benchmark.push({
    colliders: count,
    medianBuildMs: Number(percentile(buildSamples, 0.5).toFixed(3)),
    maxBuildMs: Number(buildMax.toFixed(3)),
    medianStepMs: Number(percentile(stepSamples, 0.5).toFixed(4)),
    p99StepMs: Number(percentile(stepSamples, 0.99).toFixed(4))
  });
}
report.benchmark = benchmark;

{
  if (typeof global.gc === 'function') global.gc();
  const before = process.memoryUsage().heapUsed;
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
  for (let cycle = 0; cycle < 50; cycle += 1) {
    const runtime = build(makePlan(100, { mass: 100, inertia: [100, 120, 140] }), world);
    Physics.step(world, DT);
    runtime.dispose();
    assert.strictEqual(world.bodies.length, 0, `Lifecycle cycle ${cycle} left a body in the world.`);
  }
  if (typeof global.gc === 'function') global.gc();
  const after = process.memoryUsage().heapUsed;
  const heapDeltaBytes = after - before;
  assert(Number.isFinite(heapDeltaBytes));
  assert(heapDeltaBytes < 128 * 1024 * 1024, `Lifecycle heap growth exceeded safety ceiling: ${heapDeltaBytes} bytes`);
  report.lifecycleCycles = 50;
  report.lifecycleHeapDeltaBytes = heapDeltaBytes;
}

console.log(JSON.stringify(report, null, 2));
