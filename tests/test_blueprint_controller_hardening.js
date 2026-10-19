const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

global.window = global;
global.document = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'));
for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/blueprint.js',
  'src/game/blueprint_controller.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });

const Config = VAW.require('foundation.config');
const Blueprint = VAW.require('foundation.blueprint');
const Controller = VAW.require('game.blueprint-controller');

class Element {
  constructor() { this.value = ''; this.visible = false; this.disabled = false; this.dataset = {}; this.classList = { toggle() {} }; }
}
const elements = new Map(['btn-undo','btn-redo','thruster-power','balloon-power','stability'].map(id => [id, new Element()]));
const document = {
  getElementById: id => elements.get(id) || new Element(),
  querySelectorAll: () => [],
  createElement: () => ({ click() {}, remove() {}, style: {}, classList: { toggle() {} } }),
  body: { appendChild() {} }
};
const state = {
  mode: 'BUILD', statusText: 'ORIGINAL', selectedBlock: 'Hull', orientation: 0, symmetry: 'NONE',
  thrusterPower: 0.7, balloonPower: 0.7, stabilityAssist: 0.18, controlAxis: 'pitch', controlSign: 0,
  history: { canUndo: false, canRedo: false, commit() { return false; }, undo() {}, redo() {}, rollbackUndo() {}, rollbackRedo() {} }
};
const original = Blueprint.createDocument({ blocks: [{ blockId: 'core', assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Core' }] });
let current = original;
let rejectReplacement = false;
const craft = {
  get size() { return current.blocks.length; },
  toDocument() { return current; },
  replaceDocument(next) {
    if (rejectReplacement) return { ok: false, reason: 'injected-rejection' };
    current = next;
    return { ok: true };
  },
  clear() { current = Blueprint.createDocument(); return { ok: true }; }
};
const previousPrimary = JSON.stringify(Blueprint.createDocument({ blocks: [{ blockId: 'previous-core', assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Core' }] }));
const values = new Map([[Config.SAVE_KEY, previousPrimary]]);
const storage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value)
};
const statuses = [];
const controller = Controller.create({
  state, craft, document, storage, defaultOrientation: 0,
  markers: { comSphere: {}, axesHelper: {} },
  callbacks: {
    cleanupFlightState() {}, updateTelemetry() {}, updateGhost() {}, updateControlConfigurationUI() {},
    syncHudVisibility() {}, resetToEmptyCraft() {}, updateHUD() {}, showStatus: text => statuses.push(text), setMechanicalAuthoring() {}
  }
});

assert.strictEqual(controller.persistBlueprint(false), true);
assert.strictEqual(values.get(Config.SAVE_BACKUP_KEY), previousPrimary);
assert.strictEqual(JSON.parse(values.get(Config.SAVE_KEY)).version, 12);

// A corrupt primary must never overwrite the last known-good backup during recovery.
const goodBackup = values.get(Config.SAVE_KEY);
values.set(Config.SAVE_BACKUP_KEY, goodBackup);
values.set(Config.SAVE_KEY, '{corrupt-json');
// A stale controller must not silently overwrite storage changed outside its tab.
assert.strictEqual(controller.persistBlueprint(false), false);
assert.strictEqual(values.get(Config.SAVE_KEY), '{corrupt-json');
assert.strictEqual(values.get(Config.SAVE_BACKUP_KEY), goodBackup);
// A newly opened recovery session starts from the actual current primary and
// can deliberately repair it, without discarding the last valid backup.
const recoveryController = Controller.create({
  state, craft, document, storage, defaultOrientation: 0,
  markers: { comSphere: {}, axesHelper: {} },
  callbacks: {
    cleanupFlightState() {}, updateTelemetry() {}, updateGhost() {}, updateControlConfigurationUI() {},
    syncHudVisibility() {}, resetToEmptyCraft() {}, updateHUD() {}, showStatus: text => statuses.push(text), setMechanicalAuthoring() {}
  }
});
assert.strictEqual(recoveryController.persistBlueprint(false), true);
assert.strictEqual(values.get(Config.SAVE_BACKUP_KEY), goodBackup);
assert.strictEqual(Blueprint.normalize(JSON.parse(values.get(Config.SAVE_KEY))).version, 12);

const candidate = Blueprint.createDocument({ blocks: [{ blockId: 'new-core', assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Core' }] });
const stateBefore = JSON.stringify(state);
const craftBefore = Blueprint.signature(current);
rejectReplacement = true;
assert.strictEqual(controller.loadBlueprintData(candidate), false);
assert.strictEqual(Blueprint.signature(current), craftBefore);
assert.strictEqual(JSON.stringify(state), stateBefore, 'failed load must not partially mutate UI settings');
rejectReplacement = false;
assert.strictEqual(controller.loadBlueprintData(candidate), true);
assert.strictEqual(current.blocks[0].blockId, 'new-core');

let fileReaderConstructed = false;
global.FileReader = class { constructor() { fileReaderConstructed = true; } };
controller.importBlueprintFile({ size: Config.IMPORT_POLICY.maxBlueprintBytes + 1 });
assert.strictEqual(fileReaderConstructed, false);
assert(statuses.includes('BLUEPRINT TOO LARGE'));

fileReaderConstructed = false;
global.FileReader = class {
  constructor() { fileReaderConstructed = true; this.result = 'ą'.repeat(Config.IMPORT_POLICY.maxBlueprintBytes); }
  readAsText() { this.onload(); }
};
controller.importBlueprintFile({});
assert.strictEqual(fileReaderConstructed, true);
assert(statuses.includes('INVALID BLUEPRINT'));

// Two independent tabs sharing one origin and save slot must not silently
// overwrite each other. The displaced tab retains a recoverable JSON snapshot.
const tabValues = new Map([[Config.SAVE_KEY, previousPrimary]]);
const tabStorage = {
  getItem: key => tabValues.has(key) ? tabValues.get(key) : null,
  setItem: (key, value) => tabValues.set(key, value),
  get length() { return tabValues.size; },
  key(index) { return [...tabValues.keys()][index] || null; }
};
const rescuePanel = { style: { display: 'none' } };
const rescuePicker = {
  value: '', options: [],
  replaceChildren() { this.options = []; },
  appendChild(option) { this.options.push(option); }
};
const tabDocument = {
  ...document,
  getElementById(id) {
    if (id === 'rescue-controls') return rescuePanel;
    if (id === 'rescue-copy-select') return rescuePicker;
    return document.getElementById(id);
  }
};
function makeTab(id) {
  let authored = Blueprint.createDocument({ blocks: [{ blockId: id, assemblySpaceId: 'space:root', x: 0, y: 0, z: 0, type: 'Core' }] });
  const tabCraft = {
    get size() { return authored.blocks.length; },
    toDocument() { return authored; },
    replaceDocument(data) { authored = data; return { ok: true }; }
  };
  return Controller.create({
    state: { ...state, mode: 'BUILD' }, craft: tabCraft, document: tabDocument, storage: tabStorage, defaultOrientation: 0,
    markers: { comSphere: {}, axesHelper: {} },
    callbacks: {
      cleanupFlightState() {}, updateTelemetry() {}, updateGhost() {}, updateControlConfigurationUI() {},
      syncHudVisibility() {}, resetToEmptyCraft() {}, updateHUD() {},
      showStatus: text => statuses.push(text), setMechanicalAuthoring() {}
    }
  });
}
const tabA = makeTab('tab-a');
const tabB = makeTab('tab-b');
assert.strictEqual(tabA.persistBlueprint(false), true);
const primaryAfterA = tabValues.get(Config.SAVE_KEY);
assert.strictEqual(tabB.persistBlueprint(false), false, 'stale tab B must refuse silent last-writer-wins');
assert.strictEqual(tabValues.get(Config.SAVE_KEY), primaryAfterA, 'conflict must not replace the shared primary');
assert.strictEqual(tabValues.get(Config.SAVE_BACKUP_KEY), previousPrimary, 'conflict must not replace the backup');
const rescueKeys = [...tabValues.keys()].filter(key => key.startsWith(Config.SAVE_KEY + ':conflict:'));
assert.strictEqual(rescueKeys.length, 1, 'conflicting craft must get one distinct rescue slot');
assert.strictEqual(JSON.parse(tabValues.get(rescueKeys[0])).blocks[0].blockId, 'tab-b');
assert.deepStrictEqual(tabB.listRescueCopies().map(copy => copy.key), rescueKeys);
assert.strictEqual(rescuePanel.style.display, 'flex', 'conflict exposes the export rescue UI');
assert.strictEqual(rescuePicker.value, rescueKeys[0]);
assert.strictEqual(rescuePicker.options.length, 1);
assert.strictEqual(tabB.exportRescueCopy(), true, 'retained copy must be user-exportable');
assert.strictEqual(tabValues.has(rescueKeys[0]), true, 'export does not remove a rescue copy');
assert(statuses.includes('RESCUE EXPORTED • IMPORT JSON TO OPEN'));
assert(statuses.includes('SAVE CONFLICT • EXPORT BLUEPRINT'));
assert.strictEqual(tabB.persistBlueprint(false), false);
assert.strictEqual([...tabValues.keys()].filter(key => key.startsWith(Config.SAVE_KEY + ':conflict:')).length, 1,
  'repeated conflicted autosaves in one tab should reuse its rescue slot');
assert.strictEqual(tabB.loadBlueprint(false), true, 'explicitly loading the new primary should resolve stale baseline');
assert.strictEqual(tabB.persistBlueprint(false), true);
assert.strictEqual(tabValues.get(Config.SAVE_KEY), primaryAfterA);

console.log({ atomicLoad: 'ok', backupSave: 'ok', corruptPrimaryPreservesBackup: 'ok',
  importSizeGuard: 'ok', multiTabConflict: 'rescue-without-overwrite' });
