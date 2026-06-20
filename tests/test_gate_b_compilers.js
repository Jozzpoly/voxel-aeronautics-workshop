const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load(FOUNDATION_SOURCES, { stubs: true });

const Blueprint = VAW.require('foundation.blueprint');
const CraftModel = VAW.require('foundation.craft-model');
const CraftHistory = VAW.require('foundation.craft-history');
const CraftCompiler = VAW.require('foundation.craft-compiler');
const StructuralGraphCompiler = VAW.require('foundation.structural-graph-compiler');
const RuntimeAssembly = VAW.require('foundation.runtime-assembly');
const Config = VAW.require('foundation.config');

const block = (blockId, x, y, z, type = 'Hull') => ({ blockId, x, y, z, type, orientation: 0, controlAxis: 'pitch', controlSign: 0 });
const hinge = (id, a, faceA, b, faceB, axis = 'PY', extra = {}) => ({
  mechanicalLinkId: id, kind: 'hinge', endpointA: { blockId: a, face: faceA }, endpointB: { blockId: b, face: faceB },
  axis, collideConnected: false, maxForce: 1000000, frictionTorque: 0, limits: null, ...extra
});
const codes = compiled => compiled.diagnostics.map(item => item.code);

// Stepwise v10 -> v11 migration preserves identities and is pure.
const v10 = { version: 10, blocks: [block('core', 0, 0, 0, 'Core'), block('hull', 1, 0, 0)] };
const migrated = Blueprint.migrateV10ToV11(v10);
assert.strictEqual(migrated.version, 11);
assert.deepStrictEqual(migrated.blocks.map(item => item.blockId), ['core', 'hull']);
assert.deepStrictEqual(migrated.mechanicalLinks, []);
assert.strictEqual(v10.mechanicalLinks, undefined);
assert.deepStrictEqual(Blueprint.normalize(v10).blocks.map(item => item.blockId), ['core', 'hull']);
const legacyV3 = { version: 3, blocks: [block(undefined, 0, 0, 0, 'Core')] };
const migratedLegacy = Blueprint.migrateToCurrent(legacyV3);
assert.strictEqual(migratedLegacy.version, 12);
assert.deepStrictEqual(migratedLegacy.mechanicalLinks, []);
assert.strictEqual(legacyV3.version, 3, 'Stepwise migration must not mutate the source document.');

const baseBlocks = [block('core', 0, 0, 0, 'Core'), block('root', 1, 0, 0), block('arm', 2, 0, 0), block('tip', 3, 0, 0)];
const baseLink = hinge('mechanical:arm', 'root', 'PX', 'arm', 'NX');
const v11 = Blueprint.createDocument({ blocks: baseBlocks, mechanicalLinks: [baseLink] });
assert.deepStrictEqual(Blueprint.normalize(JSON.parse(JSON.stringify(v11))), v11);
assert.throws(() => Blueprint.createDocument({ blocks: [block('dup', 0, 0, 0, 'Core'), block('dup', 1, 0, 0)] }), /invalid block/i);
assert.strictEqual(Blueprint.normalize({ ...v11, mechanicalLinks: [baseLink, baseLink] }), null);
assert.strictEqual(Blueprint.normalize({ ...v11, mechanicalLinks: [{ ...baseLink, axis: 'BAD' }] }), null);

// CraftModel owns blocks + links under one revision and transaction history.
let allocated = 0;
const model = CraftModel.create(v11, { idAllocator(kind) { allocated += 1; return `${kind === 'block' ? 'copy:block' : 'copy:link'}:${allocated}`; } });
assert.strictEqual(model.mechanicalLinkCount, 1);
const originalRevision = model.revision;
assert(model.move('arm', 2, 1, 0).ok);
assert.strictEqual(model.getMechanicalLink('mechanical:arm').mechanicalLinkId, 'mechanical:arm');
assert.strictEqual(model.revision, originalRevision + 1);
assert(model.move('arm', 2, 0, 0).ok);
const history = CraftHistory.create();
const beforeDelete = model.toDocument();
assert(model.remove('arm').ok);
assert.strictEqual(model.mechanicalLinkCount, 0);
const afterDelete = model.toDocument();
assert(history.commit(beforeDelete, afterDelete));
const restored = history.undo(afterDelete);
assert(model.replaceDocument(restored, 'undo-delete').ok);
assert(model.getById('arm') && model.getMechanicalLink('mechanical:arm'));
assert.strictEqual(model.linksForBlock('arm').length, 1);

