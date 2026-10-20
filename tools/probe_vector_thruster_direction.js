#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_ONLY = process.argv.includes('--report-only');
const SUMMARY = process.argv.includes('--summary');
const MAX_ANGLE = Math.PI * 16 / 180;
const TOLERANCE_DEGREES = 2;

const AXES = Object.freeze([
  Object.freeze({ x: 1, y: 0, z: 0, label: '+X' }),
  Object.freeze({ x: 0, y: 1, z: 0, label: '+Y' }),
  Object.freeze({ x: -1, y: 0, z: 0, label: '-X' }),
  Object.freeze({ x: 0, y: -1, z: 0, label: '-Y' }),
  Object.freeze({ x: 0, y: 0, z: 1, label: '+Z' }),
  Object.freeze({ x: 0, y: 0, z: -1, label: '-Z' }),
]);

const DEFAULT_PROFILE = Object.freeze({
  source: 'runtime-default',
  channels: Object.freeze([
    Object.freeze({ input: 'gimbalA', axis: 'z', direction: 1 }),
    Object.freeze({ input: 'gimbalB', axis: 'y', direction: -1 }),
  ]),
});

const CASES = Object.freeze([
  Object.freeze({ name: 'neutral', gimbalA: 0, gimbalB: 0, roll: 0 }),
  Object.freeze({ name: 'normal-positive', gimbalA: 0.5, gimbalB: 0, roll: 0 }),
  Object.freeze({ name: 'normal-negative', gimbalA: -0.5, gimbalB: 0, roll: 0 }),
  Object.freeze({ name: 'span-positive', gimbalA: 0, gimbalB: 0.5, roll: 0 }),
  Object.freeze({ name: 'span-negative', gimbalA: 0, gimbalB: -0.5, roll: 0 }),
  Object.freeze({ name: 'mixed-positive', gimbalA: 0.45, gimbalB: 0.35, roll: 0 }),
  Object.freeze({ name: 'mixed-cross', gimbalA: -0.45, gimbalB: 0.35, roll: 0 }),
  Object.freeze({ name: 'roll-visual-only', gimbalA: 0.3, gimbalB: -0.25, roll: 0.6 }),
]);

