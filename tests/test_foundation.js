const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

const sourceFiles = [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/blueprint.js',
  'src/foundation/craft_model.js',
  'src/foundation/craft_history.js',
  'src/foundation/control_frame.js',
  'src/foundation/mass_properties.js',
  'src/foundation/craft_compiler.js',
  'src/foundation/runtime_assembly.js',
  'src/foundation/input_profile.js',
  'src/foundation/ui_workspace.js',
  'src/foundation/mission_evaluator.js',
  'src/foundation/aerostatics.js',
  'src/foundation/flight_control.js',
  'src/foundation/state.js',
  'src/runtime/physics_port.js',
  'src/runtime/cannon_physics_backend.js',
  'src/runtime/headless_physics_backend.js',
  'src/runtime/assembly_builder.js',
  'src/foundation/bootstrap.js'
];
for (const relative of sourceFiles) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const { Config, Catalog, Orientation, Blueprint, CraftModel, CraftHistory, ControlFrame, MassProperties, CraftCompiler, RuntimeAssembly, AssemblyBuilder, HeadlessPhysicsBackend, InputProfile, UIWorkspace, MissionEvaluator, Aerostatics, FlightControl, State, PhysicsPort, Physics, Capabilities } = global.VAW_RUNTIME;
assert(Object.isFrozen(Config));
assert(Object.isFrozen(Config.GRID));
assert.strictEqual(Config.SAVE_VERSION, 10);
assert.strictEqual(Config.TEST_RANGE.maxAltitude, 160);
assert.strictEqual(typeof Config.PHYSICS.wingStallStart, 'number');
assert(Object.isFrozen(Catalog.BLOCKS));
assert(Object.isFrozen(Catalog.CONTRACTS));
assert.strictEqual(Catalog.getContractById('courier').payloadMass, 10);
assert.strictEqual(Catalog.getContractById('missing'), null);
assert(Catalog.knownContractIds().has('heavy_lift'));
assert.strictEqual(Capabilities.physicsBackend, 'cannon');
assert.strictEqual(Capabilities.physicsBoundary, 'phase-1d3e-neutral-assembly-api');
assert.strictEqual(Capabilities.runtimeAssembly, 'runtime-builder-v1');
assert.strictEqual(Capabilities.headlessHarness, 'deterministic-free-flight-v1');
assert.strictEqual(Capabilities.missionEvaluation, 'phase-1d2b-multi-pad-ground-state');
assert.strictEqual(Capabilities.aerostatics, 'altitude-lift-damped-settling-v2');
assert.strictEqual(Capabilities.platform, 'desktop-keyboard-mouse-v1');
assert.strictEqual(Capabilities.workspaceState, 'version-3-z-order');
assert.strictEqual(typeof Physics.createWorld, 'function');
assert.strictEqual(typeof PhysicsPort.normalizeBodyDescriptor, 'function');
assert.strictEqual(Orientation.ORIENTATION_BASES.length, 24);
assert(Object.isFrozen(Orientation.ORIENTATION_BASES[0].forward));
assert(Object.isFrozen(Orientation.ORIENTATION_BASES[0].quaternion));
assert.strictEqual(new Set(Orientation.ORIENTATION_BASES.map(basis => `${basis.forward.x},${basis.forward.y},${basis.forward.z}|${basis.up.x},${basis.up.y},${basis.up.z}`)).size, 24);