const copied = model.copySubgraph(['root', 'arm'], { x: 0, y: 2, z: 0 });
assert(copied.ok, copied.reason);
assert.strictEqual(copied.blocks.length, 2);
assert.strictEqual(copied.mechanicalLinks.length, 1);
assert.notStrictEqual(copied.mechanicalLinks[0].mechanicalLinkId, 'mechanical:arm');
assert.strictEqual(copied.mechanicalLinks[0].endpointA.blockId, copied.blockIdMap.root);
assert.strictEqual(copied.mechanicalLinks[0].endpointB.blockId, copied.blockIdMap.arm);

const cachedA = CraftCompiler.compile(model);
assert(model.updateMechanicalLink('mechanical:arm', { collideConnected: true }).ok);
const cachedB = CraftCompiler.compile(model);
assert.notStrictEqual(cachedA, cachedB);
assert.notStrictEqual(cachedA.signature, cachedB.signature);

// Structural adjacency is exact, canonical and input-order independent.
const structuralA = StructuralGraphCompiler.compile(baseBlocks);
const structuralB = StructuralGraphCompiler.compile([...baseBlocks].reverse());
assert.deepStrictEqual(structuralA.edges, structuralB.edges);
assert.strictEqual(structuralA.edges.length, 3);
assert.strictEqual(new Set(structuralA.edges.map(edge => edge.edgeId)).size, 3);

const compiled = CraftCompiler.compile({ blocks: baseBlocks, mechanicalLinks: [baseLink] });
assert(compiled.ready, compiled.errors.join(', '));
assert.strictEqual(compiled.rigidIslands.length, 2);
assert.strictEqual(compiled.rootBodyId, 'body:core');
assert.strictEqual(compiled.blockIdToBodyId.arm, 'body:arm');
assert.strictEqual(compiled.blockIdToBodyId.tip, 'body:arm');
assert.strictEqual(compiled.mechanicalGraph.constraints[0].constraintId, 'mechanical:arm');
assert.strictEqual('control' in compiled.mechanicalGraph.constraints[0], false, 'Mutable commands must not enter the immutable graph.');
assert.notDeepStrictEqual(compiled.bodyById['body:core'].assemblyPose.position, compiled.bodyById['body:arm'].assemblyPose.position);
assert(compiled.parts.every(part => part.bodyLocalPosition.every(Number.isFinite)));

// The shipped v11 example is a real importable document, not a hand-built runtime plan.
const exampleDocument = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'articulated_hinge_v11.json'), 'utf8'));
const exampleModel = CraftModel.create(exampleDocument);
const exampleCompiled = CraftCompiler.compile(exampleModel);
assert(exampleCompiled.ready, exampleCompiled.errors.join(', '));
assert.strictEqual(exampleCompiled.rigidIslands.length, 2);
assert.strictEqual(exampleCompiled.mechanicalGraph.constraints.length, 1);
assert.strictEqual(Blueprint.normalize(exampleModel.toDocument()).version, 12);

const extended = CraftCompiler.compile({ blocks: [...baseBlocks, block('zz-extra', 4, 0, 0)], mechanicalLinks: [baseLink] });
assert.strictEqual(extended.blockIdToBodyId.arm, 'body:arm', 'Adding a non-anchor block must not change bodyId.');

const permuted = CraftCompiler.compile({ blocks: [baseBlocks[2], baseBlocks[0], baseBlocks[3], baseBlocks[1]], mechanicalLinks: [baseLink] });
assert.strictEqual(permuted.signature, compiled.signature);
assert.deepStrictEqual(permuted.rigidIslands, compiled.rigidIslands);
assert.deepStrictEqual(permuted.mechanicalGraph.constraints, compiled.mechanicalGraph.constraints);

