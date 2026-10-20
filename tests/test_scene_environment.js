const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
global.innerWidth = 1280;
global.innerHeight = 720;
global.devicePixelRatio = 1;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests/browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

for (const relative of [
  'src/foundation/kernel.js',
  'src/game/scene_environment.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const SceneEnvironment = VAW.require('game.scene-environment');

function physicsStub() {
  return {
    createWorld: options => ({ options, bodies: [] }),
    createBody: options => ({ options, shapes: [] }),
    addPlaneCollider: body => { body.planeCollider = true; },
    setBodyTransform: (body, transform) => { body.transform = transform; },
    addBody: (world, body) => { world.bodies.push(body); },
    addBoxCollider: (body, collider) => { body.shapes.push(collider); }
  };
}

function baseOptions(THREE) {
  return {
    THREE,
    Physics: physicsStub(),
    container: { children: [], appendChild(child) { this.children.push(child); } },
    GRID: { halfExtent: 32 },
    AEROSTATIC_POLICY: { gravity: 9.81 },
    COLLISION_GROUP: { world: 1, craft: 2, debris: 4 },
    TEST_RANGE: {
      startPad: { x: 0, y: 0, z: 0, radius: 4 },
      finishPad: { x: 40, y: 0, z: 0, radius: 4 },
      pads: {
        startPad: { x: 0, y: 0, z: 0, radius: 4 },
        finishPad: { x: 40, y: 0, z: 0, radius: 4 }
      },
      padIds: ['startPad', 'finishPad'],
      bounds: 80,
      groundY: -0.5,
      terrain: {
        fog: { color: 0x0b1220, density: 0.0038 },
        baseMaterial: 'basin',
        materials: {
          basin: { color: 0x15283a, roughness: 1, texture: { kind: 'checker', colorA: 0x15283a, colorB: 0x1b3349, repeat: 16 } },
          routePaint: { color: 0x93c5fd, roughness: 1, opacity: 0.4, texture: { kind: 'stripe', colorA: 0x60a5fa, colorB: 0x1e3a8a, repeat: 12 } }
        },
        patches: [{ id: 'test-patch', material: 'basin', center: { x: 0, z: 0 }, size: { x: 20, z: 20 }, rotation: 0, layer: 10 }],
        strips: [{ id: 'test-strip', fromPad: 'startPad', toPad: 'finishPad', width: 6, material: 'routePaint', opacity: 0.4, layer: 20 }]
      },
      obstacles: []
    },
    BLOCKS: {
      Core: { color: 0xffffff },
      Hull: { color: 0xffffff },
      Frame: { color: 0xffffff },
      Thruster: { color: 0xffffff },
      VectorThruster: { color: 0xffffff },
      Balloon: { color: 0xffffff },
      Wing: { color: 0xffffff },
      ControlSurface: { color: 0xffffff },
      Gyro: { color: 0xffffff },
      Fuel: { color: 0xffffff }
    }
  };
}

function cloneThreeWithRenderer(Renderer, extra = {}) {
  return { ...THREE, ...extra, WebGLRenderer: Renderer };
}

{
  class RendererWithLegacyEncoding extends THREE.WebGLRenderer {
    constructor(options) {
      super(options);
      this.options = options;
      this.outputEncoding = 'linear';
    }
  }
  const three = cloneThreeWithRenderer(RendererWithLegacyEncoding, { sRGBEncoding: 'srgb-encoding' });
  const environment = SceneEnvironment.create(baseOptions(three));
  assert.strictEqual(environment.renderer.outputEncoding, 'srgb-encoding');
  assert.strictEqual(environment.renderer.options.powerPreference, 'high-performance');
}

{
  class RendererWithColorSpace extends THREE.WebGLRenderer {
    constructor(options) {
      super(options);
      this.options = options;
      this.outputColorSpace = 'linear';
      this.outputEncoding = 'linear';
    }
  }
  const three = cloneThreeWithRenderer(RendererWithColorSpace, {
    SRGBColorSpace: 'srgb-color-space',
    sRGBEncoding: 'srgb-encoding'
  });
  const environment = SceneEnvironment.create(baseOptions(three));
  assert.strictEqual(environment.renderer.outputColorSpace, 'srgb-color-space');
  assert.strictEqual(environment.renderer.outputEncoding, 'linear');
}

{
  const environment = SceneEnvironment.create(baseOptions(THREE));
  const terrainSurfaces = environment.testRangeGroup.children.filter(child => child.userData?.terrainLayer);
  const ground = terrainSurfaces.find(child => child.userData.terrainLayer === 'ground');
  const patch = terrainSurfaces.find(child => child.userData.terrainLayer === 'patch');
  const strip = terrainSurfaces.find(child => child.userData.terrainLayer === 'strip');
  assert(ground && patch && strip, 'scene should render ground, terrain patches and strips as layered terrain surfaces');
  assert(patch.position.y > ground.position.y, 'patch surface must sit above base ground to avoid z-fighting');
  assert(strip.position.y > patch.position.y, 'strip surface must sit above patches to avoid z-fighting');
  assert(strip.renderOrder > patch.renderOrder && patch.renderOrder > ground.renderOrder, 'terrain renderOrder must follow ground < patch < strip');
  assert.strictEqual(patch.material.polygonOffset, true);
  assert.strictEqual(strip.material.depthWrite, false);
}

console.log({ sceneEnvironment: 'ok', colorOutput: 'srgb' });
