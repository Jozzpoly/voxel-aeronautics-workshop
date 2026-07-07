# Remediation Plan R0–R4

Status: Active — blocks push until `DEC-REMEDIATION-COMPLETE` approved  
Transport: `origin/VAW_GRoK` @ `80c0ae4` (= `origin/current_work`)

## Critical path

```text
r0-001 → r1-001 → r1-004 → r2-* → r3-001/002 → r4-004 PUSH GATE
```

## R0 — Stabilize truth

| ID | Lane | Task |
|----|------|------|
| r0-001 | qa-validation | Re-run `check:css` + `validate:fast` on current HEAD; reopen m0-004 if fail |
| r0-002 | env-infra | Regenerate CSS if stale (`tailwindcss@4.1.10 --no-save`) |
| r0-003 | qa-validation | Classify validation-runner failure PRODUCT/HARNESS/ENVIRONMENT |
| r0-004 | dispatcher | Block m4l-101/m4l-107; free ghost busy slots |

## R1 — Fix harness

| ID | Lane | Task |
|----|------|------|
| r1-001 | tooling-tests | Test `terminals/` exclusion in `test_validation_runner.py` |
| r1-002 | docs-convergence | Document exclusion policy in README_FOR_AGENTS / AGENT_WORKFLOW |
| r1-003 | tooling-tests | Add `tests/test_agent_dispatch.py` |
| r1-004 | qa-validation | Re-run m0-004 after harness tests; archive `.agent-validation` summary |

## R2 — Reconcile mesh

| ID | Lane | Task |
|----|------|------|
| r2-001 | dispatcher | Fix STATE metrics, headSha, worktreeClass, openDecisionBlocks |
| r2-002 | dispatcher | Normalize QUEUE statuses; add remediation tasks |
| r2-003 | dispatcher | Sync REGISTRY slots with QUEUE |

## R3 — Verify M4L WIP

| ID | Lane | Task |
|----|------|------|
| r3-001 | visual-renderer | Complete/verify m4l-101 (profiles + tests) |
| r3-002 | studio-pipeline | Complete/verify m4l-107 (duplicate material diagnostics) |
| r3-003 | docs-convergence | Relabel probe as synthetic-only in evidence/docs |
| r3-004 | planner-auditor | Accept M4L WIP scope before staging |

## R4 — Doc convergence + push gate

| ID | Lane | Task |
|----|------|------|
| r4-001 | qa-validation | Refresh ENV_BASELINE post-remediation |
| r4-002 | docs-convergence | Converge PUSH_INSTRUCTIONS, handoff, ADR note for VAW_GRoK |
| r4-003 | dispatcher | Stage bounded commits (no `git add .`) |
| r4-004 | owner + dispatcher | Push gate G1–G10 (see DECISION_MESH_RULES.md) |

## Push unlocks when

All R0–R3 done, r4-004 GO, `DEC-REMEDIATION-COMPLETE` approved, owner releases push explicitly.