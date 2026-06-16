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
    sourceAssemblyCenterOfMass: [x, 0, 0],
    assemblyPose: { position: [x, 0, 0], quaternion: [0, 0, 0, 1] },
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
  constraints: [{ constraintId: 'hinge:rotor', mechanicalLinkId: 'hinge:rotor', kind: 'hinge', bodyAId: 'body:root', bodyBId: 'body:rotor', endpointA: { blockId: 'core', face: 'PX' }, endpointB: { blockId: 'rotor', face: 'NX' }, pivotA: [1, 0, 0], pivotB: [-1, 0, 0], axisA: [0, 1, 0], axisB: [0, 1, 0], collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null, control: { mode: 'free' } }],
  signalLinks: [],
  parts: [
    { blockId: 'core', bodyId: 'body:root', type: 'Core' },
    { blockId: 'rotor', bodyId: 'body:rotor', type: 'Frame' }
  ]
};

assert.deepStrictEqual(AssemblyBuilder.validatePlan(plan).bodyIds.size, 2);
const rollbackWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
assert.throws(() => AssemblyBuilder.build({ plan, physics: Physics, world: rollbackWorld }), /does not support hinge constraints/);
assert.strictEqual(rollbackWorld.bodies.length, 0, 'Failed assembly construction must roll back every body.');

const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
let constraintDisposed = false;
const runtime = AssemblyBuilder.build({
  plan,
  physics: Physics,
  world,
  bodyDescriptor: bodyPlan => ({
    position: { x: bodyPlan.bodyId === 'body:root' ? 10 : 12, y: 4, z: 0 },
    userData: { custom: true, assemblyBodyId: 'spoofed' }
  }),
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
assert.strictEqual(runtime.rootBody.userData.custom, true);
assert.strictEqual(runtime.rootBody.userData.assemblyBodyId, 'body:root', 'Reserved assembly metadata cannot be overwritten.');
assert.deepStrictEqual(runtime.getBodyIds(), ['body:root', 'body:rotor']);
assert(Object.isFrozen(runtime.getBodyIds()));
assert.strictEqual(runtime.getBodyPlan('body:rotor').bodyId, 'body:rotor');
assert.strictEqual(runtime.getBodyIdForBlock('rotor'), 'body:rotor');
assert.strictEqual(runtime.getPartDescriptor('rotor').bodyId, 'body:rotor');
assert.deepStrictEqual(runtime.getColliderOwnershipByBlockId('rotor'), {
  colliderId: 'collider:rotor', blockId: 'rotor', bodyId: 'body:rotor'
});
assert.deepStrictEqual(runtime.getColliderOwnership('collider:rotor'), {
  colliderId: 'collider:rotor', blockId: 'rotor', bodyId: 'body:rotor'
});
assert.deepStrictEqual(runtime.getBodyTransform('body:root').position, { x: 10, y: 4, z: 0 });
runtime.setBodyVelocity('body:root', { linear: { x: 2, y: 3, z: 4 }, angular: { x: 0.1, y: 0.2, z: 0.3 } });
assert.deepStrictEqual(runtime.getBodyLinearVelocity('body:root'), { x: 2, y: 3, z: 4 });
assert.deepStrictEqual(runtime.getBodyAngularVelocity('body:root'), { x: 0.1, y: 0.2, z: 0.3 });
const transformedPoint = runtime.pointToWorldFrame('body:root', { x: 1, y: 2, z: 3 });
assert.deepStrictEqual(runtime.pointToLocalFrame('body:root', transformedPoint), { x: 1, y: 2, z: 3 });
runtime.clearBodyMotion('body:root');
assert.deepStrictEqual(runtime.getBodyLinearVelocity('body:root'), { x: 0, y: 0, z: 0 });
assert.deepStrictEqual(runtime.getBodyAngularVelocity('body:root'), { x: 0, y: 0, z: 0 });

const rotorBody = runtime.bodyById.get('body:rotor').body;
Physics.setBodyVelocity(rotorBody, { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 2 } });
assert.throws(() => runtime.recenterBody('body:rotor', { x: 1, y: 0, z: 0 }), /Cannot recenter constrained body/);
assert.deepStrictEqual(runtime.constraintIdsForBody('body:rotor'), ['hinge:rotor']);
assert.deepStrictEqual(runtime.constraintIdsForEndpointBlock('rotor'), ['hinge:rotor']);
assert.deepStrictEqual(runtime.breakConstraintsForEndpointBlock('rotor', 'test-endpoint-break'), ['hinge:rotor']);
assert.strictEqual(runtime.constraintFailureLog.length, 1);
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

const noConstraintPlan = { ...plan, constraints: [] };
const validationWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
assert.throws(() => AssemblyBuilder.build({
  plan: { ...noConstraintPlan, parts: [noConstraintPlan.parts[0]] },
  physics: Physics,
  world: validationWorld
}), /has no runtime part/);
assert.strictEqual(validationWorld.bodies.length, 0, 'Invalid plans must fail before backend allocation.');

let rejectRemoval = true;
const removalPhysics = {
  ...Physics,
  id: 'headless-removal-failure-test',
  removeCollider(bodyValue, shapeValue) {
    if (rejectRemoval) { rejectRemoval = false; return false; }
    return Physics.removeCollider(bodyValue, shapeValue);
  }
};
const removalWorld = removalPhysics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const removalRuntime = AssemblyBuilder.build({ plan: noConstraintPlan, physics: removalPhysics, world: removalWorld });
assert.strictEqual(removalRuntime.removeColliderByBlockId('rotor'), false);
assert.strictEqual(removalRuntime.colliderByBlockId.has('rotor'), true, 'Failed backend removal must not corrupt runtime maps.');
assert.strictEqual(removalRuntime.removeColliderByBlockId('rotor'), true);
removalRuntime.dispose();

const cleanupPhysics = {
  ...Physics,
  id: 'headless-cleanup-failure-test',
  removeBody(worldValue, bodyValue) {
    Physics.removeBody(worldValue, bodyValue);
    throw new Error('synthetic cleanup failure');
  }
};
const cleanupWorld = cleanupPhysics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
let originalBuildError = null;
try {
  AssemblyBuilder.build({
    plan,
    physics: cleanupPhysics,
    world: cleanupWorld,
    constraintBuilder() { throw new Error('synthetic constraint construction failure'); }
  });
} catch (error) {
  originalBuildError = error;
}
assert(originalBuildError);
assert.match(originalBuildError.message, /synthetic constraint construction failure/, 'Rollback must preserve the original construction failure.');
assert(Array.isArray(originalBuildError.cleanupErrors));
assert(originalBuildError.cleanupErrors.length >= 1);
assert.strictEqual(cleanupWorld.bodies.length, 0);

console.log(JSON.stringify({
  multiBodyConstruction: 'ok',
  transactionalRollback: 'ok',
  stableBlockMaps: 'ok',
  constraintExtensionPoint: 'ok',
  colliderRemoval: 'ok',
  recenterKinematics: 'ok',
  constrainedRecenterGuard: 'ok',
  endpointConstraintBreak: 'ok',
  lifecycleDisposal: 'ok',
  preallocationValidation: 'ok',
  reservedMetadata: 'ok',
  atomicColliderRemoval: 'ok',
  rollbackErrorPreservation: 'ok',
  neutralAssemblyQueries: 'ok',
  deterministicBodyIteration: 'ok'
}, null, 2));
