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
  'src/game/debris_runtime.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });

const PhysicsBase = global.VAW.require('runtime.headless-physics-backend').create();
const DebrisRuntime = global.VAW.require('game.debris-runtime');

function visual() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
  };
}

{
  const world = PhysicsBase.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
  const sceneEntries = new Set();
  const disposed = [];
  const scene = { add(value) { sceneEntries.add(value); }, remove(value) { sceneEntries.delete(value); } };
  const runtime = DebrisRuntime.create({
    Physics: PhysicsBase, world, scene,
    disposeObjectTree(value) { disposed.push(value); },
    maxLifetime: 1,
    collisionGroup: 8,
    collisionMask: 3
  });
  const mesh = visual();
  const entry = runtime.spawn({
    visual: mesh,
    mass: 2,
    worldPosition: { x: 4, y: 5, z: 6 },
    worldVelocity: { x: 1, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    worldQuaternion: { x: 0, y: 0, z: 0, w: 1 },
    sourceBodyId: 'body:root'
  });
  assert.strictEqual(world.bodies.length, 1);
  assert.strictEqual(entry.body.collisionFilterGroup, 8);
  assert.strictEqual(entry.body.collisionFilterMask, 3);
  assert.strictEqual(sceneEntries.has(mesh), true);
  assert.deepStrictEqual([mesh.position.x, mesh.position.y, mesh.position.z], [4, 5, 6]);
  PhysicsBase.setBodyTransform(entry.body, { position: { x: 9, y: 2, z: -1 } });
  assert.strictEqual(runtime.update(entry, 0.25), false);
  assert.deepStrictEqual([mesh.position.x, mesh.position.y, mesh.position.z], [9, 2, -1]);
  assert.strictEqual(runtime.update(entry, 0.8), true);
  assert.strictEqual(runtime.dispose(entry), true);
  assert.strictEqual(world.bodies.length, 0);
  assert.strictEqual(sceneEntries.size, 0);
  assert.deepStrictEqual(disposed, [mesh]);
  assert.strictEqual(runtime.dispose(entry), true, 'Debris disposal must be idempotent after completion.');
}

// A visual cleanup error must not cause an already removed body to be removed again on retry.
{
  const world = PhysicsBase.createWorld();
  let bodyRemovalCalls = 0;
  const Physics = {
    ...PhysicsBase,
    id: 'headless-debris-retry',
    removeBody(worldValue, bodyValue) {
      bodyRemovalCalls += 1;
      return PhysicsBase.removeBody(worldValue, bodyValue);
    }
  };
  let visualAttempts = 0;
  const runtime = DebrisRuntime.create({
    Physics, world,
    scene: { add() {}, remove() {} },
    disposeObjectTree() {
      visualAttempts += 1;
      if (visualAttempts === 1) throw new Error('synthetic visual cleanup failure');
    }
  });
  const entry = runtime.spawn({
    visual: visual(), mass: 1,
    worldPosition: { x: 0, y: 1, z: 0 },
    worldVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    worldQuaternion: { x: 0, y: 0, z: 0, w: 1 }
  });
  assert.throws(() => runtime.dispose(entry), /synthetic visual cleanup failure/);
  assert.strictEqual(entry.bodyDisposed, true);
  assert.strictEqual(entry.visualDisposed, false);
  assert.strictEqual(runtime.dispose(entry), true);
  assert.strictEqual(bodyRemovalCalls, 1);
  assert.strictEqual(visualAttempts, 2);
}

// Allocation rollback removes a body when later scene ownership fails.
{
  const world = PhysicsBase.createWorld();
  const runtime = DebrisRuntime.create({
    Physics: PhysicsBase, world,
    scene: { add() { throw new Error('synthetic scene failure'); }, remove() {} },
    disposeObjectTree() {}
  });
  assert.throws(() => runtime.spawn({
    visual: visual(), mass: 1,
    worldPosition: { x: 0, y: 0, z: 0 },
    worldVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    worldQuaternion: { x: 0, y: 0, z: 0, w: 1 }
  }), /synthetic scene failure/);
  assert.strictEqual(world.bodies.length, 0);
}

console.log(JSON.stringify({
  neutralVisualSync: 'ok',
  explicitCollisionPolicy: 'ok',
  retrySafeCleanup: 'ok',
  allocationRollback: 'ok'
}, null, 2));
