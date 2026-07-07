'use strict';

function freezePosition(position) {
  return Object.freeze({ x: position.x, y: position.y, z: position.z });
}

function freezeLight(light) {
  const frozen = { ...light };
  if (light.position) frozen.position = freezePosition(light.position);
  if (light.shadow) {
    frozen.shadow = Object.freeze({
      ...light.shadow,
      mapSize: light.shadow.mapSize ? Object.freeze({ ...light.shadow.mapSize }) : undefined
    });
  }
  return Object.freeze(frozen);
}

function createVisualRendererProfiles() {
  const STUDIO_PREVIEW_PROFILE = Object.freeze({
    id: 'studio-preview',
    source: 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js',
    scene: Object.freeze({
      background: 0x07111f,
      fog: null
    }),
    renderer: Object.freeze({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: null,
      pixelRatioCap: 2,
      outputColorSpace: 'srgb',
      shadowMap: Object.freeze({
        enabled: false,
        type: null
      })
    }),
    lights: Object.freeze([
      freezeLight({ type: 'HemisphereLight', skyColor: 0xffffff, groundColor: 0x1a2b44, intensity: 1.35 }),
      freezeLight({ type: 'DirectionalLight', color: 0xffffff, intensity: 1.75, position: { x: 6, y: 8, z: 5 }, castShadow: false }),
      freezeLight({ type: 'DirectionalLight', color: 0x9edcff, intensity: 0.6, position: { x: -4, y: 3, z: -6 }, castShadow: false })
    ])
  });

  const GAME_DEFAULT_PROFILE = Object.freeze({
    id: 'game-default',
    source: 'src/game/scene_environment.js',
    scene: Object.freeze({
      fog: Object.freeze({
        type: 'FogExp2',
        color: 0x0b1220,
        density: 0.0038
      })
    }),
    renderer: Object.freeze({
      antialias: true,
      alpha: null,
      preserveDrawingBuffer: null,
      powerPreference: 'high-performance',
      pixelRatioCap: 2,
      outputColorSpace: 'srgb',
      shadowMap: Object.freeze({
        enabled: true,
        type: 'PCFSoftShadowMap'
      })
    }),
    lights: Object.freeze([
      freezeLight({ type: 'AmbientLight', color: 0xffffff, intensity: 0.66 }),
      freezeLight({ type: 'HemisphereLight', skyColor: 0xcde8ff, groundColor: 0x152238, intensity: 0.62 }),
      freezeLight({
        type: 'DirectionalLight',
        color: 0xffffff,
        intensity: 0.95,
        position: { x: 12, y: 20, z: 10 },
        castShadow: true,
        shadow: { mapSize: { width: 2048, height: 2048 } }
      })
    ]),
    grid: Object.freeze({
      centerLine: 0x3b4b66,
      gridLine: 0x1c2940
    })
  });

  const GAME_STUDIO_PARITY_PROFILE = Object.freeze({
    id: 'game-studio-parity',
    source: 'derived:studio-preview-with-game-srgb-policy',
    scene: Object.freeze({
      background: STUDIO_PREVIEW_PROFILE.scene.background,
      fog: null
    }),
    renderer: Object.freeze({
      antialias: STUDIO_PREVIEW_PROFILE.renderer.antialias,
      alpha: null,
      preserveDrawingBuffer: null,
      powerPreference: null,
      pixelRatioCap: STUDIO_PREVIEW_PROFILE.renderer.pixelRatioCap,
      outputColorSpace: 'srgb',
      shadowMap: Object.freeze({
        enabled: false,
        type: null
      })
    }),
    lights: STUDIO_PREVIEW_PROFILE.lights
  });

  function configureRendererColorOutput(renderer, THREE) {
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
  }

  function resolveFogColor(profile, fogConfig = {}) {
    return Number.isFinite(fogConfig.color) ? fogConfig.color : profile.scene.fog.color;
  }

  function resolveFogDensity(profile, fogConfig = {}) {
    return Number.isFinite(fogConfig.density) ? fogConfig.density : profile.scene.fog.density;
  }

  function applySceneFog(scene, THREE, profile, fogConfig = {}) {
    if (!profile.scene.fog) {
      scene.fog = null;
      return;
    }
    const color = resolveFogColor(profile, fogConfig);
    const density = resolveFogDensity(profile, fogConfig);
    scene.background = new THREE.Color(color);
    scene.fog = new THREE.FogExp2(color, density);
  }

  function applySceneBackground(scene, THREE, profile) {
    if (!Number.isFinite(profile.scene.background)) return;
    scene.background = new THREE.Color(profile.scene.background);
    if (!profile.scene.fog) scene.fog = null;
  }

  function createLightFromSpec(THREE, spec) {
    let light = null;
    if (spec.type === 'AmbientLight') {
      light = new THREE.AmbientLight(spec.color, spec.intensity);
    } else if (spec.type === 'HemisphereLight') {
      light = new THREE.HemisphereLight(spec.skyColor, spec.groundColor, spec.intensity);
    } else if (spec.type === 'DirectionalLight') {
      light = new THREE.DirectionalLight(spec.color, spec.intensity);
      if (spec.position) light.position.set(spec.position.x, spec.position.y, spec.position.z);
      if (spec.castShadow) {
        light.castShadow = true;
        if (spec.shadow?.mapSize) {
          light.shadow.mapSize.width = spec.shadow.mapSize.width;
          light.shadow.mapSize.height = spec.shadow.mapSize.height;
        }
      }
    } else {
      throw new Error(`Unsupported light type: ${String(spec.type)}`);
    }
    return light;
  }

  function createLightsFromProfile(THREE, profile) {
    return profile.lights.map(spec => createLightFromSpec(THREE, spec));
  }

  function buildRendererOptions(profile) {
    const options = { antialias: profile.renderer.antialias };
    if (profile.renderer.alpha !== null && profile.renderer.alpha !== undefined) options.alpha = profile.renderer.alpha;
    if (profile.renderer.preserveDrawingBuffer) options.preserveDrawingBuffer = true;
    if (profile.renderer.powerPreference) options.powerPreference = profile.renderer.powerPreference;
    return options;
  }

  function applyRendererProfile(renderer, THREE, profile) {
    configureRendererColorOutput(renderer, THREE);
    if (profile.renderer.shadowMap) {
      renderer.shadowMap.enabled = Boolean(profile.renderer.shadowMap.enabled);
      if (profile.renderer.shadowMap.enabled && profile.renderer.shadowMap.type && THREE[profile.renderer.shadowMap.type]) {
        renderer.shadowMap.type = THREE[profile.renderer.shadowMap.type];
      }
    }
  }

  function resolveProfilesPath() {
    if (typeof require !== 'function') return null;
    try {
      const fs = require('fs');
      const path = require('path');
      const candidates = [
        typeof __filename === 'string' ? __filename : null,
        typeof process !== 'undefined' && typeof process.cwd === 'function'
          ? path.join(process.cwd(), 'src/game/visual-renderer-profiles.js')
          : null
      ].filter(Boolean);
      for (const candidate of candidates) {
        const resolved = candidate.endsWith('visual-renderer-profiles.js')
          ? candidate
          : path.join(path.dirname(candidate), 'visual-renderer-profiles.js');
        if (fs.existsSync(resolved)) return resolved;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function ensureVawModule(VAW) {
    if (!VAW || typeof VAW.define !== 'function' || typeof VAW.require !== 'function') {
      throw new TypeError('VAW kernel is required.');
    }
    const moduleId = 'game.visual-renderer-profiles';
    if (!VAW.inspect().defined.includes(moduleId)) {
      VAW.define(moduleId, [], () => api);
    }
    return VAW.require(moduleId);
  }

  const api = Object.freeze({
    STUDIO_PREVIEW_PROFILE,
    GAME_DEFAULT_PROFILE,
    GAME_STUDIO_PARITY_PROFILE,
    configureRendererColorOutput,
    resolveFogColor,
    resolveFogDensity,
    applySceneFog,
    applySceneBackground,
    createLightFromSpec,
    createLightsFromProfile,
    buildRendererOptions,
    applyRendererProfile,
    resolveProfilesPath,
    ensureVawModule
  });

  return api;
}

const api = createVisualRendererProfiles();

if (typeof module === 'object' && module.exports) {
  module.exports = api;
}