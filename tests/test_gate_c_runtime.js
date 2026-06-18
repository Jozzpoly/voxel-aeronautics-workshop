const assert = require('assert');
const path = require('path');
const { FOUNDATION_SOURCES, RUNTIME_SOURCES, load } = require('./load_runtime');

const CANNON = require(path.join(__dirname, '..', 'vendor/cannon-0.6.2/cannon.min.js'));
load([...FOUNDATION_SOURCES, ...RUNTIME_SOURCES, 'src/game/flight_session.js'], { stubs: true });

const AssemblySpaces = VAW.require('foundation.assembly-spaces');
const Blueprint = VAW.require('foundation.blueprint');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const AssemblyBuilder = VAW.require('runtime.assembly-builder');
const Physics = VAW.require('runtime.cannon-physics-backend').create(CANNON);
const FlightSession = VAW.require('game.flight-session');

const rootSpace = AssemblySpaces.createRootSpace();
const childSpace = {
  assemblySpaceId: 'space:arm',
  parentAssemblySpaceId: rootSpace.assemblySpaceId,
  name: 'Arm',
  localPose: { position: [2, 0, 0], quaternion: [0, 0, 0, 1] }
};
const block = (blockId, assemblySpaceId, x, type = 'Hull') => ({
  blockId, assemblySpaceId, x, y: 0, z: 0, type, orientation: 0, controlAxis: 'pitch', controlSign: 0
});
const document = Blueprint.createDocument({
  assemblySpaces: [rootSpace, childSpace],
  blocks: [block('core', rootSpace.assemblySpaceId, 0, 'Core'), block('root-edge', rootSpace.assemblySpaceId, 1), block('arm-edge', childSpace.assemblySpaceId, 0)],
  mechanicalLinks: [{
    mechanicalLinkId: 'mechanical:space-hinge', assemblySpaceId: rootSpace.assemblySpaceId, kind: 'hinge',
    endpointA: { blockId: 'root-edge', face: 'PX' }, endpointB: { blockId: 'arm-edge', face: 'NX' }, axis: 'PY',
    collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null
  }]
});

const compiled = CraftCompiler.compile(document);
assert(compiled.ready, compiled.errors.join(', '));
const plan = RuntimeAssembly.createPlan(compiled);
assert.strictEqual(plan.format, 'VAW_RUNTIME_ASSEMBLY_PLAN_V3');

assert.throws(() => AssemblyBuilder.validatePlan({ ...plan, bodyIdToAssemblySpaceId: undefined }), /requires bodyIdToAssemblySpaceId/);
assert.throws(() => AssemblyBuilder.validatePlan({
  ...plan,
  rigidBodies: plan.rigidBodies.map(body => body.assemblySpaceId === childSpace.assemblySpaceId ? { ...body, assemblySpaceId: 'space:missing' } : body)
}), /missing assembly space/);
assert.throws(() => AssemblyBuilder.validatePlan({
  ...plan,
  parts: plan.parts.map(part => part.blockId === 'arm-edge' ? { ...part, assemblySpaceId: rootSpace.assemblySpaceId } : part)
}), /invalid assembly space ownership/);
assert.throws(() => AssemblyBuilder.validatePlan({
  ...plan,
  rigidBodies: plan.rigidBodies.map(body => body.assemblySpaceId === childSpace.assemblySpaceId
    ? { ...body, colliders: body.colliders.map(collider => ({ ...collider, assemblySpaceId: rootSpace.assemblySpaceId })) }
    : body)
}), /wrong assembly space/);
assert.throws(() => AssemblyBuilder.validatePlan({
  ...plan,
  constraints: plan.constraints.map(constraint => ({ ...constraint, assemblySpaceId: undefined }))
}), /assemblySpaceId must be a non-empty string/);

function state() { return { flight: { assembly: null, assemblyPlan: null, primaryBodyId: null, visualRootByBodyId: new Map(), cleanupPending: false } }; }
function visualRoot() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } }
  };
}
function descriptor(bodyPlan) {
  return {
    position: { x: bodyPlan.assemblyPose.position[0], y: bodyPlan.assemblyPose.position[1], z: bodyPlan.assemblyPose.position[2] },
    quaternion: { x: bodyPlan.assemblyPose.quaternion[0], y: bodyPlan.assemblyPose.quaternion[1], z: bodyPlan.assemblyPose.quaternion[2], w: bodyPlan.assemblyPose.quaternion[3] }
  };
}

const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 }, allowSleep: false });
const flightState = state();
const session = FlightSession.create({ state: flightState, RuntimeAssembly, AssemblyBuilder, Physics, world });
const rootBodyId = plan.blockIdToBodyId.core;
const armBodyId = plan.blockIdToBodyId['arm-edge'];
assert.notStrictEqual(rootBodyId, armBodyId);

for (let cycle = 0; cycle < 20; cycle += 1) {
  session.start({ assemblyPlan: plan, bodyDescriptor: descriptor });
  assert.strictEqual(session.getAssemblySpaceIdForBody(rootBodyId), rootSpace.assemblySpaceId);
  assert.strictEqual(session.getAssemblySpaceIdForBody(armBodyId), childSpace.assemblySpaceId);
  assert.strictEqual(session.getAssemblySpaceIdForBlock('arm-edge'), childSpace.assemblySpaceId);
  assert.deepStrictEqual(session.bodyIdsForAssemblySpace(childSpace.assemblySpaceId), [armBodyId]);
  const rootVisual = visualRoot(); const armVisual = visualRoot();
  session.registerVisualRoot(rootBodyId, rootVisual);
  session.registerVisualRoot(armBodyId, armVisual);
  session.syncVisuals();
  assert.strictEqual(session.getVisualRootForBlock('arm-edge'), armVisual);
  assert.deepStrictEqual(session.getVisualRootsForAssemblySpace(childSpace.assemblySpaceId).map(item => item.bodyId), [armBodyId]);
  assert.strictEqual(session.getVisualOwnership(armBodyId).assemblySpaceId, childSpace.assemblySpaceId);
  assert.strictEqual(session.getColliderOwnershipByBlockId('arm-edge').assemblySpaceId, childSpace.assemblySpaceId);
  assert.strictEqual(session.stop(), true);
  assert.strictEqual(session.stop(), false);
  assert.strictEqual(world.bodies.length, 0, `orphan body after cycle ${cycle}`);
  assert.strictEqual(world.constraints.length, 0, `orphan constraint after cycle ${cycle}`);
  assert.strictEqual(flightState.flight.visualRootByBodyId.size, 0);
}

console.log({ multiSpaceRuntime: 'ok', realCannon: 'ok', lifecycleCycles: 20, orphanBodies: world.bodies.length, orphanConstraints: world.constraints.length });
