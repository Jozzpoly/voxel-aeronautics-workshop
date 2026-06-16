(() => {
  'use strict';

  if (!window.THREE || !window.CANNON) {
    throw new Error('Required Three.js or Cannon.js library is unavailable.');
  }

  const requiredCapabilities = [
    ['THREE.Vector3', window.THREE.Vector3],
    ['THREE.Quaternion', window.THREE.Quaternion],
    ['THREE.Matrix4', window.THREE.Matrix4],
    ['THREE.WebGLRenderer', window.THREE.WebGLRenderer],
    ['CANNON.World', window.CANNON.World],
    ['CANNON.Body', window.CANNON.Body],
    ['CANNON.Box', window.CANNON.Box],
    ['CANNON.Plane', window.CANNON.Plane],
    ['CANNON.Vec3', window.CANNON.Vec3],
    ['CANNON.Quaternion', window.CANNON.Quaternion]
  ];
  const missingCapabilities = requiredCapabilities.filter(([, value]) => typeof value !== 'function').map(([name]) => name);
  if (missingCapabilities.length) {
    throw new Error(`Physics/rendering libraries are incomplete: ${missingCapabilities.join(', ')}`);
  }

  const Config = window.VAW.require('foundation.config');
  const Catalog = window.VAW.require('foundation.catalog');
  const Orientation = window.VAW.require('foundation.orientation');
  const Blueprint = window.VAW.require('foundation.blueprint');
  const CraftModel = window.VAW.require('foundation.craft-model');
  const CraftHistory = window.VAW.require('foundation.craft-history');
  const ControlFrame = window.VAW.require('foundation.control-frame');
  const MassProperties = window.VAW.require('foundation.mass-properties');
  const CraftCompiler = window.VAW.require('foundation.craft-compiler');
  const RuntimeAssembly = window.VAW.require('foundation.runtime-assembly');
  const InputProfile = window.VAW.require('foundation.input-profile');
  const UIWorkspace = window.VAW.require('foundation.ui-workspace');
  const MissionEvaluator = window.VAW.require('foundation.mission-evaluator');
  const Aerostatics = window.VAW.require('foundation.aerostatics');
  const FlightControl = window.VAW.require('foundation.flight-control');
  const State = window.VAW.require('foundation.state');
  const PhysicsPort = window.VAW.require('runtime.physics-port');
  const CannonPhysicsBackend = window.VAW.require('runtime.cannon-physics-backend');
  const HeadlessPhysicsBackend = window.VAW.require('runtime.headless-physics-backend');
  const AssemblyBuilder = window.VAW.require('runtime.assembly-builder');
  const Physics = CannonPhysicsBackend.create(window.CANNON);

  const Capabilities = Object.freeze({
    threeRevision: String(window.THREE.REVISION || 'unknown'),
    cannonVersion: Physics.version,
    webglRenderer: true,
    physicsBackend: Physics.id,
    physicsBoundary: 'phase-1d3-assembly-builder',
    runtimeAssembly: 'runtime-builder-v1',
    headlessHarness: 'deterministic-free-flight-v1',
    missionEvaluation: 'phase-1d2b-multi-pad-ground-state',
    aerostatics: 'altitude-lift-damped-settling-v2',
    platform: 'desktop-keyboard-mouse-v1',
    workspaceState: 'version-3-z-order',
    gameShell: 'explicit-composition-v1'
  });
  const runtime = Object.freeze({ Config, Catalog, Orientation, Blueprint, CraftModel, CraftHistory, ControlFrame, MassProperties, CraftCompiler, RuntimeAssembly, AssemblyBuilder, HeadlessPhysicsBackend, InputProfile, UIWorkspace, MissionEvaluator, Aerostatics, FlightControl, State, PhysicsPort, Physics, Capabilities });
  Object.defineProperty(window, 'VAW_RUNTIME', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: runtime
  });
})();
