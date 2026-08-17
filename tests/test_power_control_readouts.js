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
  'src/foundation/input_profile.js',
  'src/foundation/aerostatics.js',
  'src/game/power_control_readouts.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const InputProfile = VAW.require('foundation.input-profile');
const Aerostatics = VAW.require('foundation.aerostatics');
const PowerControlReadouts = VAW.require('game.power-control-readouts');

function createElement() {
  const classes = new Set();
  return {
    style: {},
    textContent: '',
    innerHTML: '',
    title: '',
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    }
  };
}

function createDocument() {
  const elements = new Map();
  for (const id of [
    'ui-thruster-power',
    'ui-balloon-power',
    'ui-stability',
    'ui-vertical-support',
    'ui-thruster-hover-marker',
    'ui-thruster-climb-zone',
    'ui-thruster-guidance',
    'ui-balloon-hover-marker',
    'ui-balloon-climb-zone',
    'ui-balloon-guidance'
  ]) {
    elements.set(id, createElement());
  }
  return {
    elements,
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

function createState(overrides = {}) {
  return {
    mode: 'BUILD',
    thrusterPower: 0.5,
    balloonPower: 0.5,
    stabilityAssist: 0.25,
    input: { profile: InputProfile.createDefault() },
    flight: {
      analysis: null,
      functionalBlocks: [],
      runtimeMass: 0
    },
    ...overrides
  };
}

const policy = Aerostatics.normalizePolicy({
  gravity: 10,
  minimumEfficiency: 0.1,
  scaleHeight: 100
});

assert.throws(() => PowerControlReadouts.create(), /require state/);
assert.throws(() => PowerControlReadouts.create({
  state: createState(),
  document: createDocument(),
  THREE,
  InputProfile: {},
  Aerostatics,
  computeCraftAnalysis: () => ({ mass: 0, snapshot: { parts: [] } })
}), /InputProfile and Aerostatics/);
assert.throws(() => PowerControlReadouts.create({
  state: createState(),
  document: createDocument(),
  THREE,
  InputProfile,
  Aerostatics
}), /computeCraftAnalysis/);

const state = createState();
const documentRef = createDocument();
const readouts = PowerControlReadouts.create({
  state,
  document: documentRef,
  THREE,
  InputProfile,
  Aerostatics,
  aerostaticPolicy: policy,
  getPrimaryFlightBodyId: () => (state.mode === 'FLIGHT' ? 'body:primary' : null),
  currentAerostaticAltitude: () => 10,
  computeCraftAnalysis: () => ({
    mass: 10,
    snapshot: {
      parts: [
        { type: 'Balloon', def: { force: 60 }, basis: { chord: { y: 0 } } },
        { type: 'Thruster', def: { force: 40 }, basis: { chord: { y: 1 } } }
      ]
    }
  }),
  runtimePartHealthFraction: part => part.health ?? 1
});

readouts.syncPowerControlReadouts();
assert.strictEqual(documentRef.getElementById('ui-thruster-power').textContent, '50%');
assert.strictEqual(documentRef.getElementById('ui-balloon-power').textContent, '50%');
assert.strictEqual(documentRef.getElementById('ui-stability').textContent, '25%');
assert.strictEqual(documentRef.getElementById('ui-vertical-support').textContent, '0.50\u00d7 weight');
assert(documentRef.getElementById('ui-thruster-guidance').innerHTML.includes('175% required'));
assert(documentRef.getElementById('ui-thruster-guidance').innerHTML.includes('selected: descend'));
assert(documentRef.getElementById('ui-thruster-hover-marker').classList.contains('unreachable'));
assert(documentRef.getElementById('ui-balloon-guidance').innerHTML.includes('133% required'));
assert.strictEqual(readouts.powerBindingHint('thrusterPower-', 'thrusterPower+'), '\u2212 / +');

const buildSample = readouts.verticalSupportSample();
assert.deepStrictEqual(buildSample, {
  altitude: 0,
  weight: 100,
  maxSeaLevelLift: 60,
  maxPassiveLift: 40
});

let computeCalls = 0;
const cachedAnalysisState = createState({
  flight: {
    analysis: {
      mass: 3,
      snapshot: {
        parts: [
          { type: 'Balloon', def: { force: 12 }, basis: { chord: { y: 0 } } },
          { type: 'Thruster', def: { force: 20 }, basis: { chord: { y: 1 } } }
        ]
      }
    },
    functionalBlocks: [],
    runtimeMass: 0
  }
});
const cachedAnalysis = PowerControlReadouts.create({
  state: cachedAnalysisState,
  document: createDocument(),
  THREE,
  InputProfile,
  Aerostatics,
  aerostaticPolicy: policy,
  computeCraftAnalysis: () => {
    computeCalls += 1;
    return { mass: 99, snapshot: { parts: [] } };
  }
});
assert.deepStrictEqual(cachedAnalysis.verticalSupportSample(), {
  altitude: 0,
  weight: 30,
  maxSeaLevelLift: 12,
  maxPassiveLift: 20
});
assert.strictEqual(computeCalls, 0, 'Cached build analysis must be used before recomputing.');

const sparseReadouts = PowerControlReadouts.create({
  state: createState(),
  document: { getElementById: () => null },
  THREE,
  InputProfile,
  Aerostatics,
  aerostaticPolicy: policy,
  computeCraftAnalysis: () => ({ mass: 0, snapshot: { parts: [] } })
});
assert.doesNotThrow(() => sparseReadouts.syncPowerControlReadouts(), 'Missing HUD nodes must not break readout sync.');

const noCraftDocument = createDocument();
const noCraftReadouts = PowerControlReadouts.create({
  state: createState({
    flight: {
      analysis: { mass: 0, snapshot: { parts: [] } },
      functionalBlocks: [],
      runtimeMass: 0
    }
  }),
  document: noCraftDocument,
  THREE,
  InputProfile,
  Aerostatics,
  aerostaticPolicy: policy,
  computeCraftAnalysis: () => ({ mass: 99, snapshot: { parts: [] } })
});
noCraftReadouts.syncPowerControlReadouts();
assert.strictEqual(noCraftDocument.getElementById('ui-vertical-support').textContent, '\u2014');
assert(noCraftDocument.getElementById('ui-thruster-guidance').innerHTML.includes('Build a craft to calculate hover'));
assert(noCraftDocument.getElementById('ui-balloon-guidance').innerHTML.includes('Build a craft to calculate hover'));

state.mode = 'FLIGHT';
state.flight.runtimeMass = 5;
state.flight.functionalBlocks = [
  { type: 'Balloon', attached: true, force: 80, health: 0.5 },
  { type: 'Thruster', attached: true, force: 30, localAxis: { y: 1 }, health: 0.5 },
  { type: 'VectorThruster', attached: false, force: 100, localAxis: { y: 1 }, health: 1 }
];
const flightSample = readouts.verticalSupportSample();
assert.deepStrictEqual(flightSample, {
  altitude: 10,
  weight: 50,
  maxSeaLevelLift: 40,
  maxPassiveLift: 15
});
const balloonGuidance = readouts.balloonLiftGuidance(flightSample);
assert.strictEqual(balloonGuidance.passiveLift, 7.5);
assert(Number.isFinite(balloonGuidance.requiredPower));

readouts.syncPowerControlReadouts();
assert(documentRef.getElementById('ui-vertical-support').textContent.endsWith('\u00d7 weight'));
assert(documentRef.getElementById('ui-balloon-guidance').innerHTML.includes('selected:'));

console.log({ powerControlReadouts: 'ok' });
