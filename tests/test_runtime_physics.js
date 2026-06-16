const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });
for (const relative of [
  'src/foundation/kernel.js',
  'src/runtime/physics_port.js',
  'src/runtime/cannon_physics_backend.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const Port = global.VAW.require('runtime.physics-port');
const BackendFactory = global.VAW.require('runtime.cannon-physics-backend');
const Physics = BackendFactory.create(global.CANNON);

assert.strictEqual(Physics.id, 'cannon');
assert.strictEqual(typeof Physics.getPointVelocity, 'function');
assert(Object.isFrozen(Physics));
assert.throws(() => Port.normalizeBoxDescriptor({ halfExtents: { x: 0, y: 1, z: 1 } }), /greater than zero/);
assert.throws(() => Port.assertBackend({ id: 'broken' }), /missing methods/);

const world = Physics.createWorld({
  gravity: { x: 0, y: -4, z: 0 },
  broadphase: 'sap',
  solverIterations: 7,
  solverTolerance: 0.002,
  allowSleep: false
});
assert.deepStrictEqual([world.gravity.x, world.gravity.y, world.gravity.z], [0, -4, 0]);
assert.strictEqual(world.solver.iterations, 7);
assert.strictEqual(world.solver.tolerance, 0.002);
assert.strictEqual(world.allowSleep, false);

const body = Physics.createBody({
  mass: 12,
  linearDamping: 0.1,
  angularDamping: 0.2,
  allowSleep: false,
  collisionGroup: 4,
  collisionMask: 3,
  position: { x: 1, y: 2, z: 3 },
  userData: { test: true }
});
assert.strictEqual(body.mass, 12);
assert.deepStrictEqual([body.position.x, body.position.y, body.position.z], [1, 2, 3]);
assert.strictEqual(body.collisionFilterGroup, 4);
assert.strictEqual(body.collisionFilterMask, 3);
assert.strictEqual(body.userData.test, true);
assert.strictEqual(body.type, global.CANNON.Body.DYNAMIC);
const massProperties = Physics.setBodyMassProperties(body, { mass: 12, inertiaDiagonal: { x: 2, y: 3, z: 4 } });
assert.strictEqual(massProperties.mass, 12);
assert.deepStrictEqual([body.inertia.x, body.inertia.y, body.inertia.z], [2, 3, 4]);
assert.deepStrictEqual([body.invInertia.x, body.invInertia.y, body.invInertia.z], [0.5, 1 / 3, 0.25]);
assert.throws(() => Physics.setBodyMassProperties(body, { mass: 12, centerOfMass: { x: 1, y: 0, z: 0 }, inertiaDiagonal: { x: 2, y: 3, z: 4 } }), /centered around local COM/);
Physics.setBodyMassProperties(body, { mass: 0, inertiaDiagonal: { x: 0, y: 0, z: 0 } });
assert.strictEqual(body.type, global.CANNON.Body.STATIC);
Physics.setBodyMassProperties(body, { mass: 12, inertiaDiagonal: { x: 2, y: 3, z: 4 } });
assert.strictEqual(body.type, global.CANNON.Body.DYNAMIC);

const shape = Physics.addBoxCollider(body, {
  halfExtents: { x: 2, y: 1, z: 0.5 },
  offset: { x: 3, y: 0, z: -1 }
});
assert.strictEqual(body.shapes.length, 1);
assert.strictEqual(body.shapes[0], shape);
assert.deepStrictEqual([body.shapeOffsets[0].x, body.shapeOffsets[0].y, body.shapeOffsets[0].z], [3, 0, -1]);
Physics.shiftColliderOffsets(body, { x: 1, y: -2, z: 0.5 });
assert.deepStrictEqual([body.shapeOffsets[0].x, body.shapeOffsets[0].y, body.shapeOffsets[0].z], [2, 2, -1.5]);

Physics.addBody(world, body);
assert.strictEqual(world.bodies.includes(body), true);
Physics.applyForce(body, { x: 5, y: 0, z: -2 }, body.position);
assert.deepStrictEqual([body.force.x, body.force.y, body.force.z], [5, 0, -2]);
Physics.addTorque(body, { x: 1, y: 2, z: 3 });
assert.deepStrictEqual([body.torque.x, body.torque.y, body.torque.z], [1, 2, 3]);
const otherBody = Physics.createBody({ mass: 0, userData: { rangeObstacle: true } });
let collisionEvent = null;
const unsubscribeCollision = Physics.addCollisionListener(body, event => { collisionEvent = event; });
body.listeners.collide({
  body: otherBody,
  contact: {
    bi: body,
    ri: new global.CANNON.Vec3(1, -2, 3),
    rj: new global.CANNON.Vec3(9, 9, 9),
    getImpactVelocityAlongNormal: () => -7.25
  }
});
assert(collisionEvent);
assert(Object.isFrozen(collisionEvent));
assert.strictEqual(collisionEvent.otherBody, otherBody);
assert.strictEqual(collisionEvent.impactSpeed, 7.25);
assert.deepStrictEqual(collisionEvent.relativePoint, { x: 1, y: -2, z: 3 });
unsubscribeCollision();
assert.strictEqual(body.listeners.collide, undefined);
Physics.step(world, 1 / 120);
assert.strictEqual(world.steps.length, 1);
assert.throws(() => Physics.step(world, 0), /greater than zero/);

assert.strictEqual(Physics.removeCollider(body, shape), true);
assert.strictEqual(body.shapes.length, 0);
assert.strictEqual(Physics.removeBody(world, body), true);
assert.strictEqual(world.bodies.includes(body), false);

console.log(JSON.stringify({
  backend: Physics.id,
  descriptorValidation: 'ok',
  lifecycleBoundary: 'ok',
  forceTorqueBridge: 'ok',
  colliderMutation: 'ok',
  normalizedCollisionEvents: 'ok',
  explicitMassProperties: 'ok',
  bodyTypeTransitions: 'ok'
}, null, 2));
