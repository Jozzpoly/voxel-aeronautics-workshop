# VAW Agent Team Charter

**Founded:** 2026-07-07  
**Transport:** `VAW_GRoK`  
**Members:** See `TEAM_ROSTER.json`

## Mission

Deliver VAW milestones (M4L → M5 → M6…) with **honest gates**, **parallel lane agents**, and **no single-agent exhaustion**.

## Values

1. **Truth over velocity** — PASS tylko z artefaktem na HEAD.
2. **Parallel by default** — DAG i ścieżki plików są jedynymi wymuszeniami serializacji.
3. **Bounded ownership** — jeden lane, jeden writer, jeden skill card.
4. **Owner sovereignty** — USER_ART, push, transport poza zespołem bez zgody Jozz.

## Roles at a glance

| Codename | Lane | One-line duty |
|----------|------|---------------|
| KAI | dispatcher | Assign, never implement |
| MIRA | env-infra | Git, CSS, transport truth |
| TOOL | tooling-tests | Harness and regressions |
| PIXEL | visual-renderer | Game visual truth |
| FORGE | studio-pipeline | Studio capture and diagnostics |
| SCRIBE | docs-convergence | Docs and handoffs |
| PROOF | qa-validation | Verify ladder |
| SAGE | planner-auditor | Gate critique |

## Session entry

```powershell
npm run agent:cycle
# Parent launches all entries in sessions/active_spawn_pack.json in parallel
```

Full rules: `COLLABORATION_SYSTEM.md`  
Meeting notes: `meetings/FOUNDATION_2026-07-07.md`