// Invalid authoring topology produces structured, deterministic diagnostics.
const invalidCases = [
  [{ ...baseLink, endpointB: { blockId: 'missing', face: 'NX' } }, 'mechanical-missing-endpoint'],
  [{ ...baseLink, endpointB: { blockId: 'tip', face: 'NX' } }, 'mechanical-endpoints-not-opposite-adjacent-faces'],
  [{ ...baseLink, axis: 'PX' }, 'mechanical-axis-normal-to-shared-face'],
  [{ ...baseLink, maxForce: Number.NaN }, 'mechanical-invalid-max-force'],
  [{ ...baseLink, frictionTorque: -1 }, 'mechanical-invalid-friction-torque'],
  [{ ...baseLink, limits: { minAngle: 1, maxAngle: -1 } }, 'mechanical-invalid-limits']
];
for (const [link, expected] of invalidCases) {
  const result = CraftCompiler.compile({ blocks: baseBlocks, mechanicalLinks: [link] });
  assert(codes(result).includes(expected), `${expected}: ${codes(result).join(', ')}`);
  const diagnostic = result.diagnostics.find(item => item.code === expected);
  assert(Object.isFrozen(diagnostic) && Array.isArray(diagnostic.entities));
}
const duplicateEndpoint = CraftCompiler.compile({ blocks: baseBlocks, mechanicalLinks: [baseLink, hinge('mechanical:second', 'root', 'PX', 'arm', 'NX')] });
assert(codes(duplicateEndpoint).includes('mechanical-endpoint-face-in-use'));
const duplicateIdVariant = hinge('mechanical:arm', 'arm', 'PX', 'tip', 'NX', 'PY');
const duplicateOrderA = CraftCompiler.compile({ blocks: baseBlocks, mechanicalLinks: [baseLink, duplicateIdVariant] });
const duplicateOrderB = CraftCompiler.compile({ blocks: baseBlocks, mechanicalLinks: [duplicateIdVariant, baseLink] });
assert.strictEqual(duplicateOrderA.signature, duplicateOrderB.signature);
assert.deepStrictEqual(duplicateOrderA.rigidIslands, duplicateOrderB.rigidIslands);
assert.deepStrictEqual(duplicateOrderA.diagnostics, duplicateOrderB.diagnostics);

// Cutting an edge while a rigid alternate path remains is a rigid bypass.
const square = [block('a', 0, 0, 0, 'Core'), block('b', 1, 0, 0), block('c', 1, 0, 1), block('d', 0, 0, 1)];
const bypass = CraftCompiler.compile({ blocks: square, mechanicalLinks: [hinge('m:ab', 'a', 'PX', 'b', 'NX')] });
assert(codes(bypass).includes('mechanical-rigid-bypass'));

// A mechanical cycle is legal when every edge genuinely separates rigid islands.
const cycleLinks = [
  hinge('m:ab', 'a', 'PX', 'b', 'NX'), hinge('m:bc', 'b', 'PZ', 'c', 'NZ'),
  hinge('m:cd', 'c', 'NX', 'd', 'PX'), hinge('m:da', 'd', 'NZ', 'a', 'PZ')
];
const cycle = CraftCompiler.compile({ blocks: square, mechanicalLinks: cycleLinks });
assert(cycle.ready, cycle.errors.join(', '));
assert.strictEqual(cycle.rigidIslands.length, 4);
assert.strictEqual(cycle.mechanicalGraph.constraints.length, 4);

const disconnected = CraftCompiler.compile({ blocks: [block('core', 0, 0, 0, 'Core'), block('far', 4, 0, 0)], mechanicalLinks: [] });
assert(codes(disconnected).includes('assembly-disconnected'));

// Seeded permutation/property sweep.
let seed = 0x1D4A;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
for (let iteration = 0; iteration < 100; iteration += 1) {
  const candidate = CraftCompiler.compile({ blocks: shuffle(baseBlocks), mechanicalLinks: shuffle([baseLink]) });
  assert.strictEqual(candidate.signature, compiled.signature);
  assert.strictEqual(new Set(candidate.rigidIslands.map(body => body.bodyId)).size, candidate.rigidIslands.length);
  assert.strictEqual(candidate.parts.length, baseBlocks.length);
  for (const constraint of candidate.mechanicalGraph.constraints) {
    assert(candidate.bodyById[constraint.bodyAId] && candidate.bodyById[constraint.bodyBId]);
    assert.notStrictEqual(constraint.bodyAId, constraint.bodyBId);
    const a = candidate.bodyById[constraint.bodyAId].assemblyPose.position.map((v, i) => v + constraint.pivotA[i]);
    const b = candidate.bodyById[constraint.bodyBId].assemblyPose.position.map((v, i) => v + constraint.pivotB[i]);
    assert.deepStrictEqual(a, b);
  }
}

