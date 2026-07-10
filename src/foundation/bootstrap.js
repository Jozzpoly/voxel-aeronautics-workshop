(() => {
  'use strict';

  if (!window.THREE || !window.CANNON) {
    throw new Error('Required Three.js or Cannon.js library is unavailable.');
  }

  function tryEnsureBrowserModule(moduleId, sourcePath) {
    if (window.VAW.inspect().defined.includes(moduleId)) return true;
    if (typeof XMLHttpRequest !== 'function') return false;
    try {
      const request = new XMLHttpRequest();
      request.open('GET', sourcePath, false);
      request.send();
      if (request.status !== 200) return false;
      // The source uses a browser/CommonJS wrapper and registers itself in VAW.
      // eslint-disable-next-line no-new-func
      new Function(`${request.responseText}\n//# sourceURL=${sourcePath}`)();
      return window.VAW.inspect().defined.includes(moduleId);
    } catch (error) {
      console.warn(`[adaptive-bootstrap] ${sourcePath} could not be loaded.`, error);
      return false;
    }
  }

  const mobileModulesReady =
    tryEnsureBrowserModule('game.mobile-device-profile', 'src/game/mobile-device-profile.js') &&
    tryEnsureBrowserModule('game.mobile-runtime-shell', 'src/game/mobile-runtime-shell.js');

  let mobileShell = null;
  let initialMobileProfile = null;
  if (mobileModulesReady) {
    const MobileRuntimeShell = window.VAW.require('game.mobile-runtime-shell');
    mobileShell = MobileRuntimeShell.create({
      window,
      document,
      onError(error) { console.error('[mobile-runtime-shell]', error); }
    });
    initialMobileProfile = mobileShell.initialize();
  }

  window.VAW.define('runtime.mobile-context', [], () => Object.freeze({
    shell: mobileShell,
    available: Boolean(initialMobileProfile),
    currentProfile: () => mobileShell?.current?.() || null
  }));

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

  window.VAW.define('runtime.active-context', ['runtime.cannon-physics-backend', 'runtime.mobile-context'], (CannonPhysicsBackend, MobileContext) => {
    const Physics = CannonPhysicsBackend.create(window.CANNON);
    const profile = MobileContext.currentProfile();
    const Capabilities = Object.freeze({
      threeRevision: String(window.THREE.REVISION || 'unknown'),
      cannonVersion: Physics.version,
      webglRenderer: true,
      physicsBackend: Physics.id,
      physicsBoundary: 'phase-1d4a-neutral-mechanical-assembly-api',
      runtimeAssembly: 'VAW_RUNTIME_ASSEMBLY_PLAN_V3',
      headlessHarness: 'deterministic-free-flight-v1',
      missionEvaluation: 'phase-1d2b-multi-pad-ground-state',
      aerostatics: 'altitude-lift-damped-settling-v2',
      platform: 'adaptive-desktop-touch-foundation-v1',
      mobilePresentationAvailable: MobileContext.available,
      initialPresentation: profile?.mobilePresentation ? 'mobile' : 'desktop',
      workspaceState: 'version-4-dockable-workbench',
      gameShell: 'mechanical-platform-convergence-v1'
    });
    return Object.freeze({ Physics, Capabilities, MobileContext });
  });

  // Eager resolution validates the selected browser backend and adaptive shell before game composition.
  window.VAW.require('runtime.active-context');
})();
