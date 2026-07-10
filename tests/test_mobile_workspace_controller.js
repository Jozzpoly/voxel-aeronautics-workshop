'use strict';

const assert = require('assert');
const MobileWorkspace = require('../src/game/mobile-workspace-controller.js');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.inert = false;
    this.textContent = '';
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(name, callback, options) {
    const listeners = this.listeners.get(name) || [];
    listeners.push({ callback, options });
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, callback, options) {
    const listeners = this.listeners.get(name) || [];
    this.listeners.set(name, listeners.filter(listener => listener.callback !== callback || listener.options !== options));
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }
    return false;
  }

  closest(selector) {
    if (selector !== '[data-panel-toggle]') return null;
    let current = this;
    while (current) {
      if (current.dataset?.panelToggle) return current;
      current = current.parentElement;
    }
    return null;
  }
}

function makeEvent(target) {
  return {
    target,
    defaultPrevented: false,
    propagationStopped: false,
    immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    stopImmediatePropagation() { this.immediateStopped = true; }
  };
}

function dispatch(element, name, event) {
  for (const listener of element.listeners.get(name) || []) listener.callback(event);
}

function createDocumentHarness() {
  const uiLayer = new FakeElement('ui-layer');
  const toolbar = new FakeElement('workspace-toolbar');
  toolbar.parentElement = uiLayer;
  const mode = new FakeElement('ui-mode');
  mode.textContent = 'BUILD';
  mode.parentElement = uiLayer;

  const panelNames = ['parts', 'build', 'contracts', 'telemetry', 'mission', 'controls'];
  const panelIds = {
    parts: 'parts-hotbar',
    build: 'build-panel',
    contracts: 'contract-panel',
    telemetry: 'telemetry-panel',
    mission: 'mission-hud',
    controls: 'controls-panel'
  };
  const panels = Object.fromEntries(panelNames.map(name => {
    const panel = new FakeElement(panelIds[name]);
    panel.parentElement = uiLayer;
    panel.hidden = name === 'contracts' || name === 'mission' || name === 'controls';
    panel.setAttribute('aria-hidden', panel.hidden ? 'true' : 'false');
    return [name, panel];
  }));
  const buttons = Object.fromEntries(panelNames.map(name => {
    const button = new FakeElement(`button-${name}`);
    button.dataset.panelToggle = name;
    button.setAttribute('aria-controls', panelIds[name]);
    button.setAttribute('aria-expanded', name === 'build' || name === 'parts' || name === 'telemetry' ? 'true' : 'false');
    button.parentElement = toolbar;
    return [name, button];
  }));

  const byId = new Map([
    ['ui-layer', uiLayer],
    ['workspace-toolbar', toolbar],
    ['ui-mode', mode],
    ...Object.values(panels).map(element => [element.id, element])
  ]);

  return {
    document: {
      getElementById(id) { return byId.get(id) || null; },
      querySelectorAll(selector) {
        if (selector === '#workspace-toolbar [data-panel-toggle]') return Object.values(buttons);
        if (selector === '[data-workspace-panel]') return Object.values(panels);
        return [];
      }
    },
    uiLayer,
    toolbar,
    mode,
    panels,
    buttons
  };
}

function createMobileContext(initialMobile = false) {
  let profile = { mobilePresentation: initialMobile };
  const listeners = new Set();
  return {
    context: {
      currentProfile: () => profile,
      subscribe(listener) {
        listeners.add(listener);
        listener(profile);
        return () => listeners.delete(listener);
      }
    },
    emit(mobilePresentation) {
      profile = { mobilePresentation };
      for (const listener of [...listeners]) listener(profile);
    },
    listenerCount: () => listeners.size
  };
}

function createMutationObserverHarness() {
  const instances = [];
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      instances.push(this);
    }
    observe(target, options) { this.observed.push({ target, options }); }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback([{ type: 'characterData' }]); }
  }
  return { FakeMutationObserver, instances };
}

