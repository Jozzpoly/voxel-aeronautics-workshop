#!/usr/bin/env python3
"""VAW agent mesh dispatcher — assign work to idle lane agents."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MESH = ROOT / ".codex" / "agent_mesh"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, data: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def task_index(queue: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {task["id"]: task for task in queue["tasks"]}


def deps_satisfied(task: dict[str, Any], tasks: dict[str, dict[str, Any]]) -> bool:
    for dep_id in task.get("dependsOn", []):
        dep = tasks.get(dep_id)
        if not dep or dep.get("status") != "done":
            return False
    return True


def decision_index(decisions_doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in decisions_doc.get("decisions", [])}


def decisions_approved(required: list[str], decisions: dict[str, dict[str, Any]]) -> bool:
    if not required:
        return True
    return all(decisions.get(item, {}).get("status") == "approved" for item in required)


def task_blocked_by_decision(task: dict[str, Any], decisions: dict[str, dict[str, Any]]) -> str | None:
    task_id = task.get("id")
    phase = task.get("phase")
    for decision in decisions.values():
        if decision.get("status") not in ("pending", "proposed"):
            continue
        blocks = decision.get("blocksWhilePending", {})
        if task_id in blocks.get("taskIds", []):
            return decision["id"]
        if phase in blocks.get("phaseIds", []):
            return decision["id"]
    required = task.get("requiresDecisions", [])
    if required and not decisions_approved(required, decisions):
        return required[0]
    return None


def task_assignable(
    task: dict[str, Any],
    tasks: dict[str, dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
) -> bool:
    if task.get("status") not in ("ready", "pending"):
        return False
    if not deps_satisfied(task, tasks):
        return False
    if task_blocked_by_decision(task, decisions):
        return False
    return True


def lane_busy(registry: dict[str, Any], lane: str) -> bool:
    for slot in registry["slots"]:
        if slot["lane"] == lane and slot.get("status") == "busy":
            return True
    return False


def ready_tasks(queue: dict[str, Any]) -> list[dict[str, Any]]:
    tasks = task_index(queue)
    decisions = decision_index(load_decisions())
    registry = load_json(MESH / "REGISTRY.json")
    ready: list[dict[str, Any]] = []
    for task in queue["tasks"]:
        if not task_assignable(task, tasks, decisions):
            continue
        if lane_busy(registry, task["lane"]):
            continue
        ready.append(task)
    ready.sort(key=lambda item: (item.get("priority", 999), item["id"]))
    return ready


def load_decisions() -> dict[str, Any]:
    path = MESH / "DECISIONS.json"
    if not path.exists():
        return {"decisions": []}
    return load_json(path)


def merge_paths(lane: dict[str, Any], extra: list[str] | None) -> tuple[list[str], list[str]]:
    allowed = list(lane.get("allowedPaths", []))
    if extra:
        allowed.extend(extra)
    forbidden = list(lane.get("forbiddenPaths", []))
    return allowed, forbidden


def cmd_decisions() -> int:
    doc = load_decisions()
    print(json.dumps({
        "decisions": [
            {
                "id": d["id"],
                "type": d.get("type"),
                "status": d.get("status"),
                "title": d.get("title"),
            }
            for d in doc.get("decisions", [])
        ]
    }, indent=2))
    return 0


def cmd_gate_check(task_id: str | None) -> int:
    queue = load_json(MESH / "QUEUE.json")
    tasks = task_index(queue)
    decisions = decision_index(load_decisions())
    if task_id:
        task = tasks.get(task_id)
        if not task:
            print(json.dumps({"error": f"unknown task {task_id}"}), file=sys.stderr)
            return 2
        block = task_blocked_by_decision(task, decisions)
        print(json.dumps({
            "taskId": task_id,
            "assignable": task_assignable(task, tasks, decisions) and not lane_busy(
                load_json(MESH / "REGISTRY.json"), task["lane"]
            ),
            "blockedByDecision": block,
            "requiresDecisions": task.get("requiresDecisions", []),
            "status": task.get("status"),
        }, indent=2))
        return 0
    blocked = []
    for task in queue["tasks"]:
        reason = task_blocked_by_decision(task, decisions)
        if reason and task.get("status") in ("ready", "pending"):
            blocked.append({"taskId": task["id"], "blockedBy": reason})
    print(json.dumps({"blockedReadyTasks": blocked}, indent=2))
    return 0


def cmd_reconcile() -> int:
    queue = load_json(MESH / "QUEUE.json")
    registry = load_json(MESH / "REGISTRY.json")
    fixes: list[str] = []
    in_progress = {t["id"] for t in queue["tasks"] if t.get("status") == "in_progress"}
    for slot in registry["slots"]:
        tid = slot.get("currentTaskId")
        if slot.get("status") == "busy" and tid and tid not in in_progress:
            slot["status"] = "idle"
            slot["currentTaskId"] = None
            fixes.append(f"cleared ghost busy on {slot['id']} (was {tid})")
        if slot.get("status") == "busy" and not tid:
            slot["status"] = "idle"
            fixes.append(f"cleared busy without task on {slot['id']}")
    if fixes:
        registry["updatedAt"] = utc_now()
        save_json(MESH / "REGISTRY.json", registry)
    print(json.dumps({"reconciled": fixes or ["no changes"]}, indent=2))
    return 0


def cmd_status() -> int:
    state = load_json(MESH / "STATE.json")
    registry = load_json(MESH / "REGISTRY.json")
    queue = load_json(MESH / "QUEUE.json")
    tasks = task_index(queue)
    decisions = decision_index(load_decisions())

    counts: dict[str, int] = {}
    for task in queue["tasks"]:
        status = task.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1

    pending_decisions = [
        d["id"] for d in decisions.values() if d.get("status") in ("pending", "proposed")
    ]

    print(json.dumps({
        "mesh": {
            "meshPhase": state.get("meshPhase"),
            "milestone": state.get("milestone"),
            "branch": state.get("activeBranch"),
            "transportBranch": state.get("transportBranch"),
            "headSha": state.get("headSha"),
            "openBlockers": state.get("openBlockers", []),
            "openDecisionBlocks": state.get("openDecisionBlocks", pending_decisions),
            "taskCounts": counts,
        },
        "agents": [
            {
                "id": slot["id"],
                "lane": slot["lane"],
                "status": slot.get("status"),
                "currentTaskId": slot.get("currentTaskId"),
            }
            for slot in registry["slots"]
        ],
        "inProgress": [
            {"id": t["id"], "lane": t["lane"], "title": t["title"]}
            for t in queue["tasks"]
            if t.get("status") == "in_progress"
        ],
        "readyNext": [
            {"id": t["id"], "lane": t["lane"], "priority": t.get("priority"), "title": t["title"]}
            for t in ready_tasks(queue)[:5]
        ],
    }, indent=2))
    return 0


def cmd_next(count: int) -> int:
    queue = load_json(MESH / "QUEUE.json")
    picks = ready_tasks(queue)[:count]
    print(json.dumps({
        "ready": [
            {
                "id": task["id"],
                "lane": task["lane"],
                "priority": task.get("priority"),
                "title": task["title"],
                "status": task.get("status"),
            }
            for task in picks
        ]
    }, indent=2))
    return 0


def cmd_assign(lane: str, task_id: str) -> int:
    registry = load_json(MESH / "REGISTRY.json")
    queue = load_json(MESH / "QUEUE.json")
    state = load_json(MESH / "STATE.json")
    lanes = load_json(MESH / "LANES.json")
    tasks = task_index(queue)

    task = tasks.get(task_id)
    if not task:
        print(json.dumps({"error": f"unknown task {task_id}"}), file=sys.stderr)
        return 2
    if task.get("lane") != lane:
        print(json.dumps({
            "error": f"task {task_id} belongs to lane {task['lane']}, not {lane}"
        }), file=sys.stderr)
        return 2
    if task.get("status") in ("done", "blocked"):
        print(json.dumps({"error": f"task {task_id} is {task.get('status')}"}), file=sys.stderr)
        return 2
    decisions = decision_index(load_decisions())
    block = task_blocked_by_decision(task, decisions)
    if block:
        print(json.dumps({"error": f"task {task_id} blocked by decision {block}"}), file=sys.stderr)
        return 2
    if not deps_satisfied(task, tasks):
        print(json.dumps({"error": f"dependencies not satisfied for {task_id}"}), file=sys.stderr)
        return 2
    if lane_busy(registry, lane):
        print(json.dumps({"error": f"lane {lane} already busy"}), file=sys.stderr)
        return 2

    slot = next((s for s in registry["slots"] if s["lane"] == lane and s["id"] != "dispatcher-1"), None)
    if not slot:
        print(json.dumps({"error": f"no slot for lane {lane}"}), file=sys.stderr)
        return 2

    slot["status"] = "busy"
    slot["currentTaskId"] = task_id
    task["status"] = "in_progress"
    task["assignedAt"] = utc_now()
    task["assignedSlot"] = slot["id"]

    registry["updatedAt"] = utc_now()
    queue["updatedAt"] = utc_now()
    state["lastCycle"] = {
        "timestamp": utc_now(),
        "dispatcher": "dispatcher-1",
        "assigned": {"taskId": task_id, "lane": lane, "slot": slot["id"]},
    }

    lane_def = lanes["lanes"].get(lane, {})
    allowed, forbidden = merge_paths(lane_def, task.get("allowedPathsExtra"))

    save_json(MESH / "REGISTRY.json", registry)
    save_json(MESH / "QUEUE.json", queue)
    save_json(MESH / "STATE.json", state)

    print(json.dumps({
        "assigned": True,
        "taskId": task_id,
        "lane": lane,
        "slot": slot["id"],
        "allowedPaths": allowed,
        "forbiddenPaths": forbidden,
    }, indent=2))
    return 0


def cmd_complete(task_id: str, result: str, note: str | None) -> int:
    registry = load_json(MESH / "REGISTRY.json")
    queue = load_json(MESH / "QUEUE.json")
    state = load_json(MESH / "STATE.json")
    tasks = task_index(queue)

    task = tasks.get(task_id)
    if not task:
        print(json.dumps({"error": f"unknown task {task_id}"}), file=sys.stderr)
        return 2

    lane = task["lane"]
    slot_id = task.get("assignedSlot")
    for slot in registry["slots"]:
        if slot["id"] == slot_id or (slot["lane"] == lane and slot.get("currentTaskId") == task_id):
            slot["status"] = "idle"
            slot["currentTaskId"] = None

    if result == "pass":
        task["status"] = "done"
        task["completedAt"] = utc_now()
        state["metrics"]["tasksCompleted"] = state["metrics"].get("tasksCompleted", 0) + 1
        # Unlock dependents: mark pending tasks as ready when deps done
        for other in queue["tasks"]:
            if other.get("status") == "pending" and deps_satisfied(other, tasks):
                other["status"] = "ready"
    elif result == "fail":
        task["status"] = "ready"
        task["attempts"] = task.get("attempts", 0) + 1
        state["metrics"]["tasksFailed"] = state["metrics"].get("tasksFailed", 0) + 1
    else:
        task["status"] = "blocked"
        state["metrics"]["tasksBlocked"] = state["metrics"].get("tasksBlocked", 0) + 1

    if note:
        task["lastNote"] = note

    state["history"] = (state.get("history", []) + [{
        "at": utc_now(),
        "event": f"task_{result}",
        "taskId": task_id,
        "note": note,
    }])[-20:]

    registry["updatedAt"] = utc_now()
    queue["updatedAt"] = utc_now()
    save_json(MESH / "REGISTRY.json", registry)
    save_json(MESH / "QUEUE.json", queue)
    save_json(MESH / "STATE.json", state)

    print(json.dumps({"completed": task_id, "result": result, "newStatus": task["status"]}, indent=2))
    return 0


def cmd_block(task_id: str, reason: str, blocker_class: str) -> int:
    queue = load_json(MESH / "QUEUE.json")
    state = load_json(MESH / "STATE.json")
    tasks = task_index(queue)
    task = tasks.get(task_id)
    if not task:
        print(json.dumps({"error": f"unknown task {task_id}"}), file=sys.stderr)
        return 2

    task["status"] = "blocked"
    task["blockReason"] = reason
    blocker = {
        "id": f"blk-{task_id}",
        "taskId": task_id,
        "class": blocker_class,
        "reason": reason,
    }
    blockers = [b for b in state.get("openBlockers", []) if b.get("taskId") != task_id]
    blockers.append(blocker)
    state["openBlockers"] = blockers
    queue["updatedAt"] = utc_now()
    save_json(MESH / "QUEUE.json", queue)
    save_json(MESH / "STATE.json", state)
    print(json.dumps({"blocked": task_id, "reason": reason}, indent=2))
    return 0


def cmd_prompt(task_id: str) -> int:
    queue = load_json(MESH / "QUEUE.json")
    lanes = load_json(MESH / "LANES.json")
    tasks = task_index(queue)
    task = tasks.get(task_id)
    if not task:
        print(json.dumps({"error": f"unknown task {task_id}"}), file=sys.stderr)
        return 2

    lane_def = lanes["lanes"].get(task["lane"], {})
    allowed, forbidden = merge_paths(lane_def, task.get("allowedPathsExtra"))
    deps = task.get("dependsOn", [])
    done_deps = [d for d in deps if tasks.get(d, {}).get("status") == "done"]

    prompt = f"""VAW lane agent task {task_id}: {task['title']}

