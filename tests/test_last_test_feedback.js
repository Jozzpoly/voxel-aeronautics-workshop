'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/mission_evaluator.js',
  'src/game/mission_controller.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vector3(this.x, this.y, this.z); }
}

const MissionController = global.VAW.require('game.mission-controller');
const sandbox = { id: 'sandbox', title: 'Sandbox', payloadMass: 0, objectives: [], reward: 0 };
const contract = { id: 'test_contract', title: 'Test contract', payloadMass: 0, objectives: [], reward: 100 };
const contracts = new Map([[sandbox.id, sandbox], [contract.id, contract]]);

function makeState(contractId = 'sandbox') {
  return {
    mode: 'FLIGHT',
    career: { selectedContractId: contractId, completed: {}, best: {}, credits: 0, totalStars: 0 },
    mission: {
      contractId,
      active: contractId !== 'sandbox',
      paused: false,
      status: 'ACTIVE',
      elapsed: 12.5,
      startFuel: 100,
      maxImpact: 6.2,
      maxAltitude: 44,
      maxSpeed: 22,
      markers: []
    },
    flight: {
      fuel: 63,
      fuelMax: 100,
      integrity: 74,
      maxImpact: 8.4,
      lostParts: 2,
      severeImpact: true,
      outOfFuel: false,
      firstFailure: 'Fuel critically damaged by impact',
      firstFailureEvent: { kind: 'critical-damage', blockId: 'block:fuel-7', blockType: 'Fuel', bodyId: 'body:root', reason: 'impact' },
      runtimeParts: [
        { blockId: 'block:core', attached: true },
        { blockId: 'block:fuel-7', attached: false },
        { blockId: 'block:frame-2', attached: false }
      ],
      lastLoads: { thrust: 101, lift: 88, drag: 19, impact: 7.9 },
      payload: null
    },
    lastTestResult: null
  };
}

function createController(state, onSetMode = () => {}) {
  const flightSession = {
    isActive: () => false,
    primaryBodyId: () => null,
    clearBodyMotion: () => true
  };
  return MissionController.create({
    THREE: { Vector3, MathUtils: { clamp: (v, min, max) => Math.max(min, Math.min(max, v)) } },
    Physics: {},
    state,
    craft: {},
    document: { getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) },
    landingPolicy: { requiredHoldSeconds: 1 },
    missionMarkerGroup: { children: [], add() {}, remove() {}, visible: false },
    services: {
      getContractById: id => contracts.get(id) || sandbox,
      isContractUnlocked: () => true,
      getSelectedContract: () => contracts.get(state.career.selectedContractId) || sandbox,
      careerRank: () => 'Test',
      recalculateCareerStars: () => 0,
      saveCareer: () => true,
      flightSession
    },
    callbacks: {
      computeCraftAnalysis: () => ({}),
      buildLoadedSnapshot: value => value,
      computeControlMetrics: () => ({}),
      collectBlueprint: () => ({}),
      cleanupFlightState: () => true,
      findOrientationId: () => 0,
      commitHistory: () => true,
      updateTelemetry: () => true,
      autoSave: () => true,
      showStatus: () => true,
      updateHUD: () => true,
      disposeObjectTree: () => true,
      clearControlActions: () => true,
      setStabilize: () => true,
      setMode: mode => onSetMode(mode),
    }
  });
}

// Sandbox return must capture a bounded result before cleanup and preserve it after mode transition.
{
  const state = makeState('sandbox');
  const controller = createController(state, mode => {
    assert.strictEqual(mode, 'BUILD');
    // Simulate the destructive flight cleanup that used to erase all useful evidence.
    state.flight.fuel = 0;
    state.flight.maxImpact = 0;
    state.flight.lostParts = 0;
    state.flight.firstFailure = '';
    state.flight.firstFailureEvent = null;
    state.flight.runtimeParts = [];
    state.flight.lastLoads = { thrust: 0, lift: 0, drag: 0, impact: 0 };
    state.mode = mode;
  });
  controller.requestReturnToWorkshop();
  assert(state.lastTestResult, 'Sandbox return must preserve a last-test result.');
  assert.strictEqual(state.lastTestResult.kind, 'sandbox-test');
  assert.strictEqual(state.lastTestResult.outcome, 'returned');
  assert.strictEqual(state.lastTestResult.fuelUsed, 37);
  assert.strictEqual(state.lastTestResult.maxImpact, 8.4);
  assert.strictEqual(state.lastTestResult.lostParts, 2);
  assert.deepStrictEqual(state.lastTestResult.lostBlockIds, ['block:fuel-7', 'block:frame-2']);
  assert.strictEqual(state.lastTestResult.firstFailureEvent.blockId, 'block:fuel-7');
  assert.deepStrictEqual(state.lastTestResult.lastLoads, { thrust: 101, lift: 88, drag: 19, impact: 7.9 });
  assert.strictEqual(state.lastTestResult.simulation, null, 'Current game composition does not wire scheduler health into mission evidence.');
}

// Contract and sandbox use the same capture shape; contract-only data is nested rather than redefining the evidence model.
{
  const state = makeState('test_contract');
  const controller = createController(state);
  const result = controller.captureLastTestResult({
    success: true,
    outcome: 'completed',
    contractResult: { stars: 2, reward: 170, payloadRequired: false, payloadIntegrity: 1, payloadLost: false }
  });
  assert.strictEqual(result.kind, 'contract-test');
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(result.contractResult, {
    stars: 2, reward: 170, payloadRequired: false, payloadIntegrity: 1, payloadLost: false
  });
}

console.log(JSON.stringify({ sandboxFeedbackContinuity: 'ok', contractSharedCapture: 'ok', stableFailureIdentity: 'ok' }));
