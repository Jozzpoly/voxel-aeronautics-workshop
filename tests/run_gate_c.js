const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const tests = [
  ['node', 'tests/test_gate_c_assembly_spaces.js'],
  ['node', 'tests/test_future_hardening.js'],
  ['node', 'tests/test_fixed_step_scheduler.js'],
  ['node', 'tests/test_blueprint_controller_hardening.js'],
  ['node', 'tests/test_assembly_space_controller.js'],
  ['node', 'tests/test_gate_c_runtime.js'],
  ['node', 'tests/test_gate_c_performance.js'],
  ['node', 'tests/test_scene_environment.js'],
  [process.env.PYTHON || 'python', 'tests/test_runtime_dependency_contract.py']
];
for (const command of tests) {
  console.log(`\n> ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nGate C hardening suite passed.');
