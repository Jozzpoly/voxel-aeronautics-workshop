const assert = require('assert');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load([...FOUNDATION_SOURCES, 'src/game/assembly_space_controller.js'], { stubs: true });

const Blueprint = VAW.require('foundation.blueprint');
const CraftModel = VAW.require('foundation.craft-model');
const Controller = VAW.require('game.assembly-space-controller');

class Element {
  constructor(id = '') { this.id = id; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.children = []; this.listeners = {}; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const ids = ['assembly-space-list', 'assembly-space-name', 'ui-assembly-space-status', 'btn-delete-assembly-space', 'btn-create-assembly-space', 'btn-rename-assembly-space', 'btn-move-hovered-to-space'];
const elements = new Map(ids.map(id => [id, new Element(id)]));
const document = { getElementById: id => elements.get(id) || null, createElement: () => new Element() };
const scene = new THREE.Group();
const craft = CraftModel.create();
const state = { workshop: { mechanicalAuthoring: { firstBlockId: null } } };
let commits = 0;
const controller = Controller.create({
  THREE, craft, state, scene, document,
  callbacks: {
    collectBlueprint: () => craft.toDocument(),
    commitHistory: () => { commits += 1; },
    autoSave() {}, updateTelemetry() {}, updateGhost() {}, showStatus() {},
    compileCraft: () => VAW.require('foundation.craft-compiler').compile(craft)
  }
});

assert.strictEqual(controller.activeAssemblySpaceId(), 'space:root');
assert.strictEqual(controller.roots.size, 1);
assert(craft.add({ blockId: 'root-edge', assemblySpaceId: 'space:root', x: 1, y: 0, z: 0, type: 'Hull', orientation: 0, controlAxis: 'pitch', controlSign: 0 }).ok);
const created = controller.createSpace('Arm');
assert(created.ok, created.reason);
const childId = created.assemblySpace.assemblySpaceId;
assert.strictEqual(controller.activeAssemblySpaceId(), childId);
assert.strictEqual(controller.groupFor(childId).parent, controller.groupFor('space:root'));
assert(controller.renameActiveSpace('Articulated Arm').ok);
assert.strictEqual(craft.getAssemblySpace(childId).name, 'Articulated Arm');
const childOffset = craft.getAssemblySpace(childId).localPose.position[0];
assert(craft.add({ blockId: 'arm-edge', assemblySpaceId: childId, x: -childOffset, y: 0, z: 0, type: 'Hull', orientation: 0, controlAxis: 'pitch', controlSign: 0 }).ok);
const visual = new THREE.Group();
controller.attachBlockVisual(craft.getById('arm-edge'), visual);
assert.strictEqual(visual.parent, controller.groupFor(childId));
assert.strictEqual(controller.blockRootPosition(craft.getById('arm-edge'))[0], 0);
// Move root endpoint so cross-space blocks share a face.
assert(craft.move('root-edge', -1, 0, 0).ok);
assert.strictEqual(controller.authorHingeEndpoint('root-edge', 'PY'), true);
assert.strictEqual(controller.authorHingeEndpoint('arm-edge', 'PY'), true);
assert.strictEqual(craft.mechanicalLinks().length, 1);
controller.setActiveAssemblySpace('space:root');
assert(controller.moveBlockToActive('arm-edge').ok);
assert.strictEqual(craft.getById('arm-edge').assemblySpaceId, 'space:root');
controller.setActiveAssemblySpace(childId);
assert(controller.deleteActiveSpace().ok);
assert.strictEqual(craft.getAssemblySpace(childId), null);
assert.strictEqual(controller.roots.has(childId), false);
assert(commits >= 4);
assert.deepStrictEqual(Blueprint.normalize(craft.toDocument()), craft.toDocument());

console.log({ assemblySpaceController: 'ok', authoring: 'ok', hierarchy: 'ok', historyCommits: commits });
