'use strict';

const assert = require('assert');
const FlightControls = require('../src/game/mobile-flight-controls.js');

function freshCommandPort() {
  const path = require.resolve('../src/game/mobile-command-port.js');
  delete require.cache[path];
  return require(path);
}

function createDomHarness() {
  const byId = new Map();

  class EventTargetLike {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, callback) {
      const list = this.listeners.get(name) || [];
      list.push(callback);
      this.listeners.set(name, list);
    }
    removeEventListener(name, callback) {
      const list = (this.listeners.get(name) || []).filter(item => item !== callback);
      if (list.length) this.listeners.set(name, list);
      else this.listeners.delete(name);
    }
    dispatch(name, values = {}) {
      let prevented = false;
      let stopped = false;
      const event = {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 60,
        clientY: 60,
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
        stopImmediatePropagation() { stopped = true; },
        ...values
      };
      for (const callback of [...(this.listeners.get(name) || [])]) callback(event);
      return { prevented, stopped, event };
    }
  }

  class Element extends EventTargetLike {
    constructor(tagName) {
      super();
      this.tagName = String(tagName || 'div').toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.hidden = false;
      this.textContent = '';
      this.className = '';
      this.type = '';
      this._id = '';
      this.captures = new Set();
      this.rect = { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120 };
    }
    set id(value) {
      if (this._id) byId.delete(this._id);
      this._id = String(value || '');
      if (this._id) byId.set(this._id, this);
    }
    get id() { return this._id; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return { ...this.rect }; }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      if (this._id) byId.delete(this._id);
      this.parentNode = null;
    }
  }

  const windowLike = new EventTargetLike();
  const documentLike = new EventTargetLike();
  documentLike.hidden = false;
  documentLike.documentElement = new Element('html');
  documentLike.head = new Element('head');
  documentLike.body = new Element('body');
  documentLike.documentElement.appendChild(documentLike.head);
  documentLike.documentElement.appendChild(documentLike.body);
  documentLike.createElement = tag => new Element(tag);
  documentLike.getElementById = id => byId.get(id) || null;
  windowLike.document = documentLike;
  windowLike.navigator = {};

  return { windowLike, documentLike, Element };
}

function createMobileContext() {
  let profile = { mobilePresentation: true };
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
    setProfile(next) {
      profile = next;
      for (const listener of [...listeners]) listener(profile);
    }
  };
}

function createImplementation(state, calls) {
  return {
    build: {
      catalog: () => [], selectPart: () => false, placeAtScreen: () => false, removeAtScreen: () => false,
      rotate: () => false, setDirection: () => false, undo: () => false, redo: () => false
    },
    session: {
      snapshot() { return { mode: state.mode, selectedPart: 'Core', craftSize: 1 }; },
      launch() { state.mode = 'FLIGHT'; return true; },
      returnToWorkshop() { state.mode = 'BUILD'; return true; },
      reset() { state.mode = 'BUILD'; return true; }
    },
    flight: {
      setAction(action, active) { calls.push(['action', action, active]); return true; },
      clearActions() { calls.push(['clear']); return true; }
    }
  };
}

function findByDataset(element, key, value) {
  if (element.dataset?.[key] === value) return element;
  for (const child of element.children || []) {
    const found = findByDataset(child, key, value);
    if (found) return found;
  }
  return null;
}

function latestAction(calls, action, active) {
  return calls.some(call => call[0] === 'action' && call[1] === action && call[2] === active);
}

