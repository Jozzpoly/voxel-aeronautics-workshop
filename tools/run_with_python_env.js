'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const bundledPython = path.join(
  os.homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'python',
  'python.exe'
);

function pythonCommand() {
  if (fs.existsSync(bundledPython)) return bundledPython;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function commandForPlatform(command) {
  if (['python', 'python3', 'python.exe'].includes(command)) return pythonCommand();
  return command;
}

const [rawCommand, ...args] = process.argv.slice(2);
if (!rawCommand) {
  console.error('Usage: node tools/run_with_python_env.js <command> [...args]');
  process.exit(2);
}

const python = pythonCommand();
const pathPrefix = fs.existsSync(bundledPython)
  ? `${path.dirname(bundledPython)}${path.delimiter}`
  : '';

const result = spawnSync(commandForPlatform(rawCommand), args, {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32' && rawCommand === 'npm',
  env: {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHON: process.env.PYTHON || python,
    PATH: `${pathPrefix}${process.env.PATH || ''}`,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