// Seeded authoring fuzz: move/delete/copy/link sequences preserve document and compiler invariants.
let fuzzSeed = 0xB10C5;
const fuzzRandom = () => ((fuzzSeed = (Math.imul(fuzzSeed, 1103515245) + 12345) >>> 0) / 0x100000000);
const fuzzModel = CraftModel.create(Blueprint.createDocument({ blocks: [block('fuzz:core', 0, 0, 0, 'Core')] }));
let fuzzBlockCounter = 0;
let fuzzLinkCounter = 0;
const randomCoordinate = () => ({ x: Math.floor(fuzzRandom() * 9) - 4, y: Math.floor(fuzzRandom() * 5), z: Math.floor(fuzzRandom() * 9) - 4 });
for (let step = 0; step < 200; step += 1) {
  const values = [...fuzzModel.values()];
  const nonCore = values.filter(item => item.type !== 'Core');
  const operation = Math.floor(fuzzRandom() * 5);
  if (operation === 0 || values.length < 2) {
    const position = randomCoordinate();
    fuzzBlockCounter += 1;
    fuzzModel.add(block(`fuzz:block:${fuzzBlockCounter}`, position.x, position.y, position.z));
  } else if (operation === 1 && nonCore.length) {
    const chosen = nonCore[Math.floor(fuzzRandom() * nonCore.length)];
    const position = randomCoordinate();
    fuzzModel.move(chosen.blockId, position.x, position.y, position.z);
  } else if (operation === 2 && nonCore.length) {
    const chosen = nonCore[Math.floor(fuzzRandom() * nonCore.length)];
    fuzzModel.remove(chosen.blockId);
  } else if (operation === 3 && values.length >= 2) {
    const shuffled = shuffle(values).slice(0, Math.min(2, values.length)).map(item => item.blockId);
    const delta = { x: Math.floor(fuzzRandom() * 3) - 1, y: 1 + Math.floor(fuzzRandom() * 2), z: Math.floor(fuzzRandom() * 3) - 1 };
    fuzzModel.copySubgraph(shuffled, delta);
  } else if (values.length >= 2) {
    const pair = shuffle(values).slice(0, 2);
    fuzzLinkCounter += 1;
    fuzzModel.addMechanicalLink(hinge(`fuzz:link:${fuzzLinkCounter}`, pair[0].blockId, 'PX', pair[1].blockId, 'NX'));
  }

  const document = fuzzModel.toDocument();
  assert(Blueprint.normalize(document), `Fuzz document failed schema normalization at step ${step}.`);
  const blockIds = new Set(document.blocks.map(item => item.blockId));
  assert.strictEqual(blockIds.size, document.blocks.length);
  assert.strictEqual(new Set(document.mechanicalLinks.map(item => item.mechanicalLinkId)).size, document.mechanicalLinks.length);
  for (const link of document.mechanicalLinks) {
    assert(blockIds.has(link.endpointA.blockId) && blockIds.has(link.endpointB.blockId), `Dangling link after fuzz step ${step}.`);
  }
  const fuzzCompiled = CraftCompiler.compile(fuzzModel);
  assert.strictEqual(fuzzCompiled.parts.length, document.blocks.length);
  assert.strictEqual(new Set(fuzzCompiled.rigidIslands.map(body => body.bodyId)).size, fuzzCompiled.rigidIslands.length);
  for (const part of fuzzCompiled.parts) assert.strictEqual(fuzzCompiled.blockIdToBodyId[part.blockId], part.bodyId);
  for (const constraint of fuzzCompiled.mechanicalGraph.constraints) {
    assert(fuzzCompiled.bodyById[constraint.bodyAId] && fuzzCompiled.bodyById[constraint.bodyBId]);
    assert.notStrictEqual(constraint.bodyAId, constraint.bodyBId);
  }
}

// Scale guard: graph compilation remains practical and exactly linear in edge enumeration.
const maximumBlocks = [];
outer: for (let y = Config.GRID.minY; y <= Config.GRID.maxY; y += 1) {
  for (let x = -Config.GRID.halfExtent; x <= Config.GRID.halfExtent; x += 1) {
    for (let z = -Config.GRID.halfExtent; z <= Config.GRID.halfExtent; z += 1) {
      maximumBlocks.push(block(`scale:${maximumBlocks.length}`, x, y, z, maximumBlocks.length === 0 ? 'Core' : 'Hull'));
      if (maximumBlocks.length === Config.GRID.maxBlocks) break outer;
    }
  }
}
const started = process.hrtime.bigint();
const scaleGraph = StructuralGraphCompiler.compile(maximumBlocks);
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
assert.strictEqual(scaleGraph.blocks.length, Config.GRID.maxBlocks);
assert(elapsedMs < 5000, `Structural graph scale compile took ${elapsedMs.toFixed(1)} ms.`);

