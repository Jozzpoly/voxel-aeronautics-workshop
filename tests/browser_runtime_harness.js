(() => {
  'use strict';
  const result = document.getElementById('result');
  const report = {};
  const near = (actual, expected, epsilon, label) => {
    if (Math.abs(actual - expected) > epsilon) throw new Error(`${label}: ${actual} != ${expected}`);
  };
  const plan = {
    format: 'BROWSER_CANNON_HARNESS',
    rootBodyId: 'body:root',
    rigidBodies: [{
      bodyId: 'body:root', role: 'root', blockIds: ['core'], sourceCenterOfMass: [0, 0, 0],
      massProperties: { mass: 2, centerOfMass: [0, 0, 0], inertiaDiagonal: [2, 3, 4] },
      colliders: [{ colliderId: 'collider:core', blockId: 'core', bodyId: 'body:root', kind: 'box', center: [0, 0, 0], halfExtents: [0.5, 0.5, 0.5] }]
    }],
    constraints: [], signalLinks: [], parts: [{ blockId: 'core', bodyId: 'body:root', type: 'Core' }]
  };
  try {
    const Physics = window.VAW.require('runtime.cannon-physics-backend').create(window.CANNON);
    const AssemblyBuilder = window.VAW.require('runtime.assembly-builder');
    const world = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 }, allowSleep: false });
    const runtime = AssemblyBuilder.build({ plan, physics: Physics, world, bodyDescriptor: { allowSleep: false } });
    const body = runtime.rootBody;
    for (let step = 0; step < 120; step++) Physics.step(world, 1 / 120);
    near(body.velocity.y, -9.81, 0.15, 'free-fall velocity');
    report.freeFall = 'ok';
    near(body.inertia.x, 2, 1e-9, 'inertia X');
    near(body.inertia.y, 3, 1e-9, 'inertia Y');
    near(body.inertia.z, 4, 1e-9, 'inertia Z');
    report.inertiaParity = 'ok';
    Physics.setBodyTransform(body, { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
    Physics.setBodyVelocity(body, { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 2 } });
    world.gravity.set(0, 0, 0);
    const recentered = runtime.recenterBody('body:root', { x: 1, y: 0, z: 0 });
    near(recentered.worldPosition.x, 1, 1e-9, 'recenter position');
    near(recentered.linearVelocity.y, 2, 1e-9, 'recenter point velocity');
    report.recenterKinematics = 'ok';
    runtime.dispose();
    if (world.bodies.length !== 0) throw new Error('Assembly dispose left bodies in the world.');
    report.lifecycle = 'ok';
    report.backend = `${Physics.id} ${Physics.version}`;
    document.body.dataset.status = 'pass';
    result.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    document.body.dataset.status = 'fail';
    result.textContent = `${error.stack || error}`;
    console.error(error);
  }
})();
