const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const Profiles = require(path.join(ROOT, 'src/game/visual-renderer-profiles.js'));
const studioSource = fs.readFileSync(
  path.join(ROOT, 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js'),
  'utf8'
);
const sceneEnvironmentSource = fs.readFileSync(path.join(ROOT, 'src/game/scene_environment.js'), 'utf8');

const GAME_DEFAULT_SOURCE = Object.freeze({
  fog: { color: 0x0b1220, density: 0.0038 },
  renderer: {
    antialias: true,
    powerPreference: 'high-performance',
    pixelRatioCap: 2,
    shadowMap: { enabled: true, type: 'PCFSoftShadowMap' }
  },
  lights: [
    'AmbientLight(0xffffff, 0.66)',
    'HemisphereLight(0xcde8ff, 0x152238, 0.62)',
    'DirectionalLight(0xffffff, 0.95)',
    'position.set(12, 20, 10)',
    'sun.shadow.mapSize.width = 2048',
    'sun.shadow.mapSize.height = 2048'
  ],
  grid: { centerLine: 0x3b4b66, gridLine: 0x1c2940 }
});

function firstHexAfter(source, marker) {
  const index = source.indexOf(marker);
  assert(index >= 0, `marker not found: ${marker}`);
  const match = source.slice(index, index + 200).match(/0x[0-9a-fA-F]+/);
  assert(match, `hex literal not found after: ${marker}`);
  return Number.parseInt(match[0], 16);
}

function lightLines(source) {
  return source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /(?:AmbientLight|HemisphereLight|DirectionalLight)/.test(line));
}

function parseStudioLights(source) {
  const lines = lightLines(source);
  assert.strictEqual(lines.length, 3, `expected three studio lights, found ${lines.length}`);
  return lines;
}

function assertLightLine(line, expectedSnippet) {
  assert(
    line.includes(expectedSnippet),
    `light line mismatch.\nexpected snippet: ${expectedSnippet}\nactual: ${line}`
  );
}

{
  const { STUDIO_PREVIEW_PROFILE } = Profiles;
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.scene.background, firstHexAfter(studioSource, 'scene.background'));
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.antialias, true);
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.alpha, false);
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.preserveDrawingBuffer, true);
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.pixelRatioCap, 2);
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.outputColorSpace, 'srgb');
  assert.strictEqual(STUDIO_PREVIEW_PROFILE.renderer.shadowMap.enabled, false);
  assert(studioSource.includes('outputColorSpace') || studioSource.includes('outputEncoding'));
  assert(!studioSource.includes('scene.fog'));
  assert(!studioSource.includes('shadowMap.enabled = true'));

  const studioLights = parseStudioLights(studioSource);
  assertLightLine(studioLights[0], 'HemisphereLight(0xffffff, 0x1a2b44, 1.35)');
  assertLightLine(studioLights[1], 'DirectionalLight(0xffffff, 1.75)');
  assertLightLine(studioLights[2], 'DirectionalLight(0x9edcff, 0.6)');
  assert(studioSource.includes('key.position.set(6, 8, 5)'));
  assert(studioSource.includes('rim.position.set(-4, 3, -6)'));

  assert.deepStrictEqual(STUDIO_PREVIEW_PROFILE.lights[0], {
    type: 'HemisphereLight',
    skyColor: 0xffffff,
    groundColor: 0x1a2b44,
    intensity: 1.35
  });
  assert.deepStrictEqual(STUDIO_PREVIEW_PROFILE.lights[1], {
    type: 'DirectionalLight',
    color: 0xffffff,
    intensity: 1.75,
    position: { x: 6, y: 8, z: 5 },
    castShadow: false
  });
  assert.deepStrictEqual(STUDIO_PREVIEW_PROFILE.lights[2], {
    type: 'DirectionalLight',
    color: 0x9edcff,
    intensity: 0.6,
    position: { x: -4, y: 3, z: -6 },
    castShadow: false
  });
}

{
  const { GAME_DEFAULT_PROFILE } = Profiles;

  assert.strictEqual(GAME_DEFAULT_PROFILE.scene.fog.type, 'FogExp2');
  assert.strictEqual(GAME_DEFAULT_PROFILE.scene.fog.color, GAME_DEFAULT_SOURCE.fog.color);
  assert.strictEqual(GAME_DEFAULT_PROFILE.scene.fog.density, GAME_DEFAULT_SOURCE.fog.density);
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.antialias, GAME_DEFAULT_SOURCE.renderer.antialias);
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.powerPreference, GAME_DEFAULT_SOURCE.renderer.powerPreference);
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.pixelRatioCap, GAME_DEFAULT_SOURCE.renderer.pixelRatioCap);
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.outputColorSpace, 'srgb');
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.shadowMap.enabled, GAME_DEFAULT_SOURCE.renderer.shadowMap.enabled);
  assert.strictEqual(GAME_DEFAULT_PROFILE.renderer.shadowMap.type, GAME_DEFAULT_SOURCE.renderer.shadowMap.type);
  assert.strictEqual(GAME_DEFAULT_PROFILE.grid.centerLine, GAME_DEFAULT_SOURCE.grid.centerLine);
  assert.strictEqual(GAME_DEFAULT_PROFILE.grid.gridLine, GAME_DEFAULT_SOURCE.grid.gridLine);

  assert.deepStrictEqual(GAME_DEFAULT_PROFILE.lights[0], {
    type: 'AmbientLight',
    color: 0xffffff,
    intensity: 0.66
  });
  assert.deepStrictEqual(GAME_DEFAULT_PROFILE.lights[1], {
    type: 'HemisphereLight',
    skyColor: 0xcde8ff,
    groundColor: 0x152238,
    intensity: 0.62
  });
  assert.deepStrictEqual(GAME_DEFAULT_PROFILE.lights[2], {
    type: 'DirectionalLight',
    color: 0xffffff,
    intensity: 0.95,
    position: { x: 12, y: 20, z: 10 },
    castShadow: true,
    shadow: { mapSize: { width: 2048, height: 2048 } }
  });

  assert(sceneEnvironmentSource.includes('GAME_DEFAULT_PROFILE'));
  assert(sceneEnvironmentSource.includes('applySceneFog'));
  assert(sceneEnvironmentSource.includes('createLightsFromProfile'));
  assert(sceneEnvironmentSource.includes('applyRendererProfile'));
}

{
  const { STUDIO_PREVIEW_PROFILE, GAME_STUDIO_PARITY_PROFILE } = Profiles;
  assert.strictEqual(GAME_STUDIO_PARITY_PROFILE.scene.background, STUDIO_PREVIEW_PROFILE.scene.background);
  assert.strictEqual(GAME_STUDIO_PARITY_PROFILE.scene.fog, null);
  assert.strictEqual(GAME_STUDIO_PARITY_PROFILE.renderer.outputColorSpace, 'srgb');
  assert.strictEqual(GAME_STUDIO_PARITY_PROFILE.renderer.shadowMap.enabled, false);
  assert.strictEqual(GAME_STUDIO_PARITY_PROFILE.lights, STUDIO_PREVIEW_PROFILE.lights);
}

console.log({
  visualRendererProfiles: 'ok',
  profiles: ['studio-preview', 'game-default', 'game-studio-parity']
});