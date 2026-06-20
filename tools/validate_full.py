#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

sys.dont_write_bytecode = True

from validation_plan import FULL_PLAN
from validation_runner import cli

ROOT = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    raise SystemExit(cli(FULL_PLAN, ROOT))
