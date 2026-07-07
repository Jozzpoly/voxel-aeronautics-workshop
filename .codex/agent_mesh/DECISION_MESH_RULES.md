# Decision Mesh Rules

## Layers

| Layer | Authority | Purpose |
|-------|-----------|---------|
| **DECISIONS.json** | Owner + quorum | Policy, gates, approvals |
| **ROADMAP** | Product | What milestones mean |
| **QUEUE.json** | Dispatcher | When work runs |
| **assignments/** | Lane agents | Proof of work |

## Task assignable when

```text
deps satisfied AND requiresDecisions approved AND no blocking decision pending
```

## Dispatcher must pause when

- Any `owner_approval` pending for push or commit strategy
- `DEC-M0-GATE` pending + M4L product assign requested
- STATE.headSha ≠ git HEAD
- Verifier has not re-run validation on current HEAD

## Push gate G1–G10

1. m0-004 honestly done (validate:fast 6/6)
2. Harness tested (r1-001, r1-003)
3. Mesh truthful (STATE = QUEUE = REGISTRY)
4. M4L WIP committed or reverted
5. Probe labeled synthetic-only
6. ENV_BASELINE fresh
7. Doc authority single (VAW_GRoK transport)
8. Branch aligned with origin/VAW_GRoK
9. Clean staging (no UNKNOWN paths)
10. Owner explicit push approval