const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/mass_properties.js',
  'src/game/flight_integrity.js'
]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
const MassProperties = global.VAW.require('foundation.mass-properties');
const FlightIntegrity = global.VAW.require('game.flight-integrity');

function part(blockId, bodyId, x, type = 'Frame') {
  return {
    blockId, bodyId, key: `${x},0,0`, grid: { x, y: 0, z: 0 }, type,
    def: { structural: 1, dragArea: 0.2, durability: 10, fuelCapacity: type === 'Fuel' ? 5 : 0 },
    mass: 1, localPos: { x, y: 0, z: 0 }, maxHealth: 10, health: 10, attached: true,
    visual: { position: { x, y: 0, z: 0 } }
  };
}
function createFixture({ rejectRemovalOnce = false } = {}) {
  const parts = [part('core', 'body:root', 0, 'Core'), part('frame', 'body:root', 1), part('rotor', 'body:rotor', 0)];
  const runtimePartById = new Map(parts.map(item => [item.blockId, item]));
  const runtimePartByKey = new Map(parts.map(item => [item.key, item]));
  const state = { flight: {
    runtimeParts: parts, runtimePartById, runtimePartByKey, metricsDirty: true,
    payload: null, payloadLocalPos: null, payloadMass: 0, initialHealth: 20,
    integrity: 100, dragArea: 0, gyroAuthority: 0, gyroCount: 0, leakingFuelRate: 0,
    fuelMax: 10, fuel: 10, lostParts: 0, structuralFailures: 0, blockCount: 3,
    firstFailure: '', runtimeMass: 2, currentInertia: { x: 0, y: 0, z: 0, set(x,y,z){this.x=x;this.y=y;this.z=z;} },
    lowestLocalY: -0.5, debris: []
  } };
  const blockBody = new Map(parts.map(item => [item.blockId, item.bodyId]));
  const colliders = new Map(parts.map(item => [item.blockId, { colliderId: `c:${item.blockId}`, blockId: item.blockId, bodyId: item.bodyId }]));
  const visualRoots = new Map([
    ['body:root', { children: [parts[0].visual, parts[1].visual] }],
    ['body:rotor', { children: [parts[2].visual] }]
  ]);
  let reject = rejectRemovalOnce;
  const calls = [];
  const session = {
    primaryBodyId: () => 'body:root',
    hasBody: bodyId => bodyId === 'body:root' || bodyId === 'body:rotor',
    getBodyIdForBlock: blockId => blockBody.get(blockId) || null,
    getPartDescriptor: blockId => blockBody.has(blockId) ? { blockId, bodyId: blockBody.get(blockId) } : null,
    getColliderOwnershipByBlockId: blockId => colliders.get(blockId) || null,
    getColliderOwnership: colliderId => [...colliders.values()].find(item => item.colliderId === colliderId) || null,
    removeColliderByBlockId(blockId) {
      calls.push(`remove:${blockId}`);
      if (reject) { reject = false; return false; }
      return colliders.delete(blockId);
    },
    removeCollider(colliderId) {
      const found = [...colliders.entries()].find(([, item]) => item.colliderId === colliderId);
      if (!found) return false;
      calls.push(`remove:${colliderId}`);
      colliders.delete(found[0]); return true;
    },
    recenterBody(bodyId, shift) { calls.push({ recenter: bodyId, shift: { ...shift } }); return true; },
    setBodyMassProperties(bodyId, value) { calls.push({ mass: bodyId, value }); return value; },
    getVisualRoot: bodyId => visualRoots.get(bodyId) || null
  };
  const detached = [];
  const disposedDebris = [];
  const integrity = FlightIntegrity.create({
    state, flightSession: session, MassProperties,
    neighborDirections: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
    hooks: {
      onPartDetached(item) { detached.push(item.blockId); },
      createDebris(descriptor) { return { id: descriptor.id, age: 0 }; },
      updateDebris(entry, dt) { entry.age += dt; return entry.age >= 1; },
      disposeDebris(entry) { disposedDebris.push(entry.id); return true; }
    }
  });
  return { state, parts, session, integrity, colliders, calls, detached, disposedDebris };
}

