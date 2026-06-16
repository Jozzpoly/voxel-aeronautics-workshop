const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of [
  'src/foundation/kernel.js',
  'src/runtime/physics_port.js',
  'src/runtime/headless_physics_backend.js',
  'src/runtime/assembly_builder.js',
  'src/game/flight_session.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });

const PhysicsBase = global.VAW.require('runtime.headless-physics-backend').create();
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');
const FlightSession = global.VAW.require('game.flight-session');
const RuntimeAssembly = { createPlan(snapshot) { return snapshot; } };

function body(bodyId, blockId, x = 0, role = 'subassembly') {
  return {
    bodyId, role, blockIds: [blockId], sourceCenterOfMass: [x, 0, 0],
    massProperties: { mass: 1, centerOfMass: [0, 0, 0], inertiaDiagonal: [1, 1, 1] },
    colliders: [{ colliderId: `collider:${blockId}`, blockId, bodyId, kind: 'box', center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] }]
  };
}
function plan(ids = ['body:root']) {
  const rigidBodies = ids.map((id, index) => body(id, `block:${index}`, index * 2, id === 'body:root' ? 'root' : 'subassembly'));
  return {
    format: 'TEST_ASSEMBLY',
    rootBodyId: ids.includes('body:root') ? 'body:root' : ids[0],
    rigidBodies,
    constraints: ids.length === 2 ? [{ constraintId: 'hinge:1', kind: 'hinge', bodyAId: ids[0], bodyBId: ids[1] }] : [],
    signalLinks: [],
    parts: rigidBodies.map((entry, index) => ({ blockId: `block:${index}`, bodyId: entry.bodyId, type: index ? 'Frame' : 'Core' }))
  };
}
function state() {
  return { flight: { assembly: null, assemblyRuntime: null, assemblyPlan: null, primaryBodyId: null, primaryBody: null, body: null, visualRootByBodyId: new Map(), cleanupPending: false } };
}
function root() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
  };
}

// 0-body sessions are rejected before backend allocation.
{
  const world = PhysicsBase.createWorld();
  const session = FlightSession.create({ state: state(), RuntimeAssembly, AssemblyBuilder, Physics: PhysicsBase, world });
  assert.throws(() => session.start({ assemblyPlan: { rootBodyId: '', rigidBodies: [], constraints: [], signalLinks: [], parts: [] } }), /at least one rigid body/);
  assert.strictEqual(world.bodies.length, 0);
}

// Deterministic primary policy, per-body visual ownership, neutral body access and exact collider ownership.
{
  const flightState = state();
  const cleanupOrder = [];
  const orderedPhysics = {
    ...PhysicsBase,
    id: 'headless-flight-session-order',
    addCollisionListener(bodyValue, listener) {
      const stop = PhysicsBase.addCollisionListener(bodyValue, listener);
      return () => { cleanupOrder.push('listener'); return stop(); };
    },
    removeCollider(bodyValue, shapeValue) { cleanupOrder.push('collider'); return PhysicsBase.removeCollider(bodyValue, shapeValue); },
    removeBody(worldValue, bodyValue) { cleanupOrder.push('body'); return PhysicsBase.removeBody(worldValue, bodyValue); }
  };
  const world = orderedPhysics.createWorld();
  const session = FlightSession.create({ state: flightState, RuntimeAssembly, AssemblyBuilder, Physics: orderedPhysics, world });
  const started = session.start({
    assemblyPlan: plan(['body:z', 'body:a']),
    bodyDescriptor: bodyPlan => ({ position: { x: bodyPlan.bodyId === 'body:z' ? 5 : 9, y: 3, z: -2 } }),
    constraintBuilder: ({ constraintPlan }) => ({
      constraintId: constraintPlan.constraintId,
      dispose() { cleanupOrder.push('constraint'); return true; }
    }),
    collisionListener() {}
  });
  assert.strictEqual(started.primaryBodyId, 'body:z', 'rootBodyId must win over input ordering.');
  assert.strictEqual(session.primaryBodyId(), 'body:z');
  assert.deepStrictEqual(session.bodyIds(), ['body:a', 'body:z']);
  assert.strictEqual(flightState.flight.assembly, started.assembly);
  assert.strictEqual(flightState.flight.assemblyRuntime, started.assembly, 'Compatibility alias must reference the same assembly.');
  assert.strictEqual(session.getBodyIdForBlock('block:1'), 'body:a');
  assert.deepStrictEqual(session.getColliderOwnershipByBlockId('block:1'), { colliderId: 'collider:block:1', blockId: 'block:1', bodyId: 'body:a' });

  const rootZ = root();
  const rootA = root();
  session.registerVisualRoot('body:z', rootZ, () => { cleanupOrder.push('visual:z'); return true; });
  session.registerVisualRoot('body:a', rootA, () => { cleanupOrder.push('visual:a'); return true; });
  session.syncVisuals();
  assert.deepStrictEqual([rootZ.position.x, rootZ.position.y, rootZ.position.z], [5, 3, -2]);
  assert.deepStrictEqual([rootA.position.x, rootA.position.y, rootA.position.z], [9, 3, -2]);
  session.setBodyTransform('body:a', { position: { x: 22, y: 4, z: 1 } });
  session.syncVisuals();
  assert.strictEqual(rootA.position.x, 22);
  assert.strictEqual(rootZ.position.x, 5, 'Moving one body must not move another visual root.');

  session.registerTransient(() => { cleanupOrder.push('listener'); return true; }, 'test listener');
  // RuntimeAssembly owns order: constraints are disposed before backend bodies.
  assert.strictEqual(session.stop(), true);
  assert.strictEqual(session.stop(), false);
  const constraintIndex = cleanupOrder.indexOf('constraint');
  const listenerIndex = cleanupOrder.indexOf('listener');
  const colliderIndex = cleanupOrder.indexOf('collider');
  const bodyIndex = cleanupOrder.indexOf('body');
  assert(constraintIndex >= 0 && listenerIndex > constraintIndex && colliderIndex > constraintIndex);
  assert(bodyIndex > listenerIndex && bodyIndex > colliderIndex, 'Bodies must outlive constraints, listeners, and colliders.');
  assert(cleanupOrder.indexOf('visual:a') > bodyIndex, 'Visual disposal follows physics ownership cleanup.');
  assert.strictEqual(world.bodies.length, 0);
  assert.strictEqual(flightState.flight.assembly, null);
}

