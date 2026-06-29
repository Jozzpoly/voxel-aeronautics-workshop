const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const STUDIO_ROOT = path.join(ROOT, 'tools/blockbench_import_studio');

for (const relative of [
  'package.json',
  'index.html',
  'app/main.js',
  'src/visual_asset_pack_v1.js',
  'src/gltf_material_tools.js',
  'src/package_exporter.js',
  'tests/test_recovery_static.js',
  'schemas/visual_asset_pack_v1.schema.json',
  'assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json'
]) {
  assert(fs.existsSync(path.join(STUDIO_ROOT, relative)), `Missing Studio integration file: ${relative}`);
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.strictEqual(rootPackage.scripts['studio:test'], 'node tools/run_with_python_env.js npm --prefix tools/blockbench_import_studio test');
assert.strictEqual(rootPackage.scripts['studio:serve'], 'node tools/run_with_python_env.js python tools/serve.py --studio');

const studioPackage = JSON.parse(fs.readFileSync(path.join(STUDIO_ROOT, 'package.json'), 'utf8'));
assert(studioPackage.scripts.test.includes('test:static'));
assert(studioPackage.scripts['test:static'].includes('node ../run_with_python_env.js python tools/validate_recovery_package.py'));
assert(studioPackage.scripts.serve.includes('../serve.py --studio'));
const studioIndex = fs.readFileSync(path.join(STUDIO_ROOT, 'index.html'), 'utf8');
const studioApp = fs.readFileSync(path.join(STUDIO_ROOT, 'app/main.js'), 'utf8');
assert(studioIndex.includes('vaw-block-type'), 'Studio must expose explicit block type selection for inferred V1 manifests.');
assert(studioIndex.includes('vaw-node-visual-root'), 'Studio must expose visualRoot for explicit authoring review.');
assert(studioIndex.includes('vaw-node-visual-root-picker'), 'Studio must expose a full-path visualRoot picker.');
assert(studioIndex.includes('vaw-transform-pos-x'), 'Studio must expose renderer-only transform controls.');
assert(studioIndex.includes('vaw-material-alpha'), 'Studio must expose material alpha policy controls.');
assert(studioIndex.includes('value="auto"'), 'Studio must expose auto alpha policy as the safe default.');
assert(studioIndex.includes('vaw-material-overrides'), 'Studio must expose per-material alpha override controls.');
assert(studioIndex.includes('vaw-material-override-list'), 'Studio must expose a clickable per-material override list.');
assert(studioIndex.includes('vaw-fire-split-enabled'), 'Studio must expose fire/glow material split for mixed opaque/transparent Blockbench models.');
assert(studioIndex.includes('vaw-material-clear-overrides'), 'Studio must expose a one-click way to clear hidden material overrides.');
assert(studioIndex.includes('diagnostic-drawer'), 'Studio diagnostics should be grouped away from the primary install workflow.');
assert(studioIndex.includes('advanced-actions'), 'Studio export/debug actions should stay grouped as advanced workflow.');
assert(studioIndex.includes('vaw-install-endpoint'), 'Studio must expose the local install endpoint for diagnostics.');
assert(studioIndex.includes('data-vaw-rotate-axis'), 'Studio must expose quick transform rotation controls.');
assert(studioIndex.includes('install-block-visual'), 'Studio must expose local Install / Update workflow.');
assert(/vaw-install-probe[\s\S]{0,260}install-block-visual/.test(studioIndex), 'Install / Update must stay near endpoint controls, not buried in export actions.');
assert(studioApp.includes('selectedBlockTypes'), 'Studio inferred manifests must use explicit block type selection.');
assert(studioApp.includes('/__vaw/install_visual_block'), 'Studio install workflow must target the local VAW dev endpoint.');
assert(studioApp.includes('resolveInstallEndpoint'), 'Studio install workflow must probe the available VAW dev endpoint.');
assert(studioApp.includes('INSTALL_ENDPOINT_CANDIDATE_PORTS'), 'Studio must try known local VAW dev server ports.');
assert(studioApp.includes('local_working_visuals'), 'Studio install workflow must update the single local working pack.');
assert(studioApp.includes('BroadcastChannel'), 'Studio install workflow must request in-game visual reload through a same-origin channel.');
assert(studioApp.includes('materialOverrides'), 'Studio must persist per-material alpha overrides into Visual Asset Pack V1 manifests.');
assert(studioApp.includes('data-vaw-material-override'), 'Studio must render per-material alpha override selectors.');
assert(studioApp.includes('setMaterialOverride'), 'Studio material selectors must update the manifest form state.');
assert(studioApp.includes('currentAuthoringPrefsSnapshot'), 'Studio must persist a complete per-block authoring snapshot, not only transform/material defaults.');
assert(studioApp.includes('saveAuthoringPrefsForBlock'), 'Studio must save authoring settings under the selected block type.');
assert(studioApp.includes('handleBlockTypeChange'), 'Studio block type changes must restore per-block rig settings instead of behaving like ordinary text input.');
assert(studioApp.includes('fireSplit: currentFireSplitFields()'), 'Studio per-block preferences must remember fire/glow split rig settings.');
assert(studioApp.includes('buildInstallGltfPatch'), 'Studio install workflow must patch renderer-facing glTF material splits before local install.');
assert(studioApp.includes('splitNodeMaterialsForBlend'), 'Studio must split fire/glow primitives onto a blend material instead of using global blend.');

const runtimeSources = [
  'index.html',
  'src/game.js',
  ...fs.readdirSync(path.join(ROOT, 'src/game')).map(name => `src/game/${name}`),
  ...fs.readdirSync(path.join(ROOT, 'src/foundation')).map(name => `src/foundation/${name}`)
];
for (const relative of runtimeSources) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  assert(!source.includes('tools/blockbench_import_studio'), `${relative} must not import Studio tool code at runtime.`);
  assert(!source.includes('vaw_blockbench_import_studio_workbench_shell'), `${relative} must not depend on the ZIP package folder name.`);
}

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
const studioSampleManifest = JSON.parse(fs.readFileSync(path.join(STUDIO_ROOT, 'assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json'), 'utf8'));
const result = VisualAssetManifest.validateManifest(studioSampleManifest);
assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
assert.strictEqual(result.assets[0].model.path, 'models/test_anim.gltf');

console.log({ blockbenchImportStudioIntegration: 'ok', studioVersion: studioPackage.version });
