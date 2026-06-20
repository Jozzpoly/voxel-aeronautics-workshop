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
assert.strictEqual(controller.persistBlueprint(false), true);
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

console.log({ atomicLoad: 'ok', backupSave: 'ok', corruptPrimaryPreservesBackup: 'ok', importSizeGuard: 'ok' });
