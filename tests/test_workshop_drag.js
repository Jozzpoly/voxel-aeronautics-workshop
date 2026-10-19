const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const THREE = require(path.join(ROOT, 'vendor/three-r128/three.min.js'));
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/kernel.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/game/workshop_selection_controller.js'), 'utf8'));

const Selection = VAW.require('game.workshop-selection-controller');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1.44, 0.1, 1000);
camera.position.set(12, 14, 18);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
const parent = new THREE.Group();
parent.position.set(12, 5, -8);
parent.rotation.y = Math.PI / 3;
scene.add(parent);
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
parent.add(mesh);
let part = {
  blockId: 'selected-core', key: 'space:child:0,0,0', type: 'Core',
  assemblySpaceId: 'space:child', x: 0, y: 0, z: 0
};
const statuses = [], moves = [];
let history = 0, autosaves = 0, linked = false, selection = null;
const craft = {
  revision: 4,
  getById(id) { return id === part.blockId ? part : null; },
  linksForBlock() { return linked ? [{ mechanicalLinkId: 'hinge' }] : []; },
  move(id, x, y, z) {
    if (id !== part.blockId) return { ok: false, reason: 'missing-block' };
    if (x === part.x && y === part.y && z === part.z) return { ok: true, reason: 'unchanged' };
    moves.push([id, x, y, z]);
    part = { ...part, x, y, z };
    this.revision += 1;
    return { ok: true, block: part };
  }
};
const state = { mode: 'BUILD', workshop: { selectedBlockId: null }, lastTestResult: null };
const fakeDocument = { getElementById: () => null, querySelectorAll: () => [] };
const controller = Selection.create({
  THREE, camera, scene, state, craft,
  workshop: { meshesByKey: new Map([[part.key, mesh]]) },
  document: fakeDocument,
  callbacks: {
    hitBlock() { return { block: part, root: mesh }; },
    collectBlueprint() { return { original: true }; },
    commitHistory() { history += 1; },
    autoSave() { autosaves += 1; },
    showStatus(msg) { statuses.push(msg); },
    setActiveAssemblySpace() { return true; },
    onSelectionChanged(block) { selection = block?.blockId || null; }
  }
});
const start = new THREE.Vector2(0, 0);
// Real nested world-space transforms must be respected.
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.finishDrag(start, false), false, 'stationary Select click stays a click');
assert.strictEqual(history, 0);
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(new THREE.Vector2(0.2, 0.2), true), true);
assert.strictEqual(controller.cancelDrag(), true, 'Escape/pointercancel must be able to discard preview');
assert.strictEqual(history, 0);
assert.strictEqual(moves.length, 0, 'preview is not a CraftModel mutation');
assert.strictEqual(controller.cancelDrag(), false, 'cancel is idempotent');

assert.strictEqual(controller.beginDrag(start), true);
const destination = new THREE.Vector2(0.22, -0.12);
assert.strictEqual(controller.previewDrag(destination, true), true);
assert.strictEqual(history, 0, 'dragging never commits history before release');
assert.strictEqual(autosaves, 0);
assert.strictEqual(controller.finishDrag(destination, true), true);
assert.strictEqual(moves.length, 1, 'a true drag with snapped delta changes one authored block');
assert.strictEqual(history, 1, 'drag must create exactly one undo entry');
assert.strictEqual(autosaves, 1, 'drag schedules exactly one save');
assert.strictEqual(part.blockId, 'selected-core', 'moving preserves authored identity');
assert.strictEqual(part.y, 0, 'planar gesture preserves local elevation');
assert.strictEqual(selection, 'selected-core', 'selected part stays selected after editing');

// A linked part must never be displaced by the new gesture.
linked = true;
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(destination, true), true);
assert.strictEqual(controller.finishDrag(destination, true), true);
assert.strictEqual(moves.length, 1);
assert(statuses.includes('MOVE BLOCKED • MECHANICALLY-LINKED'));
linked = false;
state.mode = 'FLIGHT';
assert.strictEqual(controller.beginDrag(start), false, 'Select dragging is BUILD-only');
state.mode = 'BUILD';
console.log({ planarDrag: 'nested-parent-local-space', cancel: 'atomic', undoCommits: history, stableId: true, linkedGuard: true });
