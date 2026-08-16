const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests/browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/blueprint.js',
  'src/foundation/diagnostics.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/craft_model.js',
  'src/foundation/control_frame.js',
  'src/foundation/mass_properties.js',
  'src/foundation/structural_graph_compiler.js',
  'src/foundation/mechanical_authoring_resolver.js',
  'src/foundation/rigid_island_compiler.js',
  'src/foundation/mechanical_graph_compiler.js',
  'src/foundation/craft_compiler.js',
  'src/foundation/runtime_assembly.js',
  'src/foundation/input_profile.js',
  'src/foundation/flight_control.js',
  'src/foundation/mission_evaluator.js',
  'src/game/engineering_analysis.js',
  'src/game/mission_controller.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const CraftModel = VAW.require('foundation.craft-model');
const Orientation = VAW.require('foundation.orientation');
const EngineeringAnalysis = VAW.require('game.engineering-analysis');
const MissionController = VAW.require('game.mission-controller');

const ROOT_SPACE = 'space:root';
const CHILD_SPACE = 'space:child';
const state = { mode: 'BUILD', thrusterPower: 0.7, balloonPower: 0.7, mission: {} };
const documentRef = { getElementById: () => null };
const controlAxisVector = axis => axis === 'roll'
  ? new THREE.Vector3(1, 0, 0)
  : (axis === 'yaw' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1));

function createAnalysis(craft) {
  return EngineeringAnalysis.create({
    THREE,
    state,
    craft,
    document: documentRef,
    aerostaticPolicy: { gravity: 9.81 },
    controlAxisVector,
    markers: {}
  });
}

function buildArticulatedCraft({ withSecondaryControls = false } = {}) {
  const craft = CraftModel.create();
  let result = craft.createAssemblySpace({
    assemblySpaceId: CHILD_SPACE,
    name: 'Child',
    localPose: { position: [2, 0, 0], quaternion: [0, 0, 0, 1] }
  });
  assert(result.ok, result.reason);

  const blocks = [
    { blockId: 'core', assemblySpaceId: ROOT_SPACE, x: 0, y: 0, z: 0, type: 'Core', orientation: Orientation.DEFAULT_ORIENTATION },
    { blockId: 'root-frame', assemblySpaceId: ROOT_SPACE, x: 1, y: 0, z: 0, type: 'Frame', orientation: Orientation.DEFAULT_ORIENTATION },
    { blockId: 'child-a', assemblySpaceId: CHILD_SPACE, x: 0, y: 0, z: 0, type: 'Hull', orientation: Orientation.DEFAULT_ORIENTATION },
    { blockId: 'child-b', assemblySpaceId: CHILD_SPACE, x: 1, y: 0, z: 0, type: 'Frame', orientation: Orientation.DEFAULT_ORIENTATION },
    { blockId: 'child-c', assemblySpaceId: CHILD_SPACE, x: 2, y: 0, z: 0, type: 'Hull', orientation: Orientation.DEFAULT_ORIENTATION }
  ];
  if (withSecondaryControls) {
    blocks.push(
      { blockId: 'child-thruster', assemblySpaceId: CHILD_SPACE, x: 3, y: 0, z: 0, type: 'Thruster', orientation: Orientation.DEFAULT_ORIENTATION },
      { blockId: 'child-gyro', assemblySpaceId: CHILD_SPACE, x: 1, y: 1, z: 0, type: 'Gyro', orientation: Orientation.DEFAULT_ORIENTATION },
      { blockId: 'fuel', assemblySpaceId: ROOT_SPACE, x: 0, y: 1, z: 0, type: 'Fuel', orientation: Orientation.DEFAULT_ORIENTATION }
    );
  }
  result = craft.addMany(blocks);
  assert(result.ok, result.reason);

  result = craft.addMechanicalLink({
    mechanicalLinkId: 'hinge',
    kind: 'hinge',
    endpointA: { blockId: 'root-frame', face: 'PX' },
    endpointB: { blockId: 'child-a', face: 'NX' },
    axis: 'PY',
    collideConnected: false,
    maxForce: 1000000,
    frictionTorque: 0,
    limits: null
  });
  assert(result.ok, result.reason);
  return craft;
}

// Reproduces the P1 defect: root/assembly positions must not be used to reconstruct
// per-space rigid adjacency. Compiled rigidNeighborBlockIds is the topology authority.
const topologyAnalysis = createAnalysis(buildArticulatedCraft()).computeCraftAnalysis();
assert.strictEqual(topologyAnalysis.snapshot.ready, true);
const expectedWeakLinks = topologyAnalysis.snapshot.parts.filter(part =>
  part.type !== 'Core' && part.rigidNeighborBlockIds.length <= 1
).length;
const expectedExposedFuel = topologyAnalysis.snapshot.parts.filter(part =>
  part.type === 'Fuel' && part.rigidNeighborBlockIds.length <= 2
).length;
assert.strictEqual(expectedWeakLinks, 3, 'fixture must preserve the reproduced P1 weak-link boundary');
assert.strictEqual(topologyAnalysis.weakLinks, expectedWeakLinks, 'weak-link analysis must use compiled rigid adjacency');
assert.strictEqual(topologyAnalysis.exposedFuel, expectedExposedFuel, 'fuel exposure must use compiled rigid adjacency');

