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
const otherPart = { blockId: 'another-part', key: 'space:child:3,0,0', type: 'Hull', assemblySpaceId: 'space:child', x: 3, y: 0, z: 0 };
const statuses = [], moves = [];
let history = 0, autosaves = 0, linked = false, selection = null, checkPreviewOccupancy = false;
const craft = {
  revision: 4,
  getById(id) { return id === part.blockId ? part : id === otherPart.blockId ? otherPart : null; },
  validateMove(id, x, y, z) {
    const occupied = checkPreviewOccupancy && id === part.blockId
      && x === otherPart.x && y === otherPart.y && z === otherPart.z;
    return occupied ? { ok: false, reason: 'occupied' } : { ok: true };
  },
  linksForBlock() { return linked ? [{ mechanicalLinkId: 'hinge' }] : []; },
  move(id, x, y, z) {
    const block = this.getById(id);
    if (!block) return { ok: false, reason: 'missing-block' };
    if (x === block.x && y === block.y && z === block.z) return { ok: true, reason: 'unchanged' };
    moves.push([id, x, y, z]);
    if (id === part.blockId) part = { ...part, x, y, z };
    else Object.assign(otherPart, { x, y, z });
    this.revision += 1;
    return { ok: true, block: this.getById(id) };
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
const visualHome = mesh.position.clone();
const worldHome = mesh.getWorldPosition(new THREE.Vector3()).clone();
assert.strictEqual(controller.previewDrag(new THREE.Vector2(0.2, 0.2), true), true);
const previewOutline = scene.children.find(item => item.material?.color?.getHex?.() === 0xfbbf24);
assert(previewOutline?.visible && previewOutline.position.length() > 0,
  'Falsifier setup must create a visible non-zero proposed move.');
assert(!mesh.position.equals(visualHome),
  'The visible part itself must follow the snapped pointer preview, not just its bounding outline.');
const previewWorldDelta = mesh.getWorldPosition(new THREE.Vector3()).sub(worldHome);
assert(previewWorldDelta.distanceTo(previewOutline.position) < 1e-6,
  'Nested rotated assembly-space live visual must coincide exactly with the preview outline.');
assert.strictEqual(controller.cancelDrag(), true, 'Escape/pointercancel must be able to discard preview');
assert(mesh.position.equals(visualHome), 'Cancelled preview restores exact local render transform.');
assert(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(worldHome) < 1e-6,
  'Cancelled preview restores world transform even in a rotated assembly.');
assert.strictEqual(history, 0);
assert.strictEqual(moves.length, 0, 'preview is not a CraftModel mutation');
assert.strictEqual(controller.cancelDrag(), false, 'cancel is idempotent');

assert.strictEqual(controller.beginDrag(start), true);
const destination = new THREE.Vector2(0.22, -0.12);
assert.strictEqual(controller.previewDrag(destination, true), true);
assert(!mesh.position.equals(visualHome), 'Real geometry follows valid preview before commit.');
assert.strictEqual(history, 0, 'dragging never commits history before release');
assert.strictEqual(autosaves, 0);
assert.strictEqual(controller.finishDrag(destination, true), true);
assert(mesh.position.equals(visualHome), 'Preview visual is restored before the authoritative authored move.');
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

// Reset the fixture's rendered position to match its authoritative authored
// position; the earlier mocked CraftModel.move does not trigger a real
// WORKSHOP visual rebuild. Without this, the candidate displacement can be
// a no-op and the negative tests falsely pass.
part = { ...part, x: 0, y: 0, z: 0 };
mesh.position.set(0, 0, 0);
controller.select(part.blockId);
function assertNonzeroPreview(label) {
  const candidate = scene.children.find(item => item.material?.color?.getHex?.() === 0xfbbf24);
  assert(candidate?.visible && candidate.position.length() > 0.001,
    label + ': regression setup must have a real visible nonzero candidate offset');
}

// Falsifier A: final ray missing the drag plane must not commit the previously
// projected destination. A temporary deterministic Raycaster shim simulates a
// pointer ray parallel to the local plane while retaining real Three math.
const RealRaycaster = THREE.Raycaster;
THREE.Raycaster = class extends RealRaycaster {
  setFromCamera(ndc, activeCamera) {
    super.setFromCamera(ndc, activeCamera);
    if (ndc.x === 1000) this.ray.direction.set(1, 0, 0); // horizontal, parallel to XZ
  }
};
const invalidPoint = new THREE.Vector2(1000, 0);
const beforeInvalidMoves = moves.length, beforeInvalidHistory = history;
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(destination, true), true);
assertNonzeroPreview('invalid final ray');
assert.strictEqual(controller.finishDrag(invalidPoint, true), true);
assert.strictEqual(moves.length, beforeInvalidMoves,
  'Invalid final cursor projection must not commit stale last-good preview coordinates');
assert.strictEqual(history, beforeInvalidHistory,
  'Invalid final cursor projection must not create an Undo entry');
THREE.Raycaster = RealRaycaster;

// Falsifier B: the authored identity captured on pointerdown cannot change
// just because another inspector action updates selection during the drag.
const beforeSelectionMoves = moves.length;
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(destination, true), true);
assertNonzeroPreview('selection changes mid-drag');
assert.strictEqual(controller.select(otherPart.blockId).ok, true);
assert.strictEqual(controller.finishDrag(destination, true), false,
  'Selecting another part cancels the previous transient drag session');
