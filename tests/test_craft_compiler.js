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
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/blueprint.js',
  'src/foundation/diagnostics.js',
  'src/foundation/craft_model.js',
  'src/foundation/control_frame.js',
  'src/foundation/mass_properties.js',
  'src/foundation/structural_graph_compiler.js',
  'src/foundation/mechanical_authoring_resolver.js',
  'src/foundation/rigid_island_compiler.js',
  'src/foundation/mechanical_graph_compiler.js',
  'src/foundation/craft_compiler.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const CraftModel = global.VAW.require('foundation.craft-model');
const CraftCompiler = global.VAW.require('foundation.craft-compiler');
const Config = global.VAW.require('foundation.config');
const Catalog = global.VAW.require('foundation.catalog');
const AssemblySpaces = global.VAW.require('foundation.assembly-spaces');

function block(x, y, z, type = 'Hull', orientation = 0) {
  return { blockId: `block:${x}:${y}:${z}:${type}`, x, y, z, type, orientation, controlAxis: 'pitch', controlSign: 0 };
}

const empty = CraftCompiler.compile(CraftModel.create());
assert.strictEqual(empty.ready, false);
assert(empty.errors.includes('empty-craft'));
assert(empty.errors.includes('missing-core'));
assert(Object.isFrozen(empty));

const incomplete = CraftModel.create([block(0, 0, 0, 'Thruster')]);
const incompleteCompiled = CraftCompiler.compile(incomplete);
assert.strictEqual(incompleteCompiled.ready, false);
assert(incompleteCompiled.errors.includes('missing-core'));

const rocket = CraftModel.create([
  block(0, 0, 0, 'Thruster'),
  block(0, 1, 0, 'Fuel'),
  block(0, 2, 0, 'Core'),
  block(0, 3, 0, 'Gyro')
]);
const compiled = CraftCompiler.compile(rocket);
assert(compiled.ready);
assert.strictEqual(compiled.coreKey, '0,2,0');
assert.deepStrictEqual(compiled.coreAssemblyPosition, [0, 2, 0]);
assert.deepStrictEqual(compiled.controlFrame.forward, [1, 0, 0]);
assert.deepStrictEqual(compiled.controlFrame.up, [0, 1, 0]);
assert.deepStrictEqual(compiled.controlFrame.right, [0, 0, 1]);
assert.strictEqual(compiled.blockCount, 4);
assert.strictEqual(typeof compiled.parts[0].blockId, 'string');
assert.strictEqual(compiled.blockIdToIndex[compiled.parts[0].blockId], 0);
assert.strictEqual(compiled.gravity, Config.AEROSTATICS.gravity);
assert.strictEqual(compiled.weight, compiled.mass * compiled.gravity);
assert.strictEqual(compiled.rigidIslandCount, 1);
assert.strictEqual(compiled.colliderPlan.length, 4);
assert.strictEqual(compiled.parts[compiled.coreIndex].type, 'Core');
assert.strictEqual(compiled.counts.Thruster, 1);
assert.strictEqual(compiled.fuelCapacity, Catalog.BLOCKS.Fuel.fuelCapacity);
assert(Math.abs(compiled.mass - (Catalog.BLOCKS.Thruster.mass + Catalog.BLOCKS.Fuel.mass + Catalog.BLOCKS.Core.mass + Catalog.BLOCKS.Gyro.mass)) < 1e-9);
assert(Object.isFrozen(compiled.parts));
assert(Object.isFrozen(compiled.parts[0]));
assert(Object.isFrozen(compiled.parts[0].basis.forward));
assert(Object.isFrozen(compiled.adjacency));
assert.strictEqual(CraftCompiler.compile(rocket), compiled, 'Same model revision should hit the compiler cache.');

const rotatedOrientation = global.VAW.require('foundation.orientation').findOrientationId(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0)
);
const rotatedCraft = CraftModel.create([
  block(0, 0, 0, 'Core', rotatedOrientation),
  block(1, 0, 0, 'Hull')
]);
const rotatedCompiled = CraftCompiler.compile(rotatedCraft);
assert.deepStrictEqual(rotatedCompiled.controlFrame.forward, [0, 0, 1]);
assert.deepStrictEqual(rotatedCompiled.controlFrame.up, [0, 1, 0]);
assert.deepStrictEqual(rotatedCompiled.controlFrame.right, [-1, 0, 0]);