// Ownership is exact and never falls back to primary body.
{
  const { parts, integrity } = createFixture();
  assert.strictEqual(integrity.bodyIdForPart(parts[2]), 'body:rotor');
  integrity.recompute(true);
  const fixture = createFixture();
  fixture.integrity.recompute(true);
  assert.strictEqual(fixture.state.flight.integrity, 100, 'Primary-island integrity must not include another body in its denominator.');
  assert.strictEqual(integrity.bodyIdForPart({ blockId: 'missing' }), null);
  assert.throws(() => integrity.applyDamageOnly({ blockId: 'missing', attached: true, def: {}, health: 1, maxHealth: 1 }, 1), /no runtime body ownership/);
  assert.throws(() => integrity.detachParts([{ part: parts[2], reason: 'test' }]), /primary-rigid-island-only/);
}

// Backend-first removal preserves gameplay maps after a failed collider mutation.
{
  const { state, parts, integrity, colliders } = createFixture({ rejectRemovalOnce: true });
  assert.throws(() => integrity.detachParts([{ part: parts[1], reason: 'impact' }], false), /state was not mutated/);
  assert.strictEqual(parts[1].attached, true);
  assert.strictEqual(state.flight.runtimePartById.has('frame'), true);
  assert.strictEqual(colliders.has('frame'), true);
  assert.strictEqual(integrity.detachParts([{ part: parts[1], reason: 'impact' }], false), 1);
  assert.strictEqual(parts[1].attached, false);
  assert.strictEqual(state.flight.runtimePartById.has('frame'), false);
  assert.strictEqual(state.flight.runtimePartByKey.has('1,0,0'), false);
}

// Per-body recenter only shifts the selected body's parts and visual children.
{
  const { state, parts, integrity, calls } = createFixture();
  const rotorBefore = { ...parts[2].localPos };
  const result = integrity.recenterBody('body:root');
  assert(result && result.bodyId === 'body:root');
  assert.deepStrictEqual(parts[2].localPos, rotorBefore, 'Another rigid island must not be recentered.');
  assert(calls.some(call => call.recenter === 'body:root'));
  assert(calls.some(call => call.mass === 'body:root'));
  assert.strictEqual(state.flight.runtimeMass, 2);
}

// Damage is routed through exact ownership and detaches only the intended block.
{
  const { parts, integrity, detached } = createFixture();
  integrity.damagePart(parts[1], 100, 'test impact');
  assert.strictEqual(parts[1].attached, false);
  assert.strictEqual(parts[2].attached, true);
  assert.deepStrictEqual(detached, ['frame']);
}


// Presentation hook failures are diagnosed but cannot leave backend-first integrity mutations half committed.
{
  const fixture = createFixture();
  const diagnostics = [];
  const failing = FlightIntegrity.create({
    state: fixture.state,
    flightSession: fixture.session,
    MassProperties,
    neighborDirections: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
    hooks: {
      onPartDetached() { throw new Error('synthetic presentation failure'); },
      onDiagnostic(entry) { diagnostics.push(entry); }
    }
  });
  assert.strictEqual(failing.detachParts([{ part: fixture.parts[1], reason: 'test' }], false), 1);
  assert.strictEqual(fixture.parts[1].attached, false);
  assert.strictEqual(fixture.state.flight.runtimePartById.has('frame'), false);
  assert.strictEqual(diagnostics.length, 1);
  assert.strictEqual(diagnostics[0].hook, 'onPartDetached');
}

// Payload ownership and debris lifecycle are explicit.
{
  const { state, integrity, colliders, disposedDebris } = createFixture();
  state.flight.payload = { bodyId: 'body:root', colliderId: 'c:payload', attached: true, health: 5, maxHealth: 5, mass: 2, localPos: { x: 0, y: -1, z: 0 } };
  colliders.set('payload', { colliderId: 'c:payload', blockId: null, bodyId: 'body:root' });
  assert.strictEqual(integrity.damagePayload(10, 'payload test'), true);
  assert.strictEqual(state.flight.payload.attached, false);
  integrity.createDebris({ id: 'd1' });
  integrity.updateDebris(0.5);
  assert.strictEqual(state.flight.debris.length, 1);
  integrity.updateDebris(0.5);
  assert.strictEqual(state.flight.debris.length, 0);
  assert.deepStrictEqual(disposedDebris, ['d1']);
}

console.log(JSON.stringify({
  exactPartOwnership: 'ok',
  destructiveFallbackRejected: 'ok',
  backendFirstMutation: 'ok',
  perBodyRecenter: 'ok',
  wrongBodyDamagePrevented: 'ok',
  payloadOwnership: 'ok',
  debrisLifecycle: 'ok',
  presentationHookIsolation: 'ok'
}, null, 2));
