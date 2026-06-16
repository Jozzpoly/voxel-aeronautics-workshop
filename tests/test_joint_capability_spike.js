const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.CANNON = require(path.join(ROOT, 'tests/vendor/cannon-0.6.2/cannon.min.js'));
for (const relative of [
  'src/foundation/kernel.js',
  'src/runtime/physics_port.js',
  'src/runtime/cannon_physics_backend.js',
  'src/runtime/assembly_builder.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const PhysicsPort = global.VAW.require('runtime.physics-port');
const Physics = global.VAW.require('runtime.cannon-physics-backend').create(global.CANNON);
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');
const DT = 1 / 120;

function near(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

function finiteBody(body) {
  return [
    body.position, body.velocity, body.angularVelocity, body.quaternion, body.inertia
  ].every(value => value && Object.values(value).every(Number.isFinite));
}

function bodyPlan(bodyId, blockId, mass, inertiaDiagonal) {
  return {
    bodyId,
    role: bodyId === 'body:root' ? 'root' : 'subassembly',
    blockIds: [blockId],
    sourceAssemblyCenterOfMass: [0, 0, 0],
    assemblyPose: { position: bodyId === 'body:root' ? [0, 0, 0] : [0, 1.6, 0], quaternion: [0, 0, 0, 1] },
    massProperties: { mass, centerOfMass: [0, 0, 0], inertiaDiagonal },
    colliders: [{
      colliderId: `collider:${blockId}`,
      blockId,
      bodyId,
      kind: 'box',
      center: [0, 0, 0],
      halfExtents: [0.4, 0.8, 0.4]
    }]
  };
}

function makePlan(options = {}) {
  return {
    format: 'VAW_JOINT_SPIKE_PLAN_V1',
    rootBodyId: 'body:root',
    rigidBodies: [
      bodyPlan('body:root', 'core', 10, [4, 5, 6]),
      bodyPlan('body:rotor', 'rotor', 2, [0.8, 1, 1.2])
    ],
    constraints: [{
      constraintId: 'hinge:rotor',
      kind: 'hinge',
      bodyAId: 'body:root',
      bodyBId: 'body:rotor',
      endpointA: { blockId: 'core', face: 'PY' },
      endpointB: { blockId: 'rotor', face: 'NY' },
      pivotA: [0, 0.8, 0],
      pivotB: [0, -0.8, 0],
      axisA: [0, 0, 1],
      axisB: [0, 0, 1],
      collideConnected: options.collideConnected === true,
      maxForce: 1e6,
      frictionTorque: options.frictionTorque || 0,
      limits: options.limits || null,
      control: options.control || { mode: 'free' }
    }],
    signalLinks: options.signalLinks || [],
    parts: [
      { blockId: 'core', bodyId: 'body:root', type: 'Core' },
      { blockId: 'rotor', bodyId: 'body:rotor', type: 'Frame' }
    ]
  };
}

function buildAssembly(options = {}, physics = Physics) {
  const world = physics.createWorld({
    gravity: { x: 0, y: 0, z: 0 },
    allowSleep: false,
    solverIterations: 40,
    solverTolerance: 1e-7
  });
  const plan = makePlan(options);
  const runtime = AssemblyBuilder.build({
    plan,
    physics,
    world,
    bodyDescriptor: body => ({
      position: body.bodyId === 'body:root'
        ? { x: 0, y: 0, z: 0 }
        : { x: 0, y: 1.6, z: 0 },
      allowSleep: false,
      linearDamping: 0,
      angularDamping: 0
    })
  });
  return { world, plan, runtime };
}

function pivotDrift(runtime) {
  const bodyA = runtime.bodyById.get('body:root').body;
  const bodyB = runtime.bodyById.get('body:rotor').body;
  const pivotA = Physics.pointToWorldFrame(bodyA, { x: 0, y: 0.8, z: 0 });
  const pivotB = Physics.pointToWorldFrame(bodyB, { x: 0, y: -0.8, z: 0 });
  return Math.hypot(pivotA.x - pivotB.x, pivotA.y - pivotB.y, pivotA.z - pivotB.z);
}

assert.strictEqual(PhysicsPort.supportsConstraint(Physics, PhysicsPort.CONSTRAINT_TYPES.HINGE), true);
assert.strictEqual(Physics.capabilities.constraints.hinge, true);
assert.throws(() => PhysicsPort.normalizeConstraintPlan({ kind: 'ball' }), /Unsupported constraint kind/);
assert.throws(() => PhysicsPort.normalizeConstraintPlan({
  kind: 'hinge', axisA: [0, 0, 0], axisB: [0, 0, 1]
}), /non-zero length/);
assert.throws(() => PhysicsPort.normalizeConstraintPlan({
  kind: 'hinge', limits: { minAngle: 1, maxAngle: -1 }
}), /minAngle < maxAngle/);
assert.throws(() => PhysicsPort.normalizeConstraintControl({ mode: 'teleport' }), /Unsupported hinge control mode/);


{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
  const bodyA = Physics.createBody({ mass: 1, position: { x: 0, y: 0, z: 0 } });
  const bodyB = Physics.createBody({ mass: 1, position: { x: 0, y: 1, z: 0 } });
  const hinge = Physics.createConstraint({
    kind: 'hinge', bodyA, bodyB,
    pivotA: { x: 0, y: 0.5, z: 0 },
    pivotB: { x: 0, y: -0.5, z: 0 },
    axisA: { x: 0, y: 0, z: 1 },
    axisB: { x: 0, y: 0, z: 1 }
  });
  assert.throws(
    () => Physics.addConstraint(world, hinge),
    /must be added to the target world first/,
    'Constraint registration must not accept bodies outside the target world.'
  );
  assert.strictEqual(world.constraints.length, 0);
}

let maximumFreePivotDrift = 0;
{
  const { world, runtime } = buildAssembly();
  const root = runtime.bodyById.get('body:root').body;
  const rotor = runtime.bodyById.get('body:rotor').body;
  assert.strictEqual(root.mass, 10);
  assert.strictEqual(rotor.mass, 2);
  near(root.inertia.x, 4, 1e-12, 'root inertia');
  near(rotor.inertia.z, 1.2, 1e-12, 'rotor inertia');
  for (let step = 0; step < 240; step += 1) {
    Physics.addTorque(rotor, { x: 0, y: 0, z: 5 });
    Physics.step(world, DT);
    maximumFreePivotDrift = Math.max(maximumFreePivotDrift, pivotDrift(runtime));
  }
  const state = runtime.getConstraintState('hinge:rotor');
  assert(state.angle > 1, `Free hinge did not rotate: ${state.angle}`);
  assert(maximumFreePivotDrift < 0.03, `Free hinge pivot drift exceeded spike ceiling: ${maximumFreePivotDrift}`);
  runtime.dispose();
  assert.strictEqual(world.bodies.length, 0);
  assert.strictEqual(world.constraints.length, 0);
}

let motorState;
{
  const { world, plan, runtime } = buildAssembly({ signalLinks: [{ source: 'pilot.aux1', target: 'hinge:rotor.speed' }] });
  const serializedPlan = JSON.stringify(plan);
  runtime.setConstraintControl('hinge:rotor', {
    mode: 'motor', targetSpeed: 1.5, maxSpeed: 2, maxTorque: 40
  });
  for (let step = 0; step < 360; step += 1) Physics.step(world, DT);
  motorState = runtime.getConstraintState('hinge:rotor');
  near(motorState.angularVelocity, 1.5, 0.02, 'hinge motor target speed');
  assert(motorState.angle > 4);
  assert(pivotDrift(runtime) < 0.01);
  assert.strictEqual(JSON.stringify(plan), serializedPlan, 'Runtime control must not mutate mechanical or signal plans.');
  assert.throws(
    () => Physics.removeBody(world, runtime.bodyById.get('body:rotor').body),
    /active constraint still references it/,
    'A constrained body must not be removed before its constraint.'
  );
  assert.strictEqual(runtime.removeConstraint('hinge:rotor'), true);
  assert.strictEqual(runtime.removeConstraint('hinge:rotor'), false);
  assert.strictEqual(runtime.constraintById.size, 0);
  assert.strictEqual(world.constraints.length, 0);
  assert.strictEqual(world.bodies.length, 2, 'Removing a constraint must not remove connected bodies.');
  runtime.dispose();
  assert.strictEqual(world.bodies.length, 0);
}

let servoState;
{
  const { world, runtime } = buildAssembly();
  runtime.setConstraintControl('hinge:rotor', {
    mode: 'servo', targetAngle: 0.7, maxTorque: 30, maxSpeed: 1.5,
    positionGain: 4, velocityDamping: 0.5
  });
  for (let step = 0; step < 600; step += 1) Physics.step(world, DT);
  servoState = runtime.getConstraintState('hinge:rotor');
  near(servoState.angle, 0.7, 0.005, 'positive servo target');
  assert(Math.abs(servoState.angularVelocity) < 0.01);
  runtime.setConstraintControl('hinge:rotor', {
    mode: 'servo', targetAngle: -0.5, maxTorque: 30, maxSpeed: 1.5,
    positionGain: 4, velocityDamping: 0.5
  });
  for (let step = 0; step < 720; step += 1) Physics.step(world, DT);
  servoState = runtime.getConstraintState('hinge:rotor');
  near(servoState.angle, -0.5, 0.005, 'negative servo target');
  assert(Math.abs(servoState.angularVelocity) < 0.01);
  assert(pivotDrift(runtime) < 0.01);
  runtime.dispose();
}

let frictionAngle;
{
  const { world, runtime } = buildAssembly({ frictionTorque: 5 });
  const rotor = runtime.bodyById.get('body:rotor').body;
  for (let step = 0; step < 600; step += 1) {
    Physics.addTorque(rotor, { x: 0, y: 0, z: 4 });
    Physics.step(world, DT);
  }
  frictionAngle = runtime.getConstraintState('hinge:rotor').angle;
  assert(Math.abs(frictionAngle) < 0.01, `Passive hinge friction failed to resist sub-limit torque: ${frictionAngle}`);
  runtime.dispose();
}

let minimumLimitedAngle = Infinity;
let maximumLimitedAngle = -Infinity;
let maximumSoakPivotDrift = 0;
{
  const limits = {
    minAngle: -0.3,
    maxAngle: 0.3,
    tolerance: 0.03,
    maxTorque: 200,
    maxSpeed: 5,
    positionGain: 20,
    velocityDamping: 2
  };
  const { world, runtime } = buildAssembly({ limits });
  const rotor = runtime.bodyById.get('body:rotor').body;
  for (let step = 0; step < 12000; step += 1) {
    Physics.addTorque(rotor, { x: 0, y: 0, z: step < 6000 ? 20 : -20 });
    Physics.step(world, DT);
    const state = runtime.getConstraintState('hinge:rotor');
    minimumLimitedAngle = Math.min(minimumLimitedAngle, state.angle);
    maximumLimitedAngle = Math.max(maximumLimitedAngle, state.angle);
    maximumSoakPivotDrift = Math.max(maximumSoakPivotDrift, pivotDrift(runtime));
    assert(finiteBody(runtime.rootBody));
    assert(finiteBody(rotor));
  }
  assert(minimumLimitedAngle >= -0.33, `Lower soft limit overshoot exceeded ceiling: ${minimumLimitedAngle}`);
  assert(maximumLimitedAngle <= 0.33, `Upper soft limit overshoot exceeded ceiling: ${maximumLimitedAngle}`);
  assert(maximumSoakPivotDrift < 0.1, `Joint soak pivot drift exceeded ceiling: ${maximumSoakPivotDrift}`);
  runtime.dispose();
}

function overlappingCollisionCount(collideConnected) {
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false, solverIterations: 20 });
  const bodyA = Physics.createBody({ mass: 1, position: { x: 0, y: 0, z: 0 }, allowSleep: false });
  const bodyB = Physics.createBody({ mass: 1, position: { x: 0.5, y: 0, z: 0 }, allowSleep: false });
  for (const body of [bodyA, bodyB]) {
    Physics.addBoxCollider(body, { halfExtents: { x: 0.5, y: 0.5, z: 0.5 } });
    Physics.setBodyMassProperties(body, { mass: 1, inertiaDiagonal: { x: 1, y: 1, z: 1 } });
    Physics.addBody(world, body);
  }
  let collisions = 0;
  const unsubscribe = Physics.addCollisionListener(bodyA, () => { collisions += 1; });
  const hinge = Physics.createConstraint({
    kind: 'hinge', bodyA, bodyB,
    pivotA: { x: 0.25, y: 0, z: 0 },
    pivotB: { x: -0.25, y: 0, z: 0 },
    axisA: { x: 0, y: 0, z: 1 },
    axisB: { x: 0, y: 0, z: 1 },
    collideConnected
  });
  Physics.addConstraint(world, hinge);
  for (let step = 0; step < 10; step += 1) Physics.step(world, 1 / 60);
  assert.strictEqual(hinge.native.collideConnected, collideConnected);
  assert.strictEqual(Physics.removeConstraint(world, hinge), true);
  assert.strictEqual(Physics.removeConstraint(world, hinge), false);
  unsubscribe();
  Physics.removeBody(world, bodyB);
  Physics.removeBody(world, bodyA);
  return collisions;
}

const collisionsDisabled = overlappingCollisionCount(false);
const collisionsEnabled = overlappingCollisionCount(true);
assert.strictEqual(collisionsDisabled, 0, 'Connected-body collisions should be disabled explicitly.');
assert(collisionsEnabled > 0, 'Connected-body collisions should be observable when enabled.');

{
  const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
  assert.throws(() => AssemblyBuilder.build({
    plan: makePlan(),
    physics: Physics,
    world,
    bodyDescriptor: body => ({
      position: body.bodyId === 'body:root' ? { x: 0, y: 0, z: 0 } : { x: 0, y: 3, z: 0 }
    })
  }), /pivots must coincide/);
  assert.strictEqual(world.bodies.length, 0, 'Invalid hinge geometry must roll back allocated bodies.');
  assert.strictEqual(world.constraints.length, 0);
}

{
  const failingPhysics = {
    ...Physics,
    id: 'cannon-hinge-build-failure',
    createConstraint() { throw new Error('synthetic hinge construction failure'); }
  };
  const world = failingPhysics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
  assert.throws(() => AssemblyBuilder.build({
    plan: makePlan(),
    physics: failingPhysics,
    world,
    bodyDescriptor: body => ({ position: body.bodyId === 'body:root' ? { x: 0, y: 0, z: 0 } : { x: 0, y: 1.6, z: 0 } })
  }), /synthetic hinge construction failure/);
  assert.strictEqual(world.bodies.length, 0, 'Constraint construction failure must roll back bodies.');
  assert.strictEqual(world.constraints.length, 0, 'Constraint construction failure must not leak constraints.');
}

{
  let rejectRemoval = true;
  const removalPhysics = {
    ...Physics,
    id: 'cannon-hinge-removal-failure',
    removeConstraint(world, constraint) {
      if (rejectRemoval) { rejectRemoval = false; return false; }
      return Physics.removeConstraint(world, constraint);
    }
  };
  const { world, runtime } = buildAssembly({}, removalPhysics);
  assert.strictEqual(runtime.removeConstraint('hinge:rotor'), false);
  assert.strictEqual(runtime.constraintById.size, 1, 'Failed backend removal must preserve runtime constraint maps.');
  assert.strictEqual(world.constraints.length, 1);
  assert.strictEqual(runtime.removeConstraint('hinge:rotor'), true);
  assert.strictEqual(runtime.constraintById.size, 0);
  assert.strictEqual(world.constraints.length, 0);
  runtime.dispose();
}


{
  let rejectDisposeOnce = true;
  const retryPhysics = {
    ...Physics,
    id: 'cannon-hinge-dispose-retry',
    removeConstraint(world, constraint) {
      if (rejectDisposeOnce) { rejectDisposeOnce = false; return false; }
      return Physics.removeConstraint(world, constraint);
    }
  };
  const { world, runtime } = buildAssembly({}, retryPhysics);
  assert.throws(() => runtime.dispose(), /cleanup failed/);
  assert.strictEqual(runtime.disposed, false, 'Failed cleanup must not report a disposed assembly.');
  assert.strictEqual(runtime.cleanupPending, true, 'Failed cleanup must enter an explicit retry-only state.');
  assert.strictEqual(runtime.constraintById.size, 1, 'Failed constraint cleanup must preserve the retry handle.');
  assert.strictEqual(world.constraints.length, 1);
  assert.strictEqual(world.bodies.length, 2, 'Bodies must remain while a referenced constraint survives cleanup.');
  assert.throws(() => runtime.getConstraintState('hinge:rotor'), /cleanup is incomplete/);
  assert.strictEqual(runtime.dispose(), true, 'A second dispose call must finish transiently rejected cleanup.');
  assert.strictEqual(runtime.cleanupPending, false);
  assert.strictEqual(runtime.disposed, true);
  assert.strictEqual(world.constraints.length, 0);
  assert.strictEqual(world.bodies.length, 0);
}

console.log(JSON.stringify({
  backend: `${Physics.id} ${Physics.version}`,
  hingeCapability: 'ok',
  separateBodyMassProperties: 'ok',
  freeHinge: 'ok',
  motor: { targetSpeed: 1.5, measuredSpeed: Number(motorState.angularVelocity.toFixed(6)) },
  servo: { targetAngle: -0.5, measuredAngle: Number(servoState.angle.toFixed(6)) },
  passiveFriction: { finalAngle: Number(frictionAngle.toFixed(6)) },
  softLimits: {
    configured: [-0.3, 0.3],
    observed: [Number(minimumLimitedAngle.toFixed(6)), Number(maximumLimitedAngle.toFixed(6))]
  },
  collisionToggle: { disabledContacts: collisionsDisabled, enabledContacts: collisionsEnabled },
  soakSteps: 12000,
  maximumFreePivotDrift: Number(maximumFreePivotDrift.toFixed(6)),
  maximumSoakPivotDrift: Number(maximumSoakPivotDrift.toFixed(6)),
  lifecycleAndRollback: 'ok',
  retrySafeAssemblyDisposal: 'ok',
  worldMembershipPreflight: 'ok',
  signalMechanicalSeparation: 'ok'
}, null, 2));