function clone(v) { return { x: v.x, y: v.y, z: v.z }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function scale(v, factor) { return { x: v.x * factor, y: v.y * factor, z: v.z * factor }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function length(v) { return Math.sqrt(dot(v, v)); }
function normalize(v) {
  const value = length(v) || 1;
  return scale(v, 1 / value);
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function degrees(radians) { return radians * 180 / Math.PI; }
function angleDegrees(a, b) {
  return degrees(Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1)));
}

function axisLabel(v) {
  let best = AXES[0];
  let score = -Infinity;
  for (const axis of AXES) {
    const value = dot(v, axis);
    if (value > score) {
      score = value;
      best = axis;
    }
  }
  return best.label;
}

function orientationBases() {
  const bases = [];
  for (const forwardSource of AXES) {
    for (const upSource of AXES) {
      if (Math.abs(dot(forwardSource, upSource)) > 0.001) continue;
      const forward = clone(forwardSource);
      const normal = clone(upSource);
      const span = normalize(cross(forward, normal));
      bases.push(Object.freeze({
        id: bases.length,
        label: `${forwardSource.label}/UP ${upSource.label}`,
        forward: Object.freeze(forward),
        normal: Object.freeze(normal),
        span: Object.freeze(span),
      }));
    }
  }
  return bases;
}

function expectedForceDirection(basis, sample) {
  const a = Number(sample.gimbalA) || 0;
  const b = Number(sample.gimbalB) || 0;
  const magnitude = Math.min(1, Math.hypot(a, b));
  const forwardScale = Math.cos(MAX_ANGLE * magnitude);
  const lateral = Math.sin(MAX_ANGLE);
  return normalize(add(
    add(scale(basis.forward, forwardScale), scale(basis.normal, lateral * a)),
    scale(basis.span, lateral * b)
  ));
}

function channelValue(input, sample) {
  if (input === 'gimbalA') return Number(sample.gimbalA) || 0;
  if (input === 'gimbalB') return Number(sample.gimbalB) || 0;
  if (input === 'roll') return Number(sample.roll) || 0;
  return 0;
}

function eulerFromProfile(profile, sample) {
  const euler = { x: 0, y: 0, z: 0 };
  for (const channel of profile.channels || []) {
    const axis = String(channel.axis || '').toLowerCase();
    if (!['x', 'y', 'z'].includes(axis)) continue;
    const direction = Number(channel.direction) === -1 ? -1 : 1;
    euler[axis] = channelValue(channel.input, sample) * MAX_ANGLE * direction;
  }
  return euler;
}

function quaternionFromEulerXYZ(euler) {
  const c1 = Math.cos(euler.x / 2);
  const c2 = Math.cos(euler.y / 2);
  const c3 = Math.cos(euler.z / 2);
  const s1 = Math.sin(euler.x / 2);
  const s2 = Math.sin(euler.y / 2);
  const s3 = Math.sin(euler.z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function applyQuaternion(v, q) {
  const x = v.x;
  const y = v.y;
  const z = v.z;
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;
  const qw = q.w;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function visualForceDirection(basis, profile, sample) {
  const euler = eulerFromProfile(profile, sample);
  const local = normalize(applyQuaternion({ x: 1, y: 0, z: 0 }, quaternionFromEulerXYZ(euler)));
  return normalize(add(
    add(scale(basis.forward, local.x), scale(basis.normal, local.y)),
    scale(basis.span, local.z)
  ));
}

function loadLocalVectorProfile() {
  const manifestPath = path.join(ROOT, 'assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const asset = (manifest.assets || []).find(item => (item.bindings?.blockTypes || []).includes('VectorThruster'));
  const profile = asset?.bindings?.rig?.vectorThruster;
  if (!profile || !Array.isArray(profile.channels)) return null;
  return {
    source: `${path.relative(ROOT, manifestPath)}:${asset.assetId}`,
    channels: profile.channels.map(channel => Object.freeze({
      input: channel.input,
      axis: channel.axis,
      direction: channel.direction,
    })),
  };
}

function probeProfile(profile) {
  const mismatches = [];
  const bases = orientationBases();
  if (bases.length !== 24) throw new Error(`Expected 24 orientations, got ${bases.length}.`);
  let checked = 0;
  for (const basis of bases) {
    for (const sample of CASES) {
      checked += 1;
      const expected = expectedForceDirection(basis, sample);
      const visual = visualForceDirection(basis, profile, sample);
      const error = angleDegrees(expected, visual);
      if (error > TOLERANCE_DEGREES) {
        mismatches.push({
          orientation: basis.id,
          orientationLabel: basis.label,
          case: sample.name,
          gimbalA: sample.gimbalA,
          gimbalB: sample.gimbalB,
          roll: sample.roll,
          expectedAxis: axisLabel(expected),
          visualAxis: axisLabel(visual),
          angleErrorDegrees: Number(error.toFixed(3)),
          expected: vectorSummary(expected),
          visual: vectorSummary(visual),
        });
      }
    }
  }
  mismatches.sort((a, b) => b.angleErrorDegrees - a.angleErrorDegrees);
  return {
    source: profile.source,
    checked,
    toleranceDegrees: TOLERANCE_DEGREES,
    ok: mismatches.length === 0,
    mismatchCount: mismatches.length,
    worstMismatches: mismatches.slice(0, 12),
  };
}

function vectorSummary(v) {
  return {
    x: Number(v.x.toFixed(4)),
    y: Number(v.y.toFixed(4)),
    z: Number(v.z.toFixed(4)),
  };
}

const profiles = [DEFAULT_PROFILE];
const localProfile = loadLocalVectorProfile();
if (localProfile) profiles.push(localProfile);

const reports = profiles.map(probeProfile);
const result = {
  vectorThrusterDirectionProbe: reports.every(report => report.ok) ? 'ok' : 'mismatch',
  model: 'expected force direction from computeVectorThrusterForceCannon vs visual +X after renderer rig profile',
  profiles: reports,
};

const output = SUMMARY ? {
  vectorThrusterDirectionProbe: result.vectorThrusterDirectionProbe,
  model: result.model,
  profiles: reports.map(report => ({
    source: report.source,
    checked: report.checked,
    toleranceDegrees: report.toleranceDegrees,
    ok: report.ok,
    mismatchCount: report.mismatchCount,
    worstAngleErrorDegrees: report.worstMismatches[0]?.angleErrorDegrees || 0,
    worstCase: report.worstMismatches[0] ? {
      orientation: report.worstMismatches[0].orientation,
      orientationLabel: report.worstMismatches[0].orientationLabel,
      case: report.worstMismatches[0].case,
      expectedAxis: report.worstMismatches[0].expectedAxis,
      visualAxis: report.worstMismatches[0].visualAxis,
    } : null,
  })),
} : result;

console.log(JSON.stringify(output, null, 2));

if (!REPORT_ONLY && result.vectorThrusterDirectionProbe !== 'ok') {
  process.exitCode = 1;
}
