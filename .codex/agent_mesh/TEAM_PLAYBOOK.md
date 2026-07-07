# VAW Agent Team Playbook

Read after `DISPATCHER_ROLE.md`.

## Roles

- **Dispatcher** — gates, assign, verify closeouts; no product code
- **Lane lead** — one task, one lane; writes `assignments/<taskId>.md`
- **Verifier** — re-runs `task.validation` on **current HEAD** before `pass`
- **Owner liaison** — USER_ART, transport, destructive git

## Session lifecycle

```text
OPEN → RECONCILE → GATE → ASSIGN → VERIFY → CLOSE → REPORT
```

## Mandatory gates before assign

- G1 worktree classified
- G2 STATE.headSha == git HEAD
- G3 validate tier ≥ task.minimumTier (M4L needs T3 = validate:fast green)
- G4 no blocking openDecisionBlocks
- G5 requiresDecisions all approved
- G6 lane idle
- G7 no path conflict with other in_progress

## pass bar

1. Closeout file exists
2. Verifier re-ran all validation commands on current HEAD
3. Dispatcher `complete` only after verify_pass

## Cancelled agents

1. Free REGISTRY slot immediately
2. Task → `ready` or `blocked`
3. Never leave ghost `in_progress` + `busy`

## Planning supremacy

- **ROADMAP** = meaning of done
- **QUEUE** = dispatch order
- **DECISIONS** = gates that block assign
- Handoffs = evidence only