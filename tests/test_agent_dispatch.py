from __future__ import annotations

import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from agent_dispatch import (  # noqa: E402
    MESH,
    decision_index,
    deps_satisfied,
    decisions_approved,
    load_decisions,
    load_json,
    task_assignable,
    task_blocked_by_decision,
    task_index,
)


def test_mesh_files_parse() -> None:
    for name in ("QUEUE.json", "REGISTRY.json", "STATE.json", "LANES.json", "DECISIONS.json"):
        data = load_json(MESH / name)
        assert isinstance(data, dict), name


def test_deps_satisfied_requires_done_dependencies() -> None:
    queue = load_json(MESH / "QUEUE.json")
    tasks = task_index(queue)
    m0_004 = tasks["m0-004"]
    assert deps_satisfied(m0_004, tasks) is True
    blocked = dict(m0_004)
    blocked["dependsOn"] = ["missing-task"]
    assert deps_satisfied(blocked, tasks) is False


def test_decision_blocks_m4l_until_m0_gate() -> None:
    queue = load_json(MESH / "QUEUE.json")
    tasks = task_index(queue)
    decisions = decision_index(load_decisions())
    m4l_101 = tasks["m4l-101"]
    block = task_blocked_by_decision(m4l_101, decisions)
    assert block in {"DEC-M0-GATE", "DEC-STATE-SYNC", "DEC-M4L-COMMIT-STRATEGY"}


def test_r0_tasks_assignable_when_unblocked() -> None:
    queue = load_json(MESH / "QUEUE.json")
    tasks = task_index(queue)
    decisions = decision_index(load_decisions())
    r0_001 = tasks["r0-001"]
    assert r0_001.get("status") in ("ready", "done")
    if r0_001.get("status") == "ready":
        assert task_assignable(r0_001, tasks, decisions) is True


def test_decisions_approved_requires_all_approved() -> None:
    decisions = decision_index(load_decisions())
    assert decisions_approved(["DEC-TRANSPORT-BRANCH"], decisions) is True
    assert decisions_approved(["DEC-M0-GATE"], decisions) is False


def test_registry_slots_have_unique_ids() -> None:
    registry = load_json(MESH / "REGISTRY.json")
    ids = [slot["id"] for slot in registry["slots"]]
    assert len(ids) == len(set(ids))


def test_remediation_phase_present() -> None:
    queue = load_json(MESH / "QUEUE.json")
    phase_ids = {phase["id"] for phase in queue["phases"]}
    assert "REMEDIATION" in phase_ids
    remediation_tasks = [task for task in queue["tasks"] if task.get("phase") == "REMEDIATION"]
    assert remediation_tasks, "remediation tasks expected in QUEUE"