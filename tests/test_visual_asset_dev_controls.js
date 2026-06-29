const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

global.window = global;
for (const relative of [
  'src/foundation/kernel.js',
  'src/game/visual_asset_dev_controls.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const DevControls = VAW.require('game.visual-asset-dev-controls');

function createLoader() {
  const state = { reloads: 0, debugVisible: false };
  return {
    state,
    reloadInstalledPacks: async () => {
      state.reloads += 1;
      return { ok: true };
    },
    coverage: () => [{ blockType: 'Thruster', assetId: 'local_thruster_visual' }],
    diagnostics: () => [],
    debugVisualsVisible: () => state.debugVisible,
    setDebugVisualsVisible: value => {
      state.debugVisible = Boolean(value);
      return state.debugVisible;
    }
  };
}

function createButton() {
  const listeners = new Map();
  return {
    textContent: '',
    title: '',
    attrs: {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) fn({ type, target: this, ...event });
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    }
  };
}

function createWindow() {
  const listeners = new Map();
  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.closed = false;
      this.listeners = new Set();
      FakeBroadcastChannel.instances.push(this);
    }
    addEventListener(type, fn) {
      if (type === 'message') this.listeners.add(fn);
    }
    removeEventListener(type, fn) {
      if (type === 'message') this.listeners.delete(fn);
    }
    dispatch(data) {
      for (const fn of this.listeners) fn({ data });
    }
    close() {
      this.closed = true;
    }
  }
  FakeBroadcastChannel.instances = [];
  return {
    BroadcastChannel: FakeBroadcastChannel,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) fn({
        type,
        target: { tagName: 'BODY' },
        preventDefault() {},
        ...event
      });
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    }
  };
}

(async () => {
  const originalBroadcastChannel = global.BroadcastChannel;
  let nodeChannelConstructed = 0;
  global.BroadcastChannel = class {
    constructor() {
      nodeChannelConstructed += 1;
    }
  };
  const nodeLoader = createLoader();
  const nodeControls = DevControls.create({ visualAssetLoader: nodeLoader, window: global, document: null, logger: { warn() {}, info() {} } });
  assert.strictEqual(nodeChannelConstructed, 0, 'Node smoke harness must not open a long-lived BroadcastChannel.');
  assert.strictEqual(nodeControls.broadcastChannel, null);
  nodeControls.dispose();
  global.BroadcastChannel = originalBroadcastChannel;

  const fakeWindow = createWindow();
  const reloadButton = createButton();
  const debugButton = createButton();
  const fakeDocument = {
    getElementById(id) {
      if (id === 'btn-reload-visual-assets') return reloadButton;
      if (id === 'btn-visual-debug-toggle') return debugButton;
      return null;
    }
  };
  const browserLoader = createLoader();
  const controls = DevControls.create({
    visualAssetLoader: browserLoader,
    visualAssetRegistry: { diagnostics: () => [] },
    window: fakeWindow,
    document: fakeDocument,
    logger: { warn() {}, info() {} },
    showStatus() {}
  });

  assert.strictEqual(fakeWindow.BroadcastChannel.instances.length, 1, 'Browser-like windows should use BroadcastChannel reload.');
  assert.strictEqual(fakeWindow.listenerCount('keydown'), 1);
  assert.strictEqual(reloadButton.listenerCount('click'), 1);
  assert.strictEqual(debugButton.attrs['aria-pressed'], 'false');

  fakeWindow.BroadcastChannel.instances[0].dispatch({ type: 'visual-block-installed' });
  assert.strictEqual(browserLoader.state.reloads, 1, 'Install broadcasts should trigger reload.');
  fakeWindow.dispatch('keydown', { key: 'D', shiftKey: true, repeat: false });
  assert.strictEqual(browserLoader.state.debugVisible, true, 'Shift+D should toggle visual debug.');
  reloadButton.dispatch('click');
  assert.strictEqual(browserLoader.state.reloads, 2, 'Manual reload button should still work.');

  controls.dispose();
  assert.strictEqual(fakeWindow.BroadcastChannel.instances[0].closed, true, 'dispose() must close the BroadcastChannel.');
  assert.strictEqual(fakeWindow.listenerCount('keydown'), 0, 'dispose() must remove window keydown listener.');
  assert.strictEqual(reloadButton.listenerCount('click'), 0, 'dispose() must remove button listener.');
  assert.strictEqual(fakeWindow.VAW_VISUAL_ASSET_DIAGNOSTICS, undefined);
  assert.strictEqual(fakeWindow.VAW_VISUAL_ASSET_DEBUG, undefined);

  fakeWindow.BroadcastChannel.instances[0].dispatch({ type: 'visual-block-installed' });
  fakeWindow.dispatch('keydown', { key: 'V', shiftKey: true, repeat: false });
  assert.strictEqual(browserLoader.state.reloads, 2, 'Disposed controls must not react to reload triggers.');

  console.log({ visualAssetDevControls: 'ok' });
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
