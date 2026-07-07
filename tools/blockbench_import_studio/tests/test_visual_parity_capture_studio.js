'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const studioRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(studioRoot, '..', '..');
const packRoot = path.join(repoRoot, 'assets/visual_packs/local_working_visuals');
const captureCli = path.join(repoRoot, 'tools/visual_parity_capture_studio.mjs');

for (const relative of [
  'visual_parity_capture.html',
  'src/visual_parity_capture_page.js',
  'src/minimal_gltf_viewer.js',
  'vendor/three.min.js',
  'vendor/GLTFLoader.js'
]) {
  assert.ok(fs.existsSync(path.join(studioRoot, relative)), `missing ${relative}`);
}

assert.ok(fs.existsSync(captureCli), 'missing tools/visual_parity_capture_studio.mjs');

const capturePage = fs.readFileSync(path.join(studioRoot, 'src/visual_parity_capture_page.js'), 'utf8');
assert.match(capturePage, /__VAW_STUDIO_CAPTURE__/);
assert.match(capturePage, /studio-preview/);

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options
  });
}

const syntax = runNode(['--check', path.join(studioRoot, 'src/visual_parity_capture_page.js')]);
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

const staticCapture = runNode([
  captureCli,
  '--pack', packRoot,
  '--block', 'Balloon',
  '--static-only',
  '--quiet'
]);
assert.equal(staticCapture.status, 0, staticCapture.stderr || staticCapture.stdout);
const staticReport = JSON.parse(staticCapture.stdout.trim());
assert.equal(staticReport.surface, 'studio');
assert.equal(staticReport.blockType, 'Balloon');
assert.equal(staticReport.assetId, 'local_balloon_visual');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaw-studio-capture-'));
const capture = runNode([
  captureCli,
  '--pack', packRoot,
  '--block', 'Balloon',
  '--output', outputDir,
  '--quiet'
], { timeout: 120000 });

if (capture.status === 2) {
  const envReport = JSON.parse(capture.stdout.trim());
  assert.equal(envReport.classification, 'ENVIRONMENT');
  console.log({ visualParityCaptureStudio: 'static-only-pass', browserCapture: 'skipped-environment' });
  process.exit(0);
}

assert.equal(capture.status, 0, capture.stderr || capture.stdout);
const report = JSON.parse(capture.stdout.trim());
const pngPath = path.join(outputDir, report.png);
const jsonPath = path.join(outputDir, report.json);

assert.equal(report.status, 'ok');
assert.equal(report.blockType, 'Balloon');
assert.equal(report.assetId, 'local_balloon_visual');
assert.ok(fs.existsSync(pngPath), `missing png ${pngPath}`);
assert.ok(fs.existsSync(jsonPath), `missing json ${jsonPath}`);
assert.ok(fs.statSync(pngPath).size > 1000, 'png should contain rendered pixels');

const saved = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
assert.equal(saved.surface, 'studio');
assert.equal(saved.modelPath, 'models/blocks/balloon/model.gltf');
assert.ok(saved.camera?.position, 'capture json should include camera position');
assert.ok(saved.bounds?.maxDim, 'capture json should include model bounds');

console.log({
  visualParityCaptureStudio: 'ok',
  pngBytes: fs.statSync(pngPath).size,
  outputDir
});