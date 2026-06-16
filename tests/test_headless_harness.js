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
const Physics = global.VAW.require('runtime.headless-physics-backend').create();
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');
const DT = 1 / 120;
const near = (actual, expected, epsilon, label) => assert(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} != ${expected}`);

function makePlan(mass = 2, inertia = [2, 3, 4]) {
  return {
    format: 'HARNESS_PLAN',
    rootBodyId: 'body:root',
    rigidBodies: [{
      bodyId: 'body:root', role: 'root', blockIds: ['core'], sourceCenterOfMass: [0, 0, 0],
      massProperties: { mass, centerOfMass: [0, 0, 0], inertiaDiagonal: inertia },
      colliders: [{ colliderId: 'collider:core', blockId: 'core', bodyId: 'body:root', kind: 'box', center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] }]
    }],
    constraints: [], signalLinks: [], parts: [{ blockId: 'core', bodyId: 'body:root', type: 'Core' }]
  };
}

function runSteps(world, count, beforeStep = null) {
  for (let i = 0; i < count; i++) {
    beforeStep?.(i);
    Physics.step(world, DT);
  }
}

const gravityWorld = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 } });
const falling = AssemblyBuilder.build({ plan: makePlan(), physics: Physics, world: gravityWorld });
runSteps(gravityWorld, 120);
near(falling.rootBody.velocity.y, -9.81, 0.02, 'free-fall velocity');
near(falling.rootBody.position.y, -4.945875, 0.03, 'free-fall position');
assert.deepStrictEqual([falling.rootBody.inertia.x, falling.rootBody.inertia.y, falling.rootBody.inertia.z], [2, 3, 4]);
falling.dispose();

const hoverWorld = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 } });
const hover = AssemblyBuilder.build({ plan: makePlan(5, [2, 2, 2]), physics: Physics, world: hoverWorld });
runSteps(hoverWorld, 1200, () => Physics.applyForce(hover.rootBody, { x: 0, y: 5 * 9.81, z: 0 }, hover.rootBody.position));
near(hover.rootBody.velocity.y, 0, 1e-9, 'hover velocity');
near(hover.rootBody.position.y, 0, 1e-9, 'hover position');
hover.dispose();

const torqueWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const torqueAssembly = AssemblyBuilder.build({ plan: makePlan(2, [2, 3, 4]), physics: Physics, world: torqueWorld });
runSteps(torqueWorld, 120, () => Physics.addTorque(torqueAssembly.rootBody, { x: 1, y: 0, z: 0 }));
near(torqueAssembly.rootBody.angularVelocity.x, 0.5, 0.002, 'angular velocity from explicit inertia');
assert(Number.isFinite(torqueAssembly.rootBody.quaternion.w));
torqueAssembly.dispose();

const offsetWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const offsetAssembly = AssemblyBuilder.build({ plan: makePlan(1, [1, 1, 1]), physics: Physics, world: offsetWorld });
Physics.applyForce(offsetAssembly.rootBody, { x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 });
Physics.step(offsetWorld, DT);
assert(offsetAssembly.rootBody.angularVelocity.z > 0, 'Offset thrust must create positive Z torque.');
assert(offsetAssembly.rootBody.velocity.y > 0, 'Offset thrust must still create translation.');
offsetAssembly.dispose();


const rotatedWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const halfSqrt = Math.sqrt(0.5);
const rotatedAssembly = AssemblyBuilder.build({
  plan: makePlan(2, [2, 4, 8]),
  physics: Physics,
  world: rotatedWorld,
  bodyDescriptor: { quaternion: { x: 0, y: 0, z: halfSqrt, w: halfSqrt } }
});
Physics.addTorque(rotatedAssembly.rootBody, { x: 1, y: 0, z: 0 });
Physics.step(rotatedWorld, DT);
near(rotatedAssembly.rootBody.angularVelocity.x, DT / 4, 1e-9, 'rotated inertia response');
rotatedAssembly.dispose();

const staticWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const staticBody = Physics.createBody({ mass: 0 });
Physics.addBody(staticWorld, staticBody);
Physics.applyForce(staticBody, { x: 10, y: 0, z: 0 }, staticBody.position);
Physics.step(staticWorld, DT);
assert.strictEqual(staticBody.force.x, 0, 'Static body forces must not survive a step.');
Physics.setBodyMassProperties(staticBody, { mass: 2, inertiaDiagonal: { x: 1, y: 1, z: 1 } });
assert.strictEqual(staticBody.type, 'dynamic');
Physics.removeBody(staticWorld, staticBody);

const soakWorld = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const soak = AssemblyBuilder.build({
  plan: makePlan(3, [2, 4, 6]), physics: Physics, world: soakWorld,
  bodyDescriptor: { linearDamping: 0.02, angularDamping: 0.03 }
});
runSteps(soakWorld, 12000, step => {
  const phase = step * DT;
  Physics.applyForce(soak.rootBody, { x: Math.sin(phase) * 2, y: Math.cos(phase * 0.7), z: Math.sin(phase * 0.3) }, soak.rootBody.position);
  Physics.addTorque(soak.rootBody, { x: 0.1, y: Math.sin(phase) * 0.2, z: -0.08 });
});
for (const value of [
  soak.rootBody.position.x, soak.rootBody.position.y, soak.rootBody.position.z,
  soak.rootBody.velocity.x, soak.rootBody.velocity.y, soak.rootBody.velocity.z,
  soak.rootBody.angularVelocity.x, soak.rootBody.angularVelocity.y, soak.rootBody.angularVelocity.z,
  soak.rootBody.quaternion.x, soak.rootBody.quaternion.y, soak.rootBody.quaternion.z, soak.rootBody.quaternion.w
]) assert(Number.isFinite(value), 'Long soak produced a non-finite state.');
near(Math.hypot(soak.rootBody.quaternion.x, soak.rootBody.quaternion.y, soak.rootBody.quaternion.z, soak.rootBody.quaternion.w), 1, 1e-9, 'normalized quaternion');
soak.dispose();

console.log(JSON.stringify({
  freeFall: 'ok',
  inertiaParity: 'ok',
  exactHover: 'ok',
  torqueResponse: 'ok',
  offsetThrust: 'ok',
  rotatedInertia: 'ok',
  staticAccumulatorReset: 'ok',
  dynamicTypeTransition: 'ok',
  longSoakSteps: 12000,
  finiteState: 'ok'
}, null, 2));
