const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of [
  'src/foundation/kernel.js',
  'src/runtime/physics_port.js',
  'src/runtime/headless_physics_backend.js',
  'src/runtime/assembly_builder.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
const Physics = global.VAW.require('runtime.headless-physics-backend').create();
const AssemblyBuilder = global.VAW.require('runtime.assembly-builder');

function makePlan(count) {
  const colliders = [];
  const parts = [];
  const blockIds = [];
  for (let index = 0; index < count; index++) {
    const blockId = `block:${index}`;
    blockIds.push(blockId);
    const x = index % 50;
    const y = Math.floor(index / 50) % 10;
    const z = Math.floor(index / 500);
    colliders.push({ colliderId: `collider:${blockId}`, blockId, bodyId: 'body:root', kind: 'box', center: [x, y, z], halfExtents: [0.5, 0.5, 0.5] });
    parts.push({ blockId, bodyId: 'body:root', type: 'Hull' });
  }
  return {
    format: 'BENCHMARK_PLAN', rootBodyId: 'body:root', constraints: [], signalLinks: [], parts,
    rigidBodies: [{
      bodyId: 'body:root', role: 'root', blockIds, sourceAssemblyCenterOfMass: [0, 0, 0], assemblyPose: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
      massProperties: { mass: count, centerOfMass: [0, 0, 0], inertiaDiagonal: [count, count, count] },
      colliders
    }]
  };
}

const results = [];
for (const count of [100, 500, 1000, 2500]) {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    const world = Physics.createWorld({ gravity: { x: 0, y: -9.81, z: 0 } });
    const start = performance.now();
    const runtime = AssemblyBuilder.build({ plan: makePlan(count), physics: Physics, world });
    samples.push(performance.now() - start);
    assert.strictEqual(runtime.colliderByBlockId.size, count);
    assert.strictEqual(runtime.partByBlockId.size, count);
    for (let step = 0; step < 120; step++) Physics.step(world, 1 / 120);
    assert(Number.isFinite(runtime.rootBody.position.y));
    runtime.dispose();
    assert.strictEqual(world.bodies.length, 0);
  }
  samples.sort((a, b) => a - b);
  const medianMs = samples[Math.floor(samples.length / 2)];
  const maxMs = samples.at(-1);
  assert(maxMs < 5000, `Assembly build exceeded the safety ceiling for ${count} colliders: ${maxMs} ms`);
  results.push({ colliders: count, medianBuildMs: Number(medianMs.toFixed(3)), maxBuildMs: Number(maxMs.toFixed(3)) });
}
console.log(JSON.stringify({ backend: Physics.id, note: 'architecture baseline; not a Cannon backend decision', results }, null, 2));
