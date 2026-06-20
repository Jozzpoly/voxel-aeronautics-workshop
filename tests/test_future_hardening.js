const assert = require('assert');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load(FOUNDATION_SOURCES, { stubs: true });

const AssemblySpaces = VAW.require('foundation.assembly-spaces');
const Blueprint = VAW.require('foundation.blueprint');
const CraftModel = VAW.require('foundation.craft-model');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const Diagnostics = VAW.require('foundation.diagnostics');

const root = AssemblySpaces.createRootSpace();

// Diagnostic normalization is bounded even when future schemas attach hostile/deep context.
let deepDiagnostic = { value: 'leaf' };
for (let index = 0; index < 20000; index += 1) deepDiagnostic = { next: deepDiagnostic };
const boundedDiagnostic = Diagnostics.create('deep-context', 'error', [], deepDiagnostic);
let cursor = boundedDiagnostic.details;
let diagnosticDepth = 0;
while (cursor && typeof cursor === 'object' && cursor.next) { cursor = cursor.next; diagnosticDepth += 1; }
assert(diagnosticDepth <= Diagnostics.MAX_DETAIL_DEPTH);
assert.strictEqual(cursor, '[MaxDepth]');
const wideDiagnostic = Diagnostics.create('wide-context', 'error', [], { items: Array.from({ length: 20000 }, (_, index) => index) });
assert(wideDiagnostic.details.items.includes('[Truncated]'));

// Schema projection must ignore cyclic/deep unknown data before migration/normalization.
const hostileUnknown = {};
hostileUnknown.self = hostileUnknown;
let deepUnknown = hostileUnknown;
for (let index = 0; index < 20000; index += 1) deepUnknown = { next: deepUnknown };
const hostileDocument = {
  version: 12,
  assemblySpaces: [root],
  blocks: [{
    blockId: 'hostile-core', assemblySpaceId: 'space:root', x: 0, y: 0, z: 0,
    type: 'Core', orientation: 0, controlAxis: 'pitch', controlSign: 0,
    unknownCycle: hostileUnknown
  }],
  mechanicalLinks: [],
  unknownCycle: hostileUnknown,
  deepUnknown
};
const projectedHostile = Blueprint.projectDocument(hostileDocument);
assert.strictEqual(projectedHostile.unknownCycle, undefined);
assert.strictEqual(projectedHostile.blocks[0].unknownCycle, undefined);
const normalizedHostile = Blueprint.normalize(hostileDocument);
assert(normalizedHostile, 'Unknown cyclic/deep properties must not crash or poison known-schema import.');
assert.strictEqual(normalizedHostile.blocks[0].blockId, 'hostile-core');

const hostileLegacy = { ...hostileDocument, version: 11 };
delete hostileLegacy.assemblySpaces;
delete hostileLegacy.blocks[0].assemblySpaceId;
assert(Blueprint.normalize(hostileLegacy), 'Legacy migration must also project unknown cyclic data safely.');

// Quaternion hemisphere and negative-zero canonicalization.
const q = AssemblySpaces.canonicalPose({ position: [-0, 0, -0], quaternion: [0, 0, 0, -1] });
assert.deepStrictEqual(q, root.localPose);
assert.strictEqual(AssemblySpaces.ownedGridKey('space:root', -0, 0, -0), '0,0,0');

// Anonymous IDs must not depend on cross-space input order.
const anonymousSpaces = [root, {
  assemblySpaceId: 'space:anonymous', parentAssemblySpaceId: 'space:root', name: 'Anonymous',
  localPose: { position: [3, 0, 0], quaternion: [0, 0, 0, 1] }
}];
const anonymousA = Blueprint.createDocument({ assemblySpaces: anonymousSpaces, blocks: [
  { assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Hull' },
  { assemblySpaceId: 'space:anonymous', x: 0, y: 0, z: 0, type: 'Hull' }
] });
const anonymousB = Blueprint.createDocument({ assemblySpaces: [...anonymousSpaces].reverse(), blocks: [
  { assemblySpaceId: 'space:anonymous', x: 0, y: 0, z: 0, type: 'Hull' },
  { assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Hull' }
] });
assert.deepStrictEqual(
  Object.fromEntries(anonymousA.blocks.map(item => [item.assemblySpaceId, item.blockId])),
  Object.fromEntries(anonymousB.blocks.map(item => [item.assemblySpaceId, item.blockId]))
);
assert.strictEqual(anonymousA.blocks.find(item => item.assemblySpaceId === 'space:root').blockId, 'block:0:0:0');
assert.strictEqual(anonymousA.blocks.find(item => item.assemblySpaceId === 'space:anonymous').blockId, 'block:space:anonymous:0:0:0');

// Current mechanical schema rejects invalid actuator tuning instead of silently clamping it.
const validLimits = { minAngle: -0.5, maxAngle: 0.5 };
assert.deepStrictEqual(Blueprint.canonicalLimits(validLimits), {
  minAngle: -0.5, maxAngle: 0.5, tolerance: 0.01, maxTorque: 80,
  maxSpeed: 5, positionGain: 16, velocityDamping: 1.5
});
for (const patch of [
  { tolerance: -1 }, { maxTorque: 0 }, { maxTorque: -1 }, { maxSpeed: 0 },
  { positionGain: 0 }, { velocityDamping: -0.1 }, { maxTorque: 'not-a-number' }
]) assert.strictEqual(Blueprint.canonicalLimits({ ...validLimits, ...patch }), null);

// Deep chains are iterative and safe from JS call-stack overflow.
const DEEP = 6000;
const deep = [root];
for (let index = 1; index <= DEEP; index += 1) {
  deep.push({
    assemblySpaceId: `space:deep:${index}`,
    parentAssemblySpaceId: index === 1 ? 'space:root' : `space:deep:${index - 1}`,
    name: `Deep ${index}`,
    localPose: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] }
  });
}
const indexed = AssemblySpaces.validateAndIndex(deep, { allowDefaultRoot: false });
assert(indexed.ok, indexed.diagnostics.map(item => item.code));
assert.strictEqual(indexed.depthById[`space:deep:${DEEP}`], DEEP);
assert.deepStrictEqual(AssemblySpaces.spaceLocalToRoot(`space:deep:${DEEP}`, [0, 0, 0], indexed), [DEEP, 0, 0]);
assert.strictEqual(AssemblySpaces.lowestCommonAncestor(`space:deep:${DEEP}`, 'space:deep:4500', indexed), 'space:deep:4500');

