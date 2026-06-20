from __future__ import annotations

import sys
from pathlib import Path

from build_release import SINGLE_NAME, ZIP_NAME
from validation_runner import Plan, Stage

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


def command(*parts: str) -> tuple[str, ...]:
    return tuple(parts)


FAST_PLAN = Plan(
    name="fast",
    stages=(
        Stage("static-check", command(PYTHON, "tests/static_check.py"), 30, "Source and DOM static contract"),
        Stage("foundation", command("node", "tests/test_foundation.js"), 30, "Foundation module and migration checks"),
        Stage("gate-b-compilers", command("node", "tests/test_gate_b_compilers.js"), 45, "Mechanical compiler regressions"),
        Stage("gate-c-hardening", command("node", "tests/run_gate_c.js"), 120, "Assembly Space, persistence, runtime-health and dependency hardening"),
        Stage("audit-regressions", command(PYTHON, "tests/test_audit_regressions.py"), 45, "Known product regression guards"),
        Stage("validation-runner", command(PYTHON, "tests/test_validation_runner.py"), 360, "Comprehensive workflow runner safety contract"),
    ),
)


VALIDATION_RELEASE_ROOT = Path("{run_dir}") / "release"
VALIDATION_SINGLE = VALIDATION_RELEASE_ROOT / SINGLE_NAME
VALIDATION_ZIP = VALIDATION_RELEASE_ROOT / ZIP_NAME
VALIDATION_HASHES = VALIDATION_RELEASE_ROOT / "SHA256.txt"

FULL_PLAN = Plan(
    name="full",
    stages=(
        Stage("core-suite", command(PYTHON, "tests/run_all.py"), 360, "Complete core suite, including deterministic release-build tests"),
        Stage(
            "release-build",
            command(
                PYTHON,
                "tools/build_release.py",
                "--single", str(VALIDATION_SINGLE),
                "--zip", str(VALIDATION_ZIP),
                "--hashes", str(VALIDATION_HASHES),
            ),
            180,
            "Build release evidence inside the controlled validation artifact root",
        ),
        Stage(
            "release-verify",
            command(
                PYTHON,
                "tools/verify_release.py",
                "--single", str(VALIDATION_SINGLE),
                "--zip", str(VALIDATION_ZIP),
                "--hashes", str(VALIDATION_HASHES),
            ),
            120,
            "Verify the exact HTML, ZIP, checksum file and source parity from this validation run",
        ),
    ),
)