Repo: {ROOT}
Lane: {task['lane']}
Phase: {task.get('phase')}
Milestone: {task.get('phase')} / {queue['phases'][0]['milestone'] if task.get('phase') == 'M0' else task.get('phase')}

ALLOWED_PATHS:
{chr(10).join('  - ' + p for p in allowed)}

FORBIDDEN_PATHS:
{chr(10).join('  - ' + p for p in forbidden)}

Completed dependencies: {', '.join(done_deps) if done_deps else 'none'}

Read first:
  - README_FOR_AGENTS.md
  - AGENT_WORKFLOW.md
  - .codex/agent_mesh/DISPATCHER_ROLE.md (report-back rules)

Deliverable:
  {task.get('acceptance', 'See QUEUE.json')}

Validation:
{chr(10).join('  - ' + cmd for cmd in task.get('validation', []))}

Notes:
  {task.get('notes', 'None')}

When finished, report: result pass|fail|blocked, changed paths, validation output.
Dispatcher will run: python tools/agent_dispatch.py complete --task {task_id} --result <pass|fail|blocked>
"""
    print(prompt)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="VAW agent mesh dispatcher")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="Show mesh status")
    sub.add_parser("decisions", help="List decision mesh status")
    sub.add_parser("reconcile", help="Fix REGISTRY/QUEUE slot drift")

    p_gate = sub.add_parser("gate-check", help="Check decision gates for tasks")
    p_gate.add_argument("--task", default=None)

    p_next = sub.add_parser("next", help="List ready tasks")
    p_next.add_argument("--count", type=int, default=3)

    p_assign = sub.add_parser("assign", help="Assign task to lane")
    p_assign.add_argument("--lane", required=True)
    p_assign.add_argument("--task", required=True)

    p_complete = sub.add_parser("complete", help="Mark task outcome")
    p_complete.add_argument("--task", required=True)
    p_complete.add_argument("--result", choices=["pass", "fail", "blocked"], required=True)
    p_complete.add_argument("--note", default=None)

    p_block = sub.add_parser("block", help="Block a task")
    p_block.add_argument("--task", required=True)
    p_block.add_argument("--reason", required=True)
    p_block.add_argument("--class", dest="blocker_class", default="OWNER")

    p_prompt = sub.add_parser("prompt", help="Emit spawn prompt for a task")
    p_prompt.add_argument("--task", required=True)

    args = parser.parse_args()
    if not MESH.exists():
        print(json.dumps({"error": f"missing agent mesh at {MESH}"}), file=sys.stderr)
        return 2

    handlers = {
        "status": cmd_status,
        "decisions": cmd_decisions,
        "reconcile": cmd_reconcile,
        "gate-check": lambda: cmd_gate_check(args.task),
        "next": lambda: cmd_next(args.count),
        "assign": lambda: cmd_assign(args.lane, args.task),
        "complete": lambda: cmd_complete(args.task, args.result, args.note),
        "block": lambda: cmd_block(args.task, args.reason, args.blocker_class),
        "prompt": lambda: cmd_prompt(args.task),
    }
    return handlers[args.command]()


if __name__ == "__main__":
    raise SystemExit(main())