// Articulated control is deliberately scoped rather than faked: runtime pilot-routes
// secondary thrusters, while this estimator only computes primary-body local authority.
const articulatedAnalysisApi = createAnalysis(buildArticulatedCraft({ withSecondaryControls: true }));
const articulated = articulatedAnalysisApi.computeCraftAnalysis();
const controls = articulatedAnalysisApi.computeControlMetrics(articulated.snapshot);
assert.strictEqual(controls.controlScope, 'primary-body-local');
assert.strictEqual(controls.bodyCount, 2);
assert.strictEqual(controls.articulated, true);
assert.strictEqual(controls.secondaryPilotThrusterCount, 1);
assert.strictEqual(controls.primaryGyroCount, 0, 'secondary-body Gyro must not inflate primary-body manual authority');
assert.strictEqual(articulated.controlScope, 'primary-body-local');
assert.strictEqual(articulated.controlArticulated, true);
assert(articulated.warnings.some(item => item.text.includes('joint-coupled articulated response is not estimated')));
assert(articulated.warnings.some(item => item.text.includes('pilot-routed at runtime')));
assert(articulated.warnings.some(item => item.text.includes('secondary-body gyros are not pilot-controlled')));

// Mission readiness must not present the primary-body estimate as whole-craft truth.
const mission = MissionController.create({
  THREE,
  Physics: {},
  state,
  craft: {},
  document: documentRef,
  landingPolicy: {},
  missionMarkerGroup: {},
  services: { flightSession: {} },
  callbacks: {
    computeCraftAnalysis: () => articulated,
    buildLoadedSnapshot: () => ({ mass: 42, weight: 100 }),
    computeControlMetrics: () => ({
      controlRating: { pitch: 0.01, yaw: 0.01, roll: 0.01 },
      articulated: true,
      secondaryPilotThrusterCount: 1
    })
  }
});
const readiness = mission.contractReadiness({
  id: 'test-route',
  kind: 'gate-course',
  payloadMass: 0,
  minFuelFraction: 0
}, {
  ...articulated,
  counts: { ...articulated.counts, Thruster: 1, VectorThruster: 0, Balloon: 0 },
  fuelCapacity: 10,
  blockCount: 8,
  staticLift: 100,
  cruiseLift: 100,
  enduranceSeconds: 120
});
assert.strictEqual(readiness.level, 'warn');
assert(readiness.text.includes('primary-body local authority only'));
assert(readiness.text.includes('pilot-routes 1 secondary-body thruster'));
assert(!readiness.text.includes('falls to 1% on the weakest axis'), 'articulated readiness must not present a partial metric as whole-craft truth');

const singleBodyMission = MissionController.create({
  THREE,
  Physics: {},
  state,
  craft: {},
  document: documentRef,
  landingPolicy: {},
  missionMarkerGroup: {},
  services: { flightSession: {} },
  callbacks: {
    computeCraftAnalysis: () => articulated,
    buildLoadedSnapshot: () => ({ mass: 42, weight: 100 }),
    computeControlMetrics: () => ({
      controlRating: { pitch: 0.01, yaw: 0.02, roll: 0.03 },
      articulated: false,
      secondaryPilotThrusterCount: 0
    })
  }
});
const singleBodyReadiness = singleBodyMission.contractReadiness({
  id: 'single-route', kind: 'gate-course', payloadMass: 0, minFuelFraction: 0
}, {
  ...articulated,
  counts: { ...articulated.counts, Thruster: 1, VectorThruster: 0, Balloon: 0 },
  fuelCapacity: 10, blockCount: 8, staticLift: 100, cruiseLift: 100, enduranceSeconds: 120
});
assert.strictEqual(singleBodyReadiness.level, 'warn');
assert(singleBodyReadiness.text.includes('Loaded primary-body control authority falls to 1% on the weakest axis.'));
assert(!singleBodyReadiness.text.includes('articulated craft'));

console.log({
  engineeringTopology: 'compiled-adjacency',
  weakLinks: topologyAnalysis.weakLinks,
  controlScope: controls.controlScope,
  articulatedBodies: controls.bodyCount,
  secondaryPilotThrusters: controls.secondaryPilotThrusterCount,
  missionReadiness: 'scoped-not-faked'
});
