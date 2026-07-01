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
  'src/foundation/visual_asset_manifest.js',
  'src/foundation/orientation.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/blueprint.js',
  'src/game/orientation_service.js',
  'src/game/visual_asset_registry.js',
  'src/game/visual_runtime_adapter.js',
  'src/game/module_visual_factory.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const Registry = VAW.require('game.visual-asset-registry');
const Catalog = VAW.require('foundation.catalog');
const RuntimeAdapter = VAW.require('game.visual-runtime-adapter');
const ModuleVisualFactory = VAW.require('game.module-visual-factory');
const studioSampleManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/visual_packs/test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));
const realBlockbenchManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/visual_packs/real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));

const manifest = {
  format: 'VAW_VISUAL_ASSET_PACK_V1',
  packId: 'test_pack',
  version: '0.1.0',
  assets: [{
    assetId: 'thruster_basic',
    kind: 'blockVisual',
    model: { path: 'models/thruster_basic.gltf', unitMeters: 1, forwardAxis: '+X', upAxis: '+Y' },
    bindings: {
      blockTypes: ['Thruster'],
      nodes: { visualRoot: 'Root', flame: 'Flame', flameGlow: 'FlameGlow', gimbalAssembly: null, controlFlapPivot: null },
      clips: { idle: null, thrust: 'thrust_loop', damage: null }
    },
    materialPolicy: { pixelated: true }
  }]
};

const registry = Registry.create();
assert.strictEqual(registry.assetForBlockType('Thruster'), null, 'Missing asset must resolve to fallback/null.');
assert.strictEqual(registry.registerManifest({ ...manifest, format: 'bad' }).ok, false, 'Invalid packs must not register.');
assert.strictEqual(registry.assetForBlockType('Thruster'), null, 'Invalid packs must not affect fallback.');

const registered = registry.registerManifest(manifest, 'unit-test', { packBaseUrl: 'assets/unit_pack' });
assert.strictEqual(registered.ok, true);
assert.strictEqual(registered.registered, 1);
assert.strictEqual(registry.assetForBlockType('Thruster').assetId, 'thruster_basic');
assert.strictEqual(registry.assetForBlockType('Thruster').packBaseUrl, 'assets/unit_pack/');
assert.strictEqual(registry.assetForBlockType('Thruster').source.source, 'unit-test');
assert.strictEqual(registry.assetForBlockType('Hull'), null);
assert.deepStrictEqual(registry.registeredBlockTypes(), ['Thruster']);
const coverage = registry.coverage();
assert.strictEqual(coverage.length, Object.keys(Catalog.BLOCKS).length);
assert.strictEqual(coverage.find(item => item.blockType === 'Thruster').status, 'registered-fallback');
assert.strictEqual(coverage.find(item => item.blockType === 'Hull').status, 'procedural-fallback');

function cloneMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
}

const factory = ModuleVisualFactory.create({
  THREE,
  sharedGeometry: new THREE.BoxGeometry(1, 1, 1),
  cloneMaterial,
  visualAssetRegistry: registry
});

const thruster = factory.createModuleVisual('Thruster', 0);
assert.strictEqual(thruster.userData.isVoxelRoot, true);
assert.strictEqual(thruster.userData.type, 'Thruster');
assert.strictEqual(thruster.userData.visualAssetId, 'thruster_basic');
assert.strictEqual(thruster.userData.visualAssetStatus, 'registered-fallback');
assert(thruster.children.some(child => child.name === 'vawHitProxy'), 'Factory must create a stable raycast proxy.');

const hull = factory.createModuleVisual('Hull', 0);
assert.strictEqual(hull.userData.visualAssetId, null);
assert.strictEqual(hull.userData.visualAssetStatus, 'procedural-fallback');

const adapter = RuntimeAdapter.create();
assert.strictEqual(adapter.setThrusterIntensity(thruster, 1, { active: true }), 2);
const flame = adapter.findByName(thruster, 'flame');
assert(flame && flame.visible, 'Thruster flame must be controllable through the adapter.');

const vector = factory.createModuleVisual('VectorThruster', 0);
assert.strictEqual(adapter.setGimbal(vector, 0.5, -0.25, Math.PI / 8), true);
const gimbal = adapter.findByName(vector, 'gimbalAssembly');
assert(gimbal && gimbal.rotation.y > 0 && gimbal.rotation.z > 0);

const control = factory.createModuleVisual('ControlSurface', 0);
assert.strictEqual(adapter.setControlDeflection(control, 0.5, Math.PI / 6), true);
const flap = adapter.findByName(control, 'controlFlapPivot');
assert(flap && flap.rotation.z < 0);

assert(adapter.setDamageTint(thruster, 0.2) > 0, 'Damage tint must work on the wrapped procedural visual.');

const sampleRegistry = Registry.create();
const sampleResult = sampleRegistry.registerManifest(studioSampleManifest, 'studio-sample', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' });
assert.strictEqual(sampleResult.ok, true);
assert.strictEqual(sampleRegistry.assetForBlockType('Thruster').assetId, 'test_anim_preview');
assert.strictEqual(sampleRegistry.assetForBlockType('Thruster').model.path, 'models/test_anim.gltf');

const realRegistry = Registry.create();
const realResult = realRegistry.registerManifest(realBlockbenchManifest, 'real-blockbench-fixture', { packBaseUrl: 'assets/visual_packs/real_blockbench_thruster_pack/' });
assert.strictEqual(realResult.ok, true);
assert.strictEqual(realRegistry.assetForBlockType('Thruster').assetId, 'real_blockbench_thruster_test_anim');
assert.strictEqual(realRegistry.assetForBlockType('Thruster').bindings.nodes.visualRoot, '/group');

console.log({ visualAssetRegistry: 'ok', registered: registry.size });
