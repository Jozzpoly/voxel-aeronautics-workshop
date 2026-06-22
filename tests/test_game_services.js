'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.window = global;

function load(relative) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

load('src/foundation/kernel.js');
load('src/foundation/config.js');
load('src/foundation/catalog.js');
load('src/foundation/input_profile.js');
load('src/foundation/ui_workspace.js');
load('src/game/career_service.js');
load('src/game/workspace_controller.js');

const Config = window.VAW.require('foundation.config');
const InputProfile = window.VAW.require('foundation.input-profile');
const UIWorkspace = window.VAW.require('foundation.ui-workspace');
const CareerService = window.VAW.require('game.career-service');
const WorkspaceController = window.VAW.require('game.workspace-controller');
const storage = new MemoryStorage();

const state = {
  mode: 'BUILD',
  uiCollapsed: false,
  contractPanelCollapsed: false,
  career: { credits: 0, selectedContractId: 'hover_license', completed: {}, best: {}, totalStars: 0 },
  input: { profile: InputProfile.createDefault() },
  uiWorkspace: UIWorkspace.createDefault(),
  camera: { mode: 'follow-body', followStrength: 0.12 }
};

const career = CareerService.create({ state, storage });
const normalized = career.normalizeCareerData({
  credits: Number.POSITIVE_INFINITY,
  selectedContractId: 'heavy_lift',
  completed: { hover_license: true, unknown: true },
  best: {
    hover_license: { stars: 9, time: 12, fuelFraction: 4, integrity: -2 },
    unknown: { stars: 3, time: 1, fuelFraction: 1, integrity: 100 }
  }
});
if (normalized.credits !== 1_000_000_000) throw new Error('Career credits must preserve the historical upper clamp.');
if (normalized.selectedContractId !== 'hover_license') throw new Error('Locked selected contract must fall back.');
state.career.selectedContractId = 'removed-future-contract';
if (career.getSelectedContract().id !== 'hover_license') throw new Error('Unknown selected contract must recover safely.');
if (career.isContractUnlocked(null) !== false) throw new Error('Missing contract must not be treated as unlocked.');
if (normalized.best.hover_license.stars !== 3 || normalized.best.hover_license.fuelFraction !== 1 || normalized.best.hover_license.integrity !== 0) {
  throw new Error('Career result bounds were not enforced.');
}
if ('unknown' in normalized.completed || 'unknown' in normalized.best) throw new Error('Unknown contract data leaked through normalization.');

Object.assign(state.career, normalized, { credits: 125 });
career.saveCareer();
state.career.credits = 0;
career.loadCareer();
if (state.career.credits !== 125) throw new Error('Career round-trip failed.');

const legacyKey = Config.LEGACY_UI_SAVE_KEYS[0];
storage.setItem(legacyKey, JSON.stringify({
  inputProfile: InputProfile.createDefault(),
  contractPanelCollapsed: true
}));
const fakeDocument = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null
};
const workspace = WorkspaceController.create({
  state,
  storage,
  document: fakeDocument,
  window: { innerWidth: 1280, innerHeight: 720 }
});
workspace.loadUIPreferences();
if (state.uiWorkspace.panels.contracts.open !== false || state.contractPanelCollapsed !== true) {
  throw new Error('Legacy contract-panel preference migration failed.');
}
workspace.saveUIPreferences();
const persisted = JSON.parse(storage.getItem(Config.UI_SAVE_KEY));
if (persisted.version !== Config.UI_SAVE_VERSION || !persisted.inputProfile || !persisted.workspace) {
  throw new Error('UI preference persistence contract failed.');
}
if (!persisted.camera || persisted.camera.mode !== 'follow-body' || persisted.camera.followStrength !== 0.12) {
  throw new Error('Camera UI preference persistence failed.');
}

const oldGeometryStorage = new MemoryStorage();
oldGeometryStorage.setItem('voxel-aeronautics-ui-v7', JSON.stringify({
  version: 7,
  inputProfile: InputProfile.createDefault(),
  workspace: UIWorkspace.updatePanel(UIWorkspace.createDefault(), 'build', { y: 68 }, { layoutId: 'build' })
}));
const oldGeometryState = {
  mode: 'BUILD',
  uiCollapsed: false,
  contractPanelCollapsed: false,
  input: { profile: InputProfile.createDefault() },
  uiWorkspace: UIWorkspace.createDefault()
};
WorkspaceController.create({
  state: oldGeometryState,
  storage: oldGeometryStorage,
  document: fakeDocument,
  window: { innerWidth: 1280, innerHeight: 720 }
}).loadUIPreferences();
if (oldGeometryState.uiWorkspace.panels.build.y !== UIWorkspace.DEFAULT_PANELS.build.y) {
  throw new Error('Legacy v7 UI geometry must not override the edge-aligned workbench defaults.');
}

