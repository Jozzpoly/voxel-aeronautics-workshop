const assert = require('assert');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load(FOUNDATION_SOURCES, { stubs: true });

const CraftModel = VAW.require('foundation.craft-model');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const TransformMath = VAW.require('foundation.transform-math');

const blocks = [
  { blockId: 'core', x: 0, y: 0, z: 0, type: 'Core' },
  { blockId: 'root-hull', x: 1, y: 0, z: 0, type: 'Hull' },
  { blockId: 'arm-hull', x: 2, y: 0, z: 0, type: 'Hull' },
  { blockId: 'arm-tip', x: 3, y: 0, z: 0, type: 'Hull' }
];
const links = [{
  mechanicalLinkId: 'mechanical:arm', kind: 'hinge',
  endpointA: { blockId: 'root-hull', face: 'PX' },
  endpointB: { blockId: 'arm-hull', face: 'NX' },
  axis: 'PY', collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null
}];
const model = CraftModel.create({ version: 11, blocks, mechanicalLinks: links });
const compiled = CraftCompiler.compile(model);
assert.strictEqual(compiled.format, 'VAW_COMPILED_CRAFT_V5');
assert(compiled.ready, compiled.errors.join(', '));
const plan = RuntimeAssembly.createPlan(compiled);
assert(Object.isFrozen(plan));
assert.strictEqual(plan.format, 'VAW_RUNTIME_ASSEMBLY_PLAN_V3');
assert.strictEqual(plan.rigidBodies.length, 2);
assert.strictEqual(plan.constraints.length, 1);
assert.strictEqual(plan.signalLinks.length, 0);
assert.strictEqual(plan.parts.length, 4);
assert.strictEqual(plan.rootBodyId, 'body:core');
assert.strictEqual(plan.constraints[0].constraintId, 'mechanical:arm');
assert.notStrictEqual(plan.blockIdToBodyId['root-hull'], plan.blockIdToBodyId['arm-hull']);
for (const body of plan.rigidBodies) {
  assert.deepStrictEqual(body.massProperties.centerOfMass, [0, 0, 0]);
  const bodyParts = plan.parts.filter(part => part.bodyId === body.bodyId);
  for (const part of bodyParts) {
    assert.deepStrictEqual(
      part.bodyLocalPosition.map((value, index) => value + body.assemblyPose.position[index]),
      part.assemblyPosition
    );
  }
}
const hinge = plan.constraints[0];
const bodyA = plan.rigidBodies.find(body => body.bodyId === hinge.bodyAId);
const bodyB = plan.rigidBodies.find(body => body.bodyId === hinge.bodyBId);
assert.deepStrictEqual(hinge.pivotA.map((v, i) => v + bodyA.assemblyPose.position[i]), hinge.assemblyPivotPosition);
assert.deepStrictEqual(hinge.pivotB.map((v, i) => v + bodyB.assemblyPose.position[i]), hinge.assemblyPivotPosition);

const loaded = RuntimeAssembly.createPlan(compiled, {
  payloadMass: 10,
  payloadAnchorBlockId: 'core',
  payloadAssemblyPosition: [0, -1, 0]
});
const ownerBodyId = loaded.blockIdToBodyId.core;
const otherBodyId = loaded.rigidBodies.find(body => body.bodyId !== ownerBodyId).bodyId;
const baseOwner = plan.rigidBodies.find(body => body.bodyId === ownerBodyId);
const loadedOwner = loaded.rigidBodies.find(body => body.bodyId === ownerBodyId);
assert(loadedOwner.massProperties.mass > baseOwner.massProperties.mass);
assert.notDeepStrictEqual(loadedOwner.assemblyPose.position, baseOwner.assemblyPose.position);
assert.deepStrictEqual(
  loaded.rigidBodies.find(body => body.bodyId === otherBodyId).assemblyPose,
  plan.rigidBodies.find(body => body.bodyId === otherBodyId).assemblyPose
);
assert.strictEqual(loaded.launchLoadout.payload.ownerBodyId, ownerBodyId);
const loadedHinge = loaded.constraints[0];
assert.deepStrictEqual(loadedHinge.pivotA.map((v, i) => v + loaded.rigidBodies.find(b => b.bodyId === loadedHinge.bodyAId).assemblyPose.position[i]), loadedHinge.assemblyPivotPosition);
assert.deepStrictEqual(loadedHinge.pivotB.map((v, i) => v + loaded.rigidBodies.find(b => b.bodyId === loadedHinge.bodyBId).assemblyPose.position[i]), loadedHinge.assemblyPivotPosition);

const spawn = { position: [10, 4, -3], quaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2] };
assert.throws(() => RuntimeAssembly.worldBodyPoses(plan, { position: [NaN, 0, 0], quaternion: [0, 0, 0, 1] }), /finite 3D vector/);
assert.throws(() => RuntimeAssembly.worldBodyPoses(plan, { position: [0, 0, 0], quaternion: [0, 0, 0, 0] }), /non-zero length/);
const poses = RuntimeAssembly.worldBodyPoses(plan, spawn);
for (const body of plan.rigidBodies) {
  assert.deepStrictEqual(poses[body.bodyId], RuntimeAssembly.worldBodyPose(spawn, body));
  const assemblyPoint = body.assemblyPose.position;
  assert.deepStrictEqual(poses[body.bodyId].position, TransformMath.transformPoint(spawn, assemblyPoint));
}

assert.throws(() => RuntimeAssembly.createPlan({ format: 'VAW_COMPILED_CRAFT_V3' }), /CompiledCraft V5/);
assert.throws(() => RuntimeAssembly.createPlan({ ...compiled, ready: false, errors: ['synthetic'] }), /unready craft/);
console.log(JSON.stringify({
  planV2: 'ok', multiBodyCoordinates: 'ok', hingePivotRoundTrip: 'ok',
  payloadOwnerIsolation: 'ok', bodyInAssemblySpawn: 'ok', strictCompiledBoundary: 'ok'
}, null, 2));
