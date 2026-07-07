'use strict';

function createVisualParityDiagnostic(Profiles) {
  const PROFILE_BY_ID = Object.freeze({
    'studio-preview': Profiles.STUDIO_PREVIEW_PROFILE,
    'game-studio-parity': Profiles.GAME_STUDIO_PARITY_PROFILE,
    'game-default': Profiles.GAME_DEFAULT_PROFILE
  });

  const PROFILE_ALIASES = Object.freeze({
    'studio_preview_profile': 'studio-preview',
    'studio-preview-profile': 'studio-preview',
    'game_studio_parity_profile': 'game-studio-parity',
    'game-studio-parity-profile': 'game-studio-parity',
    'game_default_profile': 'game-default',
    'game-default-profile': 'game-default'
  });

  const DEFAULT_PROFILE_ID = 'game-studio-parity';
  const DEFAULT_CAMERA_FOV = 50;
  const DEFAULT_CAMERA_MARGIN = 1.75;
  const DEFAULT_CAMERA_DIRECTION = Object.freeze({ x: 0.85, y: 0.55, z: 1.15 });

  function normalizeProfileId(profileId) {
    const raw = String(profileId || '').trim();
    if (!raw) return DEFAULT_PROFILE_ID;
    const lowered = raw.toLowerCase();
    if (PROFILE_BY_ID[lowered]) return lowered;
    if (PROFILE_ALIASES[lowered]) return PROFILE_ALIASES[lowered];
    if (lowered === 'studio_preview' || lowered === 'studiopreview') return 'studio-preview';
    if (lowered === 'game_studio_parity' || lowered === 'gamestudioparity') return 'game-studio-parity';
    return lowered;
  }

  function parseRequest(search = '') {
    const query = String(search || '');
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    const enabled = params.get('visualParity') === '1'
      || params.get('mode') === 'visual-parity'
      || params.has('visualParityBlock')
      || params.has('visualParityAsset');
    if (!enabled) return null;
    const block = String(params.get('block') || params.get('visualParityBlock') || '').trim();
    const assetId = String(params.get('assetId') || params.get('visualParityAsset') || '').trim();
    const profile = normalizeProfileId(params.get('profile') || params.get('visualParityProfile') || DEFAULT_PROFILE_ID);
    if (!block && !assetId) return null;
    return Object.freeze({ block, assetId, profile });
  }

  function resolveProfile(profileId) {
    const normalized = normalizeProfileId(profileId);
    const profile = PROFILE_BY_ID[normalized];
    if (!profile) {
      throw new Error(`Unknown visual parity profile "${String(profileId || '')}". Expected one of: ${Object.keys(PROFILE_BY_ID).join(', ')}`);
    }
    return profile;
  }

  function computeObjectBounds(root, THREE) {
    if (!root || !THREE?.Box3 || !THREE.Vector3) return { valid: false, reason: 'no-root' };
    root.updateWorldMatrix?.(true, true);
    const box = new THREE.Box3().setFromObject(root);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x) || box.isEmpty()) {
      return { valid: false, reason: 'empty-or-non-finite-box', box };
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return {
      valid: true,
      box,
      size,
      center,
      maxDim: Math.max(size.x, size.y, size.z, 0.001)
    };
  }

  function fitCameraToBounds(camera, bounds, THREE, options = {}) {
    if (!camera || !bounds?.valid || !THREE?.Vector3) return null;
    const margin = Number.isFinite(options.margin) ? options.margin : DEFAULT_CAMERA_MARGIN;
    const fovRadians = THREE.MathUtils
      ? THREE.MathUtils.degToRad(camera.fov || DEFAULT_CAMERA_FOV)
      : ((camera.fov || DEFAULT_CAMERA_FOV) * Math.PI / 180);
    const distance = Math.max(bounds.maxDim / (2 * Math.tan(fovRadians / 2)) * margin, 0.05);
    const direction = new THREE.Vector3(
      DEFAULT_CAMERA_DIRECTION.x,
      DEFAULT_CAMERA_DIRECTION.y,
      DEFAULT_CAMERA_DIRECTION.z
    ).normalize();
    camera.position.copy(bounds.center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 2000, 0.001);
    camera.far = Math.max(distance * 2000, bounds.maxDim * 1000, 1000);
    camera.updateProjectionMatrix?.();
    camera.lookAt?.(bounds.center);
    return Object.freeze({
      mode: 'reset-default-orientation',
      distance,
      near: camera.near,
      far: camera.far,
      center: Object.freeze({ x: bounds.center.x, y: bounds.center.y, z: bounds.center.z }),
      size: Object.freeze({ x: bounds.size.x, y: bounds.size.y, z: bounds.size.z }),
      maxDim: bounds.maxDim
    });
  }

  function applyProfileScene(scene, THREE, profile, fogConfig = {}) {
    if (profile.scene.fog) Profiles.applySceneFog(scene, THREE, profile, fogConfig);
    else Profiles.applySceneBackground(scene, THREE, profile);
  }

  function createStatusOverlay(document, request, profile) {
    const overlay = document.createElement('div');
    overlay.id = 'visual-parity-diagnostic-status';
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:12px',
      'z-index:40',
      'padding:10px 12px',
      'border-radius:8px',
      'background:rgba(7,17,31,0.88)',
      'color:#dbeafe',
      'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'pointer-events:none',
      'max-width:min(92vw,520px)'
    ].join(';');
    const target = request.block || request.assetId;
    overlay.textContent = `visual-parity • profile=${profile.id} • target=${target}`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function showFatal(document, message) {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'alert');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:24px',
      'background:#07111f',
      'color:#fecaca',
      'font:14px/1.5 ui-sans-serif,system-ui,sans-serif',
      'z-index:60'
    ].join(';');
    overlay.textContent = String(message || 'Visual parity diagnostic failed.');
    document.body.appendChild(overlay);
    return overlay;
  }

  async function resolveTargetAsset(registry, request) {
    if (request.assetId) {
      const asset = registry.assetById(request.assetId);
      if (!asset) throw new Error(`Visual asset "${request.assetId}" is not registered.`);
      return Object.freeze({
        asset,
        blockType: String((asset.bindings?.blockTypes || [])[0] || request.block || '')
      });
    }
    const asset = registry.assetForBlockType(request.block);
    if (!asset) throw new Error(`No imported visual is registered for block type "${request.block}".`);
    return Object.freeze({ asset, blockType: request.block });
  }

  async function run(options = {}) {
    const VAW = options.VAW || window.VAW;
    const THREE = options.THREE || window.THREE;
    const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
    const windowRef = options.window || (typeof window !== 'undefined' ? window : null);
    const container = options.container || documentRef?.getElementById?.('canvas-container');
    const request = options.request || parseRequest(windowRef?.location?.search || '');
    if (!VAW?.require) throw new TypeError('VAW kernel is required for visual parity diagnostic mode.');
    if (!THREE?.Scene || !THREE.PerspectiveCamera || !THREE.WebGLRenderer) {
      throw new TypeError('THREE renderer primitives are required for visual parity diagnostic mode.');
    }
    if (!container?.appendChild) throw new TypeError('Canvas container is required for visual parity diagnostic mode.');
    if (!request) throw new TypeError('Visual parity diagnostic request is required.');
    if (!documentRef?.createElement) throw new TypeError('document is required for visual parity diagnostic mode.');

    const profile = resolveProfile(request.profile);
    const VisualAssetRegistry = VAW.require('game.visual-asset-registry');
    const VisualAssetLoader = VAW.require('game.visual-asset-loader');

    const registry = VisualAssetRegistry.create();
    const loader = VisualAssetLoader.create({ THREE, visualAssetRegistry: registry, logger: console });
    const bootstrap = await loader.bootstrapInstalledPacks();
    if (!bootstrap?.ok && registry.size === 0) {
      throw new Error('Installed visual packs could not be bootstrapped for diagnostic render mode.');
    }

    const target = await resolveTargetAsset(registry, request);
    const scene = new THREE.Scene();
    applyProfileScene(scene, THREE, profile);

    const camera = new THREE.PerspectiveCamera(
      DEFAULT_CAMERA_FOV,
      Math.max(1, container.clientWidth || windowRef?.innerWidth || 1) / Math.max(1, container.clientHeight || windowRef?.innerHeight || 1),
      0.001,
      100000
    );
    camera.position.set(4, 3, 6);

    const renderer = new THREE.WebGLRenderer(Profiles.buildRendererOptions(profile));
    renderer.setPixelRatio(Math.min(windowRef?.devicePixelRatio || 1, profile.renderer.pixelRatioCap));
    renderer.setSize(
      Math.max(1, container.clientWidth || windowRef?.innerWidth || 1),
      Math.max(1, container.clientHeight || windowRef?.innerHeight || 1)
    );
    Profiles.applyRendererProfile(renderer, THREE, profile);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    for (const light of Profiles.createLightsFromProfile(THREE, profile)) {
      scene.add(light);
    }

    const modelRoot = new THREE.Group();
    modelRoot.name = 'visualParityDiagnosticRoot';
    modelRoot.userData.isVoxelRoot = true;
    modelRoot.userData.type = target.blockType || target.asset.assetId;
    modelRoot.userData.visualAssetId = target.asset.assetId;
    scene.add(modelRoot);

    const attached = await loader.attachImportedVisual(modelRoot);
    if (!attached) {
      throw new Error(`Failed to attach imported visual for "${request.block || request.assetId}".`);
    }

    const bounds = computeObjectBounds(modelRoot, THREE);
    const framing = bounds.valid ? fitCameraToBounds(camera, bounds, THREE) : null;

    let frameId = null;
    const render = () => {
      renderer.render(scene, camera);
    };
    const tick = () => {
      frameId = windowRef.requestAnimationFrame(tick);
      render();
    };
    tick();

    const resize = () => {
      const width = Math.max(1, container.clientWidth || windowRef?.innerWidth || 1);
      const height = Math.max(1, container.clientHeight || windowRef?.innerHeight || 1);
      renderer.setPixelRatio(Math.min(windowRef?.devicePixelRatio || 1, profile.renderer.pixelRatioCap));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    windowRef?.addEventListener?.('resize', resize);

    createStatusOverlay(documentRef, request, profile);

    const state = Object.freeze({
      ready: true,
      request,
      profileId: profile.id,
      profile,
      blockType: target.blockType,
      assetId: target.asset.assetId,
      bootstrap,
      framing,
      scene,
      camera,
      renderer,
      modelRoot,
      render,
      dispose() {
        if (frameId != null) windowRef?.cancelAnimationFrame?.(frameId);
        frameId = null;
        windowRef?.removeEventListener?.('resize', resize);
        renderer.dispose?.();
      }
    });

    if (windowRef) windowRef.__VAW_VISUAL_PARITY_DIAGNOSTIC__ = state;
    return state;
  }

  const api = Object.freeze({
    DEFAULT_PROFILE_ID,
    PROFILE_IDS: Object.freeze(Object.keys(PROFILE_BY_ID)),
    PROFILE_BY_ID,
    parseRequest,
    resolveProfile,
    computeObjectBounds,
    fitCameraToBounds,
    run
  });

  return api;
}