// Deep cycle detection must also remain iterative.
const cyclic = deep.slice(0, 2500).map(space => JSON.parse(JSON.stringify(space)));
cyclic[1].parentAssemblySpaceId = 'space:deep:2499';
const cycleResult = AssemblySpaces.validateAndIndex(cyclic, { allowDefaultRoot: false });
assert.strictEqual(cycleResult.ok, false);
const cycleDiagnostic = cycleResult.diagnostics.find(item => item.code === 'assembly-space-parent-cycle');
assert(cycleDiagnostic);
assert.strictEqual(cycleDiagnostic.cycle[0], cycleDiagnostic.cycle[cycleDiagnostic.cycle.length - 1]);
for (let index = 1; index < cycleDiagnostic.cycle.length - 1; index += 1) {
  assert.notStrictEqual(cycleDiagnostic.cycle[index], cycleDiagnostic.cycle[index - 1], 'Cycle context must not duplicate adjacent nodes.');
}
assert.strictEqual(new Set(cycleDiagnostic.cycle.slice(0, -1)).size, cycleDiagnostic.cycle.length - 1, 'Cycle context must contain each cycle node once.');

const block = (blockId, assemblySpaceId, x, y = 0, z = 0, type = 'Hull') => ({
  blockId, assemblySpaceId, x, y, z, type, orientation: 0, controlAxis: 'pitch', controlSign: 0
});
const child = {
  assemblySpaceId: 'space:child', parentAssemblySpaceId: 'space:root', name: 'Child',
  localPose: { position: [1.5, 0, 0], quaternion: [0, 0, 0, 1] }
};
const model = CraftModel.create(Blueprint.createDocument({
  assemblySpaces: [root, child],
  blocks: [block('core', 'space:root', 0, 0, 0, 'Core'), block('child-block', 'space:child', 0)],
  mechanicalLinks: []
}));
const before = Blueprint.signature(model.toDocument());
const offGrid = model.reassignBlock('child-block', 'space:root');
assert.strictEqual(offGrid.ok, false);
assert.strictEqual(offGrid.reason, 'assembly-space-reassign-off-grid');
assert.strictEqual(Blueprint.signature(model.toDocument()), before, 'failed transaction must be atomic');

// Collision during child deletion must not partially mutate state.
const colliding = CraftModel.create(Blueprint.createDocument({
  assemblySpaces: [root, { ...child, localPose: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] } }],
  blocks: [block('core2', 'space:root', 0, 0, 0, 'Core'), block('occupied', 'space:root', 1), block('child2', 'space:child', 0)],
  mechanicalLinks: []
}));
const collisionBefore = Blueprint.signature(colliding.toDocument());
const deleteResult = colliding.removeAssemblySpace('space:child', { policy: 'reassign-to-parent' });
assert.strictEqual(deleteResult.ok, false);
assert.strictEqual(deleteResult.reason, 'occupied');
assert.strictEqual(Blueprint.signature(colliding.toDocument()), collisionBefore);