assert.strictEqual(moves.length, beforeSelectionMoves,
  'Releasing a drag after selection changes must never move the newly selected part');
assert.strictEqual(otherPart.x, 3);

// Defense-in-depth: even when integration bypasses the controller's select(),
// a changed selectedBlockId must never redirect the drag commit to another part.
assert.strictEqual(controller.select(part.blockId).ok, true);
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(destination, true), true);
assertNonzeroPreview('directly replaced selection');
state.workshop.selectedBlockId = otherPart.blockId;
assert.strictEqual(controller.finishDrag(destination, true), true);
assert.strictEqual(moves.length, beforeSelectionMoves);
assert.strictEqual(otherPart.x, 3);

// Occupied preview is visually invalid before release; the attempt must never
// mutate authored state. First obtain a guaranteed nonzero world-space outline.
state.workshop.selectedBlockId = part.blockId;
assert.strictEqual(controller.beginDrag(start), true);
assert.strictEqual(controller.previewDrag(destination, true), true);
assertNonzeroPreview('collision falsifier setup');
const candidateOutline = scene.children.find(item => item.material?.color?.getHex?.() === 0xfbbf24);
const proposedWorld = mesh.getWorldPosition(new THREE.Vector3()).add(candidateOutline.position);
const proposedLocal = parent.worldToLocal(proposedWorld);
otherPart.x = Math.round(proposedLocal.x);
otherPart.y = part.y;
otherPart.z = Math.round(proposedLocal.z);
checkPreviewOccupancy = true;
const beforeRejectedPreviewMoves = moves.length, beforeRejectedPreviewHistory = history;
assert.strictEqual(controller.previewDrag(destination, true), true);
assert.strictEqual(candidateOutline.material.color.getHex(), 0xfb7185,
  'Occupied destination must be visibly rejected before pointer release');
assert(mesh.position.equals(visualHome), 'Invalid candidate cannot drag solid visual into an occupied cell.');
assert.strictEqual(controller.finishDrag(destination, true), true);
assert.strictEqual(moves.length, beforeRejectedPreviewMoves, 'Occupied preview must not trigger a commit');
assert.strictEqual(history, beforeRejectedPreviewHistory, 'Occupied preview must not create Undo history');
checkPreviewOccupancy = false;
console.log({ planarDrag: 'nested-parent-local-space', cancel: 'atomic', undoCommits: history,
  stableId: true, linkedGuard: true, invalidRelease: 'rejected', selectionRace: 'rejected' });
