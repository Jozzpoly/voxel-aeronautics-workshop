'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests/browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/blueprint.js',
  'src/game/orientation_service.js',
  'src/game/module_visual_factory.js',
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const ModuleVisualFactory = global.VAW.require('game.module-visual-factory');
const {
  MODULE_VISUAL_CELL_SCALE,
  MODULE_VISUAL_CELL_SCALE_DEFAULT,
  MODULE_VISUAL_CELL_SCALE_FLUSH,
  parseModuleVisualCellScaleDevFlag,
  create
} = ModuleVisualFactory;

assert.strictEqual(MODULE_VISUAL_CELL_SCALE, 0.96, 'Default export must remain 0.96.');
assert.strictEqual(MODULE_VISUAL_CELL_SCALE_DEFAULT, 0.96);
assert.strictEqual(MODULE_VISUAL_CELL_SCALE_FLUSH, 1);
assert.strictEqual(parseModuleVisualCellScaleDevFlag({ search: '?cellScale=1' }), 1);
assert.strictEqual(parseModuleVisualCellScaleDevFlag({ search: '?voxelFit=flush' }), 1);
assert.strictEqual(parseModuleVisualCellScaleDevFlag({ search: '' }), 0.96);
const storage = { values: new Map(), getItem(key) { return this.values.get(key) || null; }, setItem(key, value) { this.values.set(key, value); } };
storage.setItem('vaw.moduleVisualCellScale', '1');
assert.strictEqual(parseModuleVisualCellScaleDevFlag({ search: '', storage }), 1);

function cloneMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
}

const factory = create({
  THREE,
  sharedGeometry: new THREE.BoxGeometry(1, 1, 1),
  cloneMaterial,
});

function hitProxy(root) {
  const proxy = root.children.find(child => child.name === 'vawHitProxy');
  assert.ok(proxy, 'Module visual root must include vawHitProxy.');
  return proxy;
}

function assertScale(root) {
  assert.strictEqual(root.scale.x, MODULE_VISUAL_CELL_SCALE);
  assert.strictEqual(root.scale.y, MODULE_VISUAL_CELL_SCALE);
  assert.strictEqual(root.scale.z, MODULE_VISUAL_CELL_SCALE);
}

function assertRaycastPolicy(root, proxy) {
  assert.strictEqual(proxy.userData.isVoxelHitProxy, true, 'Hit proxy must be flagged for selection.');
  let decorativeMeshes = 0;
  let decorativeWithNoRaycast = 0;
  root.traverse(object => {
    if (object === proxy || object === root || !object.geometry) return;
    decorativeMeshes += 1;
    if (typeof object.raycast === 'function' && object.raycast.length === 0) decorativeWithNoRaycast += 1;
  });
  if (decorativeMeshes > 0) {
    assert.strictEqual(
      decorativeWithNoRaycast,
      decorativeMeshes,
      'Every decorative mesh must no-op raycast so only the proxy is hit-testable.'
    );
  }
  assert.notStrictEqual(typeof proxy.raycast, 'function', 'Hit proxy must remain the default raycast target.');
}

const blockTypes = ['Hull', 'Thruster', 'VectorThruster', 'Core', 'Balloon'];
for (const blockType of blockTypes) {
  const solid = factory.createModuleVisual(blockType, 0, false);
  assert.strictEqual(solid.userData.isVoxelRoot, true);
  assert.strictEqual(solid.userData.type, blockType);
  assertScale(solid);
  const solidProxy = hitProxy(solid);
  assertRaycastPolicy(solid, solidProxy);
  assert.notStrictEqual(solidProxy.material.opacity, 0.52, `${blockType} solid proxy must not use ghost placement opacity.`);
  assert.notStrictEqual(solidProxy.material.transparent, true, `${blockType} solid proxy must stay opaque for placement.`);

  const ghost = factory.createModuleVisual(blockType, 0, true);
  assertScale(ghost);
  const ghostProxy = hitProxy(ghost);
  assertRaycastPolicy(ghost, ghostProxy);
  assert.strictEqual(ghostProxy.material.transparent, true, `${blockType} ghost proxy must be transparent.`);
  assert.strictEqual(ghostProxy.material.opacity, 0.52, `${blockType} ghost proxy must keep readable placement opacity.`);
}

const oriented = factory.createModuleVisual('Thruster', 12, false);
assertScale(oriented);
assert.notStrictEqual(oriented.quaternion.w, 1, 'Oriented blocks must still apply basis rotation under cell scale.');

const flushFactory = create({
  THREE,
  sharedGeometry: new THREE.BoxGeometry(1, 1, 1),
  cloneMaterial,
  cellScale: MODULE_VISUAL_CELL_SCALE_FLUSH
});
const flushHull = flushFactory.createModuleVisual('Hull', 0, false);
assert.strictEqual(flushHull.scale.x, 1);
assert.strictEqual(flushHull.userData.moduleVisualCellScale, 1);

console.log(JSON.stringify({
  moduleVisualCellScale: MODULE_VISUAL_CELL_SCALE,
  moduleVisualCellScaleFlush: MODULE_VISUAL_CELL_SCALE_FLUSH,
  devFlagParse: 'ok',
  hitProxyPolicy: 'ok',
  ghostPlacementOpacity: 0.52,
  blockTypesChecked: blockTypes.length,
}, null, 2));