const firstState = State.createInitialState();
const secondState = State.createInitialState();
assert(firstState.craft.add({ x: 0, y: 0, z: 0, type: 'Core', orientation: 0 }).ok);
firstState.workshop.meshesByKey.set('0,0,0', { fake: true });
firstState.input.controlActions.add('pitch+');
assert.strictEqual(secondState.craft.size, 0, 'State factory must not share craft models.');
assert.strictEqual(secondState.workshop.meshesByKey.size, 0, 'State factory must not share workshop view maps.');
assert.strictEqual(secondState.input.controlActions.size, 0, 'State factory must not share mutable sets.');
assert.notStrictEqual(firstState.flight.com, secondState.flight.com, 'State factory must not share vectors.');
assert.strictEqual(typeof CraftModel.create, 'function');
assert.strictEqual(typeof CraftHistory.create, 'function');
assert.strictEqual(typeof MassProperties.compute, 'function');
assert.strictEqual(typeof CraftCompiler.compile, 'function');
assert.strictEqual(typeof AssemblyBuilder.build, 'function');
assert.strictEqual(typeof HeadlessPhysicsBackend.create, 'function');
assert.strictEqual(typeof FlightControl.actionForInput, 'function');
assert.notStrictEqual(firstState.history, secondState.history, 'State factory must not share history instances.');
assert.notStrictEqual(firstState.input.profile, secondState.input.profile, 'State factory must not share input profiles.');
assert.notStrictEqual(firstState.uiWorkspace, secondState.uiWorkspace, 'State factory must not share UI workspace state.');
assert.strictEqual(firstState.input.profile.axes.pitch.invert, true, 'Default profile must correct the legacy pitch direction.');
const movedWorkspace = UIWorkspace.updatePanel(firstState.uiWorkspace, 'controls', { open: true, width: 420 });
assert.strictEqual(movedWorkspace.panels.controls.open, true);
assert.strictEqual(movedWorkspace.panels.controls.width, 420);
assert.strictEqual(firstState.uiWorkspace.panels.controls.open, false, 'Workspace updates must be immutable.');
assert.strictEqual(UIWorkspace.WORKSPACE_VERSION, 3);
assert.strictEqual(typeof MissionEvaluator.evaluateLanding, 'function');
assert.strictEqual(typeof MissionEvaluator.advanceHold, 'function');
assert.strictEqual(typeof MissionEvaluator.evaluateLandingZones, 'function');
assert.strictEqual(typeof Aerostatics.requiredPowerForHover, 'function');
assert.strictEqual(typeof Aerostatics.requiredSupplementalPowerForHover, 'function');
const migratedWorkspace = UIWorkspace.normalize({
  version: 1,
  panels: { build: { open: true, x: 9000, y: 9000, width: 260, height: 160 } }
});
assert.strictEqual(migratedWorkspace.panels.build.open, true, 'Workspace migration must preserve visibility preferences.');
assert.strictEqual(migratedWorkspace.panels.build.x, UIWorkspace.DEFAULT_PANELS.build.x, 'Legacy geometry must reset after the scroll-shell migration.');
assert.strictEqual(migratedWorkspace.panels.build.height, UIWorkspace.DEFAULT_PANELS.build.height);
const migratedV2Workspace = UIWorkspace.normalize({
  version: 2,
  panels: { controls: { open: true, x: 111, y: 122, width: 444, height: 555 } }
});
assert.strictEqual(migratedV2Workspace.panels.controls.x, 111, 'Version 2 geometry must survive the z-order migration.');
assert.strictEqual(migratedV2Workspace.panels.controls.height, 555);
assert.deepStrictEqual([...migratedV2Workspace.zOrder].sort(), [...UIWorkspace.PANEL_IDS].sort(), 'Every panel must appear exactly once in z-order.');
const focusedWorkspace = UIWorkspace.focusPanel(migratedV2Workspace, 'controls');
assert.strictEqual(focusedWorkspace.zOrder.at(-1), 'controls');
assert.strictEqual(UIWorkspace.topPanel(focusedWorkspace), 'controls');
assert.strictEqual(UIWorkspace.topPanel(focusedWorkspace, id => id !== 'controls'), 'telemetry');
const fittedWorkspaceRect = UIWorkspace.fitPanelRect(
  { open: true, minimized: false, x: 9999, y: 9999, width: 900, height: 1200 },
  { width: 800, height: 600 },
  { panelId: 'build', topInset: 72 }
);
assert(fittedWorkspaceRect.left >= 8 && fittedWorkspaceRect.top >= 72);
assert(fittedWorkspaceRect.left + fittedWorkspaceRect.width <= 792, 'Panel must remain horizontally reachable.');
assert(fittedWorkspaceRect.top + fittedWorkspaceRect.height <= 592, 'Panel must remain vertically reachable.');

const valid = Blueprint.normalize({
  version: 7,
  selectedBlock: 'Wing',
  orientation: Orientation.DEFAULT_ORIENTATION,
  symmetry: 'X',
  thrusterPower: 0.8,
  balloonPower: 0.4,
  stabilityAssist: 0.2,
  blocks: [
    { x: 0, y: 0, z: 0, type: 'Core', orientation: 0 },
    { x: 1, y: 0, z: 0, type: 'Hull', orientation: 0 },
    { x: 2, y: 0, z: 0, type: 'Wing', orientation: 0, controlAxis: 'roll', controlSign: -1 }
  ]
});
assert(valid);
assert.strictEqual(valid.blocks.length, 3);
assert.strictEqual(valid.selectedBlock, 'Wing');
assert.strictEqual(valid.blocks[2].controlAxis, 'roll');
assert.strictEqual(valid.blocks[2].controlSign, -1);


