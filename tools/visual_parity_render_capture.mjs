#!/usr/bin/env node
/**
 * M4L unified visual parity capture orchestrator (m4l-104).
 *
 * Prep scaffold: validates dependency artifacts and documents the planned capture
 * pipeline. Full implementation activates once m4l-102 (game diagnostic) and
 * m4l-103 (studio harness) land.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACK = path.join(ROOT, 'assets', 'visual_packs', 'local_working_visuals');
const DEFAULT_BLOCKS = ['Balloon', 'Hull', 'Fuel', 'Thruster', 'VectorThruster'];
const DEFAULT_OUT = path.join(ROOT, '.agent-validation', 'm4l-capture');
const DEFAULT_PROFILE = 'game-studio-parity';
const REPORT_NAME = 'visual_parity_render_report.json';

const DEPENDENCIES = [
  {
    taskId: 'm4l-102',
    label: 'Game diagnostic render mode',
    paths: [
      path.join(ROOT, 'src', 'game', 'visual-parity-diagnostic.js')
    ]
  },
  {
    taskId: 'm4l-103',
    label: 'Studio-side capture harness',
    paths: [
      path.join(ROOT, 'tools', 'visual_parity_capture_studio.mjs')
    ]
  }
];

function parseArgs(argv) {
  const options = {
    pack: DEFAULT_PACK,
    blocks: [...DEFAULT_BLOCKS],
    profile: DEFAULT_PROFILE,
    out: DEFAULT_OUT
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--pack' && argv[index + 1]) {
      options.pack = path.resolve(argv[++index]);
      continue;
    }
    if (token === '--blocks' && argv[index + 1]) {
      options.blocks = argv[++index].split(',').map(item => item.trim()).filter(Boolean);
      continue;
    }
    if (token === '--profile' && argv[index + 1]) {
      options.profile = argv[++index];
      continue;
    }
    if (token === '--out' && argv[index + 1]) {
      options.out = path.resolve(argv[++index]);
      continue;
    }
    if (token === '--help' || token === '-h') {
      options.help = true;
    }
  }
  return options;
}

function usage() {
  return `Usage: node tools/visual_parity_render_capture.mjs [options]

Options:
  --pack <dir>       Visual pack root (default: assets/visual_packs/local_working_visuals)
  --blocks <list>    Comma-separated block types (default: ${DEFAULT_BLOCKS.join(',')})
  --profile <id>     Renderer profile for game capture (default: ${DEFAULT_PROFILE})
  --out <dir>        Capture output directory (default: .agent-validation/m4l-capture)

Emits: <out>/${REPORT_NAME} when dependencies are satisfied and capture succeeds.
`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function dependencyReport() {
  const missing = [];
  for (const dependency of DEPENDENCIES) {
    const absent = [];
    for (const candidate of dependency.paths) {
      if (!(await pathExists(candidate))) absent.push(path.relative(ROOT, candidate));
    }
    if (absent.length) {
      missing.push({
        taskId: dependency.taskId,
        label: dependency.label,
        missingPaths: absent
      });
    }
  }
  return missing;
}

function buildBlockedPayload(options, missing) {
  return {
    status: 'blocked',
    reason: 'm4l-104 dependencies not satisfied',
    taskId: 'm4l-104',
    blockedBy: missing.map(item => item.taskId),
    missing,
    planned: {
      pack: options.pack,
      blocks: options.blocks,
      profile: options.profile,
      outDir: options.out,
      reportPath: path.join(options.out, REPORT_NAME),
      steps: [
        'capture studio PNG+JSON per block via tools/visual_parity_capture_studio.mjs',
        'capture game PNG+JSON per block via visual-parity diagnostic page + CDP screenshot',
        'compare pairs with tools/visual_parity_metrics.py',
        'aggregate visual_parity_render_report.json'
      ]
    },
    prepDoc: '.codex/agent_mesh/assignments/m4l-104-prep.json'
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const missing = await dependencyReport();
  if (missing.length) {
    const payload = buildBlockedPayload(options, missing);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 2;
    return;
  }

  // Dependency stubs exist — full capture loop will be implemented in m4l-104 completion pass.
  const payload = {
    status: 'not-implemented',
    reason: 'orchestrator capture loop not yet wired; dependency files present',
    taskId: 'm4l-104',
    options: {
      pack: options.pack,
      blocks: options.blocks,
      profile: options.profile,
      outDir: options.out
    },
    prepDoc: '.codex/agent_mesh/assignments/m4l-104-prep.json'
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 2;
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'error',
    message: String(error?.message || error)
  }, null, 2));
  process.exitCode = 1;
});