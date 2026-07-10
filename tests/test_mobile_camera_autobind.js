'use strict';

const assert = require('assert');
const Autobind = require('../src/game/mobile-camera-autobind.js');

function cameraModuleHarness() {
  let listener = null;
  let current = null;
  return {
    module: {
      onCreated(callback) {
        listener = callback;
        if (current) callback(current);
        return () => { if (listener === callback) listener = null; };
      }
    },
    emit(controller) { current = controller; listener?.(controller); },
    subscribed: () => Boolean(listener)
  };
}

function mobileContextHarness() {
  let listener = null;
  let profile = { mobilePresentation: true };
  return {
    context: {
      currentProfile: () => profile,
      subscribe(callback) {
        listener = callback;
        callback(profile);
        return () => { if (listener === callback) listener = null; };
      }
    },
    emit(next) { profile = next; listener?.(profile); },
    subscribed: () => Boolean(listener)
  };
}

function runtimeHarness() {
  const records = [];
  return {
    module: {
      create(options) {
        const record = { options, binds: 0, destroys: 0, refreshes: 0 };
        records.push(record);
        return {
          bind() { record.binds += 1; return true; },
          destroy() { record.destroys += 1; return true; },
          refreshEnabled() { record.refreshes += 1; return true; }
        };
      }
    },
    records
  };
}

function runImmediateSurfaceCase() {
  const camera = cameraModuleHarness();
  const mobile = mobileContextHarness();
  const runtime = runtimeHarness();
  const surface = { id: 'canvas' };
  const documentLike = {
    documentElement: {},
    querySelector(selector) { return selector === '#canvas-container canvas' ? surface : null; }
  };
  const bound = [];
  const taps = [];
  let tapActive = false;
  const binder = Autobind.create({
    document: documentLike,
    window: {},
    mobileContext: mobile.context,
    cameraControllerModule: camera.module,
    runtimeModule: runtime.module,
    tapEnabled: () => tapActive,
    onTap(value) { taps.push(value); },
    onBound(value) { bound.push(value); }
  });

  assert.equal(binder.start(), true);
  assert.equal(binder.start(), false);
  assert.equal(camera.subscribed(), true);
  assert.equal(mobile.subscribed(), true);

  const firstController = { id: 'first' };
  camera.emit(firstController);
  assert.equal(runtime.records.length, 1);
  assert.equal(runtime.records[0].binds, 1);
  assert.strictEqual(runtime.records[0].options.surface, surface);
  assert.strictEqual(runtime.records[0].options.cameraController, firstController);
  assert.equal(runtime.records[0].options.tapEnabled(), false);
  tapActive = true;
  assert.equal(runtime.records[0].options.tapEnabled(), true, 'tap policy must remain live after binding');
  runtime.records[0].options.onTap({ x: 12, y: 34 });
  assert.deepEqual(taps, [{ x: 12, y: 34 }]);
  assert.equal(binder.bound(), true);

  mobile.emit({ mobilePresentation: false });
  assert.equal(runtime.records[0].refreshes, 1, 'only profile changes emitted after runtime creation can refresh it');

  const secondController = { id: 'second' };
  camera.emit(secondController);
  assert.equal(runtime.records[0].destroys, 1);
  assert.equal(runtime.records.length, 2);
  assert.equal(runtime.records[1].binds, 1);
  assert.strictEqual(runtime.records[1].options.onTap, runtime.records[0].options.onTap);
  assert.strictEqual(runtime.records[1].options.tapEnabled, runtime.records[0].options.tapEnabled);
  assert.strictEqual(binder.currentController(), secondController);
  assert.equal(bound.length, 2);

  assert.equal(binder.destroy(), true);
  assert.equal(runtime.records[1].destroys, 1);
  assert.equal(camera.subscribed(), false);
  assert.equal(mobile.subscribed(), false);
  assert.equal(binder.destroy(), false);
  assert.throws(() => binder.start(), /cannot be restarted/);
}

function runDefaultTapSafetyCase() {
  const camera = cameraModuleHarness();
  const mobile = mobileContextHarness();
  const runtime = runtimeHarness();
  const surface = { id: 'canvas' };
  const binder = Autobind.create({
    document: { documentElement: {}, querySelector() { return surface; } },
    window: {},
    mobileContext: mobile.context,
    cameraControllerModule: camera.module,
    runtimeModule: runtime.module
  });
  binder.start();
  camera.emit({ id: 'default-safe' });
  assert.equal(runtime.records[0].options.tapEnabled(), false, 'tap must remain disabled unless explicitly enabled');
  assert.doesNotThrow(() => runtime.records[0].options.onTap({ x: 1, y: 2 }));
  binder.destroy();
}

function runDelayedSurfaceCase() {
  const camera = cameraModuleHarness();
  const mobile = mobileContextHarness();
  const runtime = runtimeHarness();
  let surface = null;
  let observerInstance = null;
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = false;
      this.disconnected = false;
      observerInstance = this;
    }
    observe() { this.observed = true; }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback(); }
  }
  const documentLike = {
    documentElement: {},
    querySelector() { return surface; }
  };
  const binder = Autobind.create({
    document: documentLike,
    window: {},
    MutationObserver: FakeMutationObserver,
    mobileContext: mobile.context,
    cameraControllerModule: camera.module,
    runtimeModule: runtime.module
  });

  binder.start();
  camera.emit({ id: 'delayed' });
  assert.equal(runtime.records.length, 0);
  assert(observerInstance?.observed);

  surface = { id: 'late-canvas' };
  observerInstance.trigger();
  assert.equal(observerInstance.disconnected, true);
  assert.equal(runtime.records.length, 1);
  assert.strictEqual(runtime.records[0].options.surface, surface);
  assert.equal(runtime.records[0].binds, 1);

  binder.destroy();
  assert.equal(runtime.records[0].destroys, 1);
}

function runFailureRecoveryCase() {
  const camera = cameraModuleHarness();
  const mobile = mobileContextHarness();
  const surface = { id: 'canvas' };
  const documentLike = { documentElement: {}, querySelector() { return surface; } };
  const errors = [];
  let attempts = 0;
  const successful = { binds: 0, destroys: 0, refreshes: 0 };
  const runtimeModule = {
    create() {
      attempts += 1;
      if (attempts === 1) throw new Error('runtime create failed');
      return {
        bind() { successful.binds += 1; return true; },
        destroy() { successful.destroys += 1; return true; },
        refreshEnabled() { successful.refreshes += 1; return true; }
      };
    }
  };
  const binder = Autobind.create({
    document: documentLike,
    window: {},
    mobileContext: mobile.context,
    cameraControllerModule: camera.module,
    runtimeModule,
    onError(error, context) { errors.push({ error, context }); }
  });

  binder.start();
  assert.doesNotThrow(() => camera.emit({ id: 'broken-first' }));
  assert.equal(binder.bound(), false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].context.phase, 'runtime-bind');
  assert.match(errors[0].error.message, /runtime create failed/);

  assert.doesNotThrow(() => camera.emit({ id: 'working-second' }));
  assert.equal(binder.bound(), true);
  assert.equal(successful.binds, 1);
  binder.destroy();
  assert.equal(successful.destroys, 1);
}

function run() {
  runImmediateSurfaceCase();
  runDefaultTapSafetyCase();
  runDelayedSurfaceCase();
  runFailureRecoveryCase();
  assert.throws(() => Autobind.create({}), /document/);
  assert.throws(() => Autobind.create({ document: {}, mobileContext: {} }), /currentProfile/);
  console.log('OK mobile camera autobind');
}

run();