const rotatedCoreOrientation = Orientation.findOrientationId(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0)
);
const legacyCoreDocument = Blueprint.normalize({ version: 8, blocks: [
  { x: 0, y: 0, z: 0, type: 'Core', orientation: rotatedCoreOrientation }
] });
assert.strictEqual(legacyCoreDocument.blocks[0].orientation, Orientation.DEFAULT_ORIENTATION, 'Legacy Core orientation must remain compatible.');
const orientedCoreDocument = Blueprint.normalize({ version: 9, blocks: [
  { x: 0, y: 0, z: 0, type: 'Core', orientation: rotatedCoreOrientation }
] });
assert.strictEqual(orientedCoreDocument.blocks[0].orientation, rotatedCoreOrientation, 'Version 9+ must preserve oriented Core control frames.');
assert(orientedCoreDocument.blocks[0].blockId, 'Legacy documents must receive persistent block ids.');
assert.strictEqual(typeof RuntimeAssembly.createPlan, 'function');

assert.strictEqual(Blueprint.normalize({ version: 10, blocks: [
  { blockId: 'same', x: 0, y: 0, z: 0, type: 'Core' },
  { blockId: 'same', x: 1, y: 0, z: 0, type: 'Hull' }
] }), null, 'Version 10 must reject ambiguous duplicate block identities.');
assert.strictEqual(Blueprint.normalize({ version: 999, blocks: [] }), null, 'Future save versions must be rejected.');
assert.strictEqual(Blueprint.normalize({ version: 7, blocks: [
  { x: 0, y: 0, z: 0, type: 'Core' },
  { x: 2, y: 0, z: 0, type: 'Hull' }
] }), null, 'Disconnected documents must be rejected.');
assert.strictEqual(Blueprint.normalize({ version: 7, blocks: [
  { x: 0, y: 0, z: 0, type: 'Core' },
  { x: 1.5, y: 0, z: 0, type: 'Hull' }
] }), null, 'Fractional voxel coordinates must be rejected.');

const migrated = Blueprint.normalize({ version: 3, blocks: [
  { x: 1, y: 0, z: 0, type: 'Hull', orientation: 0 }
] });
assert(migrated);
assert(migrated.blocks.some(block => block.type === 'Core' && block.x === 0 && block.y === 0 && block.z === 0));

const document = Blueprint.createDocument({
  blocks: [
    { x: 1, y: 0, z: 0, type: 'Hull', orientation: 0 },
    { x: 0, y: 0, z: 0, type: 'Core', orientation: 5 }
  ],
  selectedBlock: 'Core', selectedOrientation: -1, symmetry: 'invalid',
  thrusterPower: 2, balloonPower: -1, stabilityAssist: 0.5,
  controlAxis: 'invalid', controlSign: 99
});
assert.strictEqual(document.version, 10);
assert.strictEqual(document.blocks[0].type, 'Core');
assert.strictEqual(document.selectedBlock, 'Core');
assert.strictEqual(document.symmetry, 'NONE');
assert.strictEqual(document.thrusterPower, 1);
assert.strictEqual(document.balloonPower, 0);
assert.strictEqual(document.controlAxis, 'pitch');
assert.strictEqual(document.controlSign, 0);

const history = [1, 2, 3, 4].map(size => ({ blocks: Array.from({ length: size }, (_, index) => ({ index })) }));
Blueprint.trimHistory(history, 3, 7);
assert(history.length <= 3);
assert(history.reduce((sum, entry) => sum + entry.blocks.length, 0) <= 7 || history.length === 1);

assert.throws(() => global.VAW.define('foundation.config', [], () => ({})), /already defined/);
console.log(JSON.stringify({
  modules: global.VAW.inspect(),
  orientationBases: Orientation.ORIENTATION_BASES.length,
  stateIsolation: 'ok',
  blueprintValidation: 'ok',
  migration: 'ok',
  immutableCatalogs: 'ok'
}, null, 2));
