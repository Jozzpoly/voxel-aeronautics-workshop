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

  window.VAW.define('runtime.active-context', ['runtime.cannon-physics-backend'], CannonPhysicsBackend => {
    const Physics = CannonPhysicsBackend.create(window.CANNON);
    const Capabilities = Object.freeze({
      threeRevision: String(window.THREE.REVISION || 'unknown'),
      cannonVersion: Physics.version,
      webglRenderer: true,
      physicsBackend: Physics.id,
      physicsBoundary: 'phase-1d4a-neutral-mechanical-assembly-api',
      runtimeAssembly: 'runtime-assembly-plan-v2',
      headlessHarness: 'deterministic-free-flight-v1',
      missionEvaluation: 'phase-1d2b-multi-pad-ground-state',
      aerostatics: 'altitude-lift-damped-settling-v2',
      platform: 'desktop-keyboard-mouse-v1',
      workspaceState: 'version-4-dockable-workbench',
      gameShell: 'mechanical-platform-convergence-v1'
    });
    return Object.freeze({ Physics, Capabilities });
  });

  // Eager resolution validates the selected browser backend before game composition.
  window.VAW.require('runtime.active-context');
})();
