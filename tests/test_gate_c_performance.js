const assert = require('assert');
const { performance } = require('perf_hooks');
const { FOUNDATION_SOURCES, RUNTIME_SOURCES, load } = require('./load_runtime');
load([...FOUNDATION_SOURCES, ...RUNTIME_SOURCES], { stubs: true });

const AssemblySpaces = VAW.require('foundation.assembly-spaces');
const Blueprint = VAW.require('foundation.blueprint');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const AssemblyBuilder = VAW.require('runtime.assembly-builder');
const Physics = VAW.require('runtime.headless-physics-backend').create();

const SPACE_COUNT = 32;
const BLOCKS_PER_SPACE = 8;
const spaces = [AssemblySpaces.createRootSpace()];
const blocks = [];
const links = [];
for (let spaceIndex = 0; spaceIndex < SPACE_COUNT; spaceIndex += 1) {
  const assemblySpaceId = spaceIndex === 0 ? 'space:root' : `space:${String(spaceIndex).padStart(2, '0')}`;
  if (spaceIndex > 0) spaces.push({
    assemblySpaceId,
    parentAssemblySpaceId: 'space:root',
    name: `Space ${spaceIndex}`,
    localPose: { position: [spaceIndex, 0, 0], quaternion: [0, 0, 0, 1] }
  });
  for (let z = 0; z < BLOCKS_PER_SPACE; z += 1) blocks.push({
    blockId: `block:${spaceIndex}:${z}`,
    assemblySpaceId,
    x: 0, y: 0, z,
    type: spaceIndex === 0 && z === 0 ? 'Core' : 'Hull',
    orientation: 0, controlAxis: 'pitch', controlSign: 0
  });
  if (spaceIndex > 0) links.push({
    mechanicalLinkId: `mechanical:${spaceIndex}`,
    assemblySpaceId: 'space:root',
    kind: 'hinge',
    endpointA: { blockId: `block:${spaceIndex - 1}:0`, face: 'PX' },
    endpointB: { blockId: `block:${spaceIndex}:0`, face: 'NX' },
    axis: 'PY', collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null
  });
}
const document = Blueprint.createDocument({ assemblySpaces: spaces, blocks, mechanicalLinks: links });
const blueprintText = JSON.stringify(document);

function measure(fn, iterations = 1) {
  const samples = [];
  let result;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    result = fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { result, medianMs: samples[Math.floor(samples.length / 2)], maxMs: samples[samples.length - 1] };
}

const compile = measure(() => CraftCompiler.compile(document), 5);
assert(compile.result.ready, compile.result.errors.join(', '));
const planBuild = measure(() => RuntimeAssembly.createPlan(compile.result), 5);
const plan = planBuild.result;
const saveLoad = measure(() => Blueprint.normalize(JSON.parse(blueprintText)), 20);
assert(saveLoad.result);

const world = Physics.createWorld({ gravity: { x: 0, y: 0, z: 0 } });
const launch = measure(() => AssemblyBuilder.build({
  plan,
  physics: Physics,
  world,
  bodyDescriptor: bodyPlan => ({
    position: { x: bodyPlan.assemblyPose.position[0], y: bodyPlan.assemblyPose.position[1], z: bodyPlan.assemblyPose.position[2] },
    quaternion: { x: bodyPlan.assemblyPose.quaternion[0], y: bodyPlan.assemblyPose.quaternion[1], z: bodyPlan.assemblyPose.quaternion[2], w: bodyPlan.assemblyPose.quaternion[3] }
  }),
  constraintBuilder: ({ constraintPlan }) => ({ constraintId: constraintPlan.constraintId, dispose() { return true; } })
}), 1);
const runtime = launch.result;
const runtimeObjectCount = runtime.bodyById.size + runtime.colliderById.size + runtime.constraintById.size;
const cleanupStarted = performance.now();
runtime.dispose();
const cleanupMs = performance.now() - cleanupStarted;
assert.strictEqual(world.bodies.length, 0);
assert.strictEqual(runtime.bodyById.size + runtime.colliderById.size + runtime.constraintById.size, 0);

const deepSpaces = [AssemblySpaces.createRootSpace()];
for (let index = 1; index <= 1024; index += 1) deepSpaces.push({
  assemblySpaceId: `space:deep:${index}`,
  parentAssemblySpaceId: index === 1 ? 'space:root' : `space:deep:${index - 1}`,
  name: `Deep ${index}`,
  localPose: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] }
});
const indexed = AssemblySpaces.validateAndIndex(deepSpaces, { allowDefaultRoot: false });
assert(indexed.ok);
const transformLookup = measure(() => AssemblySpaces.spaceLocalToRoot('space:deep:1024', [0, 0, 0], indexed), 1000);
assert.deepStrictEqual(transformLookup.result.map(Math.round), [1024, 0, 0]);

const result = {
  spaces: SPACE_COUNT,
  blocks: blocks.length,
  mechanicalLinks: links.length,
  blueprintBytes: Buffer.byteLength(blueprintText),
  compileMedianMs: Number(compile.medianMs.toFixed(3)),
  compileMaxMs: Number(compile.maxMs.toFixed(3)),
  runtimePlanMedianMs: Number(planBuild.medianMs.toFixed(3)),
  saveLoadMedianMs: Number(saveLoad.medianMs.toFixed(3)),
  launchMs: Number(launch.medianMs.toFixed(3)),
  runtimeObjectCount,
  cleanupMs: Number(cleanupMs.toFixed(3)),
  cleanupObjectCount: world.bodies.length + runtime.bodyById.size + runtime.colliderById.size + runtime.constraintById.size,
  transformChainDepth: 1024,
  transformLookupMedianMs: Number(transformLookup.medianMs.toFixed(5))
};
assert(Object.values(result).every(value => typeof value !== 'number' || Number.isFinite(value)));
console.log(JSON.stringify(result, null, 2));
