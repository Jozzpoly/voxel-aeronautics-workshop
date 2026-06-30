'use strict';

const assert = require('node:assert/strict');
const AuthoringState = require('../src/authoring_state.js');

function assetWithRig() {
  return {
    bindings: {
      blockTypes: ['Thruster'],
      nodes: {
        visualRoot: '/thruster_root',
        flame: 'thuster_fire',
        flameGlow: 'thuster_glow',
        gimbalAssembly: 'thuster_nozzle',
        controlFlapPivot: 'old_flap',
      },
    },
  };
}

{
  const asset = assetWithRig();
  AuthoringState.applyNodeFields(asset, {
    visualRoot: '/thruster_root',
    flame: '',
    flameGlow: '',
    gimbalAssembly: '',
    controlFlapPivot: '',
  }, { preserveEmpty: true });
  assert.deepEqual(asset.bindings.nodes, {
    visualRoot: '/thruster_root',
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'Clearing optional rig inputs must remove old node bindings from the committed manifest.');
}

{
  const nodes = AuthoringState.clearOptionalNodeFields({
    visualRoot: '/balloon',
    flame: 'thuster_fire',
    gimbalAssembly: 'thuster_nozzle',
  });
  assert.deepEqual(nodes, {
    visualRoot: '/balloon',
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'Clear rig bindings must preserve visualRoot and clear only optional rig aliases.');
}

{
  const thrusterSnapshot = {
    nodes: {
      visualRoot: '/thuster_base_bone',
      flame: 'thuster_fire',
      flameGlow: null,
      gimbalAssembly: 'thuster_nozzle',
      controlFlapPivot: null,
    },
    transform: { position: { x: 0.25, y: 0, z: 0 } },
    materialPolicy: { alpha: 'auto', materialOverrides: [{ materialName: 'Nozzle', alpha: 'opaque' }] },
    fireSplit: { enabled: true, nodes: ['/thuster_fire'] },
    rig: { vectorThruster: { channels: [{ input: 'gimbalA', node: 'gimbalAssembly', axis: 'z', direction: -1 }] } },
  };
  const prefs = {
    defaults: thrusterSnapshot,
    byBlock: {
      VectorThruster: {
        nodes: {
          visualRoot: '/vector_root',
          flame: '/vector_fire',
          flameGlow: null,
          gimbalAssembly: '/vector_gimbal',
          controlFlapPivot: null,
        },
        transform: { position: { x: 1, y: 0, z: 0 } },
        materialPolicy: { alpha: 'mask' },
      },
    },
  };

  const balloon = AuthoringState.preferenceSnapshotForBlock(prefs, 'Balloon', { includeDefaults: true });
  assert.deepEqual(balloon.nodes, {
    visualRoot: null,
    flame: null,
    flameGlow: null,
    gimbalAssembly: null,
    controlFlapPivot: null,
  }, 'A new block type must not inherit Thruster rig bindings from default prefs.');
  assert.deepEqual(balloon.fireSplit, { enabled: false, nodes: [] }, 'Fire split rig state must not cross block types through defaults.');
  assert.equal(balloon.rig, undefined, 'Renderer rig profiles must not cross block types through defaults.');
  assert.deepEqual(balloon.transform, thrusterSnapshot.transform, 'Default transform may still be reused across block types.');
  assert.deepEqual(balloon.materialPolicy, thrusterSnapshot.materialPolicy, 'Default material policy may still be reused across block types.');

  const vector = AuthoringState.preferenceSnapshotForBlock(prefs, 'VectorThruster', { includeDefaults: true });
  assert.equal(vector.nodes.gimbalAssembly, '/vector_gimbal', 'Exact per-block VectorThruster rig must remain restorable.');
  assert.equal(vector.nodes.flame, '/vector_fire');
}

console.log({ authoringState: 'ok' });
