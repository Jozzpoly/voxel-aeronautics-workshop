const assert = require('assert');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load(FOUNDATION_SOURCES, { stubs: true });

const Config = VAW.require('foundation.config');
const Blueprint = VAW.require('foundation.blueprint');
const AssemblySpaces = VAW.require('foundation.assembly-spaces');
const CraftModel = VAW.require('foundation.craft-model');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');

const root = AssemblySpaces.createRootSpace();
const child = {
  assemblySpaceId: 'space:arm',
  parentAssemblySpaceId: root.assemblySpaceId,
  name: 'Arm',
  localPose: { position: [2, 0, 0], quaternion: [0, 0, 0, 1] }
};
const block = (blockId, assemblySpaceId, x, y, z, type = 'Hull') => ({
  blockId, assemblySpaceId, x, y, z, type, orientation: 0, controlAxis: 'pitch', controlSign: 0
});
const hinge = {
  mechanicalLinkId: 'mechanical:space-hinge',
  assemblySpaceId: root.assemblySpaceId,
  kind: 'hinge',
  endpointA: { blockId: 'root-edge', face: 'PX' },
  endpointB: { blockId: 'arm-edge', face: 'NX' },
  axis: 'PY',
  collideConnected: false,
  maxForce: 1000000,
  frictionTorque: 0,
  limits: null
};

assert.strictEqual(Config.SAVE_VERSION, 12);
const v11 = {
  version: 11,
  blocks: [{ blockId: 'core', x: 0, y: 0, z: 0, type: 'Core', orientation: 0, controlAxis: 'pitch', controlSign: 0 }],
  mechanicalLinks: []
};
const v11Before = JSON.stringify(v11);
const migrated = Blueprint.migrateV11ToV12(v11);
assert.strictEqual(JSON.stringify(v11), v11Before, 'migration must not mutate source');
assert.strictEqual(migrated.version, 12);
assert.deepStrictEqual(migrated.assemblySpaces.map(space => space.assemblySpaceId), [root.assemblySpaceId]);
assert.strictEqual(migrated.blocks[0].assemblySpaceId, root.assemblySpaceId);
assert.deepStrictEqual(Blueprint.normalize(v11), Blueprint.createDocument({ blocks: v11.blocks }));

const document = Blueprint.createDocument({
  assemblySpaces: [child, root],
  blocks: [
    block('arm-edge', child.assemblySpaceId, 0, 0, 0),
    block('core', root.assemblySpaceId, 0, 0, 0, 'Core'),
    block('root-edge', root.assemblySpaceId, 1, 0, 0)
  ],
  mechanicalLinks: [hinge]
});
assert.deepStrictEqual(Blueprint.normalize(JSON.parse(JSON.stringify(document))), document);
assert.strictEqual(Blueprint.signature(document), Blueprint.signature(Blueprint.normalize(document)));

assert.strictEqual(Blueprint.normalize({ ...document, assemblySpaces: [root, { ...child, parentAssemblySpaceId: 'space:missing' }] }), null);
assert.strictEqual(Blueprint.normalize({
  ...document,
  assemblySpaces: [
    root,
    { ...child, parentAssemblySpaceId: 'space:loop' },
    { assemblySpaceId: 'space:loop', parentAssemblySpaceId: child.assemblySpaceId, name: 'Loop', localPose: child.localPose }
  ]
}), null);
assert.strictEqual(Blueprint.normalize({
  ...document,
  blocks: document.blocks.map(item => item.blockId === 'arm-edge' ? { ...item, assemblySpaceId: 'space:missing' } : item)
}), null);
assert.strictEqual(Blueprint.normalize({ ...document, mechanicalLinks: [{ ...hinge, assemblySpaceId: child.assemblySpaceId }] }), null);
assert.strictEqual(Blueprint.normalize({
  ...document,
  blocks: document.blocks.map(item => item.blockId === 'arm-edge'
    ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'assemblySpaceId'))
    : item)
}), null);
assert.strictEqual(Blueprint.normalize({
  ...document,
  mechanicalLinks: [Object.fromEntries(Object.entries(hinge).filter(([key]) => key !== 'assemblySpaceId'))]
}), null);

const model = CraftModel.create(document);
assert.strictEqual(model.assemblySpaceCount, 2);
assert.strictEqual(model.getById('arm-edge').assemblySpaceId, child.assemblySpaceId);
assert.strictEqual(model.get('space:arm@0,0,0').blockId, 'arm-edge');
assert.deepStrictEqual(model.toDocument(), document);