function run() {
  const dom = createDocumentHarness();
  const mobile = createMobileContext(false);
  const mutation = createMutationObserverHarness();
  const initialHidden = Object.fromEntries(Object.entries(dom.panels).map(([name, panel]) => [name, panel.hidden]));
  const initialAria = Object.fromEntries(Object.entries(dom.buttons).map(([name, button]) => [name, button.getAttribute('aria-expanded')]));
  const snapshots = [];

  const controller = MobileWorkspace.create({
    document: dom.document,
    window: {},
    mobileContext: mobile.context,
    MutationObserver: mutation.FakeMutationObserver,
    onChanged: snapshot => snapshots.push(snapshot)
  });

  assert.equal(controller.bind(), true);
  assert.equal(controller.bind(), false, 'bind must be idempotent');
  assert.equal(controller.active(), false);
  assert.equal(mobile.listenerCount(), 1);

  const desktopClick = makeEvent(dom.buttons.telemetry);
  dispatch(dom.toolbar, 'click', desktopClick);
  assert.equal(desktopClick.defaultPrevented, false, 'desktop toolbar event must pass through');

  mobile.emit(true);
  let snapshot = controller.snapshot();
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.mode, 'BUILD');
  assert.equal(snapshot.activePanel, 'build');
  assert.equal(snapshot.partsOpen, true);
  assert.deepEqual(snapshot.availablePanels, ['build', 'contracts', 'telemetry', 'mission', 'controls', 'parts']);
  assert.equal(dom.uiLayer.dataset.vawMobileWorkspace, 'active');
  assert.equal(dom.panels.build.dataset.vawMobileActive, 'true');
  assert.equal(dom.panels.telemetry.dataset.vawMobileActive, 'false');
  assert.equal(dom.panels.parts.dataset.vawMobileOpen, 'true');
  assert.equal(dom.panels.telemetry.inert, true);
  assert.equal(dom.panels.build.inert, false);

  const telemetryClick = makeEvent(dom.buttons.telemetry);
  dispatch(dom.toolbar, 'click', telemetryClick);
  assert(telemetryClick.defaultPrevented && telemetryClick.propagationStopped && telemetryClick.immediateStopped);
  snapshot = controller.snapshot();
  assert.equal(snapshot.activePanel, 'telemetry');
  assert.equal(snapshot.partsOpen, true);
  assert.equal(dom.panels.build.dataset.vawMobileActive, 'false');
  assert.equal(dom.panels.telemetry.dataset.vawMobileActive, 'true');
  assert.equal(dom.buttons.telemetry.getAttribute('aria-expanded'), 'true');
  assert.equal(dom.buttons.build.getAttribute('aria-expanded'), 'false');

  dispatch(dom.toolbar, 'click', makeEvent(dom.buttons.telemetry));
  assert.equal(controller.snapshot().activePanel, null, 'second large-panel tap closes the sheet');

  dispatch(dom.toolbar, 'click', makeEvent(dom.buttons.parts));
  assert.equal(controller.snapshot().partsOpen, false);
  assert.equal(controller.snapshot().activePanel, null, 'parts toggle must not open a large sheet');
  dispatch(dom.toolbar, 'click', makeEvent(dom.buttons.build));
  assert.equal(controller.snapshot().activePanel, 'build');
  assert.equal(controller.snapshot().partsOpen, false);

  dom.mode.textContent = 'FLIGHT';
  mutation.instances[0].trigger();
  snapshot = controller.snapshot();
  assert.equal(snapshot.mode, 'FLIGHT');
  assert.equal(snapshot.activePanel, 'telemetry');
  assert.equal(snapshot.partsOpen, false);
  assert.deepEqual(snapshot.availablePanels, ['telemetry', 'mission', 'controls']);
  assert.equal(dom.buttons.build.dataset.vawMobileAvailable, 'false');
  assert.equal(dom.buttons.telemetry.dataset.vawMobileAvailable, 'true');

  const unavailableClick = makeEvent(dom.buttons.build);
  dispatch(dom.toolbar, 'click', unavailableClick);
  assert(unavailableClick.defaultPrevented && unavailableClick.immediateStopped, 'unavailable mobile tab remains consumed');
  assert.equal(controller.snapshot().activePanel, 'telemetry');

  dom.mode.textContent = 'BUILD';
  mutation.instances[0].trigger();
  snapshot = controller.snapshot();
  assert.equal(snapshot.mode, 'BUILD');
  assert.equal(snapshot.activePanel, 'build');
  assert.equal(snapshot.partsOpen, true);

  assert.equal(controller.setActivePanel('controls'), true);
  assert.equal(controller.snapshot().activePanel, 'controls');
  assert.equal(controller.setActivePanel('unknown'), false);
  assert.equal(controller.setPartsOpen(false), true);
  assert.equal(controller.snapshot().partsOpen, false);

  const frozen = controller.snapshot();
  assert(Object.isFrozen(frozen));
  assert(Object.isFrozen(frozen.availablePanels));
  assert.throws(() => frozen.availablePanels.push('x'));

  for (const [name, panel] of Object.entries(dom.panels)) {
    assert.equal(panel.hidden, initialHidden[name], `mobile presentation must not mutate panel.hidden for ${name}`);
  }

  mobile.emit(false);
  assert.equal(controller.active(), false);
  assert.equal(dom.uiLayer.dataset.vawMobileWorkspace, undefined);
  for (const [name, panel] of Object.entries(dom.panels)) {
    assert.equal(panel.dataset.vawMobileActive, undefined);
    assert.equal(panel.dataset.vawMobileSheet, undefined);
    assert.equal(panel.dataset.vawMobileTray, undefined);
    assert.equal(panel.inert, false);
    assert.equal(panel.hidden, initialHidden[name]);
  }
  for (const [name, button] of Object.entries(dom.buttons)) {
    assert.equal(button.getAttribute('aria-expanded'), initialAria[name]);
    assert.equal(button.dataset.vawMobileSelected, undefined);
    assert.equal(button.dataset.vawMobileAvailable, undefined);
  }

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(mobile.listenerCount(), 0);
  assert.equal(mutation.instances[0].disconnected, true);
  assert.equal((dom.toolbar.listeners.get('click') || []).length, 0);
  assert(snapshots.length >= 6);

  assert.throws(() => MobileWorkspace.create({}), /document/);
  assert.throws(() => MobileWorkspace.create({ document: dom.document, mobileContext: {} }), /currentProfile/);

  console.log('OK mobile workspace controller');
}

run();
