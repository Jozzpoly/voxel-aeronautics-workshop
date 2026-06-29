const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { baseURI: 'http://127.0.0.1:8765/index.html', createElement: () => ({}) };
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
  'src/game/visual_asset_loader.js',
  'src/game/visual_runtime_adapter.js',
  'src/game/module_visual_factory.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const Registry = VAW.require('game.visual-asset-registry');
const Catalog = VAW.require('foundation.catalog');
const Loader = VAW.require('game.visual-asset-loader');
const RuntimeAdapter = VAW.require('game.visual-runtime-adapter');
const ModuleVisualFactory = VAW.require('game.module-visual-factory');
const studioSampleManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/visual_packs/test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));

function cloneObject(object) {
  const clone = object instanceof THREE.Mesh
    ? new THREE.Mesh(object.geometry, object.material?.clone?.() || object.material)
    : new THREE.Group();
  clone.name = object.name;
  clone.visible = object.visible;
  clone.userData = { ...object.userData };
  clone.position.copy(object.position);
  clone.quaternion.copy(object.quaternion);
  clone.scale.copy(object.scale);
  clone.clone = () => cloneObject(clone);
  for (const child of object.children || []) clone.add(cloneObject(child));
  return clone;
}

function group(name) {
  const item = new THREE.Group();
  item.name = name;
  item.clone = () => cloneObject(item);
  return item;
}

function makeImportedScene() {
  const scene = group('blockbench_export');
  const boneA = group('Bone');
  const boneB = group('Bone');
  const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0x000000, transparent: true, opacity: 1 }));
  flame.material.name = 'FlameMat';
  flame.name = 'flame';
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0x000000, transparent: true, opacity: 1 }));
  glow.material.name = 'GlowMat';
  glow.name = 'flameGlow';
  boneB.add(flame, glow);
  boneA.add(boneB);
  scene.add(boneA);
  return scene;
}

function makeDeepVisualRootScene() {
  const scene = group('blockbench_export');
  const root = group('Root');
  const pivot = group('Pivot');
  const nozzle = group('Nozzle');
  const other = group('Other');
  const wrongFlame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0x000000, transparent: true, opacity: 1 }));
  wrongFlame.name = 'flame';
  const boundFlame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0x000000, transparent: true, opacity: 1 }));
  boundFlame.name = 'flame';
  nozzle.add(wrongFlame);
  other.add(boundFlame);
  pivot.add(nozzle, other);
  root.add(pivot);
  scene.add(root);
  return scene;
}

function makeMaterialPolicyScene() {
  const scene = group('blockbench_export');
  const root = group('Root');
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xaa7755, emissive: 0x000000, transparent: false, opacity: 1 }));
  body.name = 'body';
  body.material.name = 'BodyMat';
  const nozzle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, transparent: true, opacity: 0.42 }));
  nozzle.name = 'nozzle';
  nozzle.material.name = 'NozzleMat';
  const nozzleTrim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, transparent: true, opacity: 0.5 }));
  nozzleTrim.name = 'nozzleTrim';
  nozzleTrim.material.name = 'NozzleMat';
  const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0x000000, transparent: true, opacity: 0.65 }));
  flame.name = 'flame';
  flame.material.name = 'FlameMat';
  root.add(body, nozzle, nozzleTrim, flame);
  scene.add(root);
  return scene;
}

function cloneMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
}

function createFactory(registry) {
  return ModuleVisualFactory.create({
    THREE,
    sharedGeometry: new THREE.BoxGeometry(1, 1, 1),
    cloneMaterial,
    visualAssetRegistry: registry
  });
}

function disposeTree(root) {
  root?.traverse?.(object => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
    for (const material of materials) material?.dispose?.();
  });
}

function importedRootOf(root) {
  return root.children.find(child => child.userData?.isImportedVisual) || null;
}

function firstMesh(root) {
  let found = null;
  root?.traverse?.(object => {
    if (!found && object instanceof THREE.Mesh) found = object;
  });
  return found;
}

function meshByMaterialName(root, materialName) {
  let found = null;
  root?.traverse?.(object => {
    const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
    if (!found && materials.some(material => material?.name === materialName)) found = object;
  });
  return found;
}