const createResult = model.createAssemblySpace({
  assemblySpaceId: 'space:payload',
  parentAssemblySpaceId: root.assemblySpaceId,
  name: 'Payload',
  localPose: { position: [0, 2, 0], quaternion: [0, 0, 0, 1] }
});
assert(createResult.ok, createResult.reason);
assert(model.add(block('payload', 'space:payload', 0, 0, 0)).ok);
const reassign = model.reassignBlock('payload', root.assemblySpaceId);
assert(reassign.ok, reassign.reason);
assert.deepStrictEqual([reassign.block.x, reassign.block.y, reassign.block.z], [0, 2, 0]);
assert(model.removeAssemblySpace('space:payload').ok);

const copied = model.copySubgraph(['arm-edge'], { x: 0, y: 1, z: 0 });
assert(copied.ok, copied.reason);
assert.strictEqual(copied.blocks[0].assemblySpaceId, child.assemblySpaceId);

const compiled = CraftCompiler.compile(document);
assert(compiled.ready, compiled.errors.join(', '));
assert.strictEqual(compiled.format, 'VAW_COMPILED_CRAFT_V5');
assert.strictEqual(compiled.assemblySpaceCount, 2);
assert.strictEqual(compiled.blockIdToAssemblySpaceId['arm-edge'], child.assemblySpaceId);
assert.strictEqual(compiled.bodyIdToAssemblySpaceId['body:arm-edge'], child.assemblySpaceId);
assert.deepStrictEqual(compiled.parts.find(part => part.blockId === 'arm-edge').assemblyPosition, [2, 0, 0]);
assert.strictEqual(compiled.mechanicalGraph.constraints[0].assemblySpaceId, root.assemblySpaceId);

const permuted = CraftCompiler.compile({
  ...document,
  assemblySpaces: [...document.assemblySpaces].reverse(),
  blocks: [...document.blocks].reverse(),
  mechanicalLinks: [...document.mechanicalLinks].reverse()
});
assert.strictEqual(permuted.signature, compiled.signature);
assert.deepStrictEqual(permuted.rigidIslands, compiled.rigidIslands);

const plan = RuntimeAssembly.createPlan(compiled);
assert.strictEqual(plan.format, 'VAW_RUNTIME_ASSEMBLY_PLAN_V3');
assert.strictEqual(plan.blockIdToAssemblySpaceId['arm-edge'], child.assemblySpaceId);
const armBody = plan.rigidBodies.find(body => body.bodyId === 'body:arm-edge');
const worldPose = RuntimeAssembly.worldBodyPose(plan, { position: [10, 3, -2], quaternion: [0, 0, 0, 1] }, armBody);
assert.deepStrictEqual(worldPose.position, [12, 3, -2]);

const quarterTurnZ = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
const siblingDocument = Blueprint.createDocument({
  assemblySpaces: [
    root,
    { assemblySpaceId: 'space:a', parentAssemblySpaceId: root.assemblySpaceId, name: 'A', localPose: { position: [1, 0, 0], quaternion: quarterTurnZ } },
    { assemblySpaceId: 'space:b', parentAssemblySpaceId: root.assemblySpaceId, name: 'B', localPose: { position: [2, 0, 0], quaternion: [0, 0, 0, 1] } }
  ],
  blocks: [
    block('sibling-core', 'space:a', 0, 1, 0, 'Core'),
    block('sibling-a', 'space:a', 0, 0, 0),
    block('sibling-b', 'space:b', 0, 0, 0)
  ],
  mechanicalLinks: [{
    ...hinge,
    mechanicalLinkId: 'mechanical:sibling-hinge',
    endpointA: { blockId: 'sibling-a', face: 'NY' },
    endpointB: { blockId: 'sibling-b', face: 'NX' },
    axis: 'PY'
  }]
});
const siblingCompiled = CraftCompiler.compile(siblingDocument);
assert(siblingCompiled.ready, siblingCompiled.errors.join(', '));
assert.deepStrictEqual(siblingCompiled.mechanicalGraph.constraints[0].axisAssemblyVector.map(value => Math.round(value)), [0, 1, 0]);

const invalidOwnerCompile = CraftCompiler.compile({
  version: 12,
  assemblySpaces: [root],
  blocks: [{ blockId: 'ownerless', x: 0, y: 0, z: 0, type: 'Core', orientation: 0, controlAxis: 'pitch', controlSign: 0 }],
  mechanicalLinks: []
});
assert.strictEqual(invalidOwnerCompile.ready, false);
assert(invalidOwnerCompile.errors.includes('assembly-space-missing-block-owner'));

console.log({ gateCAssemblySpaces: 'ok', blueprintVersion: Config.SAVE_VERSION, spaces: compiled.assemblySpaceCount, bodies: compiled.rigidIslandCount });