// Primary selection cannot depend on array order when there is no role marker.
{
  const run = ids => {
    const p = plan(ids);
    p.rootBodyId = 'body:a';
    p.rigidBodies.forEach(item => { item.role = 'subassembly'; });
    p.constraints = [];
    const s = FlightSession.create({ state: state(), RuntimeAssembly, AssemblyBuilder, Physics: PhysicsBase, world: PhysicsBase.createWorld() });
    s.start({ assemblyPlan: p });
    const selected = s.primaryBodyId();
    s.stop();
    return selected;
  };
  assert.strictEqual(run(['body:z', 'body:a', 'body:m']), 'body:a');
  assert.strictEqual(run(['body:m', 'body:z', 'body:a']), 'body:a');
}

// A failed backend cleanup preserves the authoritative assembly and can be retried.
{
  let rejectOnce = true;
  const cleanupPhysics = {
    ...PhysicsBase,
    id: 'headless-flight-session-retry',
    removeBody(world, bodyValue) {
      if (rejectOnce) { rejectOnce = false; return false; }
      return PhysicsBase.removeBody(world, bodyValue);
    }
  };
  const flightState = state();
  const world = cleanupPhysics.createWorld();
  const session = FlightSession.create({ state: flightState, RuntimeAssembly, AssemblyBuilder, Physics: cleanupPhysics, world });
  const first = session.start({ assemblyPlan: plan() });
  let error = null;
  try { session.stop(); } catch (value) { error = value; }
  assert(error);
  assert.strictEqual(error.cleanupComplete, false);
  assert.strictEqual(flightState.flight.assembly, first.assembly, 'Failed cleanup must retain retry handles.');
  assert.strictEqual(flightState.flight.cleanupPending, true);
  assert.strictEqual(session.stop(), true);
  assert.strictEqual(flightState.flight.assembly, null);
  assert.strictEqual(world.bodies.length, 0);

  // start -> stop -> start must not inherit the old assembly.
  const second = session.start({ assemblyPlan: plan(), bodyDescriptor: { position: { x: 17, y: 0, z: 0 } } });
  assert.notStrictEqual(second.assembly, first.assembly);
  assert.strictEqual(session.getBodyTransform().position.x, 17);
  session.stop();
}

// A failed visual disposer remains registered and succeeds on retry.
{
  let attempts = 0;
  const flightState = state();
  const world = PhysicsBase.createWorld();
  const session = FlightSession.create({ state: flightState, RuntimeAssembly, AssemblyBuilder, Physics: PhysicsBase, world });
  session.start({ assemblyPlan: plan() });
  session.registerVisualRoot('body:root', root(), () => {
    attempts += 1;
    if (attempts === 1) throw new Error('synthetic visual failure');
    return true;
  });
  assert.throws(() => session.stop(), /resource cleanup failed/);
  assert.strictEqual(flightState.flight.assembly !== null, true, 'Published state is retained until all owned resources are cleared.');
  assert.strictEqual(session.stop(), true);
  assert.strictEqual(attempts, 2);
  assert.strictEqual(flightState.flight.assembly, null);
}

console.log(JSON.stringify({
  zeroBodyRejection: 'ok',
  multiBodyLifecycle: 'ok',
  deterministicPrimaryBody: 'ok',
  perBodyVisuals: 'ok',
  exactOwnership: 'ok',
  cleanupOrdering: 'ok',
  idempotentStop: 'ok',
  retrySafeCleanup: 'ok',
  startStopStart: 'ok'
}, null, 2));
