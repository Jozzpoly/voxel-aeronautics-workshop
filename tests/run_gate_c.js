const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUNDLED_PYTHON = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const PYTHON = process.env.PYTHON || (fs.existsSync(BUNDLED_PYTHON) ? BUNDLED_PYTHON : (process.platform === 'win32' ? 'python' : 'python3'));
const tests = [
  ['node', 'tests/test_gate_c_assembly_spaces.js'],
  ['node', 'tests/test_future_hardening.js'],
  ['node', 'tests/test_fixed_step_scheduler.js'],
  ['node', 'tests/test_blueprint_controller_hardening.js'],
  ['node', 'tests/test_assembly_space_controller.js'],
  ['node', 'tests/test_gate_c_runtime.js'],
  ['node', 'tests/test_gate_c_performance.js'],
  ['node', 'tools/validate_mission_map.js'],
  ['node', 'tests/test_scene_environment.js'],
  [PYTHON, 'tests/test_runtime_dependency_contract.py']
];
for (const command of tests) {
  console.log(`\n> ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nGate C hardening suite passed.');
