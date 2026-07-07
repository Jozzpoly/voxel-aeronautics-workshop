# VAW Agent Mesh

Status: Active orchestration layer
Authority: Operational routing only. Product truth remains in source, ADRs and accepted contracts.

This folder is the live control plane for multi-agent work. One dedicated **Dispatcher** agent owns assignment; lane agents execute bounded tasks.

## Roles

| Role | Count | May write product code? | Owns |
|------|-------|-------------------------|------|
| **Dispatcher** | 1 | No (STATE/QUEUE/REGISTRY only) | Assignment, dependency unlock, conflict detection |
| **Lane agents** | 1+ per lane | Yes, within ALLOWED_PATHS | Milestone slices |
| **Owner (Jozz)** | 1 | Approves USER_ART, remote, destructive ops | Product decisions |

## Files

| File | Owner | Purpose |
|------|-------|---------|
| `DISPATCHER_ROLE.md` | Dispatcher | Operating contract for the assignment agent |
| `REGISTRY.json` | Dispatcher | Agent slots, lanes, capacity |
| `QUEUE.json` | Dispatcher | Prioritized DAG of tasks |
| `STATE.json` | Dispatcher | Live assignments, blockers, history |
| `LANES.json` | Dispatcher | ALLOWED/FORBIDDEN paths per lane |
| `assignments/` | Lane agents | Per-task evidence drops (optional) |

## Team foundation (2026-07-07)

| Doc | Purpose |
|-----|---------|
| `TEAM_ROSTER.json` | Names, skills, slots |
| `TEAM_CHARTER.md` | Mission and values |
| `COLLABORATION_SYSTEM.md` | Forced multi-agent collaboration |
| `FILE_STRUCTURE.md` | Folder layout v2 |
| `skills/*.md` | Per-lane skill cards |
| `meetings/FOUNDATION_2026-07-07.md` | Founding meeting notes |

## Commands

```powershell
# Session start — parallel spawn pack
npm run agent:cycle
npm run agent:spawn-pack
npm run agent:fatigue

# Dispatcher ops
npm run agent:status
npm run agent:next
node tools/run_with_python_env.js python tools/agent_dispatch.py assign --lane docs-convergence --task m4l-108
node tools/run_with_python_env.js python tools/agent_dispatch.py complete --task m4l-108 --result pass
```

## Session loop

```text
1. Dispatcher reads STATE + QUEUE + REGISTRY
2. Run start gate (README_FOR_AGENTS.md)
3. Mark completed tasks; unlock dependents
4. Assign ready tasks to idle lane slots (max 1 writer per lane)
5. Emit spawn prompts for parent orchestrator to launch subagents
6. Lane agents report back → Dispatcher updates STATE
7. Repeat until milestone closed or OWNER blocker
```

## Branch policy (owner 2026-07-07)

- Transport only on **`VAW_GRoK`** (`origin/VAW_GRoK` = copy of `current_work` @ `80c0ae4`).
- Local feature branches off `VAW_GRoK` are allowed; ask owner before other remotes or branches.
- **Push held** until `DEC-REMEDIATION-COMPLETE` (see `DECISIONS.json`).

## Decision mesh (above QUEUE)

| File | Role |
|------|------|
| `AUDIT_FINDINGS.json` | Audit finding IDs |
| `DECISIONS.json` | Policy gates and owner approvals |
| `DECISION_MESH_RULES.md` | Pause rules and push gate G1–G10 |
| `REMEDIATION_PLAN.md` | R0–R4 task breakdown |
| `TEAM_PLAYBOOK.md` | Agent team lifecycle and verify discipline |

```powershell
python tools/agent_dispatch.py decisions
python tools/agent_dispatch.py gate-check
python tools/agent_dispatch.py reconcile
```

**ROADMAP** = meaning of done. **DECISIONS** = what blocks assign. **QUEUE** = when work runs.

## Integration

- Start here after `README_FOR_AGENTS.md` when running multi-agent milestones.
- Handoffs remain in `.codex/handoff/`; they are evidence, not assignment authority.
- `QUEUE.json` follows `docs/ROADMAP_REBASE_2026-07-01.md` order: M0 env → M4L → M4L-C′ → M5+.