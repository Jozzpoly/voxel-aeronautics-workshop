const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { load } = require('./load_runtime');
load(['src/foundation/kernel.js', 'src/game/build_targeting.js']);

const BuildTargeting = VAW.require('game.build-targeting');

function assertAxis(actual, expected, message) {
  assert.deepStrictEqual([...actual], expected, message);
}

const nearZero = BuildTargeting.snapDominantAxis3([1e-8, -1e-8, 1e-8]);
assert.strictEqual(nearZero.ok, false);
assert.strictEqual(nearZero.reason, 'invalid-normal');
assert.deepStrictEqual(Object.keys(nearZero).sort(), ['details', 'ok', 'reason']);

assertAxis(BuildTargeting.snapDominantAxis3([0.02, 0.98, -0.01]).gridNormal, [0, 1, 0]);
assertAxis(BuildTargeting.snapDominantAxis3([-0.9, 0.1, 0.05]).gridNormal, [-1, 0, 0]);

// The old raycast path rounded hitObjectLocalNormal before transform. This fixture proves
// M2A needs scene/active-space conversion: a local +X face on a rotated hit object can be scene +Y.
const oldRoundedHitObjectLocalNormal = BuildTargeting.snapDominantAxis3([1, 0, 0]).gridNormal;
const converted = BuildTargeting.sceneNormalToActiveGridNormal(
  { x: 0, y: 1, z: 0 },
  'space:root',
  (activeAssemblySpaceId, sceneNormal) => {
    assert.strictEqual(activeAssemblySpaceId, 'space:root');
    return sceneNormal;
  }
);
assert.strictEqual(converted.ok, true);
assertAxis(oldRoundedHitObjectLocalNormal, [1, 0, 0]);
assertAxis(converted.gridNormal, [0, 1, 0]);

const activeSpaceRotation = BuildTargeting.sceneNormalToActiveGridNormal(
  [0, 1, 0],
  'space:rotated',
  (activeAssemblySpaceId, sceneNormal) => {
    assert.strictEqual(activeAssemblySpaceId, 'space:rotated');
    assert.deepStrictEqual(sceneNormal, [0, 1, 0]);
    // Simulated inverse root->active rotation: scene +Y becomes active +X.
    return [sceneNormal[1], -sceneNormal[0], sceneNormal[2]];
  }
);
assert.strictEqual(activeSpaceRotation.ok, true);
assertAxis(activeSpaceRotation.activeSpaceNormal, [1, 0, 0]);
assertAxis(activeSpaceRotation.gridNormal, [1, 0, 0]);

const clickedBlock = { assemblySpaceId: 'space:rotated', x: 4, y: 2, z: -3 };
const placementCell = BuildTargeting.placementCellFromNormal(clickedBlock, activeSpaceRotation.gridNormal);
assert.deepStrictEqual(placementCell, { assemblySpaceId: 'space:rotated', x: 5, y: 2, z: -3 });

const ok = BuildTargeting.targetOk({ target: { kind: 'voxel' } });
assert.deepStrictEqual(Object.keys(ok).sort(), ['ok', 'target']);
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.target.kind, 'voxel');


const okCannotBePoisoned = BuildTargeting.targetOk({ ok: false, target: { kind: 'surface' } });
assert.strictEqual(okCannotBePoisoned.ok, true, 'targetOk must not allow payloads to override ok=true');

const missingConverter = BuildTargeting.sceneNormalToActiveGridNormal([0, 1, 0], 'space:any', null);
assert.strictEqual(missingConverter.ok, false);
assert.strictEqual(missingConverter.reason, 'invalid-normal');
assert.strictEqual(missingConverter.details.reason, 'missing-rootVectorToSpace');

const throwingConverter = BuildTargeting.sceneNormalToActiveGridNormal([0, 1, 0], 'space:any', () => { throw new Error('boom'); });
assert.strictEqual(throwingConverter.ok, false);
assert.strictEqual(throwingConverter.reason, 'invalid-normal');
assert.strictEqual(throwingConverter.details.reason, 'boom');

const fail = BuildTargeting.targetFail('wrong-assembly-space', { clicked: 'space:a', active: 'space:b' });
assert.deepStrictEqual(Object.keys(fail).sort(), ['details', 'ok', 'reason']);
assert.strictEqual(fail.ok, false);
assert.strictEqual(fail.reason, 'wrong-assembly-space');
assert.deepStrictEqual(fail.details, { clicked: 'space:a', active: 'space:b' });


const placementReasons = {
  'no-hit': 'NO: NO HIT',
  'no-face': 'NO: NO FACE',
  'invalid-normal': 'NO: BAD FACE',
  'wrong-assembly-space': 'NO: ACTIVE SPACE',
  occupied: 'NO: OCCUPIED',
  'block-limit': 'NO: LIMIT',
  'invalid-block': 'NO: INVALID BLOCK',
  'orphan-block-assembly-space': 'NO: ORPHAN SPACE',
  'empty-plan': 'NO: EMPTY PLAN',
  'symmetry-collision': 'NO: SYMMETRY HIT'
};
for (const [reason, ui] of Object.entries(placementReasons)) {
  const feedback = BuildTargeting.placementFeedback(BuildTargeting.targetFail(reason));
  assert.strictEqual(feedback.reason, reason);
  assert.strictEqual(feedback.ui, ui);
}
assert.strictEqual(BuildTargeting.placementFeedback(BuildTargeting.targetFail('wrong-assembly-space')).status, 'ACTIVE SPACE MISMATCH');
assert.strictEqual(BuildTargeting.placementFeedback(BuildTargeting.validationFeedback({ ok: false, reason: 'occupied' })).ui, 'NO: OCCUPIED');
assert.strictEqual(BuildTargeting.placementFeedback(BuildTargeting.validationFeedback({ ok: true }), 4).ui, 'OK x4');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'src/game.js'), 'utf8');
assert(gameSource.includes('removeBlock(target.root.userData.blockKey)'), 'right-click remove must keep using target.root identity');
assert(gameSource.includes('handleMechanicalEndpointSelection(target)'), 'hinge endpoint selection must keep receiving the raycast target');
assert(gameSource.includes('root: voxelRootMesh'), 'voxel target must preserve old-compatible root field');
assert(gameSource.includes('block: clickedBlock'), 'voxel target must preserve old-compatible block field');
assert(!gameSource.includes("textContent = 'NO'"), 'updateGhost must not show naked NO for placement failures');
assert(gameSource.includes('BT.placementFeedback(placement, plan.length).ui'), 'updateGhost must use deterministic placement feedback text');
assert(gameSource.includes('const validation = canPlacePlan(plan);'), 'addBlock must use structured placement validation');
assert(gameSource.includes('showStatus(BT.placementFeedback(validation).status'), 'addBlock must show a deterministic placement failure status');

console.log({ buildTargeting: 'ok', activeSpaceNormal: 'ok', placementBugProof: 'ok', targetCallers: 'ok' });
