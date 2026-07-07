'use strict';

const assert = require('assert');
const { getRuntimeProbeApi } = require('../tools/vector_thruster_runtime_harness');

const runtime = getRuntimeProbeApi();
const { computeVectorThrusterForceCannon } = runtime;

assert.strictEqual(typeof computeVectorThrusterForceCannon, 'function', 'Must extract computeVectorThrusterForceCannon from src/game.js');
assert.strictEqual(typeof runtime.adapter.setGimbal, 'function', 'Must load visual_runtime_adapter.setGimbal');

const basis = {
  forward: { x: 1, y: 0, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  span: { x: 0, y: 0, z: 1 },
};

const mod = runtime.createModForBasis(basis);
const pilot = { roll: 0.25, yaw: -0.4, pitch: 0 };
const force = computeVectorThrusterForceCannon(mod, pilot, 1);
assert.ok(force.x !== 0 || force.y !== 0 || force.z !== 0, 'Runtime force vector must be non-zero for non-neutral pilot.');

const profile = {
  channels: [
    { input: 'gimbalA', axis: 'z', direction: 1 },
    { input: 'gimbalB', axis: 'y', direction: -1 },
  ],
};
const root = runtime.buildProbeRoot(profile);
const gimbal = root.children.find(child => child.name === 'gimbalAssembly');
assert.ok(gimbal, 'Probe root must expose gimbalAssembly for fallback profile.');
assert.strictEqual(runtime.adapter.setGimbal(root, 0.5, -0.25, runtime.gimbalAngle, { roll: 0 }), true);
assert.ok(Math.abs(gimbal.rotation.z - 0.5 * runtime.gimbalAngle) < 1e-6, 'setGimbal must map gimbalA to local Z rotation.');
assert.ok(Math.abs(gimbal.rotation.y - 0.25 * runtime.gimbalAngle) < 1e-6, 'setGimbal must map gimbalB to inverted local Y rotation.');

const scalar = runtime.forceDirectionFromGimbalScalars(mod, 0.5, -0.25);
assert.ok(Number.isFinite(scalar.x) && Number.isFinite(scalar.y) && Number.isFinite(scalar.z), 'Scalar force direction must be finite.');

console.log(JSON.stringify({
  vectorThrusterRuntimeProbe: 'ok',
  computeVectorThrusterForceCannon: 'imported',
  setGimbal: 'imported',
}, null, 2));