// 2500-block articulated benchmark with hundreds of genuine bridge cuts.
const mechanicalScaleBlocks = [];
for (let x = -18; x <= 18; x += 1) {
  for (let z = -18; z <= 18; z += 1) {
    mechanicalScaleBlocks.push(block(`perf:base:${x}:${z}`, x, 0, z, mechanicalScaleBlocks.length === 0 ? 'Core' : 'Hull'));
  }
}
const towerCoordinates = [];
for (let x = -18; x <= 18; x += 2) for (let z = -18; z <= 18; z += 2) towerCoordinates.push([x, z]);
const mechanicalScaleLinks = [];
for (let index = 0; index < towerCoordinates.length; index += 1) {
  const [x, z] = towerCoordinates[index];
  const baseId = `perf:base:${x}:${z}`;
  for (let y = 1; y <= 3; y += 1) mechanicalScaleBlocks.push(block(`perf:tower:${index}:${y}`, x, y, z));
  if (index < 48) mechanicalScaleBlocks.push(block(`perf:tower:${index}:4`, x, 4, z));
  mechanicalScaleLinks.push(hinge(`perf:hinge:${String(index).padStart(3, '0')}`, baseId, 'PY', `perf:tower:${index}:1`, 'NY', 'PX'));
}
assert.strictEqual(mechanicalScaleBlocks.length, Config.GRID.maxBlocks);
const mechanicalStarted = process.hrtime.bigint();
const mechanicalScale = CraftCompiler.compile({ blocks: mechanicalScaleBlocks, mechanicalLinks: mechanicalScaleLinks });
const mechanicalCompileMs = Number(process.hrtime.bigint() - mechanicalStarted) / 1e6;
assert(mechanicalScale.ready, mechanicalScale.errors.join(', '));
assert.strictEqual(mechanicalScale.mechanicalGraph.constraints.length, mechanicalScaleLinks.length);
assert.strictEqual(mechanicalScale.rigidIslands.length, mechanicalScaleLinks.length + 1);
const planStarted = process.hrtime.bigint();
const mechanicalScalePlan = RuntimeAssembly.createPlan(mechanicalScale);
const mechanicalPlanMs = Number(process.hrtime.bigint() - planStarted) / 1e6;
assert.strictEqual(mechanicalScalePlan.rigidBodies.length, mechanicalScaleLinks.length + 1);
assert.strictEqual(mechanicalScalePlan.parts.length, Config.GRID.maxBlocks);
assert(mechanicalCompileMs < 10000, `2500-block mechanical compile took ${mechanicalCompileMs.toFixed(1)} ms.`);
assert(mechanicalPlanMs < 10000, `2500-block mechanical plan took ${mechanicalPlanMs.toFixed(1)} ms.`);
const reversedMechanicalScale = CraftCompiler.compile({ blocks: [...mechanicalScaleBlocks].reverse(), mechanicalLinks: [...mechanicalScaleLinks].reverse() });
assert.strictEqual(reversedMechanicalScale.signature, mechanicalScale.signature);
assert.deepStrictEqual(reversedMechanicalScale.rigidIslands, mechanicalScale.rigidIslands);

const invalidScaleLinks = mechanicalScaleLinks.slice(0, 300).map((link, index) => ({
  ...link,
  mechanicalLinkId: `perf:invalid:${String(index).padStart(3, '0')}`,
  endpointB: { blockId: `perf:missing:${index}`, face: 'NY' }
}));
const invalidStarted = process.hrtime.bigint();
const invalidScale = CraftCompiler.compile({ blocks: mechanicalScaleBlocks, mechanicalLinks: invalidScaleLinks });
const invalidCompileMs = Number(process.hrtime.bigint() - invalidStarted) / 1e6;
assert.strictEqual(invalidScale.diagnostics.filter(item => item.code === 'mechanical-missing-endpoint').length, invalidScaleLinks.length);
assert(invalidCompileMs < 10000, `Invalid mechanical compile took ${invalidCompileMs.toFixed(1)} ms.`);

console.log(JSON.stringify({
  schemaV11Migration: 'ok', strictIdentity: 'ok', modelTransactions: 'ok', copyRemap: 'ok',
  deterministicTopology: 'ok', structuredDiagnostics: 'ok', rigidBypass: 'ok', mechanicalCycle: 'ok',
  exampleImport: 'ok', seededPermutations: 100, authoringFuzzSteps: 200, maximumBlocks: scaleGraph.blocks.length, structuralGraphMs: Number(elapsedMs.toFixed(2)),
  mechanicalScaleLinks: mechanicalScaleLinks.length, mechanicalCompileMs: Number(mechanicalCompileMs.toFixed(2)),
  mechanicalPlanMs: Number(mechanicalPlanMs.toFixed(2)), invalidDiagnostics: invalidScaleLinks.length, invalidCompileMs: Number(invalidCompileMs.toFixed(2))
}, null, 2));
