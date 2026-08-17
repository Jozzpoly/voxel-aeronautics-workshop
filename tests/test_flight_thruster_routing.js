'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
global.window = global;
for (const relative of ['src/foundation/kernel.js', 'src/game/flight_thruster_router.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const calls = [];
const bodies = new Map([
  ['root', { position: { x: 0, y: 0, z: 0 }, angle: 0 }],
  ['arm', { position: { x: 10, y: 2, z: 0 }, angle: Math.PI / 2 }]
]);
function rotateZ(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}
const session = {
  hasBody: id => bodies.has(String(id)),
  vectorToWorldFrame(id, vector) { return rotateZ(vector, bodies.get(String(id)).angle); },
  vectorToLocalFrame(id, vector) { return rotateZ(vector, -bodies.get(String(id)).angle); },
  pointToWorldFrame(id, point) {
    const body = bodies.get(String(id));
    const rotated = rotateZ(point, body.angle);
    return { x: body.position.x + rotated.x, y: body.position.y + rotated.y, z: body.position.z + rotated.z };
  },
  applyBodyForce(bodyId, force, point) { calls.push({ bodyId, force: { ...force }, point: { ...point } }); }
};
const router = window.VAW.require('game.flight-thruster-router').create({ flightSession: session });
function thruster(bodyId, extra = {}) {
  return { blockId: `thruster:${bodyId}`, bodyId, type: 'Thruster', attached: true, bodyLocalPosition: { x: 2, y: 0, z: 0 }, lastCommand: 0, ...extra };
}
function close(a, b) { return Math.abs(a - b) < 1e-9; }

const root = thruster('root');
assert(router.routeLocalForce(root, { x: 1, y: 0, z: 0 }).applied);
assert.strictEqual(calls.at(-1).bodyId, 'root', 'Root thruster must apply force to root body.');

const arm = thruster('arm');
assert(router.routeLocalForce(arm, { x: 1, y: 0, z: 0 }).applied);
assert.strictEqual(calls.at(-1).bodyId, 'arm', 'Sub-body thruster must apply force only to its own body.');
assert(close(calls.at(-1).force.x, 0) && close(calls.at(-1).force.y, 1), 'Sub-body world axis must use its current body rotation.');
assert(close(calls.at(-1).point.x, 10) && close(calls.at(-1).point.y, 4), 'Sub-body application point must use its current body transform.');

const beforeSeparate = calls.length;
router.routeLocalForce(root, { x: 2, y: 0, z: 0 });
router.routeLocalForce(arm, { x: 3, y: 0, z: 0 });
assert.deepStrictEqual(calls.slice(beforeSeparate).map(call => call.bodyId), ['root', 'arm'], 'Thrusters on separate bodies require separate force calls.');

bodies.get('arm').angle = Math.PI;
router.routeLocalForce(arm, { x: 1, y: 0, z: 0 });
assert(close(calls.at(-1).force.x, -1) && close(calls.at(-1).force.y, 0), 'Hinge/body rotation must update the world thrust axis.');
bodies.get('arm').position = { x: 20, y: 5, z: 1 };
router.routeLocalForce(arm, { x: 1, y: 0, z: 0 });
assert(close(calls.at(-1).point.x, 18) && close(calls.at(-1).point.y, 5) && close(calls.at(-1).point.z, 1), 'Sub-body movement must update the world application point.');

const detached = thruster('arm', { attached: false, lastCommand: 1 });
const callCount = calls.length;
assert.deepStrictEqual(router.routeLocalForce(detached, { x: 1, y: 0, z: 0 }), { applied: false, reason: 'detached' });
router.recordCommand(detached, 1, 1, 1);
assert.strictEqual(detached.lastCommand, 0, 'Detached thruster command/flame state must be cleared.');
assert.strictEqual(calls.length, callCount, 'Detached thruster must not generate force.');

const commanded = thruster('arm');
assert(close(router.recordCommand(commanded, 0.8, 0.5, 0.25), 0.1));
assert(close(commanded.lastCommand, 0.1), 'Flame state must reflect effective fuel- and health-scaled command.');

bodies.get('arm').angle = Math.PI / 2;
const bodyPilot = router.pilotForBody('root', 'arm', { surge: 1, lift: 0, sway: 0, roll: 1, yaw: 0, pitch: 0 });
assert(close(bodyPilot.surge, 0) && close(bodyPilot.lift, -1), 'Manual linear intent must be remapped through primary world frame into the sub-body frame.');
assert(close(bodyPilot.roll, 0) && close(bodyPilot.yaw, -1), 'Manual angular intent must be remapped into the sub-body frame.');

const missing = thruster('missing');
assert.deepStrictEqual(router.routeLocalForce(missing, { x: 1, y: 0, z: 0 }), { applied: false, reason: 'missing-body', bodyId: 'missing' });
assert.strictEqual(calls.length, callCount, 'Missing ownership must never fall back to the camera/root body.');
assert.throws(() => router.routeLocalForce(thruster(null), { x: 1, y: 0, z: 0 }), /no body ownership/);

const gameSource = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
assert(gameSource.includes("pilotControlled: bodyId === started.primaryBodyId || part.type === 'Thruster' || part.type === 'VectorThruster'"), 'Runtime creation must command articulated thrusters.');
assert(gameSource.includes('flightThrusterRouter.recordCommand'), 'Effective command must drive lastCommand/flame state.');
assert(gameSource.includes('flightThrusterRouter.routeLocalForce'), 'Game loop must route force through explicit body ownership.');
assert(gameSource.includes('gimbalRoll = Number(pilot.roll) || 0'), 'VectorThruster roll must remain renderer-only visual state.');
assert(gameSource.includes('PHYSICS.gimbalAngle, { roll: mod.gimbalRoll || 0 }'), 'VectorThruster rig profiles must receive roll in the visual adapter path.');

console.log(JSON.stringify({
  rootBodyRouting: 'ok',
  subBodyRouting: 'ok',
  separateBodyCalls: 'ok',
  movingAxisAndPoint: 'ok',
  detachedAndMissingSafety: 'ok',
  bodyRelativePilot: 'ok',
  effectiveCommandVisualState: 'ok',
  cameraRootIndependence: 'ok'
}, null, 2));
