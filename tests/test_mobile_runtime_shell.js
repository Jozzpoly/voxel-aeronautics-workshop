'use strict';

const assert = require('assert');
const RuntimeShell = require('../src/game/mobile-runtime-shell.js');

function makeElement() {
  const styleValues = new Map();
  return {
    hidden: false,
    dataset: {},
    attrs: {},
    styleValues,
    style: { setProperty(name, value) { styleValues.set(name, value); } },
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector() { return null; }
  };
}

function run() {
  const styleValues = new Map();
  const root = {
    dataset: {},
    classList: { toggle() {} },
    style: { setProperty(name, value) { styleValues.set(name, value); } }
  };
  const blocker = makeElement();
  const listeners = new Map();
  const visualViewportListeners = new Map();
  const storageValues = new Map();
  const windowLike = {
    innerWidth: 390,
    innerHeight: 844,
    navigator: { maxTouchPoints: 5 },
    matchMedia(query) { return { matches: query === '(pointer: coarse)' || query === '(hover: none)' }; },
    requestAnimationFrame(callback) { callback(); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    visualViewport: {
      width: 390,
      height: 844,
      addEventListener(name, callback) { visualViewportListeners.set(name, callback); },
      removeEventListener(name) { visualViewportListeners.delete(name); }
    },
    localStorage: {
      getItem(key) { return storageValues.get(key) || null; },
      setItem(key, value) { storageValues.set(key, value); }
    }
  };
  const documentLike = {
    documentElement: root,
    getElementById(id) { return id === 'desktop-required' ? blocker : null; }
  };

  const shell = RuntimeShell.create({ window: windowLike, document: documentLike });
  const profile = shell.initialize();
  assert(profile);
  assert.equal(profile.mobilePresentation, true);
  assert.equal(shell.initialized(), true);
  assert.equal(blocker.hidden, true);
  assert.equal(blocker.styleValues.get('display'), 'none');
  assert.equal(blocker.attrs['aria-hidden'], 'true');
  assert.equal(blocker.dataset.mobileAdapter, 'ready');
  assert.equal(root.dataset.vawPresentation, 'mobile');
  assert.equal(styleValues.get('--vaw-viewport-width'), '390px');
  assert.equal(styleValues.get('--vaw-viewport-height'), '844px');

  const observed = [];
  const unsubscribe = shell.subscribe(next => observed.push(next.mobilePresentation));
  assert.deepEqual(observed, [true]);
  const desktopProfile = shell.setOverride('desktop');
  assert.equal(desktopProfile.mobilePresentation, false);
  assert.deepEqual(observed, [true, false]);
  unsubscribe();
  shell.setOverride('mobile');
  assert.deepEqual(observed, [true, false], 'unsubscribed profile listener must not receive updates');
  assert.equal(shell.subscribe(null)() , undefined);

  shell.destroy();
  assert.equal(shell.initialized(), false);
  assert.equal(listeners.size, 0);
  assert.equal(visualViewportListeners.size, 0);

  const failureBlocker = makeElement();
  failureBlocker.querySelector = selector => selector === 'strong'
    ? { set textContent(value) { failureBlocker.strong = value; } }
    : { set textContent(value) { failureBlocker.span = value; } };
  RuntimeShell.showFailure(failureBlocker, new Error('boom'));
  assert.equal(failureBlocker.hidden, false);
  assert.equal(failureBlocker.styleValues.get('display'), 'flex');
  assert.equal(failureBlocker.attrs['aria-hidden'], 'false');
  assert.equal(failureBlocker.dataset.mobileAdapter, 'failed');
  assert.equal(failureBlocker.strong, 'Touch controls failed to initialize');
  assert(failureBlocker.span.includes('boom'));

  console.log('OK mobile runtime shell');
}

run();
