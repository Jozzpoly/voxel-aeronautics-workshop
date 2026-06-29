#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLED_PYTHON = Path.home() / '.cache' / 'codex-runtimes' / 'codex-primary-runtime' / 'dependencies' / 'python' / 'python.exe'


def python_executable() -> str:
    return str(BUNDLED_PYTHON) if BUNDLED_PYTHON.exists() else sys.executable


def npm_command() -> str:
    return 'npm.cmd' if os.name == 'nt' else 'npm'


def test_environment() -> dict[str, str]:
    env = os.environ.copy()
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    env['PYTHON'] = python_executable()
    if BUNDLED_PYTHON.exists():
        env['PATH'] = f"{BUNDLED_PYTHON.parent}{os.pathsep}{env.get('PATH', '')}"
    return env


def run(command: list[str], env: dict[str, str]) -> None:
    print(f"\n> {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True, env=env)


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Run focused VAW Visual Asset / Blockbench Studio checks for long-change validation.'
    )
    parser.add_argument(
        '--include-release-gates',
        action='store_true',
        help='Also run build targeting, flight integrity, architecture and Tailwind gates.'
    )
    parser.add_argument(
        '--include-run-all',
        action='store_true',
        help='Also run the full tests/run_all.py suite after the focused visual checks.'
    )
    args = parser.parse_args()

    sys.dont_write_bytecode = True
    env = test_environment()
    py = python_executable()

    focused = [
        ['node', 'tests/test_visual_asset_manifest.js'],
        ['node', 'tests/test_visual_asset_registry.js'],
        ['node', 'tests/test_visual_asset_loader.js'],
        ['node', 'tests/test_visual_asset_dev_controls.js'],
        ['node', 'tests/test_visual_asset_composition.js'],
        ['node', 'tests/test_blockbench_import_studio_integration.js'],
        [py, 'tests/test_local_visual_pack_install.py'],
        [py, 'tests/test_visual_asset_pack_audit.py'],
        [npm_command(), 'run', 'studio:test'],
    ]

    release_gates = [
        ['node', 'tests/test_build_targeting.js'],
        ['node', 'tests/test_flight_integrity.js'],
        [py, 'tests/test_game_architecture.py'],
        [py, 'tests/test_audit_regressions.py'],
        ['node', 'tools/generate_tailwind_css.js', '--check'],
    ]

    for command in focused:
        run(command, env)

    if args.include_release_gates:
        for command in release_gates:
            run(command, env)

    if args.include_run_all:
        run([py, 'tests/run_all.py'], env)

    print('\nVisual asset checks passed.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
