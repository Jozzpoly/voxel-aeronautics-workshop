const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;

for (const relative of [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const Config = VAW.require('foundation.config');
const Catalog = VAW.require('foundation.catalog');
const { TEST_RANGE, MISSION } = Config;
const { CONTRACTS } = Catalog;
const landingMargin = MISSION.landing.zoneMargin || 0.25;

function finitePoint(point, fields, label) {
  for (const field of fields) {
    assert(Number.isFinite(point[field]), `${label}.${field} must be finite`);
  }
}

function circleBoxClearance2D(circle, box, margin = 0) {
  const hx = box.size.x / 2;
  const hz = box.size.z / 2;
  const nx = Math.min(Math.max(circle.x, box.position.x - hx), box.position.x + hx);
  const nz = Math.min(Math.max(circle.z, box.position.z - hz), box.position.z + hz);
  return Math.hypot(circle.x - nx, circle.z - nz) - (circle.radius + margin);
}

function sphereBoxClearance3D(sphere, box, margin = 0) {
  const hx = box.size.x / 2;
  const hy = box.size.y / 2;
  const hz = box.size.z / 2;
  const nx = Math.min(Math.max(sphere.x, box.position.x - hx), box.position.x + hx);
  const ny = Math.min(Math.max(sphere.y, box.position.y - hy), box.position.y + hy);
  const nz = Math.min(Math.max(sphere.z, box.position.z - hz), box.position.z + hz);
  return Math.hypot(sphere.x - nx, sphere.y - ny, sphere.z - nz) - (sphere.radius + margin);
}

const pads = TEST_RANGE.pads || {};
assert(TEST_RANGE.bounds >= 300, 'extended range bounds should be meaningfully larger than the original test range');
assert(TEST_RANGE.maxAltitude >= 220, 'extended range needs a higher altitude envelope');
assert(TEST_RANGE.terrain?.fog?.density > 0 && TEST_RANGE.terrain.fog.density <= 0.006, 'extended range fog should stay light enough for long-distance navigation');
assert(Object.keys(pads).length >= 10, 'extended range should expose at least ten pads');

for (const [padId, pad] of Object.entries(pads)) {
  finitePoint(pad, ['x', 'y', 'z', 'radius'], `pad ${padId}`);
  assert(pad.radius > 0, `pad ${padId} radius must be positive`);
  assert(Math.abs(pad.x) <= TEST_RANGE.bounds && Math.abs(pad.z) <= TEST_RANGE.bounds, `pad ${padId} is outside range bounds`);
}

const materials = TEST_RANGE.terrain?.materials || {};
assert(Object.keys(materials).length >= 5, 'terrain should expose multiple editable material definitions');
for (const [materialId, material] of Object.entries(materials)) {
  assert(Number.isFinite(material.color), `terrain material ${materialId} needs a color`);
  assert(material.texture?.kind, `terrain material ${materialId} needs a procedural texture kind`);
}
for (const patch of TEST_RANGE.terrain?.patches || []) {
  assert(materials[patch.material], `terrain patch ${patch.id} references missing material ${patch.material}`);
  finitePoint(patch.center, ['x', 'z'], `terrain patch ${patch.id}.center`);
  finitePoint(patch.size, ['x', 'z'], `terrain patch ${patch.id}.size`);
  assert(patch.size.x > 0 && patch.size.z > 0, `terrain patch ${patch.id} size must be positive`);
}
for (const strip of TEST_RANGE.terrain?.strips || []) {
  assert(materials[strip.material], `terrain strip ${strip.id} references missing material ${strip.material}`);
  assert(pads[strip.fromPad] && pads[strip.toPad], `terrain strip ${strip.id} references missing pads`);
  assert(Number(strip.width) > 0, `terrain strip ${strip.id} width must be positive`);
}

const sectors = TEST_RANGE.missionMap?.sectors || [];
assert(sectors.length >= 5, 'mission map should expose the extended range sectors');
const sectorPadIds = new Set();
for (const sector of sectors) {
  assert(sector.id && sector.title && sector.short, `sector ${sector.id || '<missing>'} needs id, title and short text`);
  for (const padId of sector.padIds || []) {
    assert(pads[padId], `sector ${sector.id} references missing pad ${padId}`);
    sectorPadIds.add(padId);
  }
}
for (const padId of Object.keys(pads)) assert(sectorPadIds.has(padId), `pad ${padId} is not assigned to a mission map sector`);

const collidableObstacles = (TEST_RANGE.obstacles || []).filter(obstacle => obstacle.collidable === true);
assert(collidableObstacles.length >= 8, 'extended range should declare collidable landmarks/obstacles as data');
for (const obstacle of collidableObstacles) {
  finitePoint(obstacle.size, ['x', 'y', 'z'], `obstacle ${obstacle.id}.size`);
  finitePoint(obstacle.position, ['x', 'y', 'z'], `obstacle ${obstacle.id}.position`);
  assert(obstacle.size.x > 0 && obstacle.size.y > 0 && obstacle.size.z > 0, `obstacle ${obstacle.id} size must be positive`);
}

const padClearanceFailures = [];
for (const [padId, pad] of Object.entries(pads)) {
  for (const obstacle of collidableObstacles) {
    const clearance = circleBoxClearance2D(pad, obstacle, landingMargin);
    if (clearance < 3) padClearanceFailures.push({ padId, obstacleId: obstacle.id, clearance: Number(clearance.toFixed(3)) });
  }
}

const gateClearanceFailures = [];
for (const contract of CONTRACTS) {
  for (const [index, gate] of (contract.gates || []).entries()) {
    for (const obstacle of collidableObstacles) {
      const clearance = sphereBoxClearance3D(gate, obstacle, landingMargin);
      if (clearance < 1) gateClearanceFailures.push({ contractId: contract.id, gate: index + 1, obstacleId: obstacle.id, clearance: Number(clearance.toFixed(3)) });
    }
  }
}

assert.deepStrictEqual(padClearanceFailures, [], `landing pad clearance failures: ${JSON.stringify(padClearanceFailures)}`);
assert.deepStrictEqual(gateClearanceFailures, [], `mission gate clearance failures: ${JSON.stringify(gateClearanceFailures)}`);

const padPurpose = new Map(Object.keys(pads).map(padId => [padId, { landing: 0, nearbyGate: 0 }]));
for (const contract of CONTRACTS) {
  for (const padId of contract.landingZones || []) {
    if (padPurpose.has(padId)) padPurpose.get(padId).landing += 1;
  }
  for (const gate of contract.gates || []) {
    for (const [padId, pad] of Object.entries(pads)) {
      if (Math.hypot(gate.x - pad.x, gate.z - pad.z) <= pad.radius + gate.radius) padPurpose.get(padId).nearbyGate += 1;
    }
  }
}
const orphanPads = [...padPurpose.entries()]
  .filter(([, purpose]) => purpose.landing + purpose.nearbyGate === 0)
  .map(([padId]) => padId);
assert.deepStrictEqual(orphanPads, [], `rendered pads need gameplay/exploration purpose: ${orphanPads.join(', ')}`);

console.log(JSON.stringify({
  missionMap: 'ok',
  contracts: CONTRACTS.length,
  playableContracts: CONTRACTS.filter(contract => contract.id !== 'sandbox').length,
  pads: Object.keys(pads).length,
  sectors: sectors.map(sector => sector.id),
  terrainMaterials: Object.keys(materials).length,
  terrainPatches: TEST_RANGE.terrain?.patches?.length || 0,
  collidableObstacles: collidableObstacles.length,
  fogDensity: TEST_RANGE.terrain.fog.density,
  bounds: TEST_RANGE.bounds,
  maxAltitude: TEST_RANGE.maxAltitude
}, null, 2));
