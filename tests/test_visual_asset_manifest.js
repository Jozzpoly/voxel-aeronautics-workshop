const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/visual_asset_manifest.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const VisualAssetManifest = VAW.require('foundation.visual-asset-manifest');
const studioSampleManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/visual_packs/test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));
const realBlockbenchManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/visual_packs/real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));

function validManifest(overrides = {}) {
  return {
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
      materialPolicy: { pixelated: true, alpha: 'mask-or-blend', doubleSided: 'from-gltf' },
      ...overrides.asset
    }],
    ...overrides.manifest
  };
}

{
  const result = VisualAssetManifest.validateManifest(validManifest());
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].bindings.blockTypes[0], 'Thruster');
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.blockTypes = ['VectorThruster'];
  manifest.assets[0].bindings.nodes.gimbalAssembly = '/NozzlePivot';
  manifest.assets[0].bindings.rig = {
    vectorThruster: {
      channels: [
        { input: 'gimbalA', node: 'gimbalAssembly', axis: 'z', direction: -1 },
        { input: 'gimbalB', node: 'gimbalAssembly', axis: 'y', direction: 1 },
        { input: 'roll', node: 'gimbalAssembly', axis: 'x', direction: 1 }
      ]
    }
  };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.deepStrictEqual(result.assets[0].bindings.rig.vectorThruster.channels[0], {
    input: 'gimbalA',
    node: 'gimbalAssembly',
    axis: 'z',
    direction: -1
  });
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.blockTypes = ['VectorThruster'];
  manifest.assets[0].bindings.rig = { vectorThruster: { channels: [{ input: 'pitch', node: 'gimbalAssembly', axis: 'yaw', direction: 0 }] } };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.rigInputInvalid'));
  assert(result.errors.some(item => item.code === 'visualAsset.rigAxisInvalid'));
  assert(result.errors.some(item => item.code === 'visualAsset.rigDirectionInvalid'));
  assert(result.errors.some(item => item.code === 'visualAsset.rigNodeBindingMissing'));
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.rig = { gameplayGimbal: { channels: [] } };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.unknownRigProfile'));
}

{
  const manifest = validManifest();
  manifest.assets[0].model.transform = {
    position: { x: 0.25, y: -0.5, z: 1 },
    rotationDegrees: { x: 0, y: 90, z: 180 },
    scale: { x: 1, y: 2, z: 1 }
  };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.deepStrictEqual(result.assets[0].model.transform.position, { x: 0.25, y: -0.5, z: 1 });
  assert.deepStrictEqual(result.assets[0].model.transform.rotationDegrees, { x: 0, y: 90, z: 180 });
  assert.deepStrictEqual(result.assets[0].model.transform.scale, { x: 1, y: 2, z: 1 });
}

{
  const manifest = validManifest();
  manifest.assets[0].materialPolicy = {
    pixelated: true,
    alpha: 'auto',
    doubleSided: 'from-gltf',
    materialOverrides: [
      { materialName: 'BodyMat', alpha: 'opaque' },
      { materialName: 'FlameMat', alpha: 'blend', doubleSided: 'force' }
    ]
  };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.assets[0].materialPolicy.alpha, 'auto');
  assert.strictEqual(result.assets[0].materialPolicy.materialOverrides[0].materialName, 'BodyMat');
}

{
  const manifest = validManifest();
  manifest.assets[0].materialPolicy = {
    alpha: 'transparent-magic',
    materialOverrides: [{ materialName: 'FlameMat', alpha: 'ghost' }]
  };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.alphaPolicyInvalid'));
}

{
  const manifest = validManifest();
  manifest.assets[0].model.transform = { position: { x: 'bad', y: 0, z: 0 } };
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.transformVectorInvalid'));
}

{
  const result = VisualAssetManifest.validateManifest(studioSampleManifest);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.assets.length, 1);
  assert.strictEqual(result.assets[0].assetId, 'test_anim_preview');
  assert.strictEqual(result.assets[0].model.path, 'models/test_anim.gltf');
  assert.deepStrictEqual(result.assets[0].bindings.blockTypes, ['Thruster']);
}

{
  const result = VisualAssetManifest.validateManifest(realBlockbenchManifest);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.assets[0].assetId, 'real_blockbench_thruster_test_anim');
  assert.strictEqual(result.assets[0].model.path, 'models/test_anim.gltf');
  assert.strictEqual(result.assets[0].bindings.nodes.visualRoot, '/group');
  assert.deepStrictEqual(result.assets[0].bindings.blockTypes, ['Thruster']);
}

{
  const result = VisualAssetManifest.validateManifest(validManifest({ asset: { mass: 20 } }));
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.gameplayFieldForbidden' && item.path === 'assets[0].mass'));
  assert.strictEqual(result.assets.length, 0);
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.blockTypes = ['NotABlock'];
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.unknownBlockType'));
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.nodes.visualRoot = null;
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.visualRootMissing'));
}

{
  const manifest = validManifest();
  manifest.assets[0].bindings.nodes.badAlias = 'Bad';
  manifest.assets[0].bindings.clips.badClip = 'BadClip';
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false);
  assert(result.errors.some(item => item.code === 'visualAsset.unknownNodeAlias'));
  assert(result.errors.some(item => item.code === 'visualAsset.unknownClipAlias'));
}

for (const badPath of ['http://example.invalid/model.gltf', 'data:model/gltf;base64,AAAA', '../model.gltf', '/models/model.gltf', 'C:/tmp/model.gltf', 'models\\model.gltf', './models/model.gltf', 'models/model.gltf?cache=1', 'models/model.gltf#node']) {
  const manifest = validManifest();
  manifest.assets[0].model.path = badPath;
  const result = VisualAssetManifest.validateManifest(manifest);
  assert.strictEqual(result.ok, false, `Unsafe model.path must fail: ${badPath}`);
  assert(result.errors.some(item => item.code === 'visualAsset.modelPathInvalid'));
}

const source = fs.readFileSync(path.join(ROOT, 'src/foundation/visual_asset_manifest.js'), 'utf8');
for (const forbidden of ['THREE.', 'CANNON.', 'document.', 'fetch(', 'localStorage']) {
  assert(!source.includes(forbidden), `Visual asset manifest validator must stay pure: ${forbidden}`);
}

console.log({ visualAssetManifest: 'ok' });
