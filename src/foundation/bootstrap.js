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

  const mobileModuleSources = [
    ['game.mobile-device-profile', 'src/game/mobile-device-profile.js'],
    ['game.mobile-runtime-shell', 'src/game/mobile-runtime-shell.js'],
    ['game.mobile-command-port', 'src/game/mobile-command-port.js'],
    ['game.mobile-game-command-adapter', 'src/game/mobile-game-command-adapter.js'],
    ['game.mobile-playable-shell', 'src/game/mobile-playable-shell.js'],
    ['game.mobile-flight-controls', 'src/game/mobile-flight-controls.js'],
    ['game.mobile-touch-controller', 'src/game/mobile-touch-controller.js'],
    ['game.mobile-pointer-adapter', 'src/game/mobile-pointer-adapter.js'],
    ['game.mobile-camera-gesture-bridge', 'src/game/mobile-camera-gesture-bridge.js'],
    ['game.mobile-camera-input-runtime', 'src/game/mobile-camera-input-runtime.js'],
    ['game.mobile-camera-autobind', 'src/game/mobile-camera-autobind.js']
  ];
  const mobileModulesReady = mobileModuleSources.every(([moduleId, sourcePath]) => tryEnsureBrowserModule(moduleId, sourcePath));

  let mobileShell = null;
  let initialMobileProfile = null;
  let mobilePlayableShell = null;
  let mobileFlightControls = null;
  let mobileCameraBinder = null;
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
    currentProfile: () => mobileShell?.current?.() || null,
    subscribe: listener => mobileShell?.subscribe?.(listener) || (() => {}),
    playableShell: () => mobilePlayableShell,
    flightControls: () => mobileFlightControls,
    cameraInputBinder: () => mobileCameraBinder
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
      platform: 'desktop-keyboard-mouse-v1',
      mobilePresentationAvailable: MobileContext.available,
      mobileCameraGestures: mobileModulesReady ? 'autobind-v1' : 'unavailable',
      mobilePlayableShell: mobileModulesReady ? 'command-port-v1' : 'unavailable',
      mobileFlightControls: mobileModulesReady ? 'named-actions-v1' : 'unavailable',
      initialPresentation: profile?.mobilePresentation ? 'mobile' : 'desktop',
      workspaceState: 'version-4-dockable-workbench',
      gameShell: 'mechanical-platform-convergence-v1'
    });
    return Object.freeze({ Physics, Capabilities, MobileContext });
  });

  // Eager resolution validates the selected browser backend and adaptive shell before game composition.
  const activeContext = window.VAW.require('runtime.active-context');
  if (mobileModulesReady && initialMobileProfile) {
    const MobileCommandPort = window.VAW.require('game.mobile-command-port');
    try {
      const MobilePlayableShell = window.VAW.require('game.mobile-playable-shell');
      mobilePlayableShell = MobilePlayableShell.create({
        window,
        document,
        mobileContext: activeContext.MobileContext,
        commandPort: MobileCommandPort,
        onError(error, context) { console.error(`[mobile-playable-shell] ${context?.phase || 'unknown'} failed.`, error); }
      });
      mobilePlayableShell.start();
    } catch (error) {
      mobilePlayableShell = null;
      console.error('[mobile-playable-shell] startup failed.', error);
    }

    try {
      const MobileFlightControls = window.VAW.require('game.mobile-flight-controls');
      mobileFlightControls = MobileFlightControls.create({
        window,
        document,
        mobileContext: activeContext.MobileContext,
        commandPort: MobileCommandPort,
        onError(error, context) { console.error(`[mobile-flight-controls] ${context?.phase || 'unknown'} failed.`, error); }
      });
      mobileFlightControls.start();
    } catch (error) {
      mobileFlightControls = null;
      console.error('[mobile-flight-controls] startup failed.', error);
    }

    const MobileCameraAutobind = window.VAW.require('game.mobile-camera-autobind');
    mobileCameraBinder = MobileCameraAutobind.create({
      window,
      document,
      mobileContext: activeContext.MobileContext,
      tapEnabled: () => Boolean(mobilePlayableShell?.tapEnabled?.()),
      onTap: sample => mobilePlayableShell?.handleCanvasTap?.(sample)
    });
    mobileCameraBinder.start();
  }
})();