function ensureRendererProfilesModule(VAW) {
  const moduleId = 'game.visual-renderer-profiles';
  if (VAW.inspect().defined.includes(moduleId)) return VAW.require(moduleId);
  const nodeRequire = typeof require === 'function'
    ? require
    : (typeof process !== 'undefined' && process.mainModule && process.mainModule.require
      ? process.mainModule.require.bind(process.mainModule)
      : null);
  if (nodeRequire) {
    const path = nodeRequire('path');
    const profilesPath = path.join(process.cwd(), 'src/game/visual-renderer-profiles.js');
    return nodeRequire(profilesPath).ensureVawModule(VAW);
  }
  const request = new XMLHttpRequest();
  request.open('GET', 'src/game/visual-renderer-profiles.js', false);
  request.send();
  if (request.status !== 200) {
    throw new Error('Failed to load visual-renderer-profiles.js for visual parity diagnostic bootstrap.');
  }
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', 'exports', `${request.responseText}\n;return module.exports;`);
  factory(module, module.exports).ensureVawModule(VAW);
  return VAW.require(moduleId);
}

function ensureVawModule(VAW) {
  if (!VAW || typeof VAW.define !== 'function' || typeof VAW.require !== 'function') {
    throw new TypeError('VAW kernel is required.');
  }
  const profiles = ensureRendererProfilesModule(VAW);
  const moduleId = 'game.visual-parity-diagnostic';
  if (!VAW.inspect().defined.includes(moduleId)) {
    VAW.define(moduleId, ['game.visual-renderer-profiles'], loadedProfiles => {
      return createVisualParityDiagnostic(loadedProfiles);
    });
  }
  return VAW.require(moduleId);
}

if (typeof window === 'object' && window.VAW && typeof window.VAW.define === 'function') {
  ensureVawModule(window.VAW);
}

if (typeof module === 'object' && module.exports) {
  const Profiles = require('./visual-renderer-profiles.js');
  module.exports = Object.freeze({
    ...createVisualParityDiagnostic(Profiles),
    ensureRendererProfilesModule,
    ensureVawModule
  });
}