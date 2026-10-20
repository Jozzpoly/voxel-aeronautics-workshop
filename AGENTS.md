# AGENTS.md — VAW repository rules

This file is the only active agent-workflow document for VAW.

## Start here

Before changing anything:

1. resolve the live repository and branch head;
2. read `README.md`, `AI_PROJECT_MEMORY.md`, `PROJECT_VISION.md`, `ARCHITECTURE.md` and `ROADMAP.md`;
3. inspect the actual source relevant to the task;
4. treat `docs/history/**` as evidence only, never as current instructions.

Current recovery work is isolated on `recovery/playable-truth`. Do not move or rewrite `main` unless the recovery candidate is explicitly promoted.

## Authority order

When sources disagree, use this order:

1. current owner decision and manual evidence;
2. live source on the exact active SHA;
3. reproducible runtime/build evidence from that SHA;
4. current docs listed in `README.md`;
5. accepted architecture/contract documents;
6. tests;
7. historical material.

A passing test does not prove that a feature is useful, understandable or pleasant to use.

## Scope discipline

- Work on one bounded problem at a time.
- Do not fix unrelated defects merely because they were noticed.
- Separate `PRODUCT`, `HARNESS`, `ENVIRONMENT`, `OWNER` and `SCOPE` failures.
- Do not turn historical milestone names into active roadmap items without an explicit current decision.
- Do not merge donor branches such as `VAW_GRoK` or mobile branches wholesale. Salvage independently understandable slices only after the current code audit identifies a need.

## Repository safety

- Do not force-push or silently rewrite history.
- Do not use old recovery, maintenance or agent-mesh branches as authority.
- Do not recreate `.codex/agent_mesh`, dispatcher queues, registries or meeting/status machinery.
- Protect user-authored visual assets and local working packs; never normalize/delete them as cleanup side effects.
- Generated release/provenance output is not authored product truth. Do not change product code only to make generated evidence cosmetically green.
- If repository/file access is blocked and an exact uploaded file or ZIP would resolve it, ask for that file early instead of spending long effort on fragile workarounds.

## Validation

Use the smallest relevant technical validation first, then broader validation only when the changed scope justifies it. Keep target-platform/browser evidence separate from source-level evidence.

For frontend or rendered behavior, build/test success is insufficient. The rendered flow must be checked, and owner/manual evidence remains required for product-quality claims.

## Documentation rule

Current documentation must answer only four questions:

1. what VAW is trying to become;
2. what the current source demonstrably contains;
3. what is uncertain or known-bad;
4. what we are doing next.

History belongs under `docs/history/`. If a historical document says `current`, `stable`, `ready`, `next` or `complete`, those words describe its old checkpoint only.

When current reality changes, update the small current-doc set rather than appending another competing status report.