function assertNear(value, expected, epsilon = 1e-6) {
  assert(Math.abs(value - expected) <= epsilon, `expected ${value} to be near ${expected}`);
}

async function main() {
  const loadedUrls = [];
  const failedOnce = new Set();
  THREE.GLTFLoader = class {
    load(url, onLoad, _onProgress, onError) {
      loadedUrls.push(url);
      Promise.resolve().then(() => {
        if (String(url).includes('missing.gltf')) onError(new Error('missing test model'));
        else if (String(url).includes('flaky.gltf') && !failedOnce.has(url)) {
          failedOnce.add(url);
          onError(new Error('flaky test model'));
        }
        else if (String(url).includes('deep-root.gltf')) onLoad({ scene: makeDeepVisualRootScene(), animations: [] });
        else if (String(url).includes('material-policy.gltf')) onLoad({ scene: makeMaterialPolicyScene(), animations: [] });
        else onLoad({ scene: makeImportedScene(), animations: [] });
      });
    }
  };

  const registry = Registry.create();
  const loader = Loader.create({ THREE, visualAssetRegistry: registry, logger: { warn() {}, error() {} } });
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(JSON.stringify(studioSampleManifest))
  });

  const factory = createFactory(registry);
  const parent = new THREE.Group();
  const root = factory.createModuleVisual('Thruster', 0);
  parent.add(root);
  assert.strictEqual(root.userData.isVoxelRoot, true);
  assert.strictEqual(root.userData.visualAssetStatus, 'procedural-fallback');
  assert(root.children.some(child => child.name === 'vawHitProxy'), 'Stable hit proxy must exist before import.');

  assert.strictEqual(await loader.attachImportedVisual(root), false, 'Unregistered asset must keep procedural fallback.');
  const bootstrap = await loader.bootstrapDevPacks([{ source: 'studio-sample', manifestUrl: 'sample-pack.json', packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }]);
  assert.strictEqual(bootstrap.ok, true);
  assert.strictEqual(bootstrap.registered, 1);
  assert.strictEqual(root.userData.visualAssetStatus, 'imported-visual');
  assert.strictEqual(root.userData.visualAssetId, 'test_anim_preview');
  assert(loadedUrls.some(url => {
    const text = String(url);
    try { return new URL(text).pathname.endsWith('/models/test_anim.gltf'); }
    catch (_) { return text.split('?')[0].endsWith('/models/test_anim.gltf'); }
  }));

  const proxy = root.children.find(child => child.name === 'vawHitProxy');
  const imported = root.children.find(child => child.userData?.isImportedVisual);
  assert(proxy, 'Imported visual must not replace the hit proxy.');
  assert(imported, 'Imported visual must be added as a child of the stable root.');
  assert.strictEqual(imported.parent, root);
  assert.strictEqual(imported.children[0]?.name, 'Bone', 'visualRoot binding must mount the bound subtree, not the whole glTF scene.');
  assert.notStrictEqual(imported, root);
  assert.notStrictEqual(imported, proxy);
  assert.strictEqual(proxy.visible, true, 'Hit proxy must stay visible/raycastable in Three even when render-invisible.');
  assert.strictEqual(proxy.material.opacity, 0, 'Hit proxy should be render-invisible by default.');
  assert.strictEqual(proxy.material.colorWrite, false, 'Hit proxy should not write color by default.');
  assert.strictEqual(proxy.material.depthWrite, false, 'Hit proxy should not occlude imported visuals in the depth buffer.');
  assert.strictEqual(loader.setDebugVisualsVisible(true), true);
  assert(proxy.material.opacity > 0, 'Debug visual toggle should reveal the hit proxy.');
  assert.strictEqual(proxy.material.colorWrite, true);
  assert.strictEqual(loader.setDebugVisualsVisible(false), false);
  assert.strictEqual(proxy.material.opacity, 0);
  assert.strictEqual(proxy.material.colorWrite, false);

  const adapter = RuntimeAdapter.create();
  assert.strictEqual(adapter.setThrusterIntensity(root, 1, { active: true }), 2);
  const flame = adapter.findByName(root, 'flame');
  const glow = adapter.findByName(root, 'flameGlow');
  assert(flame && flame.visible, 'Imported flame binding must be controllable by alias path.');
  assert(glow && glow.visible, 'Imported flameGlow binding must be controllable by alias path.');
  assert.strictEqual(adapter.setGimbal(root, 0.5, -0.5, Math.PI / 8), false, 'Missing gimbal alias must no-op.');
  assert.strictEqual(adapter.setControlDeflection(root, 0.5, Math.PI / 6), false, 'Missing control flap alias must no-op.');
  assert(adapter.setDamageTint(root, 0.2) >= 0, 'Damage tint must never throw on imported visual materials.');

  const root2 = factory.createModuleVisual('Thruster', 0);
  parent.add(root2);
  assert.strictEqual(await loader.attachImportedVisual(root2), true);
  const imported2 = importedRootOf(root2);
  const mesh1 = firstMesh(imported);
  const mesh2 = firstMesh(imported2);
  assert(mesh1 && mesh2, 'Imported visuals should contain test meshes.');
  assert.notStrictEqual(mesh1.geometry, mesh2.geometry, 'Each imported instance must own a cloned geometry.');
  assert.notStrictEqual(mesh1.material, mesh2.material, 'Each imported instance must own a cloned material.');
  disposeTree(imported);
  assert.strictEqual(mesh1.geometry.disposed, true);
  assert.strictEqual(mesh1.material.disposed, true);
  assert.strictEqual(mesh2.geometry.disposed, false, 'Disposing one imported instance must not corrupt another instance using the same cached glTF.');
  assert.strictEqual(mesh2.material.disposed, false, 'Disposing one imported material must not dispose another imported instance material.');

  const missingManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  missingManifest.assets[0].assetId = 'test_anim_missing';
  missingManifest.assets[0].model.path = 'models/missing.gltf';
  const missingRegistry = Registry.create();
  assert.strictEqual(missingRegistry.registerManifest(missingManifest, 'missing-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const missingFactory = createFactory(missingRegistry);
  const missingLoader = Loader.create({ THREE, visualAssetRegistry: missingRegistry, logger: { warn() {}, error() {} } });
  const missingParent = new THREE.Group();
  const missingRoot = missingFactory.createModuleVisual('Thruster', 0);
  missingParent.add(missingRoot);
  assert.strictEqual(missingRoot.userData.visualAssetStatus, 'registered-fallback');
  assert.strictEqual(await missingLoader.attachImportedVisual(missingRoot), false);
  assert.strictEqual(missingRoot.userData.visualAssetStatus, 'import-failed-fallback');
  assert.strictEqual(missingRoot.userData.isVoxelRoot, true);
  assert(missingRoot.children.some(child => child.name === 'vawHitProxy'), 'Missing model must keep stable hit proxy.');
  assert(!missingRoot.children.some(child => child.userData?.isImportedVisual), 'Missing model must not attach a partial imported child.');

  const flakyManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  flakyManifest.assets[0].assetId = 'test_anim_flaky';
  flakyManifest.assets[0].model.path = 'models/flaky.gltf';
  const flakyRegistry = Registry.create();
  assert.strictEqual(flakyRegistry.registerManifest(flakyManifest, 'flaky-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const flakyFactory = createFactory(flakyRegistry);
  const flakyLoader = Loader.create({ THREE, visualAssetRegistry: flakyRegistry, logger: { warn() {}, error() {} } });
  const flakyParent = new THREE.Group();
  const flakyRoot = flakyFactory.createModuleVisual('Thruster', 0);
  flakyParent.add(flakyRoot);
  assert.strictEqual(await flakyLoader.attachImportedVisual(flakyRoot), false, 'First flaky load should fail into fallback.');
  assert.strictEqual(flakyRoot.userData.visualAssetStatus, 'import-failed-fallback');
  assert.strictEqual(await flakyLoader.attachImportedVisual(flakyRoot), true, 'Rejected glTF promise must be evicted so retry can succeed.');
  assert.strictEqual(flakyRoot.userData.visualAssetStatus, 'imported-visual');

  const visualRootFallbackManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  visualRootFallbackManifest.assets[0].assetId = 'test_anim_bad_visual_root';
  visualRootFallbackManifest.assets[0].bindings.nodes.visualRoot = '/MissingRoot';
  const badRootRegistry = Registry.create();
  assert.strictEqual(badRootRegistry.registerManifest(visualRootFallbackManifest, 'bad-root-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const badRootFactory = createFactory(badRootRegistry);
  const badRootLoader = Loader.create({ THREE, visualAssetRegistry: badRootRegistry, logger: { warn() {}, error() {} } });
  const badRootParent = new THREE.Group();
  const badRoot = badRootFactory.createModuleVisual('Thruster', 0);
  badRootParent.add(badRoot);
  assert.strictEqual(await badRootLoader.attachImportedVisual(badRoot), true);
  assert.strictEqual(importedRootOf(badRoot).children[0]?.name, 'blockbench_export', 'Missing visualRoot must fall back to full scene mount.');
  assert(badRootLoader.diagnostics().some(item => item.code === 'visualAssetLoader.visualRootNotFound'));

  const axisManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  axisManifest.assets[0].assetId = 'test_anim_axis_z_forward';
  axisManifest.assets[0].model.forwardAxis = '+Z';
  axisManifest.assets[0].model.upAxis = '+Y';
  const axisRegistry = Registry.create();
  assert.strictEqual(axisRegistry.registerManifest(axisManifest, 'axis-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const axisFactory = createFactory(axisRegistry);
  const axisLoader = Loader.create({ THREE, visualAssetRegistry: axisRegistry, logger: { warn() {}, error() {} } });
  const axisParent = new THREE.Group();
  const axisRoot = axisFactory.createModuleVisual('Thruster', 0);
  axisParent.add(axisRoot);
  assert.strictEqual(await axisLoader.attachImportedVisual(axisRoot), true);
  const transformedForward = new THREE.Vector3(0, 0, 1).applyQuaternion(importedRootOf(axisRoot).quaternion);
  assertNear(transformedForward.x, 1);
  assertNear(transformedForward.y, 0);
  assertNear(transformedForward.z, 0);

  const materialPolicyManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  materialPolicyManifest.assets[0].assetId = 'test_anim_material_policy';
  materialPolicyManifest.assets[0].model.path = 'models/material-policy.gltf';
  materialPolicyManifest.assets[0].bindings.nodes.visualRoot = '/Root';
  materialPolicyManifest.assets[0].bindings.nodes.flame = '/Root/flame';
  materialPolicyManifest.assets[0].materialPolicy = {
    pixelated: false,
    alpha: 'auto',
    doubleSided: 'from-gltf',
    materialOverrides: [
      { materialName: 'NozzleMat', alpha: 'opaque' },
      { materialName: 'FlameMat', alpha: 'blend' }
    ]
  };
  const materialPolicyRegistry = Registry.create();
  assert.strictEqual(materialPolicyRegistry.registerManifest(materialPolicyManifest, 'material-policy-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const materialPolicyFactory = createFactory(materialPolicyRegistry);
  const materialPolicyLoader = Loader.create({ THREE, visualAssetRegistry: materialPolicyRegistry, logger: { warn() {}, error() {} } });
  const materialPolicyParent = new THREE.Group();
  const materialPolicyRoot = materialPolicyFactory.createModuleVisual('Thruster', 0);
  materialPolicyParent.add(materialPolicyRoot);
  assert.strictEqual(await materialPolicyLoader.attachImportedVisual(materialPolicyRoot), true);
  const materialPolicyImported = importedRootOf(materialPolicyRoot);
  const bodyMesh = meshByMaterialName(materialPolicyImported, 'BodyMat');
  const nozzleMesh = meshByMaterialName(materialPolicyImported, 'NozzleMat');
  const flameMesh = meshByMaterialName(materialPolicyImported, 'FlameMat');
  assert(bodyMesh && nozzleMesh && flameMesh, 'Material policy test scene must include body, nozzle and flame materials.');
  assert.strictEqual(bodyMesh.material.transparent, false, 'Auto alpha must keep ordinary body material opaque.');
  assert.strictEqual(bodyMesh.material.depthWrite, true);
  assert.strictEqual(nozzleMesh.material.transparent, false, 'Opaque override must stop a nozzle from becoming camera-angle transparent.');
  assert.strictEqual(nozzleMesh.material.opacity, 1);
  assert.strictEqual(nozzleMesh.material.depthWrite, true);
  assert.strictEqual(flameMesh.material.transparent, true, 'Blend override must keep flame semi-transparent.');
  assert.strictEqual(flameMesh.material.alphaTest, 0.001, 'Blend should still discard fully transparent texture pixels.');
  assert.strictEqual(flameMesh.material.depthWrite, false);
  assert.strictEqual(flameMesh.material.depthTest, true);
  assert(materialPolicyLoader.diagnostics().some(item => item.code === 'visualAssetLoader.materialOverrideApplied'), 'Applied material overrides must be visible in runtime diagnostics.');
  assert(materialPolicyLoader.diagnostics().some(item => item.code === 'visualAssetLoader.materialNameAmbiguous'), 'Duplicate material names targeted by overrides must produce a runtime diagnostic.');

  const deepManifest = JSON.parse(JSON.stringify(studioSampleManifest));
  deepManifest.assets[0].assetId = 'test_anim_deep_visual_root';
  deepManifest.assets[0].model.path = 'models/deep-root.gltf';
  deepManifest.assets[0].bindings.nodes.visualRoot = '/Root/Pivot';
  deepManifest.assets[0].bindings.nodes.flame = '/Root/Pivot/Other/flame';
  deepManifest.assets[0].bindings.nodes.flameGlow = null;
  const deepRegistry = Registry.create();
  assert.strictEqual(deepRegistry.registerManifest(deepManifest, 'deep-root-pack', { packBaseUrl: 'assets/visual_packs/test_anim_preview_visual_pack/' }).ok, true);
  const deepFactory = createFactory(deepRegistry);
  const deepLoader = Loader.create({ THREE, visualAssetRegistry: deepRegistry, logger: { warn() {}, error() {} } });
  const deepParent = new THREE.Group();
  const deepRoot = deepFactory.createModuleVisual('Thruster', 0);
  deepParent.add(deepRoot);
  assert.strictEqual(await deepLoader.attachImportedVisual(deepRoot), true);
  const deepImported = importedRootOf(deepRoot);
  assert.strictEqual(deepImported.children[0]?.name, 'Pivot', 'Deep visualRoot must mount the requested subtree.');
  const nozzleFlame = deepImported.children[0].children[0].children[0];
  const boundFlame = deepImported.children[0].children[1].children[0];
  assert.strictEqual(nozzleFlame.userData.visualAssetOriginalPath, '/Root/Pivot/Nozzle/flame');
  assert.strictEqual(boundFlame.userData.visualAssetOriginalPath, '/Root/Pivot/Other/flame');
  assert.strictEqual(adapter.setThrusterIntensity(deepRoot, 1, { active: true }), 1);
  assert.strictEqual(nozzleFlame.scale.x, 1, 'Alias lookup must not fall back to the first duplicate node name.');
  assert(boundFlame.scale.x > 1, 'Alias lookup must honor the original full glTF path after subtree mounting.');

  const indexRegistry = Registry.create();
  const indexLoader = Loader.create({ THREE, visualAssetRegistry: indexRegistry, logger: { warn() {}, error() {} } });
  global.fetch = async url => {
    if (String(url).endsWith('/installed_visual_packs.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          format: 'VAW_VISUAL_PACK_INDEX_V1',
          version: '0.1.0',
          packs: [{ source: 'index-sample', manifestUrl: 'test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json' }]
        })
      };
    }
    if (String(url).endsWith('/test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json')) {
      return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(studioSampleManifest)) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const indexResult = await indexLoader.bootstrapInstalledPacks('assets/visual_packs/installed_visual_packs.json');
  assert.strictEqual(indexResult.ok, true);
  assert.strictEqual(indexResult.registered, 1);
  assert.strictEqual(indexRegistry.assetForBlockType('Thruster').assetId, 'test_anim_preview');

  const invalidIndexRegistry = Registry.create();
  const invalidIndexLoader = Loader.create({ THREE, visualAssetRegistry: invalidIndexRegistry, logger: { warn() {}, error() {} } });
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ format: 'wrong', packs: [{ manifestUrl: 'ignored.json' }] }) });
  const invalidIndex = await invalidIndexLoader.bootstrapInstalledPacks('assets/visual_packs/installed_visual_packs.json');
  assert.strictEqual(invalidIndex.ok, true, 'Invalid index is non-fatal and simply registers no packs.');
  assert.strictEqual(invalidIndex.registered, 0);
  assert.strictEqual(invalidIndexRegistry.assetForBlockType('Thruster'), null);
  assert(invalidIndexLoader.diagnostics().some(item => item.code === 'visualAssetLoader.packIndexFormatInvalid'));

  const missingIndexLoader = Loader.create({ THREE, visualAssetRegistry: Registry.create(), logger: { warn() {}, error() {} } });
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const missingIndex = await missingIndexLoader.bootstrapInstalledPacks('assets/visual_packs/missing_index.json');
  assert.strictEqual(missingIndex.ok, false);
  assert.strictEqual(missingIndex.registered, 0);
  assert(missingIndexLoader.diagnostics().some(item => item.code === 'visualAssetLoader.packIndexLoadFailed'));

  let workingRevision = 1;
  function workingManifest() {
    const manifest = JSON.parse(JSON.stringify(studioSampleManifest));
    manifest.packId = 'local_working_visuals';
    manifest.version = `0.1.0-local.${workingRevision}`;
    manifest.metadata = { status: 'local-working-pack', authority: 'visual-only', revision: workingRevision };
    manifest.assets[0].assetId = 'local_thruster_visual';
    manifest.assets[0].model.path = 'models/blocks/thruster/model.gltf';
    manifest.assets[0].model.transform = {
      position: { x: 0.25 * workingRevision, y: 0.5, z: -0.25 },
      rotationDegrees: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 2, z: 1 }
    };
    manifest.assets[0].materialPolicy = { pixelated: true, alpha: 'blend', doubleSided: 'force' };
    return manifest;
  }
  const reloadRegistry = Registry.create();
  const reloadLoader = Loader.create({ THREE, visualAssetRegistry: reloadRegistry, disposeObjectTree: disposeTree, logger: { warn() {}, error() {} } });
  const reloadFactory = createFactory(reloadRegistry);
  const reloadParent = new THREE.Group();
  const reloadRoot = reloadFactory.createModuleVisual('Thruster', 0);
  reloadParent.add(reloadRoot);
  assert.strictEqual(await reloadLoader.attachImportedVisual(reloadRoot), false);
  global.fetch = async url => {
    if (String(url).includes('installed_visual_packs.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          format: 'VAW_VISUAL_PACK_INDEX_V1',
          version: '0.1.0',
          packs: [{ source: 'local:local_working_visuals', manifestUrl: 'local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json', revision: workingRevision }]
        })
      };
    }
    if (String(url).includes('local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json')) {
      return { ok: true, status: 200, json: async () => workingManifest() };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const firstReloadBootstrap = await reloadLoader.bootstrapInstalledPacks('assets/visual_packs/installed_visual_packs.json');
  assert.strictEqual(firstReloadBootstrap.registered, 1);
  assert.strictEqual(reloadRoot.userData.visualAssetStatus, 'imported-visual');
  let reloadImported = importedRootOf(reloadRoot);
  const oldReloadMesh = firstMesh(reloadImported);
  assertNear(reloadImported.position.x, 0.25);
  assertNear(reloadImported.scale.y, 2);
  assert.strictEqual(oldReloadMesh.material.transparent, true);
  assert.strictEqual(oldReloadMesh.material.alphaTest, 0.001);
  assert.strictEqual(oldReloadMesh.material.depthWrite, false);
  assert(loadedUrls.some(url => String(url).includes('vaw_visual_rev=1')), 'Working pack model load should include revision cache-bust.');

  workingRevision = 2;
  const reloadResult = await reloadLoader.reloadInstalledPacks('assets/visual_packs/installed_visual_packs.json');
  assert.strictEqual(reloadResult.registered, 1);
  assert.strictEqual(oldReloadMesh.geometry.disposed, true, 'Reload must dispose the previous imported visual geometry.');
  assert.strictEqual(oldReloadMesh.material.disposed, true, 'Reload must dispose the previous imported visual material.');
  reloadImported = importedRootOf(reloadRoot);
  assert(reloadImported, 'Reload must reattach imported visual to the same stable root.');
  assertNear(reloadImported.position.x, 0.5);
  assert(reloadRoot.children.some(child => child.name === 'vawHitProxy'), 'Reload must keep stable hit proxy.');
  assert(loadedUrls.some(url => String(url).includes('vaw_visual_rev=2')), 'Reload must bust model cache after revision changes.');

  global.fetch = async url => {
    if (String(url).includes('installed_visual_packs.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          format: 'VAW_VISUAL_PACK_INDEX_V1',
          version: '0.1.0',
          packs: [{ source: 'local:local_working_visuals', manifestUrl: 'local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json', revision: 3 }]
        })
      };
    }
    if (String(url).includes('local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          format: 'VAW_VISUAL_ASSET_PACK_V1',
          packId: 'local_working_visuals',
          version: '0.1.0-local.3',
          metadata: { status: 'local-working-pack', authority: 'visual-only', revision: 3 },
          assets: []
        })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const emptyReload = await reloadLoader.reloadInstalledPacks('assets/visual_packs/installed_visual_packs.json');
  assert.strictEqual(emptyReload.registered, 0);
  assert.strictEqual(reloadRoot.userData.visualAssetStatus, 'procedural-fallback', 'Reload with no asset must restore procedural fallback status.');
  assert(!importedRootOf(reloadRoot), 'Reload with no asset must remove old imported child.');

  const blockTypes = Object.keys(Catalog.BLOCKS);
  const fullManifest = {
    format: 'VAW_VISUAL_ASSET_PACK_V1',
    packId: 'catalog_visual_replacement_test',
    version: '0.1.0',
    assets: blockTypes.map(blockType => ({
      assetId: `visual_${blockType}`,
      kind: 'blockVisual',
      model: { path: `models/${blockType}.gltf`, unitMeters: 1, forwardAxis: '+X', upAxis: '+Y' },
      bindings: {
        blockTypes: [blockType],
        nodes: { visualRoot: '/Root', flame: null, flameGlow: null, gimbalAssembly: null, controlFlapPivot: null },
        clips: { idle: null, thrust: null, damage: null }
      },
      materialPolicy: {}
    }))
  };
  const fullRegistry = Registry.create();
  assert.strictEqual(fullRegistry.registerManifest(fullManifest, 'full-replacement-test', { packBaseUrl: 'assets/full_pack/' }).ok, true);
  const fullLoader = Loader.create({ THREE, visualAssetRegistry: fullRegistry, logger: { warn() {}, error() {} } });
  const fullFactory = createFactory(fullRegistry);
  const fullParent = new THREE.Group();
  const fullRoots = blockTypes.map(blockType => {
    const visual = fullFactory.createModuleVisual(blockType, 0);
    fullParent.add(visual);
    assert.strictEqual(visual.userData.isVoxelRoot, true, `${blockType} must keep a stable root.`);
    assert(visual.children.some(child => child.name === 'vawHitProxy'), `${blockType} must keep a hit proxy.`);
    return visual;
  });
  assert(fullRegistry.coverage().every(item => item.status === 'registered-fallback'), 'All Catalog block types must be replaceable through the registry.');
  const fullAttached = await Promise.all(fullRoots.map(visual => fullLoader.attachImportedVisual(visual)));
  assert(fullAttached.every(Boolean), 'All Catalog block types should accept imported renderer children when a valid pack binds them.');
  for (const visual of fullRoots) {
    assert.strictEqual(visual.userData.visualAssetStatus, 'imported-visual');
    assert(visual.children.some(child => child.name === 'vawHitProxy'), 'Imported visual must not replace the hit proxy.');
    assert(visual.children.some(child => child.userData?.isImportedVisual), 'Imported visual must be attached as a child.');
  }

  console.log({ visualAssetLoader: 'ok', imported: root.userData.visualAssetId, missingFallback: missingRoot.userData.visualAssetStatus });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
