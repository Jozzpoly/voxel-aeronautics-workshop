'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Resolver = require('../src/file_bundle_resolver.js');
const ProjectFilesReport = require('../src/project_files_report.js');
const AnimationReport = require('../src/animation_report.js');
const LayoutManager = require('../src/layout_manager.js');
const TextureReport = require('../src/texture_report.js');
const MaterialTools = require('../src/gltf_material_tools.js');
const Controls = require('../src/viewport_controls.js');
const Validator = require('../src/vaw_validator.js');
const VisualAssetPack = require('../src/visual_asset_pack_v1.js');
const AuthoringState = require('../src/authoring_state.js');
const PackageExporter = require('../src/package_exporter.js');

const root = path.resolve(__dirname, '..');
function readText(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function readJson(file) { return JSON.parse(readText(file)); }
function exists(file) { return fs.existsSync(path.join(root, file)); }

class FakeFile {
  constructor(name, relPath, text = '') { this.name = name; this.__vawRelativePath = relPath; this.size = Buffer.byteLength(text); this.type = ''; this._text = text; }
  async text() { return this._text; }
  async arrayBuffer() { const b = Buffer.from(this._text); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
}

async function main() {
  for (const required of [
    'index.html', 'minimal_viewer.html', 'app/main.js', 'app/styles.css',
    'src/file_bundle_resolver.js', 'src/project_files_report.js', 'src/animation_report.js', 'src/layout_manager.js', 'src/minimal_gltf_viewer.js', 'src/viewport_controls.js', 'src/fit_camera.js',
    'src/texture_report.js', 'src/gltf_material_tools.js', 'src/vaw_validator.js', 'src/visual_asset_pack_v1.js', 'src/authoring_state.js', 'src/package_exporter.js',
    'tests/test_authoring_state.js', 'tests/test_authoring_state_flow.js',
    'vendor/three.min.js', 'vendor/GLTFLoader.js',
    'assets/uv_checker_cube_gltf/uv_checker_cube.gltf', 'assets/uv_checker_cube_gltf/uv_checker_cube.bin', 'assets/uv_checker_cube_gltf/textures/uv_checker.png',
    'docs/RECOVERY_AUDIT.md', 'docs/ROOT_CAUSE_ANALYSIS.md', 'docs/IMPLEMENTATION_REPORT.md', 'docs/USER_TESTING_GUIDE.md',
    'docs/WORKBENCH_CRITICAL_ANALYSIS.md', 'docs/WORKBENCH_HARDENING_PLAN.md', 'docs/WORKBENCH_HARDENING_IMPLEMENTATION_REPORT.md',
    'docs/VISUAL_ASSET_PACK_V1.md', 'schemas/visual_asset_pack_v1.schema.json',
    'assets/sample_visual_asset_pack_v1/models/test_anim.gltf', 'assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json',
    'assets/real_blockbench_regression/test_anim.gltf', 'assets/real_blockbench_regression/test.gltf', 'assets/real_blockbench_regression/model_bone_as_amature.gltf',
    'assets/real_blockbench_thruster_pack/models/test_anim.gltf', 'assets/real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json',
  ]) assert.ok(exists(required), `missing ${required}`);

  assert.equal(Resolver.normalizePath('./textures\\foo%20bar.png'), 'textures/foo bar.png');
  assert.equal(Resolver.joinPath('models/body', '../textures/t.png'), 'models/textures/t.png');
  assert.equal(Resolver.dirname('a/b/model.gltf'), 'a/b');
  assert.equal(Resolver.basename('a/b/model.gltf?cache=1'), 'model.gltf');

  const gltf = readJson('assets/uv_checker_cube_gltf/uv_checker_cube.gltf');
  const animatedGltf = readJson('assets/sample_blockbench_gltf/vector_thruster_gltf.gltf');
  const embeddedGltf = readJson('assets/regression_embedded_blockbench_like/test_model_alfa_anim_BaA.gltf');
  const realBlockbenchGltf = readJson('assets/real_blockbench_regression/test_anim.gltf');
  const realBlockbenchStaticGltf = readJson('assets/real_blockbench_regression/test.gltf');
  const realBlockbenchArmatureGltf = readJson('assets/real_blockbench_regression/model_bone_as_amature.gltf');
  const bundle = Resolver.createBundle([
    new FakeFile('model.gltf', 'project/model.gltf', JSON.stringify(gltf)),
    new FakeFile('uv_checker_cube.bin', 'project/uv_checker_cube.bin', 'bin'),
    new FakeFile('uv_checker.png', 'project/textures/uv_checker.png', 'texture'),
    new FakeFile('unused.png', 'project/textures/unused.png', 'unused'),
    new FakeFile('asset.vaw.json', 'project/asset.vaw.json', '{"schemaVersion":1}'),
  ]);
  assert.equal(bundle.mainModel.normalizedPath, 'project/model.gltf');
  assert.equal(bundle.resolveRecord('uv_checker_cube.bin', 'project').status, 'found');
  assert.equal(bundle.resolveRecord('textures/uv_checker.png', 'project').status, 'found');
  assert.equal(bundle.resolveRecord('textures/foo.png', 'project').status, 'missing');
  assert.equal(bundle.resolveRecord('data:application/octet-stream;base64,AAAA', 'project').status, 'embedded');
  assert.equal(bundle.resolveRecord('blob:http://localhost:8000/uuid/textures/uv_checker.png', 'project').status, 'found');
  const ambiguous = Resolver.createBundle([
    new FakeFile('texture.png', 'a/texture.png'),
    new FakeFile('texture.png', 'b/texture.png'),
  ]);
  assert.equal(ambiguous.resolveRecord('texture.png', 'project').status, 'ambiguous');

  const dependencies = bundle.dependencyReport(gltf, 'project');
  const textureReport = TextureReport.analyzeTextures({ gltfJson: gltf, bundle, basePath: 'project' });
  assert.equal(textureReport.summary.imageCount, 1);
  assert.equal(textureReport.summary.materialCount > 0, true);
  assert.ok(Array.isArray(textureReport.diagnostics));
  assert.ok(textureReport.materials.some(material => material.slots.some(slot => slot.slot === 'baseColorTexture')));
  const missingTextureReport = TextureReport.analyzeTextures({ gltfJson: gltf, bundle: Resolver.createBundle([new FakeFile('model.gltf', 'project/model.gltf', JSON.stringify(gltf))]), basePath: 'project' });
  assert.ok(missingTextureReport.diagnostics.some(item => item.code.startsWith('texture.image.')));

  const sharedAlphaGltf = {
    asset: { version: '2.0' },
    materials: [{ alphaMode: 'MASK', alphaCutoff: 0.05, doubleSided: true }],
    meshes: [
      { primitives: [{ material: 0 }] },
      { primitives: [{ material: 0 }] },
    ],
    nodes: [
      { name: 'Root', children: [1, 2] },
      { name: 'body', mesh: 0 },
      { name: 'thuster_fire', mesh: 1 },
    ],
  };
  const sharedWarnings = MaterialTools.sharedAlphaMaterialWarnings(sharedAlphaGltf);
  assert.equal(sharedWarnings.length, 1, 'shared fire/body material should be diagnosed before install');
  const split = MaterialTools.splitNodeMaterialsForBlend(sharedAlphaGltf, ['/Root/thuster_fire']);
  assert.equal(split.changed, true);
  assert.equal(split.patchedPrimitiveCount, 1);
  assert.deepEqual(split.newMaterialNames, ['material_0__fire_blend']);
  assert.equal(split.gltfJson.materials[0].name, 'material_0', 'unnamed source material should be normalized for runtime overrides');
  assert.equal(split.gltfJson.materials[1].alphaMode, 'BLEND');
  assert.equal(split.gltfJson.meshes[0].primitives[0].material, 0, 'body primitive must keep original material');
  assert.equal(split.gltfJson.meshes[1].primitives[0].material, 1, 'fire primitive must use split blend material');

  const projectReport = ProjectFilesReport.buildProjectFilesReport({
    bundle,
    dependencies,
    textureReport,
    sidecarParseReport: { recognizedPaths: ['project/asset.vaw.json'], invalidPaths: [] },
  });
  assert.equal(projectReport.summary.totalLoadedFiles, 5);
  assert.ok(projectReport.files.some(file => file.relativePath === 'project/model.gltf' && file.status === 'main model'));
  assert.ok(projectReport.files.some(file => file.relativePath === 'project/uv_checker_cube.bin' && file.status === 'dependency used'));
  assert.ok(projectReport.files.some(file => file.relativePath === 'project/textures/uv_checker.png' && file.textureUsedByMaterial));
  assert.ok(projectReport.files.some(file => file.relativePath === 'project/textures/unused.png' && file.status === 'unused'));
  assert.ok(projectReport.files.some(file => file.relativePath === 'project/asset.vaw.json' && file.category === 'sidecar' && file.sidecarRecognized));
  const missingDepReport = ProjectFilesReport.buildProjectFilesReport({ bundle, dependencies: [{ kind: 'image', index: 2, uri: 'textures/missing.png', status: 'missing', candidates: [] }], textureReport: null });
  assert.ok(missingDepReport.files.some(file => file.virtual && file.status === 'missing'));
  const ambiguousDepReport = ProjectFilesReport.buildProjectFilesReport({ bundle, dependencies: [{ kind: 'image', index: 1, uri: 'texture.png', status: 'ambiguous', candidates: ['a/texture.png', 'b/texture.png'] }], textureReport: null });
  assert.ok(ambiguousDepReport.files.some(file => file.virtual && file.status === 'ambiguous'));

  const embeddedBundle = Resolver.createBundle([new FakeFile('test_model_alfa_anim_BaA.gltf', 'embedded/test_model_alfa_anim_BaA.gltf', JSON.stringify(embeddedGltf))]);
  const embeddedDependencies = embeddedBundle.dependencyReport(embeddedGltf, 'embedded');
  assert.ok(embeddedDependencies.some(dep => dep.kind === 'buffer' && dep.status === 'embedded' && dep.displayUri.length < 120));
  assert.ok(embeddedDependencies.some(dep => dep.kind === 'image' && dep.status === 'embedded' && /^data:image\/png/.test(dep.displayUri) && dep.displayUri.length < 120));
  const embeddedTextureReport = TextureReport.analyzeTextures({ gltfJson: embeddedGltf, bundle: embeddedBundle, basePath: 'embedded' });
  const embeddedProjectReport = ProjectFilesReport.buildProjectFilesReport({ bundle: embeddedBundle, dependencies: embeddedDependencies, textureReport: embeddedTextureReport, sidecarParseReport: {} });
  assert.equal(embeddedProjectReport.summary.physicalTextures, 0);
  assert.equal(embeddedProjectReport.summary.embeddedTextures, 1);
  assert.equal(embeddedProjectReport.summary.textures, 1);
  const embeddedTextureRow = embeddedProjectReport.files.find(file => file.virtual && file.category === 'texture' && file.status === 'embedded');
  assert.ok(embeddedTextureRow, 'embedded texture should be represented as a virtual project file row');
  assert.ok(embeddedTextureRow.relativePath.length < 140, 'embedded texture row must not spam base64 in UI-facing path');
  assert.equal(embeddedTextureRow.textureUsedByMaterial, true);

  const animationReport = AnimationReport.analyzeAnimations({ gltfJson: animatedGltf, runtimeClips: [{ name: 'activate', duration: 1.2, tracks: [{}, {}] }] });
  assert.equal(animationReport.summary.clipCount, 1);
  assert.ok(animationReport.clips[0].animatedProperties.length >= 1);

  assert.equal(Controls.classifyPointerButton(1, false), 'rotate');
  assert.equal(Controls.classifyPointerButton(1, true), 'pan');
  assert.equal(Controls.classifyPointerButton(0, false), 'ignore');
  assert.equal(Controls.classifyPointerButton(2, false), 'ignore');

  const noSidecar = Validator.validateReadiness({ gltfJson: gltf, sidecar: null, dependencies: [] });
  assert.equal(noSidecar.viewerOk, true);
  assert.equal(noSidecar.vawReady, false);
  assert.ok(noSidecar.diagnostics.some(d => d.code === 'vaw.noSidecar' && d.domain === 'vaw-readiness'));
  const missingVisual = Validator.validateReadiness({ gltfJson: gltf, sidecar: { schemaVersion: 1, assetId: 'x', kind: 'moduleVisual', model: { path: 'project/model.gltf' }, semantics: {} }, dependencies: [] });
  assert.equal(missingVisual.viewerOk, true);
  assert.equal(missingVisual.vawReady, false);
  assert.ok(missingVisual.diagnostics.some(d => d.code === 'vaw.missingVisualRoot'));
  const inferred = Validator.inferSidecar(gltf, bundle.mainModel);
  const inferredReady = Validator.validateReadiness({ gltfJson: gltf, sidecar: inferred, dependencies, modelRecord: bundle.mainModel });
  assert.equal(inferredReady.vawReady, true);
  assert.equal(inferredReady.sidecarFacts.assetId, 'model');


  const validPack = VisualAssetPack.inferManifest(embeddedGltf, { basename: 'test_anim.gltf', normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' }, { packId: 'core_blockbench_test', assetId: 'thruster_basic', blockTypes: ['Thruster'] });
  const validPackResult = VisualAssetPack.validateManifest({ manifest: validPack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } });
  assert.equal(validPackResult.viewerOk, true);
  assert.equal(validPackResult.vawReady, true);
  assert.equal(validPackResult.facts.packId, 'core_blockbench_test');
  assert.ok(validPackResult.diagnostics.some(d => d.code === 'gltf.duplicateNodeNames' && d.severity === 'warning'), 'duplicate node names should warn, not block path-based bindings');

  const inferredWithoutBlockType = VisualAssetPack.inferManifest(embeddedGltf, { basename: 'test_anim.gltf', normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' });
  assert.deepEqual(inferredWithoutBlockType.assets[0].bindings.blockTypes, [], 'Studio must not silently default inferred packs to Thruster.');
  assert.equal(inferredWithoutBlockType.metadata.inference.blockTypesExplicit, false);
  const missingBlockTypeResult = VisualAssetPack.validateManifest({ manifest: inferredWithoutBlockType, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } });
  assert.ok(missingBlockTypeResult.diagnostics.some(d => d.code === 'binding.blockTypesMissing'), 'Export must stay blocked until the user chooses a block type.');

  const topologicalRootGltf = { nodes: [{ name: 'armature', children: [1] }, { name: 'mesh' }], animations: [] };
  const topologicalRootPack = VisualAssetPack.inferManifest(topologicalRootGltf, { basename: 'model.gltf', normalizedPath: 'model.gltf' }, { blockTypes: ['Thruster'] });
  assert.equal(topologicalRootPack.assets[0].bindings.nodes.visualRoot, '/armature', 'visualRoot inference must prefer the topological root over a child mesh name match.');

  const realInferred = VisualAssetPack.inferManifest(realBlockbenchGltf, { basename: 'test_anim.gltf', normalizedPath: 'models/test_anim.gltf' }, { blockTypes: ['Thruster'] });
  assert.equal(realInferred.assets[0].bindings.nodes.visualRoot, '/group', 'Real Blockbench animated fixture should infer the scene root group.');
  assert.equal(realInferred.assets[0].bindings.clips.thrust, 'animation');
  const realStaticInferred = VisualAssetPack.inferManifest(realBlockbenchStaticGltf, { basename: 'test.gltf', normalizedPath: 'models/test.gltf' }, { blockTypes: ['Thruster'] });
  assert.equal(realStaticInferred.assets[0].bindings.nodes.visualRoot, '/mesh', 'Single-node real Blockbench fixture should infer its only node.');
  const realArmatureInferred = VisualAssetPack.inferManifest(realBlockbenchArmatureGltf, { basename: 'model_bone_as_amature.gltf', normalizedPath: 'models/model_bone_as_amature.gltf' }, { blockTypes: ['Thruster'] });
  assert.equal(realArmatureInferred.assets[0].bindings.nodes.visualRoot, '/group', 'Armature-like real fixture should infer the topological group root.');

  function validatePackPatch(mutator, { modelRecord = { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' }, gltfJson = embeddedGltf } = {}) {
    const pack = JSON.parse(JSON.stringify(validPack));
    mutator(pack);
    return VisualAssetPack.validateManifest({ manifest: pack, gltfJson, dependencies: embeddedDependencies, modelRecord });
  }
  function assertDiag(result, code, message) {
    assert.ok(result.diagnostics.some(d => d.code === code), message || `expected diagnostic ${code}`);
    assert.equal(result.vawReady, false, `${code} must block VAW export`);
  }

  const engineAllowedTypes = ['Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel'];
  for (const blockType of engineAllowedTypes) {
    const result = validatePackPatch(pack => { pack.assets[0].bindings.blockTypes = [blockType]; });
    assert.equal(result.vawReady, true, `${blockType} should match engine-side M4A catalog`);
  }
  for (const blockType of ['Structure', 'Structural', 'Hinge', 'Rotor', 'Sensor', 'Payload', 'MagicGameplayBlock']) {
    assertDiag(validatePackPatch(pack => { pack.assets[0].bindings.blockTypes = [blockType]; }), 'binding.unknownBlockType', `${blockType} must not get a false Studio OK`);
  }

  assertDiag(validatePackPatch(pack => { pack.assets[0].bindings.nodes.extra = '/Bone'; }), 'binding.unknownNodeAlias');
  assertDiag(validatePackPatch(pack => { pack.assets[0].bindings.clips.extra = 'up_down'; }), 'binding.unknownClipAlias');
  assertDiag(validatePackPatch(pack => { delete pack.assets[0].materialPolicy; }), 'asset.materialPolicyMissing');
  assertDiag(validatePackPatch(pack => { pack.assets[0].materialPolicy = null; }), 'asset.materialPolicyInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].bindings.clips = null; }), 'binding.clipsMissing');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = './models/x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = 'models\\x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = 'models/../x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = 'models//x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = 'http://example.test/x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].model.path = 'C:/tmp/x.gltf'; }, { modelRecord: null }), 'asset.modelPathInvalid');
  assertDiag(validatePackPatch(pack => { pack.assets[0].dragArea = 2; }), 'pack.forbiddenGameplayField');
  assertDiag(validatePackPatch(pack => { pack.assets[0].fuelRate = 1; }), 'pack.forbiddenGameplayField');
  assertDiag(validatePackPatch(pack => { pack.assets[0].controlAxis = 'yaw'; }), 'pack.forbiddenGameplayField');

  const vectorRigGltf = { nodes: [{ name: 'Root', children: [1] }, { name: 'gimbal' }], animations: [] };
  const vectorRigPack = VisualAssetPack.inferManifest(vectorRigGltf, { basename: 'vector.gltf', normalizedPath: 'models/vector.gltf' }, { blockTypes: ['VectorThruster'] });
  assert.ok(vectorRigPack.assets[0].bindings.rig.vectorThruster, 'VectorThruster inference should include a renderer-only rig profile when a gimbal node is found.');
  const vectorRigResult = VisualAssetPack.validateManifest({ manifest: vectorRigPack, gltfJson: vectorRigGltf, dependencies: [], modelRecord: { normalizedPath: 'models/vector.gltf' } });
  assert.equal(vectorRigResult.vawReady, true, 'Valid renderer-only VectorThruster rig profile should export.');
  const invalidVectorRigPack = JSON.parse(JSON.stringify(vectorRigPack));
  invalidVectorRigPack.assets[0].bindings.nodes.gimbalAssembly = null;
  invalidVectorRigPack.assets[0].bindings.rig.vectorThruster.channels = [{ input: 'pitch', node: 'gimbalAssembly', axis: 'yaw', direction: 0 }];
  const invalidVectorRigResult = VisualAssetPack.validateManifest({ manifest: invalidVectorRigPack, gltfJson: vectorRigGltf, dependencies: [], modelRecord: { normalizedPath: 'models/vector.gltf' } });
  assertDiag(invalidVectorRigResult, 'binding.rigInputInvalid');
  assertDiag(invalidVectorRigResult, 'binding.rigAxisInvalid');
  assertDiag(invalidVectorRigResult, 'binding.rigDirectionInvalid');
  assertDiag(invalidVectorRigResult, 'binding.rigNodeBindingMissing');

  const engineMirrorCases = [
    ['accepts VectorThruster', pack => { pack.assets[0].bindings.blockTypes = ['VectorThruster']; }, true],
    ['rejects Structure', pack => { pack.assets[0].bindings.blockTypes = ['Structure']; }, false],
    ['rejects unknown node alias', pack => { pack.assets[0].bindings.nodes.extra = '/Bone'; }, false],
    ['rejects unknown clip alias', pack => { pack.assets[0].bindings.clips.extra = 'up_down'; }, false],
    ['rejects missing materialPolicy', pack => { delete pack.assets[0].materialPolicy; }, false],
    ['rejects unsafe path', pack => { pack.assets[0].model.path = './models/x.gltf'; }, false, { modelRecord: null }],
  ];
  for (const [name, mutate, expectedReady, options = {}] of engineMirrorCases) {
    const result = validatePackPatch(mutate, options);
    assert.equal(result.vawReady, expectedReady, `engine mirror compatibility case failed: ${name}`);
  }

  const duplicateSiblingGltf = {
    nodes: [
      { name: 'Root', children: [1, 2] },
      { name: 'Panel' },
      { name: 'Panel' }
    ],
    animations: [{ name: 'up_down' }]
  };
  const duplicatePathPack = JSON.parse(JSON.stringify(validPack));
  duplicatePathPack.assets[0].model.path = 'models/duplicate.gltf';
  duplicatePathPack.assets[0].bindings.nodes.visualRoot = '/Root/Panel';
  duplicatePathPack.assets[0].bindings.nodes.flame = null;
  duplicatePathPack.assets[0].bindings.nodes.flameGlow = null;
  duplicatePathPack.assets[0].bindings.clips.thrust = 'up_down';
  const duplicatePathResult = VisualAssetPack.validateManifest({ manifest: duplicatePathPack, gltfJson: duplicateSiblingGltf, dependencies: [], modelRecord: { normalizedPath: 'models/duplicate.gltf' } });
  assertDiag(duplicatePathResult, 'binding.nodePathAmbiguous');
  assert.ok(duplicatePathResult.diagnostics.some(d => d.code === 'gltf.duplicateNodePaths'));

  const noManifest = VisualAssetPack.validateManifest({ manifest: null, gltfJson: embeddedGltf, dependencies: embeddedDependencies });
  assert.equal(noManifest.viewerOk, true);
  assert.equal(noManifest.vawReady, false);
  assert.ok(noManifest.diagnostics.some(d => d.code === 'pack.noManifest' && d.severity === 'info'));
  assert.ok(noManifest.diagnostics.some(d => d.code === 'gltf.duplicateNodeNames' && d.severity === 'info'), 'plain Blockbench duplicate names should be informational until a manifest binding makes them ambiguous');

  const missingVisualRootPack = JSON.parse(JSON.stringify(validPack));
  missingVisualRootPack.assets[0].bindings.nodes.visualRoot = null;
  assert.ok(VisualAssetPack.validateManifest({ manifest: missingVisualRootPack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } }).diagnostics.some(d => d.code === 'binding.visualRootMissing'));

  const unknownBlockTypePack = JSON.parse(JSON.stringify(validPack));
  unknownBlockTypePack.assets[0].bindings.blockTypes = ['MagicGameplayBlock'];
  assert.ok(VisualAssetPack.validateManifest({ manifest: unknownBlockTypePack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } }).diagnostics.some(d => d.code === 'binding.unknownBlockType'));

  const forbiddenGameplayPack = JSON.parse(JSON.stringify(validPack));
  forbiddenGameplayPack.assets[0].massKg = 10;
  assert.ok(VisualAssetPack.validateManifest({ manifest: forbiddenGameplayPack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } }).diagnostics.some(d => d.code === 'pack.forbiddenGameplayField'));

  const missingBindingsPack = JSON.parse(JSON.stringify(validPack));
  missingBindingsPack.assets[0].bindings.nodes.flame = 'missing_node';
  missingBindingsPack.assets[0].bindings.clips.thrust = 'missing_clip';
  const missingBindingsResult = VisualAssetPack.validateManifest({ manifest: missingBindingsPack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } });
  assert.ok(missingBindingsResult.diagnostics.some(d => d.code === 'binding.nodeNameNotFound'));
  assert.ok(missingBindingsResult.diagnostics.some(d => d.code === 'binding.clipNotFound'));

  const ambiguousNodePack = JSON.parse(JSON.stringify(validPack));
  ambiguousNodePack.assets[0].bindings.nodes.visualRoot = 'Bone';
  assert.ok(VisualAssetPack.validateManifest({ manifest: ambiguousNodePack, gltfJson: embeddedGltf, dependencies: embeddedDependencies, modelRecord: { normalizedPath: 'embedded/test_model_alfa_anim_BaA.gltf' } }).diagnostics.some(d => d.code === 'binding.nodeNameAmbiguous'));

  const samplePack = readJson('assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json');
  const sampleGltf = readJson('assets/sample_visual_asset_pack_v1/models/test_anim.gltf');
  const sampleResult = VisualAssetPack.validateManifest({ manifest: samplePack, gltfJson: sampleGltf, dependencies: [], modelRecord: { normalizedPath: 'sample_visual_asset_pack_v1/models/test_anim.gltf' }, manifestBasePath: 'sample_visual_asset_pack_v1' });
  assert.equal(sampleResult.vawReady, true);
  assert.equal(samplePack.metadata.status, 'preview-test-asset');
  assert.equal(samplePack.assets[0].model.path, 'models/test_anim.gltf', 'sample manifest model.path must be pack-root relative, not Studio-folder relative');

  const realPack = readJson('assets/real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json');
  const realPackGltf = readJson('assets/real_blockbench_thruster_pack/models/test_anim.gltf');
  const realPackResult = VisualAssetPack.validateManifest({ manifest: realPack, gltfJson: realPackGltf, dependencies: [], modelRecord: { normalizedPath: 'real_blockbench_thruster_pack/models/test_anim.gltf' }, manifestBasePath: 'real_blockbench_thruster_pack' });
  assert.equal(realPackResult.vawReady, true, 'Real Blockbench thruster pack fixture must validate before engine registration.');
  assert.equal(realPack.assets[0].bindings.nodes.visualRoot, '/group');

  assert.equal(typeof PackageExporter.crc32(new Uint8Array([1, 2, 3])), 'number');
  assert.equal(typeof PackageExporter.buildDebugPackageEntries, 'function');
  assert.equal(typeof PackageExporter.buildVisualAssetPackEntries, 'function');
  const visualEntries = await PackageExporter.buildVisualAssetPackEntries({ bundle: embeddedBundle, manifest: validPack, validation: validPackResult, projectFilesReport: embeddedProjectReport, textureReport: embeddedTextureReport, animationReport: AnimationReport.analyzeAnimations({ gltfJson: embeddedGltf, runtimeClips: [] }), dependencies: embeddedDependencies, prefix: 'visual_pack' });
  const visualEntryNames = visualEntries.map(entry => entry.name);
  assert.ok(visualEntryNames.includes('visual_pack/VAW_VISUAL_ASSET_PACK_V1.json'));
  assert.ok(visualEntryNames.includes('visual_pack/embedded/test_model_alfa_anim_BaA.gltf'), 'engine-facing model must exist at manifest.model.path inside exported pack');
  assert.ok(visualEntryNames.includes('visual_pack/validation/VAW_VISUAL_ASSET_PACK_V1_VALIDATION_REPORT.json'));
  assert.ok(visualEntryNames.includes('visual_pack/validation/LOADED_SOURCE_FILES_REPORT.json'));
  assert.ok(!visualEntryNames.some(name => name.startsWith('visual_pack/source/')), 'Visual Asset Pack must not hide engine-facing files under source/');

  const sampleBundle = Resolver.createBundle([
    new FakeFile('test_anim.gltf', 'sample_visual_asset_pack_v1/models/test_anim.gltf', JSON.stringify(sampleGltf)),
    new FakeFile('VAW_VISUAL_ASSET_PACK_V1.json', 'sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json', JSON.stringify(samplePack)),
  ]);
  const sampleEntries = await PackageExporter.buildVisualAssetPackEntries({ bundle: sampleBundle, manifest: samplePack, validation: sampleResult, dependencies: [], manifestBasePath: 'sample_visual_asset_pack_v1', prefix: 'test_anim_preview_visual_pack' });
  const sampleEntryNames = sampleEntries.map(entry => entry.name);
  assert.ok(sampleEntryNames.includes('test_anim_preview_visual_pack/models/test_anim.gltf'), 'exported sample model must be at manifest.model.path inside pack');
  assert.ok(!sampleEntryNames.includes('test_anim_preview_visual_pack/sample_visual_asset_pack_v1/models/test_anim.gltf'), 'exported sample must not leak Studio asset folder prefix into pack');

  const entries = await PackageExporter.buildDebugPackageEntries({ bundle, projectFilesReport: projectReport, textureReport, animationReport, viewerFacts: { renderer: 'ok' }, validation: noSidecar, dependencies, sidecarParseReport: { recognizedPaths: ['project/asset.vaw.json'] }, eventLog: ['event A'], sessionReport: { session: 'test' }, prefix: 'debug' });
  const names = entries.map(entry => entry.name);
  for (const name of ['debug/PROJECT_FILES_REPORT.json', 'debug/TEXTURE_REPORT.json', 'debug/ANIMATION_REPORT.json', 'debug/GLTF_DEPENDENCY_REPORT.json', 'debug/SIDECAR_PARSE_REPORT.json', 'debug/VIEWER_FACTS.json', 'debug/WORKBENCH_SESSION_REPORT.json', 'debug/VAW_READINESS_REPORT.json', 'debug/EVENT_LOG.txt', 'debug/README_DEBUG_PACKAGE.txt']) {
    assert.ok(names.includes(name), `missing debug entry ${name}`);
  }

  const memoryStore = new Map();
  const fakeStorage = { getItem: key => memoryStore.get(key) || null, setItem: (key, value) => memoryStore.set(key, value) };
  assert.deepEqual(LayoutManager.getDefaultLayout(), { leftWidth: 360, rightWidth: 410, bottomHeight: 150, leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false });
  LayoutManager.saveLayout({ leftWidth: 9999, rightWidth: 10, bottomHeight: 20, leftCollapsed: true }, fakeStorage);
  const loadedLayout = LayoutManager.loadLayout(fakeStorage);
  assert.equal(loadedLayout.leftWidth, 720);
  assert.equal(loadedLayout.rightWidth, 280);
  assert.equal(loadedLayout.bottomHeight, 72);
  assert.equal(loadedLayout.leftCollapsed, true);

  const schema = readJson('schemas/visual_asset_pack_v1.schema.json');
  assert.deepEqual(schema.$defs.blockType.enum, engineAllowedTypes);
  assert.equal(schema.$defs.asset.required.includes('materialPolicy'), true);
  assert.equal(schema.$defs.asset.properties.bindings.required.includes('clips'), true);
  assert.equal(schema.$defs.asset.properties.bindings.properties.nodes.additionalProperties, false);
  assert.equal(schema.$defs.asset.properties.bindings.properties.clips.additionalProperties, false);
  assert.deepEqual(schema.$defs.rigInput.enum, ['gimbalA', 'gimbalB', 'roll']);
  assert.deepEqual(schema.$defs.rigAxis.enum, ['x', 'y', 'z']);
  assert.equal(schema.$defs.asset.properties.bindings.properties.rig.additionalProperties, false);
  assert.ok(schema.$defs.safePackPath.pattern.includes('\\\\'), 'schema path pattern should reject backslashes');
  assert.ok(schema.$defs.notGameplayPropertyName, 'schema should include a forbidden gameplay property-name guard');
  const schemaText = JSON.stringify(schema);
  assert.ok(schemaText.includes('[fF][uU][eE][lL][rR][aA][tT][eE]'), 'schema should mirror engine forbidden gameplay fields');
  assert.deepEqual(schema.$defs.asset.properties.bindings.properties.nodes.propertyNames, { $ref: '#/$defs/notGameplayPropertyName' });
  assert.deepEqual(schema.$defs.asset.properties.materialPolicy.propertyNames, { $ref: '#/$defs/notGameplayPropertyName' });

  const app = readText('app/main.js');
  const index = readText('index.html');
  const viewer = readText('src/minimal_gltf_viewer.js');
  const fitCamera = readText('src/fit_camera.js');
  assert.ok(app.includes('Critical recovery rule') || viewer.includes('do not cancel the render loop'));
  assert.ok(!/cancelAnimationFrame\(state\.animationFrame\)/.test(app), 'old V3 reset/render-loop cancellation pattern must not return');
  assert.ok(!/clearModel\(\)[\s\S]{0,700}cancelAnimationFrame/.test(viewer), 'clearModel must not cancel the render loop');
  assert.ok(/clearModel\(\)[\s\S]{0,900}startRenderLoop\(\)/.test(viewer), 'clearModel should keep or restart render loop');
  assert.ok(fitCamera.includes('frameCameraToBounds'), 'F should have a frame/preserve-orientation implementation');
  assert.ok(viewer.includes('resetCamera()') && viewer.includes('fitCameraToBounds'), 'R should reset to the default model orientation');
  for (const snippet of ['MMB obrót', 'Shift+MMB pan', 'LPM/PPM wolne', 'viewerOk', 'vawReady']) {
    assert.ok(index.includes(snippet) || app.includes(snippet), `missing ${snippet}`);
  }
  for (const snippet of ['Project Files', 'project-files-list', 'project-files-search', 'project-files-category-filter', 'Reset layout', 'left-splitter', 'right-splitter', 'bottom-splitter', 'localStorage']) {
    assert.ok(index.includes(snippet) || app.includes(snippet) || readText('src/layout_manager.js').includes(snippet), `missing UI/layout snippet: ${snippet}`);
  }
  for (const snippet of ['Animation preview', 'animation-time', 'animation-speed', 'pauseAnimation', 'setAnimationTime']) {
    assert.ok(index.includes(snippet) || app.includes(snippet) || viewer.includes(snippet), `missing animation hardening snippet: ${snippet}`);
  }
  assert.ok(app.includes("'animation-time-label', 'animation-list'"), 'animation-list must be wired into the app element map, not only present in HTML');
  assert.ok(app.includes('handleAnimationTick') && viewer.includes('animationCallback') && viewer.includes('currentTime'), 'animation timeline needs live playback UI facts');
  assert.ok(app.includes('Bundle.isDataUri') && app.includes('compactUri'), 'data URI resolver logs must stay compact');
  assert.ok(app.includes('isViewerGeneratedBlobUrl') && app.includes('resolver: unresolved'), 'viewer-generated blob URL noise should be filtered without hiding dependency reports');
  for (const snippet of ['Format JSON', 'Apply manifest', 'parseSidecarFromEditor', 'validateManifest']) {
    assert.ok(index.includes(snippet) || app.includes(snippet) || readText('src/vaw_validator.js').includes(snippet), `missing sidecar hardening snippet: ${snippet}`);
  }
  for (const snippet of ['vaw-block-type', 'choose explicitly', 'vaw-node-visual-root', 'vaw-node-flame-glow', 'vaw-clear-rig-bindings', 'selectedBlockTypes', 'inferVisualAssetManifest']) {
    assert.ok(index.includes(snippet) || app.includes(snippet), `missing explicit Visual Asset Pack authoring UI snippet: ${snippet}`);
  }
  for (const snippet of [
    'vaw-vector-rig-enabled',
    'vaw-vector-rig-default',
    'currentVectorRigProfile',
    'currentVectorRigPreviewDiagnostics',
    'vectorRig.gimbalAssemblyMissing',
    'vectorRig.channelMissing',
    'vectorRig.axisInvalid',
    'vectorRig.fallback',
    'vectorRig.previewReady',
    'rig: currentRigFields()'
  ]) {
    assert.ok(index.includes(snippet) || app.includes(snippet), `missing VectorThruster rig authoring snippet: ${snippet}`);
  }
  assert.ok(AuthoringState.OPTIONAL_NODE_ALIASES.includes('gimbalAssembly'), 'Authoring state helper must own optional rig aliases.');
  assert.ok(app.includes('AuthoringState.applyNodeFields'), 'Studio must commit empty optional rig inputs as null bindings.');
  assert.ok(app.includes('AuthoringState.preferenceSnapshotForBlock'), 'Studio must not restore rig defaults across block types.');
  assert.ok(app.includes('commitAuthoringFieldsToManifest'), 'Apply/Validate/Export must commit explicit authoring controls into the manifest.');
  assert.ok(app.includes('currentAuthoringPrefsSnapshot'), 'Studio must keep per-block authoring preferences for repeated in-game visual iteration.');
  assert.ok(app.includes('saveAuthoringPrefsForBlock'), 'Authoring prefs must be keyed by VAW block type.');
  assert.ok(app.includes('handleBlockTypeChange'), 'Changing block type must load that block profile instead of wiping rig controls.');
  assert.ok(app.includes('fireSplit: currentFireSplitFields()'), 'Fire/glow split settings must persist with the block profile.');
  assert.ok(app.includes('const parsed = commitAuthoringFieldsToManifest({ allowInfer: false, preserveEmpty: true });'), 'Apply manifest must not reset a selected block type back to empty JSON bindings.');
  assert.ok(app.includes('const parsed = commitAuthoringFieldsToManifest({ allowInfer: true, preserveEmpty: true });'), 'Download manifest must preserve explicit authoring controls.');
  assert.ok(/validate-vaw[\s\S]{0,180}commitAuthoringFieldsToManifest/.test(app), 'Validate V1 Contract must validate the committed form state, not stale JSON.');
  assert.ok(index.includes('Export Debug Package'));
  assert.ok(index.includes('Export Visual Asset Pack V1'));
  assert.ok(index.includes('V1 preview pack'));
  assert.ok(index.includes('VAW_VISUAL_ASSET_PACK_V1'));
  assert.ok(app.includes('visual: SAMPLE_VISUAL_PACK_V1') && app.includes('v1: SAMPLE_VISUAL_PACK_V1'), 'browser smoke can deep-link to ?sample=visual or ?sample=v1');
  assert.ok(app.includes("relativePath: 'models/test_anim.gltf'"), 'built-in V1 sample must load with pack-root relative paths');
  assert.ok(app.includes('Preview OK. To zwykły import bez manifestu V1'), 'no-manifest state must not be presented as an error');
  assert.ok(app.includes('downloadDebugPackageZip'));
  assert.ok(app.includes('downloadPackageZip'));
  assert.ok(app.indexOf('downloadDebugPackageZip') !== app.indexOf('downloadPackageZip'));
  assert.ok(app.includes('buildDebugPackageEntries'));
  assert.ok(app.includes('buildVisualAssetPackEntries'));
  assert.ok(app.includes('VisualAssetPack.validateManifest'));
  assert.ok(!app.includes('localStorage') || readText('src/layout_manager.js').includes('localStorage'));

  console.log(JSON.stringify({
    recoveryStatic: 'ok',
    uvImages: textureReport.summary.imageCount,
    resolverRecords: bundle.records.length,
    projectFileRows: projectReport.files.length,
    animationClips: animationReport.summary.clipCount,
    layoutDefaults: LayoutManager.getDefaultLayout(),
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
