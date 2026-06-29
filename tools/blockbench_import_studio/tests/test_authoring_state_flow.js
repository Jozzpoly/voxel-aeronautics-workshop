'use strict';

const assert = require('node:assert/strict');
const AuthoringState = require('../src/authoring_state.js');

function snapshot({ visualRoot, flame = null, gimbalAssembly = null, fireSplit = null, x = 0 }) {
  return {
    nodes: {
      visualRoot,
      flame,
      flameGlow: null,
      gimbalAssembly,
      controlFlapPivot: null,
    },
    transform: { position: { x, y: 0, z: 0 } },
    materialPolicy: { alpha: 'auto', materialOverrides: [{ materialName: 'Body', alpha: 'opaque' }] },
    fireSplit: fireSplit || { enabled: false, nodes: [] },
  };
}

{
  const thruster = snapshot({
    visualRoot: '/thuster_base_bone',
    flame: 'thuster_fire',
    gimbalAssembly: 'thuster_nozzle',
    fireSplit: { enabled: true, nodes: ['/thuster_fire'] },
    x: 0.25,
  });
  let prefs = AuthoringState.preferenceDocumentForSave({}, 'Thruster', thruster);

  assert.deepEqual(prefs.defaults.nodes, {
    visualRoot: null,
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'Global defaults must not store model-specific rig or root aliases.');
  assert.deepEqual(prefs.defaults.fireSplit, { enabled: false, nodes: [] }, 'Global defaults must not store fire split rig state.');
  assert.equal(prefs.byBlock.Thruster.nodes.flame, 'thuster_fire', 'Exact per-block Thruster rig remains restorable.');

  const balloonDefault = AuthoringState.preferenceSnapshotForBlock(prefs, 'Balloon', { includeDefaults: true });
  assert.deepEqual(balloonDefault.nodes, {
    visualRoot: null,
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'Switching to a block type without a profile must clear optional rig fields.');
  assert.deepEqual(balloonDefault.fireSplit, { enabled: false, nodes: [] });
  assert.deepEqual(balloonDefault.transform, thruster.transform, 'Transform defaults may still carry across block types.');
  assert.deepEqual(balloonDefault.materialPolicy, thruster.materialPolicy, 'Material defaults may still carry across block types.');

  const clearedNodes = AuthoringState.clearOptionalNodeFields({
    visualRoot: '/baloon',
    flame: 'thuster_fire',
    flameGlow: 'old_glow',
    gimbalAssembly: 'thuster_nozzle',
    controlFlapPivot: 'old_flap',
  });
  const balloonAsset = {
    bindings: {
      nodes: {
        visualRoot: '/baloon',
        flame: 'thuster_fire',
        flameGlow: 'old_glow',
        gimbalAssembly: 'thuster_nozzle',
        controlFlapPivot: 'old_flap',
      },
    },
  };
  AuthoringState.applyNodeFields(balloonAsset, clearedNodes, { preserveEmpty: true });
  assert.deepEqual(balloonAsset.bindings.nodes, {
    visualRoot: '/baloon',
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'Manual clear must commit null optional rig bindings and preserve visualRoot.');

  prefs = AuthoringState.preferenceDocumentForSave(prefs, 'Balloon', {
    ...balloonDefault,
    nodes: balloonAsset.bindings.nodes,
  });
  assert.equal(prefs.byBlock.Balloon.nodes.visualRoot, '/baloon', 'Exact Balloon profile may keep its own visualRoot.');
  assert.equal(prefs.byBlock.Balloon.nodes.flame, null);
  assert.equal(prefs.defaults.nodes.visualRoot, null, 'Saving Balloon must keep global defaults root-free.');

  const vector = snapshot({
    visualRoot: '/vector_root',
    flame: '/vector_fire',
    gimbalAssembly: '/vector_nozzle',
    x: 1,
  });
  prefs = AuthoringState.preferenceDocumentForSave(prefs, 'VectorThruster', vector);
  const restoredVector = AuthoringState.preferenceSnapshotForBlock(prefs, 'VectorThruster', { includeDefaults: true });
  assert.equal(restoredVector.nodes.flame, '/vector_fire');
  assert.equal(restoredVector.nodes.gimbalAssembly, '/vector_nozzle', 'Exact VectorThruster profile must not be erased by default sanitization.');

  const restoredBalloon = AuthoringState.preferenceSnapshotForBlock(prefs, 'Balloon', { includeDefaults: true });
  assert.equal(restoredBalloon.nodes.visualRoot, '/baloon');
  assert.equal(restoredBalloon.nodes.gimbalAssembly, null, 'VectorThruster rig must not leak into Balloon profile.');
}

console.log({ authoringStateFlow: 'ok' });