rocket.add(block(0, 4, 0, 'Hull'), 'extend');
const recompiled = CraftCompiler.compile(rocket);
assert.notStrictEqual(recompiled, compiled);
assert.notStrictEqual(recompiled.signature, compiled.signature);
assert.strictEqual(recompiled.sourceRevision, rocket.revision);

const orderA = CraftCompiler.compile([
  block(0, 1, 0, 'Core'),
  block(0, 0, 0, 'Thruster')
]);
const orderB = CraftCompiler.compile([
  block(0, 0, 0, 'Thruster'),
  block(0, 1, 0, 'Core')
]);
assert.strictEqual(orderA.signature, orderB.signature, 'Compilation signature must not depend on insertion order.');

const strictV12RootBlock = {
  blockId: 'strict-core',
  assemblySpaceId: AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
  x: 0,
  y: 0,
  z: 0,
  type: 'Core',
  orientation: 0,
  controlAxis: 'pitch',
  controlSign: 0
};
for (const [label, assemblySpaces] of [
  ['missing', undefined],
  ['null', null],
  ['empty', []],
  ['wrong-type', 'space:root'],
  ['missing-root', [{
    assemblySpaceId: 'space:child',
    parentAssemblySpaceId: AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID,
    name: 'Child',
    localPose: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] }
  }]]
]) {
  const strict = CraftCompiler.compile({
    version: 12,
    assemblySpaces,
    blocks: [strictV12RootBlock],
    mechanicalLinks: []
  });
  assert.strictEqual(strict.ready, false, `Strict Blueprint v12 with ${label} assemblySpaces must not compile ready.`);
  assert(strict.errors.includes('assembly-space-missing-root'), `Strict Blueprint v12 with ${label} assemblySpaces must report missing root.`);
}
const legacyWithoutSpaces = CraftCompiler.compile({
  version: 11,
  blocks: [{ ...strictV12RootBlock, assemblySpaceId: undefined }],
  mechanicalLinks: []
});
assert.strictEqual(legacyWithoutSpaces.ready, true, 'Legacy v11 compiler fallback may still synthesize Root ownership.');

const disconnected = CraftModel.create([
  block(0, 0, 0, 'Core'),
  block(5, 0, 0, 'Hull')
]);
const disconnectedCompiled = CraftCompiler.compile(disconnected);
assert.strictEqual(disconnectedCompiled.ready, false);
assert(disconnectedCompiled.errors.includes('assembly-disconnected'));
assert.strictEqual(disconnectedCompiled.rigidIslandCount, 2);

const maximumBlocks = [];
outer: for (let y = Config.GRID.minY; y <= Config.GRID.maxY; y += 1) {
  for (let x = -Config.GRID.halfExtent; x <= Config.GRID.halfExtent; x += 1) {
    for (let z = -Config.GRID.halfExtent; z <= Config.GRID.halfExtent; z += 1) {
      maximumBlocks.push(block(x, y, z, maximumBlocks.length === 100 ? 'Core' : 'Hull'));
      if (maximumBlocks.length === Config.GRID.maxBlocks) break outer;
    }
  }
}
const maximum = CraftModel.create(maximumBlocks);
const started = process.hrtime.bigint();
const maximumCompiled = CraftCompiler.compile(maximum);
const compileMs = Number(process.hrtime.bigint() - started) / 1e6;
assert(maximumCompiled.ready);
assert.strictEqual(maximumCompiled.parts.length, Config.GRID.maxBlocks);
assert(compileMs < 5000, `Maximum compile took ${compileMs.toFixed(1)} ms.`);

const overLimitCompiled = CraftCompiler.compile([...maximumBlocks, block(999, 999, 999, 'Hull')]);
assert.strictEqual(overLimitCompiled.ready, false);
assert(overLimitCompiled.errors.includes('block-limit'));
assert.strictEqual(overLimitCompiled.parts.length, Config.GRID.maxBlocks, 'Compiler work must remain capped at the configured block limit.');
assert(!overLimitCompiled.errors.includes('invalid-block'), 'Blocks beyond the hard limit must not leak into compilation.');

console.log(JSON.stringify({
  emptyReadiness: 'ok',
  movableCore: 'ok',
  deterministicSignature: 'ok',
  revisionCache: 'ok',
  disconnectedDiagnostics: 'ok',
  maximumCompileMs: Number(compileMs.toFixed(2)),
  maximumParts: maximumCompiled.parts.length,
  overLimitWorkCap: 'ok',
  strictBlueprintV12AssemblySpaces: 'ok',
  persistentBlockMapping: 'ok',
  configuredGravity: 'ok'
}, null, 2));
