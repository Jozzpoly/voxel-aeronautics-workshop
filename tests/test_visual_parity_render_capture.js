'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const orchestrator = path.join(repoRoot, 'tools/visual_parity_render_capture.mjs');
const metrics = path.join(repoRoot, 'tools/visual_parity_metrics.py');

assert.ok(fs.existsSync(orchestrator), 'missing tools/visual_parity_render_capture.mjs');
assert.ok(fs.existsSync(metrics), 'missing tools/visual_parity_metrics.py');

const source = fs.readFileSync(orchestrator, 'utf8');
assert.match(source, /visual_parity_render_report\.json/);
assert.match(source, /runStudioCapture/);
assert.match(source, /captureGameBlock/);
assert.match(source, /visual_parity_metrics\.py/);
assert.match(source, /visualParity/);

const syntax = spawnSync(process.execPath, ['--check', orchestrator], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

const help = spawnSync(process.execPath, [orchestrator, '--help'], { encoding: 'utf8' });
assert.equal(help.status, 0, help.stderr || help.stdout);
assert.match(help.stdout, /--blocks/);

console.log({
  visualParityRenderCapture: 'ok',
  orchestrator: path.relative(repoRoot, orchestrator)
});