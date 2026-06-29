const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function load(context, relative) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, relative), 'utf8'),
    context,
    { filename: relative }
  );
}

function createHarness({ rejectBootstrap = false } = {}) {
  const captures = {
    attachedRoot: null,
    bootstrapCalls: 0,
    broadcastConstructed: 0,
    loader: null,
    loaderOptions: null,
    registry: null,
    reloadCalls: 0
  };
  const context = {
    console: {
      error() {},
      info() {},
      log() {},
      warn() {}
    },
    process,
    setTimeout,
    clearTimeout,
    __captures: captures,
    __rejectBootstrap: rejectBootstrap
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  context.document = {
    baseURI: 'http://127.0.0.1:8765/index.html',
    createElement: () => ({}),
    getElementById: () => null
  };
  context.BroadcastChannel = undefined;
  vm.createContext(context);

  load(context, 'src/foundation/kernel.js');
  load(context, 'tests/browser_stub_libs.js');
  for (const relative of [
    'src/foundation/config.js',
    'src/foundation/catalog.js',
    'src/foundation/orientation.js',
    'src/foundation/transform_math.js',
    'src/foundation/assembly_spaces.js',
    'src/foundation/blueprint.js'
  ]) {
    load(context, relative);
  }

  vm.runInContext(`
    window.VAW.define('game.visual-asset-registry', [], () => ({
      create: () => {
        const registry = {
          registerManifest: () => ({ ok: true, registered: 0 }),
          assetForBlockType: () => null,
          diagnostics: () => []
        };
        window.__captures.registry = registry;
        return registry;
      }
    }));

    window.VAW.define('game.visual-asset-loader', [], () => ({
      create: options => {
        const loader = {
          bootstrapInstalledPacks() {
            window.__captures.bootstrapCalls += 1;
            if (window.__rejectBootstrap) return Promise.reject(new Error('bootstrap failed'));
            return Promise.resolve({ ok: true, registered: 0 });
          },
          reloadInstalledPacks: async () => {
            window.__captures.reloadCalls += 1;
            return { ok: true, registered: 0 };
          },
          attachImportedVisual: root => {
            window.__captures.attachedRoot = root;
            return Promise.resolve(root);
          },
          coverage: () => [{ blockType: 'Hull', assetId: null }],
          diagnostics: () => [],
          debugVisualsVisible: () => false,
          setDebugVisualsVisible: value => Boolean(value)
        };
        window.__captures.loader = loader;
        window.__captures.loaderOptions = options;
        return loader;
      }
    }));
  `, context, { filename: 'visual-composition-harness.js' });

  load(context, 'src/game/orientation_service.js');
  load(context, 'src/game/visual_asset_dev_controls.js');
  load(context, 'src/game/visual_runtime_adapter.js');
  load(context, 'src/game/module_visual_factory.js');
  load(context, 'src/game/visual_asset_composition.js');
  return { context, captures };
}

function cloneMaterial(context) {
  return new context.THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function exerciseComposition(options = {}) {
  const { context, captures } = createHarness(options);
  const warnings = [];
  const infos = [];
  const statuses = [];
  const disposeCalls = [];
  const disposeObjectTree = root => disposeCalls.push(root);
  const logger = {
    warn: (...args) => warnings.push(args),
    info: (...args) => infos.push(args)
  };

  const Composition = context.VAW.require('game.visual-asset-composition');
  const result = Composition.create({
    THREE: context.THREE,
    sharedGeometry: new context.THREE.BoxGeometry(1, 1, 1),
    cloneMaterial: () => cloneMaterial(context),
    disposeObjectTree,
    showStatus: text => statuses.push(text),
    document: context.document,
    window: context,
    logger
  });
  await flushPromises();

  assert.strictEqual(captures.bootstrapCalls, 1, 'Composition must bootstrap installed packs exactly once.');
  assert.strictEqual(captures.loaderOptions.visualAssetRegistry, result.visualAssetRegistry);
  assert.strictEqual(captures.loaderOptions.disposeObjectTree, disposeObjectTree);
  assert.strictEqual(captures.loader, result.visualAssetLoader);
  assert.strictEqual(result.moduleVisualFactory.createModuleVisual, result.createModuleVisual);

  const visual = result.createModuleVisual('Hull', 0);
  assert.strictEqual(visual.userData.isVoxelRoot, true, 'Composition must expose the real module visual factory.');
  assert.strictEqual(visual.userData.visualAssetStatus, 'procedural-fallback');
  await result.visualAssetLoader.attachImportedVisual(visual);
  assert.strictEqual(captures.attachedRoot, visual);

  await result.visualAssetDevControls.reload();
  assert.strictEqual(captures.reloadCalls, 1, 'Dev controls must receive the composed visual asset loader.');
  assert(statuses.includes('RELOADING VISUAL ASSETS'));
  assert.strictEqual(captures.broadcastConstructed, 0, 'Node smoke must not open a long-lived BroadcastChannel.');

  result.visualAssetDevControls.dispose();
  return { warnings, infos };
}

(async () => {
  const ok = await exerciseComposition();
  assert.strictEqual(ok.warnings.length, 0, 'Successful bootstrap must not warn.');

  const failed = await exerciseComposition({ rejectBootstrap: true });
  assert.strictEqual(failed.warnings.length, 1, 'Rejected bootstrap must be reported through logger.warn.');
  assert(String(failed.warnings[0][0]).includes('bootstrap failed'));

  console.log({ visualAssetComposition: 'ok' });
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