function run() {
  const Port = freshCommandPort();
  const { windowLike, documentLike } = createDomHarness();
  const mobile = createMobileContext();
  const state = { mode: 'BUILD' };
  const calls = [];
  const cancellations = [];
  const controls = FlightControls.create({
    window: windowLike,
    document: documentLike,
    mobileContext: mobile.context,
    commandPort: Port,
    onCancel(event) { cancellations.push(event.reason); }
  });

  assert.equal(controls.start(), true);
  assert.equal(controls.start(), false);
  assert.equal(controls.snapshot().active, false);
  assert.equal(controls.root().hidden, true);

  Port.register(createImplementation(state, calls));
  assert.equal(controls.snapshot().active, false, 'BUILD mode must keep flight controls hidden');
  Port.session.launch();
  assert.equal(controls.snapshot().active, true);
  assert.equal(controls.root().hidden, false);

  const left = findByDataset(controls.root(), 'control', 'left-stick');
  const right = findByDataset(controls.root(), 'control', 'right-stick');
  const lift = findByDataset(controls.root(), 'action', 'heave+');
  const descend = findByDataset(controls.root(), 'action', 'heave-');
  const rollLeft = findByDataset(controls.root(), 'action', 'roll-');
  assert(left && right && lift && descend && rollLeft);

  left.dispatch('pointerdown', { pointerId: 11, clientX: 60, clientY: 60 });
  left.dispatch('pointermove', { pointerId: 11, clientX: 110, clientY: 10 });
  assert(latestAction(calls, 'sway+', true));
  assert(latestAction(calls, 'surge+', true));
  assert.deepEqual(controls.snapshot().activeActions, ['surge+', 'sway+']);

  right.dispatch('pointerdown', { pointerId: 22, clientX: 60, clientY: 60 });
  right.dispatch('pointermove', { pointerId: 22, clientX: 10, clientY: 10 });
  assert(latestAction(calls, 'yaw+', true));
  assert(latestAction(calls, 'pitch+', true));
  assert.deepEqual(controls.snapshot().activeActions, ['pitch+', 'surge+', 'sway+', 'yaw+']);

  left.dispatch('pointermove', { pointerId: 11, clientX: 10, clientY: 110 });
  assert(latestAction(calls, 'sway+', false));
  assert(latestAction(calls, 'surge+', false));
  assert(latestAction(calls, 'sway-', true));
  assert(latestAction(calls, 'surge-', true));
  assert.deepEqual(controls.snapshot().activeActions, ['pitch+', 'surge-', 'sway-', 'yaw+']);

  left.dispatch('pointerup', { pointerId: 11, clientX: 10, clientY: 110 });
  assert.deepEqual(controls.snapshot().activeActions, ['pitch+', 'yaw+'], 'releasing left stick must not clear right-stick actions');
  right.dispatch('pointerup', { pointerId: 22, clientX: 10, clientY: 10 });
  assert.deepEqual(controls.snapshot().activeActions, []);

  left.dispatch('pointerdown', { pointerId: 33, clientX: 60, clientY: 60 });
  left.dispatch('pointermove', { pointerId: 33, clientX: 66, clientY: 65 });
  assert.deepEqual(controls.snapshot().activeActions, [], 'movement inside deadzone must remain neutral');
  left.dispatch('pointerup', { pointerId: 33 });

  lift.dispatch('pointerdown', { pointerId: 44 });
  assert.deepEqual(controls.snapshot().activeActions, ['heave+']);
  assert.equal(lift.dataset.active, 'true');
  lift.dispatch('pointerup', { pointerId: 44 });
  assert.deepEqual(controls.snapshot().activeActions, []);
  assert.equal(lift.dataset.active, 'false');

  descend.dispatch('pointerdown', { pointerId: 55 });
  rollLeft.dispatch('pointerdown', { pointerId: 66 });
  assert.deepEqual(controls.snapshot().activeActions, ['heave-', 'roll-']);
  windowLike.dispatch('blur', { pointerType: undefined });
  assert.deepEqual(controls.snapshot().activeActions, []);
  assert.equal(calls.at(-1)[0], 'clear');
  assert(cancellations.includes('window-blur'));

  right.dispatch('pointerdown', { pointerId: 77, clientX: 60, clientY: 60 });
  right.dispatch('pointermove', { pointerId: 77, clientX: 110, clientY: 110 });
  assert(controls.snapshot().activeActions.length > 0);
  documentLike.hidden = true;
  documentLike.dispatch('visibilitychange', { pointerType: undefined });
  assert.deepEqual(controls.snapshot().activeActions, []);
  assert(cancellations.includes('document-hidden'));
  documentLike.hidden = false;

  left.dispatch('pointerdown', { pointerId: 88, clientX: 60, clientY: 60 });
  left.dispatch('pointermove', { pointerId: 88, clientX: 110, clientY: 10 });
  Port.session.returnToWorkshop();
  assert.equal(controls.snapshot().active, false);
  assert.equal(controls.root().hidden, true);
  assert.deepEqual(controls.snapshot().activeActions, []);
  assert(cancellations.includes('deactivate'));

  Port.session.launch();
  assert.equal(controls.snapshot().active, true);
  mobile.setProfile({ mobilePresentation: false });
  assert.equal(controls.snapshot().active, false);
  mobile.setProfile({ mobilePresentation: true });
  assert.equal(controls.snapshot().active, true);

  assert.equal(controls.destroy(), true);
  assert.equal(controls.destroy(), false);
  assert.equal(documentLike.getElementById(FlightControls.ROOT_ID), null);
  assert.equal(documentLike.getElementById(FlightControls.STYLE_ID), null);
  assert.equal(windowLike.listeners.size, 0);
  assert.equal(documentLike.listeners.size, 0);
  assert.throws(() => controls.start(), /cannot be restarted/);

  assert.throws(() => FlightControls.create({}), /document/);
  assert.throws(() => FlightControls.create({ window: windowLike, document: documentLike, mobileContext: {} }), /currentProfile/);
  assert.throws(() => FlightControls.create({ window: windowLike, document: documentLike, mobileContext: mobile.context, commandPort: {} }), /activity subscriptions/);
  assert.throws(() => FlightControls.create({ window: windowLike, document: documentLike, mobileContext: mobile.context, commandPort: Port, deadzone: 1 }), /deadzone/);

  console.log('OK mobile flight controls');
}

run();
