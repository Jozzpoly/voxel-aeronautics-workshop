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
  'src/runtime/assembly_builder.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}
const PhysicsPort = global.VAW.require('runtime.physics-port');
const Physics = global.VAW.require('runtime.headless-physics-backend').create();
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');

function body(bodyId, blockId, x) {
  return {
    bodyId,
    role: bodyId === 'body:root' ? 'root' : 'subassembly',
    blockIds: [blockId],
    sourceCenterOfMass: [x, 0, 0],
    massProperties: { mass: 2, centerOfMass: [0, 0, 0], inertiaDiagonal: [1, 2, 3] },
    colliders: [{
      colliderId: `collider:${blockId}`,
      blockId,
      bodyId,
      kind: 'box',
      center: [0, 0, 0],
      halfExtents: [0.5, 0.5, 0.5]
    }]
  };
}

const plan = {
  format: 'TEST_ASSEMBLY',
  rootBodyId: 'body:root',
  rigidBodies: [body('body:root', 'core', 0), body('body:rotor', 'rotor', 2)],
  constraints: [{ constraintId: 'hinge:rotor', kind: 'hinge', bodyAId: 'body:root', bodyBId: 'body:rotor' }],
  signalLinks: [],
  parts: [
    { blockId: 'core', bodyId: 'body:root', type: 'Core' },
    { blockId: 'rotor', bodyId: 'body:rotor', type: 'Frame' }
  ]
};

assert.deepStrictEqual(AssemblyBuilder.validatePlan(plan).bodyIds.size, 2);
const rollbackWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
assert.throws(() => AssemblyBuilder.build({ plan, physics: Physics, world: rollbackWorld }), /constraintBuilder/);
assert.strictEqual(rollbackWorld.bodies.length, 0, 'Failed assembly construction must roll back every body.');

const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
let constraintDisposed = false;
const runtime = AssemblyBuilder.build({
  plan,
  physics: Physics,
  world,
  bodyDescriptor: bodyPlan => ({ position: { x: bodyPlan.bodyId === 'body:root' ? 10 : 12, y: 4, z: 0 } }),
  constraintBuilder: ({ constraintPlan, bodyA, bodyB }) => ({
    constraintId: constraintPlan.constraintId,
    bodyA,
    bodyB,
    dispose() { constraintDisposed = true; }
  })
});

assert.strictEqual(runtime.rootBody, runtime.bodyById.get('body:root').body);
assert.strictEqual(world.bodies.length, 2);
assert.strictEqual(runtime.bodyById.size, 2);
assert.strictEqual(runtime.partByBlockId.get('rotor').body, runtime.bodyById.get('body:rotor').body);
assert.strictEqual(runtime.colliderByBlockId.size, 2);
assert.strictEqual(runtime.constraintById.size, 1);
assert.strictEqual(runtime.rootBody.position.x, 10);
assert.strictEqual(runtime.bodyById.get('body:rotor').body.position.x, 12);

const rotorBody = runtime.bodyById.get('body:rotor').body;
Physics.setBodyVelocity(rotorBody, { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 2 } });
const recentered = runtime.recenterBody('body:rotor', { x: 1, y: 0, z: 0 });
assert.strictEqual(recentered.worldPosition.x, 13);
assert.strictEqual(recentered.linearVelocity.y, 2, 'Recenter must preserve the velocity of the new COM point.');
assert.strictEqual(runtime.colliderByBlockId.get('rotor').shape.offset.x, -1);

const applied = runtime.setBodyMassProperties('body:rotor', {
  mass: 5,
  centerOfMass: { x: 0, y: 0, z: 0 },
  inertiaDiagonal: { x: 4, y: 5, z: 6 }
});
assert.strictEqual(applied.mass, 5);
assert.strictEqual(runtime.bodyById.get('body:rotor').body.inertia.z, 6);
assert(runtime.removeColliderByBlockId('rotor'));
assert.strictEqual(runtime.colliderByBlockId.has('rotor'), false);
assert.strictEqual(runtime.removeColliderByBlockId('rotor'), false);

assert.strictEqual(runtime.dispose(), true);
assert.strictEqual(runtime.dispose(), false);
assert.strictEqual(world.bodies.length, 0);
assert.strictEqual(constraintDisposed, true);
assert.strictEqual(runtime.disposed, true);
assert.strictEqual(PhysicsPort.assertBackend(Physics), Physics);

console.log(JSON.stringify({
  multiBodyConstruction: 'ok',
  transactionalRollback: 'ok',
  stableBlockMaps: 'ok',
  constraintExtensionPoint: 'ok',
  colliderRemoval: 'ok',
  recenterKinematics: 'ok',
  lifecycleDisposal: 'ok'
}, null, 2));
