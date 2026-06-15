#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
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
    run('node', 'tests/test_craft_model.js')
    run('node', 'tests/test_craft_compiler.js')
    run('node', 'tests/test_flight_control.js')
    run('node', 'tests/test_craft_history.js')
    run(sys.executable, 'tests/test_algorithms.py')
    run(sys.executable, 'tests/test_missions.py')
    run(sys.executable, 'tests/test_audit_regressions.py')
    run(sys.executable, 'tests/test_release_build.py')
    run('node', 'tests/startup_smoke.js', 'index.html', *(str(path) for path in APP_SOURCES))
    print('\nAll core tests passed.')


if __name__ == '__main__':
    main()
