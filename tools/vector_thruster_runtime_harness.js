#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function ensureRuntimeGlobals() {
  global.window = global;
  global.document = global.document || { createElement: () => ({}) };
  if (!global.CANNON) {
    // eslint-disable-next-line import/no-dynamic-require
    global.CANNON = require(path.join(ROOT, 'vendor/cannon-0.6.2/cannon.min.js'));
  }
  if (!global.VAW) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests/browser_stub_libs.js'), 'utf8'), { filename: 'browser_stub_libs.js' });
    for (const relative of ['src/foundation/kernel.js']) {
      vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
    }
  }
}

const loadedScripts = new Set();

function loadVawModule(relativePaths, moduleId) {
  ensureRuntimeGlobals();
  for (const relative of relativePaths) {
    if (loadedScripts.has(relative)) continue;
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
    loadedScripts.add(relative);
  }
  return global.VAW.require(moduleId);
}

function extractComputeVectorThrusterForceCannon() {
  const gameSource = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
  const match = gameSource.match(/function computeVectorThrusterForceCannon\(mod, pilot, command\) \{[\s\S]*?\n    \}/);
  if (!match) throw new Error('computeVectorThrusterForceCannon not found in src/game.js');
  const Physics = loadVawModule([
    'src/foundation/transform_math.js',
    'src/runtime/physics_port.js',
    'src/runtime/cannon_physics_backend.js',
  ], 'runtime.cannon-physics-backend').create(global.CANNON);
  const configModule = loadVawModule(['src/foundation/config.js'], 'foundation.config');
  const PHYSICS = configModule.PHYSICS;
  const runtimePartHealthFraction = () => 1;
  const cannonDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const THREE = global.THREE;
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'Physics', 'PHYSICS', 'THREE', 'runtimePartHealthFraction', 'cannonDot',
    `${match[0]}\nreturn computeVectorThrusterForceCannon;`
  );
  return {
    computeVectorThrusterForceCannon: factory(Physics, PHYSICS, THREE, runtimePartHealthFraction, cannonDot),
    Physics,
    PHYSICS,
    gimbalAngle: PHYSICS.gimbalAngle,
  };
}

function createVisualAdapter() {
  const RuntimeAdapter = loadVawModule(['src/game/visual_runtime_adapter.js'], 'game.visual-runtime-adapter');
  return RuntimeAdapter.create();
}

function group(name) {
  const item = new global.THREE.Group();
  item.name = name;
  return item;
}

function buildRigRoot(profile) {
  const root = group('root');
  const channels = profile.channels || [];
  const usesRigProfile = channels.some(channel => String(channel?.node || '').trim());
  if (usesRigProfile) {
    root.userData.visualAssetRigBindings = { vectorThruster: profile };
    const nodeNames = new Set(channels.map(channel => String(channel.node || 'gimbalAssembly').trim() || 'gimbalAssembly'));
    for (const nodeName of nodeNames) {
      root.add(group(nodeName));
    }
  } else {
    root.add(group('gimbalAssembly'));
  }
  return root;
}

