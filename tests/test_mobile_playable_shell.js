'use strict';

const assert = require('assert');
const PlayableShell = require('../src/game/mobile-playable-shell.js');

function createDocumentHarness() {
  const elementsById = new Map();

  class Element {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.listeners = new Map();
      this.hidden = false;
      this.disabled = false;
      this.className = '';
      this.textContent = '';
      this.type = '';
      this._id = '';
    }

    set id(value) {
      if (this._id) elementsById.delete(this._id);
      this._id = String(value || '');
      if (this._id) elementsById.set(this._id, this);
    }

    get id() { return this._id; }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    replaceChildren(...children) {
      for (const child of this.children) child.parentNode = null;
      this.children = [];
      for (const child of children) this.appendChild(child);
    }

    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    click() {
      if (this.disabled) return;
      this.listeners.get('click')?.({ target: this, preventDefault() {}, stopPropagation() {} });
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      if (this._id) elementsById.delete(this._id);
      this.parentNode = null;
    }
  }

  const documentElement = new Element('html');
  const head = new Element('head');
  const body = new Element('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);
  const uiLayer = new Element('div');
  uiLayer.id = 'ui-layer';
  body.appendChild(uiLayer);

  return {
    document: {
      documentElement,
      head,
      body,
      createElement: tagName => new Element(tagName),
      getElementById: id => elementsById.get(id) || null
    },
    Element
  };
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

function createCommandPortHarness() {
  let implementation = null;
  const listeners = new Set();
  const calls = [];
  const state = {
    mode: 'BUILD',
    selectedPart: 'Core',
    orientation: 'PX_UY',
    symmetry: 'NONE',
    craftSize: 0,
    resetMeaning: 'return-to-workshop'
  };

  const commandPort = {
    current: () => implementation,
    subscribe(listener) {
      listeners.add(listener);
      listener(implementation);
      return () => listeners.delete(listener);
    },
    build: {
      catalog: () => implementation.build.catalog(),
      selectPart: id => implementation.build.selectPart(id),
      placeAtScreen: (x, y) => implementation.build.placeAtScreen(x, y),
      removeAtScreen: (x, y) => implementation.build.removeAtScreen(x, y),
      rotate: direction => implementation.build.rotate(direction),
      setDirection: direction => implementation.build.setDirection(direction),
      undo: () => implementation.build.undo(),
      redo: () => implementation.build.redo()
    },
    session: {
      snapshot: () => implementation.session.snapshot(),
      launch: () => implementation.session.launch(),
      returnToWorkshop: () => implementation.session.returnToWorkshop(),
      reset: () => implementation.session.reset()
    },
    flight: {
      setAction: (action, active) => implementation.flight.setAction(action, active),
      clearActions: () => implementation.flight.clearActions()
    }
  };

  function register() {
    implementation = {
      build: {
        catalog() {
          return [
            { id: 'Core', label: 'Core', description: 'Command core', color: '#38bdf8' },
            { id: 'Wing', label: 'Wing', description: 'Lift surface', color: '#a78bfa' }
          ];
        },
        selectPart(id) { calls.push(['selectPart', id]); state.selectedPart = id; return true; },
        placeAtScreen(x, y) { calls.push(['place', x, y]); state.craftSize += 1; return true; },
        removeAtScreen(x, y) { calls.push(['remove', x, y]); state.craftSize = Math.max(0, state.craftSize - 1); return true; },
        rotate(direction) { calls.push(['rotate', direction]); return true; },
        setDirection(direction) { calls.push(['direction', direction]); return true; },
        undo() { calls.push(['undo']); return false; },
        redo() { calls.push(['redo']); return false; }
      },
      session: {
        snapshot() { return Object.freeze({ ...state }); },
        launch() { calls.push(['launch']); if (state.craftSize < 1) return false; state.mode = 'FLIGHT'; return true; },
        returnToWorkshop() { calls.push(['return']); state.mode = 'BUILD'; return true; },
        reset() { calls.push(['reset']); state.mode = 'BUILD'; return true; }
      },
      flight: {
        setAction(action, active) { calls.push(['action', action, active]); return true; },
        clearActions() { calls.push(['clearActions']); return true; }
      }
    };
    for (const listener of [...listeners]) listener(implementation);
  }

  return { commandPort, register, calls, state };
}

function findByText(element, text) {
  if (element.textContent === text) return element;
  for (const child of element.children || []) {
    const match = findByText(child, text);
    if (match) return match;
  }
  return null;
}

function findPart(root, partId) {
  if (root.dataset?.partId === partId) return root;
  for (const child of root.children || []) {
    const match = findPart(child, partId);
    if (match) return match;
  }
  return null;
}

function run() {
  const { document } = createDocumentHarness();
  const mobile = createMobileContext();
  const commands = createCommandPortHarness();
  const vibrations = [];
  const shell = PlayableShell.create({
    document,
    window: { document, navigator: { vibrate: value => vibrations.push(value) } },
    mobileContext: mobile.context,
    commandPort: commands.commandPort
  });

  assert.equal(shell.start(), true);
  assert.equal(shell.start(), false);
  assert.equal(shell.snapshot().active, true);
  assert.equal(shell.snapshot().ready, false);
  assert.equal(shell.tapEnabled(), false);
  assert.equal(document.documentElement.dataset.vawPlayableMobile, 'active');
  assert(document.getElementById(PlayableShell.ROOT_ID));
  assert(document.getElementById(PlayableShell.STYLE_ID));

  commands.register();
  assert.equal(shell.snapshot().ready, true);
  assert.equal(shell.snapshot().session.mode, 'BUILD');
  assert.equal(shell.tapEnabled(), true);
  const root = shell.root();
  const wing = findPart(root, 'Wing');
  assert(wing, 'Wing must appear in the dedicated mobile part carousel');
  wing.click();
  assert.equal(commands.state.selectedPart, 'Wing');

  assert.equal(shell.handleCanvasTap({ x: 120, y: 220 }), true);
  assert.deepEqual(commands.calls.at(-1), ['place', 120, 220]);
  assert.equal(commands.state.craftSize, 1);
  assert.deepEqual(vibrations, [10]);

  assert.equal(shell.setInteractionMode('remove'), true);
  assert.equal(shell.snapshot().interactionMode, 'remove');
  assert.equal(shell.handleCanvasTap({ x: 140, y: 240 }), true);
  assert.deepEqual(commands.calls.at(-1), ['remove', 140, 240]);
  assert.deepEqual(vibrations, [10, 18]);

  shell.setInteractionMode('place');
  shell.handleCanvasTap({ x: 160, y: 260 });
  const launch = findByText(root, 'LAUNCH');
  assert(launch && !launch.disabled);
  launch.click();
  assert.equal(shell.snapshot().session.mode, 'FLIGHT');
  assert.equal(shell.tapEnabled(), false);

  const returnButton = findByText(root, 'RETURN TO WORKSHOP');
  assert(returnButton);
  returnButton.click();
  assert.equal(shell.snapshot().session.mode, 'BUILD');
  assert.equal(shell.tapEnabled(), true);

  mobile.setProfile({ mobilePresentation: false });
  assert.equal(shell.snapshot().active, false);
  assert.equal(shell.root().hidden, true);
  assert.equal(document.documentElement.dataset.vawPlayableMobile, undefined);
  assert.equal(shell.tapEnabled(), false);

  assert.equal(shell.destroy(), true);
  assert.equal(shell.destroy(), false);
  assert.equal(document.getElementById(PlayableShell.ROOT_ID), null);
  assert.equal(document.getElementById(PlayableShell.STYLE_ID), null);
  assert.throws(() => shell.start(), /cannot be restarted/);

  assert.throws(() => PlayableShell.create({}), /document/);
  assert.throws(() => PlayableShell.create({ document, mobileContext: {} }), /currentProfile/);

  console.log('OK mobile playable shell');
}

run();