// Reparenting has a dedicated world-pose-preserving transaction.
const reparentModel = CraftModel.create(Blueprint.createDocument({
  assemblySpaces: [
    root,
    { assemblySpaceId: 'space:p1', parentAssemblySpaceId: 'space:root', name: 'P1', localPose: { position: [10, 0, 0], quaternion: [0, 0, 0, 1] } },
    { assemblySpaceId: 'space:p2', parentAssemblySpaceId: 'space:root', name: 'P2', localPose: { position: [-3, 0, 0], quaternion: [0, 0, 0, 1] } },
    { assemblySpaceId: 'space:leaf', parentAssemblySpaceId: 'space:p1', name: 'Leaf', localPose: { position: [2, 0, 0], quaternion: [0, 0, 0, 1] } }
  ],
  blocks: [block('reparent-core', 'space:root', 0, 0, 0, 'Core'), block('leaf-block', 'space:leaf', 0)],
  mechanicalLinks: []
}));
const leafBefore = AssemblySpaces.spaceLocalToRoot('space:leaf', [0, 0, 0], reparentModel.assemblySpaces());
assert.strictEqual(reparentModel.updateAssemblySpace('space:leaf', { parentAssemblySpaceId: 'space:p2' }).reason, 'assembly-space-use-reparent-operation');
const reparented = reparentModel.reparentAssemblySpace('space:leaf', 'space:p2');
assert(reparented.ok, reparented.reason);
const leafAfter = AssemblySpaces.spaceLocalToRoot('space:leaf', [0, 0, 0], reparentModel.assemblySpaces());
assert.deepStrictEqual(leafAfter, leafBefore);
const cycleAttempt = reparentModel.reparentAssemblySpace('space:p2', 'space:leaf');
assert.strictEqual(cycleAttempt.ok, false);
assert.strictEqual(cycleAttempt.reason, 'assembly-space-parent-cycle');

// Compiler cache is revision-bound and ownership changes invalidate it naturally.
const cachedA = CraftCompiler.compile(colliding);
const cachedB = CraftCompiler.compile(colliding);
assert.strictEqual(cachedA, cachedB);
assert(colliding.move('occupied', 2, 0, 0).ok);
const cachedC = CraftCompiler.compile(colliding);
assert.notStrictEqual(cachedA, cachedC);

// Authoring-only names must not perturb the executable runtime signature.
const renamedBefore = CraftCompiler.compile(reparentModel).signature;
assert(reparentModel.updateAssemblySpace('space:leaf', { name: 'Renamed metadata only' }).ok);
const renamedAfter = CraftCompiler.compile(reparentModel).signature;
assert.strictEqual(renamedAfter, renamedBefore);
assert.notStrictEqual(Blueprint.signature(reparentModel.toDocument()), before);

// Runtime plan indexes must agree exactly with authored ownership.
const validDoc = Blueprint.createDocument({
  assemblySpaces: [root],
  blocks: [block('runtime-core', 'space:root', 0, 0, 0, 'Core')],
  mechanicalLinks: []
});
// Rotated owner-space axes must be truly tangent to endpoint faces.
const diagonalHalfAngle = Math.PI / 8;
const inverseRoot = value => [value * Math.SQRT1_2, -value * Math.SQRT1_2, 0];
const diagonalOwner = {
  assemblySpaceId: 'space:diagonal-owner', parentAssemblySpaceId: 'space:root', name: 'Diagonal Owner',
  localPose: { position: [0, 0, 0], quaternion: [0, 0, Math.sin(diagonalHalfAngle), Math.cos(diagonalHalfAngle)] }
};
const inverseRotation = [0, 0, -Math.sin(diagonalHalfAngle), Math.cos(diagonalHalfAngle)];
const invalidAxisDoc = {
  version: 12,
  assemblySpaces: [
    root,
    diagonalOwner,
    { assemblySpaceId: 'space:axis-a', parentAssemblySpaceId: diagonalOwner.assemblySpaceId, name: 'A', localPose: { position: inverseRoot(1), quaternion: inverseRotation } },
    { assemblySpaceId: 'space:axis-b', parentAssemblySpaceId: diagonalOwner.assemblySpaceId, name: 'B', localPose: { position: inverseRoot(2), quaternion: inverseRotation } }
  ],
  blocks: [
    block('axis-core', 'space:axis-a', 0, 0, 0, 'Core'),
    block('axis-child-edge', 'space:axis-b', 0)
  ],
  mechanicalLinks: [{
    mechanicalLinkId: 'mechanical:invalid-diagonal-axis', assemblySpaceId: diagonalOwner.assemblySpaceId, kind: 'hinge',
    endpointA: { blockId: 'axis-core', face: 'PX' }, endpointB: { blockId: 'axis-child-edge', face: 'NX' },
    axis: 'PX', collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null
  }]
};
const invalidAxisCompile = CraftCompiler.compile(invalidAxisDoc);
assert.strictEqual(invalidAxisCompile.ready, false);
assert(invalidAxisCompile.errors.includes('mechanical-axis-normal-to-shared-face'), invalidAxisCompile.errors);

const compiled = CraftCompiler.compile(validDoc);
const plan = RuntimeAssembly.createPlan(compiled);
assert.strictEqual(plan.bodyIdToAssemblySpaceId[plan.rootBodyId], 'space:root');
assert.strictEqual(plan.blockIdToAssemblySpaceId['runtime-core'], 'space:root');

console.log({
  quaternionHemisphere: 'ok',
  negativeZero: 'ok',
  deepChain: DEEP,
  iterativeCycleDetection: 'ok',
  atomicRollback: 'ok',
  reparentPreservesWorldPose: 'ok',
  cacheRevision: 'ok'
});
