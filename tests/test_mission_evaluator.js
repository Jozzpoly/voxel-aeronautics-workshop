const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/kernel.js'), 'utf8'), { filename: 'kernel.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/mission_evaluator.js'), 'utf8'), { filename: 'mission_evaluator.js' });

const MissionEvaluator = global.VAW.require('foundation.mission-evaluator');
const policy = MissionEvaluator.normalizeLandingPolicy({ requiredHoldSeconds: 1.6 });
const zone = { x: 82, z: 0, radius: 9 };
const baseSample = {
  position: { x: 82, y: 0.05, z: 0 },
  velocity: { x: 0.1, y: 0.02, z: 0.1 },
  tiltDegrees: 2,
  groundClearance: 0.05,
  contactAge: 99
};

const restingWithoutFreshCollision = MissionEvaluator.evaluateLanding(baseSample, zone, policy);
assert.strictEqual(restingWithoutFreshCollision.settled, true, 'A physically grounded craft must not depend on a continuously repeated collide event.');
assert.strictEqual(restingWithoutFreshCollision.nearGround, true);
assert.strictEqual(restingWithoutFreshCollision.recentContact, false);

let hold = 0;
for (let index = 0; index < 240; index += 1) {
  hold = MissionEvaluator.advanceHold(hold, 1 / 120, restingWithoutFreshCollision.settled, policy);
}
assert.strictEqual(hold, policy.requiredHoldSeconds, 'A stable landing must complete the dwell period.');

const airborne = MissionEvaluator.evaluateLanding({ ...baseSample, groundClearance: 0.8, contactAge: 0.1 }, zone, policy);
assert.strictEqual(airborne.settled, false, 'A stale/recent contact timestamp must not validate a craft that is visibly airborne.');
assert.strictEqual(airborne.blockingReason, 'not-grounded');

const tooFast = MissionEvaluator.evaluateLanding({ ...baseSample, velocity: { x: 2.5, y: 0.1, z: 0 } }, zone, policy);
assert.strictEqual(tooFast.settled, false);
assert.strictEqual(tooFast.blockingReason, 'moving');

const outside = MissionEvaluator.evaluateLanding({ ...baseSample, position: { x: 93, y: 0.05, z: 0 } }, zone, policy);
assert.strictEqual(outside.settled, false);
assert.strictEqual(outside.blockingReason, 'outside-zone');

const multiZone = MissionEvaluator.evaluateLandingZones(baseSample, [{ x: 0, z: 0, radius: 9 }, zone], policy);
assert.strictEqual(multiZone.settled, true, 'Landing on any authorized zone should settle the mission.');
assert.strictEqual(multiZone.zoneIndex, 1);
const nearestZone = MissionEvaluator.evaluateLandingZones({ ...baseSample, position: { x: 40, y: 0.05, z: 0 } }, [{ x: 0, z: 0, radius: 9 }, zone], policy);
assert.strictEqual(nearestZone.zoneIndex, 0, 'When no zone is settled, guidance should select the nearest authorized pad.');

const tilted = MissionEvaluator.evaluateLanding({ ...baseSample, tiltDegrees: 31 }, zone, policy);
assert.strictEqual(tilted.settled, false);
assert.strictEqual(tilted.blockingReason, 'tilted');

let recoveredHold = 1.2;
recoveredHold = MissionEvaluator.advanceHold(recoveredHold, 0.1, false, policy);
assert(recoveredHold > 0.9 && recoveredHold < 1.2, 'A single noisy frame should decay landing progress instead of erasing it.');
recoveredHold = MissionEvaluator.advanceHold(recoveredHold, 0.5, true, policy);
assert(recoveredHold > 1.3, 'Landing hold should recover after a brief jitter.');

const identityExtent = MissionEvaluator.boxVerticalHalfExtent({ x: 0, y: 0, z: 0, w: 1 }, { x: 0.5, y: 0.5, z: 0.5 });
assert(Math.abs(identityExtent - 0.5) < 1e-9);
const quarterTurnX = { x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) };
const projectedY = MissionEvaluator.projectLocalPointY({ x: 0, y: 10, z: 0 }, quarterTurnX, { x: 0, y: 2, z: 0 });
assert(Math.abs(projectedY - 10) < 1e-8, 'Quaternion projection should rotate local +Y onto world -/+Z for a 90° X rotation.');

console.log(JSON.stringify({
  groundStateWithoutContinuousCollision: 'ok',
  landingDwell: 'ok',
  jitterHysteresis: 'ok',
  zoneSpeedTiltGuards: 'ok',
  multiZoneLanding: 'ok',
  rotatedClearanceProjection: 'ok'
}, null, 2));
