'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const bundledPython = path.join(
  os.homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'python',
  'python.exe'
);

const python = fs.existsSync(bundledPython)
  ? bundledPython
  : (process.platform === 'win32' ? 'python' : 'python3');

const result = spawnSync(
  python,
  [path.join('tools', 'run_visual_asset_checks.py'), ...process.argv.slice(2)],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHON: python,
      PATH: fs.existsSync(bundledPython)
        ? `${path.dirname(bundledPython)}${path.delimiter}${process.env.PATH || ''}`
        : process.env.PATH,
    },
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
