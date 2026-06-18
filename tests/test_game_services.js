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
  uiWorkspace: UIWorkspace.createDefault()
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

console.log(JSON.stringify({
  careerNormalization: 'ok',
  careerPersistence: 'ok',
  workspacePreferenceMigration: 'ok',
  workspacePreferencePersistence: 'ok'
}, null, 2));
