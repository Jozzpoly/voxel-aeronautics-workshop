#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'tools'))
from build_release import APP_SOURCES  # noqa: E402


def run(*command: str) -> None:
    print(f"\n> {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    for relative in APP_SOURCES:
        run('node', '--check', str(relative))
    run(sys.executable, 'tests/static_check.py')
    run('node', 'tests/test_foundation.js')
    run('node', 'tests/test_mission_evaluator.js')
    run('node', 'tests/test_aerostatics.js')
    run('node', 'tests/test_runtime_physics.js')
    run('node', 'tests/test_mass_properties.js')
    run('node', 'tests/test_runtime_assembly.js')
    run('node', 'tests/test_assembly_builder.js')
    run('node', 'tests/test_flight_session.js')
    run('node', 'tests/test_flight_integrity.js')
    run('node', 'tests/test_debris_runtime.js')
    run('node', 'tests/test_headless_harness.js')
    run('node', '--expose-gc', 'tests/test_real_cannon_harness.js')
    run('node', 'tests/test_joint_capability_spike.js')
    run('node', 'tests/test_runtime_assembly_benchmark.js')
    run('node', 'tests/test_craft_model.js')
    run('node', 'tests/test_craft_compiler.js')
    run('node', 'tests/test_gate_b_compilers.js')
    run('node', 'tests/test_gate_b_gameplay.js')
    run('node', 'tests/test_flight_control.js')
    run('node', 'tests/test_flight_thruster_routing.js')
    run('node', 'tests/test_flight_mechanical_visuals.js')
    run('node', 'tests/test_craft_history.js')
    run('node', 'tests/test_game_services.js')
    run('node', 'tests/test_input_focus_policy.js')
    run('node', '--check', 'tests/run_browser_recovery.mjs')
    run(sys.executable, 'tests/test_game_architecture.py')
    run(sys.executable, 'tests/test_algorithms.py')
    run(sys.executable, 'tests/test_missions.py')
    run(sys.executable, 'tests/test_audit_regressions.py')
    run(sys.executable, 'tests/test_release_identity.py')
    run(sys.executable, 'tests/test_documentation_contract.py')
    run(sys.executable, 'tests/test_validation_runner.py')
    run(sys.executable, 'tests/test_apply_agent_delivery_contract.py')
    run(sys.executable, 'tests/test_release_build.py')
    run('node', 'tests/startup_smoke.js', 'index.html', *(str(path) for path in APP_SOURCES))
    print('\nAll core tests passed.')


if __name__ == '__main__':
    main()