function cloneVec(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function applyQuaternion(v, q) {
  const x = v.x;
  const y = v.y;
  const z = v.z;
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;
  const qw = q.w;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function eulerToQuaternion(euler) {
  const c1 = Math.cos(euler.x / 2);
  const c2 = Math.cos(euler.y / 2);
  const c3 = Math.cos(euler.z / 2);
  const s1 = Math.sin(euler.x / 2);
  const s2 = Math.sin(euler.y / 2);
  const s3 = Math.sin(euler.z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function visualForwardFromRoot(root) {
  const target = root.children.find(child => child.name === 'gimbalAssembly') || root.children[0];
  const euler = {
    x: Number(target?.rotation?.x) || 0,
    y: Number(target?.rotation?.y) || 0,
    z: Number(target?.rotation?.z) || 0,
  };
  const local = normalize(applyQuaternion({ x: 1, y: 0, z: 0 }, eulerToQuaternion(euler)));
  return local;
}

function basisFromMod(mod) {
  return {
    forward: cloneVec(mod.localAxis),
    normal: cloneVec(mod.localNormal),
    span: cloneVec(mod.localSpan),
  };
}

function worldDirection(basis, local) {
  return normalize({
    x: basis.forward.x * local.x + basis.normal.x * local.y + basis.span.x * local.z,
    y: basis.forward.y * local.x + basis.normal.y * local.y + basis.span.y * local.z,
    z: basis.forward.z * local.x + basis.normal.z * local.y + basis.span.z * local.z,
  });
}

function createModForBasis(basis, Physics) {
  return {
    force: 1,
    localAxis: Physics.vec3(basis.forward.x, basis.forward.y, basis.forward.z),
    localNormal: Physics.vec3(basis.normal.x, basis.normal.y, basis.normal.z),
    localSpan: Physics.vec3(basis.span.x, basis.span.y, basis.span.z),
    bodyLocalPosition: Physics.vec3(0, 0, 1),
    type: 'VectorThruster',
    gimbalA: 0,
    gimbalB: 0,
    gimbalRoll: 0,
  };
}

function forceDirectionFromGimbalScalars(mod, a, b, gimbalAngle) {
  const forwardScale = Math.cos(gimbalAngle * Math.min(1, Math.hypot(a, b)));
  const lateral = Math.sin(gimbalAngle);
  const forward = mod.localAxis.clone().scale(forwardScale);
  const force = forward
    .vadd(mod.localNormal.clone().scale(lateral * a))
    .vadd(mod.localSpan.clone().scale(lateral * b));
  return normalize({ x: force.x, y: force.y, z: force.z });
}

function forceDirectionFromRuntime(computeFn, Physics, mod, gimbalA, gimbalB, gimbalAngle) {
  const pilot = { roll: gimbalA, yaw: gimbalB, pitch: 0 };
  const force = computeFn(mod, pilot, 1);
  const fromPilot = normalize({ x: force.x, y: force.y, z: force.z });
  const fromScalars = forceDirectionFromGimbalScalars(mod, mod.gimbalA, mod.gimbalB, gimbalAngle);
  const directScalars = forceDirectionFromGimbalScalars(mod, gimbalA, gimbalB, gimbalAngle);
  const pilotError = Math.acos(Math.min(1, Math.max(-1,
    fromPilot.x * fromScalars.x + fromPilot.y * fromScalars.y + fromPilot.z * fromScalars.z
  ))) * 180 / Math.PI;
  if (pilotError <= 0.05) return fromScalars;
  return directScalars;
}

function visualDirectionFromRuntime(adapter, profile, basis, sample, maxAngle) {
  const root = buildRigRoot(profile);
  adapter.setGimbal(
    root,
    Number(sample.gimbalA) || 0,
    Number(sample.gimbalB) || 0,
    maxAngle,
    { roll: Number(sample.roll) || 0 }
  );
  const local = visualForwardFromRoot(root);
  return worldDirection(basis, local);
}

let cached = null;

function getRuntimeProbeApi() {
  if (cached) return cached;
  const { computeVectorThrusterForceCannon, Physics, gimbalAngle } = extractComputeVectorThrusterForceCannon();
  const adapter = createVisualAdapter();
  const probeRoots = new Map();
  cached = {
    computeVectorThrusterForceCannon,
    adapter,
    Physics,
    gimbalAngle,
    buildProbeRoot(profile) {
      const key = JSON.stringify(profile);
      if (!probeRoots.has(key)) probeRoots.set(key, buildRigRoot(profile));
      return probeRoots.get(key);
    },
    forceDirectionFromGimbalScalars: (mod, gimbalA, gimbalB) =>
      forceDirectionFromGimbalScalars(mod, gimbalA, gimbalB, gimbalAngle),
    forceDirectionFromRuntime: (mod, gimbalA, gimbalB) =>
      forceDirectionFromRuntime(computeVectorThrusterForceCannon, Physics, mod, gimbalA, gimbalB, gimbalAngle),
    visualDirectionFromRuntime: (profile, basis, sample) =>
      visualDirectionFromRuntime(adapter, profile, basis, sample, gimbalAngle),
    createModForBasis: basis => createModForBasis(basis, Physics),
  };
  return cached;
}

module.exports = {
  getRuntimeProbeApi,
  extractComputeVectorThrusterForceCannon,
  createVisualAdapter,
};