function createPanelElement(panelId) {
  const classes = new Set();
  const style = {};
  const attributes = {};
  style.setProperty = (name, value) => { style[name] = String(value); };
  style.removeProperty = name => { delete style[name]; };
  return {
    id: panelId,
    hidden: false,
    dataset: {},
    style,
    classList: {
      toggle: (name, enabled) => {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    setAttribute: (name, value) => { attributes[name] = String(value); },
    getAttribute: name => attributes[name] || null
  };
}

const stackedDockState = {
  mode: 'FLIGHT',
  uiCollapsed: false,
  contractPanelCollapsed: false,
  input: { profile: InputProfile.createDefault() },
  uiWorkspace: UIWorkspace.updatePanel(
    UIWorkspace.updatePanel(UIWorkspace.createDefault(), 'telemetry', { y: 8, height: 320 }, { layoutId: 'flight' }),
    'mission',
    { y: 8, height: 220 },
    { layoutId: 'flight' }
  )
};
const stackedElements = Object.fromEntries(UIWorkspace.PANEL_IDS.map(id => [id, createPanelElement(id)]));
const stackedDocument = {
  querySelector: selector => {
    const match = selector.match(/data-workspace-panel="([^"]+)"/);
    return match ? stackedElements[match[1]] : null;
  },
  querySelectorAll: () => [],
  getElementById: () => null
};
WorkspaceController.create({
  state: stackedDockState,
  storage,
  document: stackedDocument,
  window: { innerWidth: 1280, innerHeight: 720 }
}).applyWorkspaceLayout();
const telemetryTop = Number.parseFloat(stackedElements.telemetry.style.top);
const telemetryHeight = Number.parseFloat(stackedElements.telemetry.style.height);
const missionTop = Number.parseFloat(stackedElements.mission.style.top);
const missionHeight = Number.parseFloat(stackedElements.mission.style.height);
if (![telemetryTop, telemetryHeight, missionTop, missionHeight].every(Number.isFinite)) {
  throw new Error('Side-docked panel geometry must be applied to visible flight panels.');
}
if (Math.min(telemetryTop, missionTop) !== 8 || Math.abs(telemetryTop - missionTop) < Math.min(telemetryHeight, missionHeight)) {
  throw new Error('Panels docked to the same side must start at the edge and stack without overlap.');
}

state.mode = 'BUILD';
state.uiWorkspace = UIWorkspace.updatePanel(UIWorkspace.createDefault(), 'parts', { placement: 'dock-top', dockSpan: 'full' }, { layoutId: 'build' });
workspace.togglePanelDockSpan('parts', false);
if (state.uiWorkspace.panels.parts.placement !== 'dock-bottom' || state.uiWorkspace.panels.parts.dockSpan !== 'compact') {
  throw new Error('Retired top hotbar placement must fall back to the bottom dock before span toggling.');
}
workspace.togglePanelDockSpan('parts', false);
if (state.uiWorkspace.panels.parts.placement !== 'dock-bottom' || state.uiWorkspace.panels.parts.dockSpan !== 'full') {
  throw new Error('Bottom hotbar span toggle must restore full width in place.');
}
state.uiWorkspace = UIWorkspace.updatePanel(UIWorkspace.createDefault(), 'parts', { placement: 'floating', dockSpan: 'compact' }, { layoutId: 'build' });
workspace.togglePanelDockSpan('parts', false);
if (state.uiWorkspace.panels.parts.placement !== 'dock-bottom' || state.uiWorkspace.panels.parts.dockSpan !== 'full') {
  throw new Error('Floating hotbar span toggle must return the parts list to the bottom dock.');
}

const wheelState = {
  mode: 'BUILD',
  uiCollapsed: false,
  contractPanelCollapsed: false,
  input: { profile: InputProfile.createDefault() },
  uiWorkspace: UIWorkspace.updatePanel(UIWorkspace.createDefault(), 'parts', { placement: 'dock-bottom', dockSpan: 'full' }, { layoutId: 'build' })
};
let wheelHandler = null;
const partsScrollRegion = {
  scrollWidth: 1600,
  clientWidth: 900,
  scrollLeft: 0,
  getAttribute: name => name === 'data-panel-scroll' ? 'parts' : null,
  closest: () => ({ dataset: { placement: 'dock-bottom' } }),
  addEventListener: (type, handler) => {
    if (type === 'wheel') wheelHandler = handler;
  }
};
const wheelDocument = {
  querySelector: () => null,
  getElementById: () => null,
  querySelectorAll: selector => selector === '[data-panel-scroll]' ? [partsScrollRegion] : []
};
const wheelWorkspace = WorkspaceController.create({
  state: wheelState,
  storage,
  document: wheelDocument,
  window: { innerWidth: 1280, innerHeight: 720 }
});
wheelWorkspace.bindWorkspacePanels();
if (typeof wheelHandler !== 'function') throw new Error('Workspace wheel handler was not bound to panel scroll regions.');
let prevented = 0;
let stopped = 0;
wheelHandler({
  currentTarget: partsScrollRegion,
  deltaX: 0,
  deltaY: 320,
  preventDefault: () => { prevented += 1; },
  stopPropagation: () => { stopped += 1; }
});
if (partsScrollRegion.scrollLeft !== 320 || prevented !== 1 || stopped !== 1) {
  throw new Error('Bottom-docked hotbar wheel input must scroll the block list horizontally.');
}

console.log(JSON.stringify({
  careerNormalization: 'ok',
  careerPersistence: 'ok',
  workspacePreferenceMigration: 'ok',
  workspacePreferencePersistence: 'ok',
  cameraPreferencePersistence: 'ok',
  legacyGeometryReset: 'ok',
  stackedSideDockPanels: 'ok',
  retiredTopHotbarMigration: 'ok',
  bottomHotbarWheelScroll: 'ok'
}, null, 2));
