# Foundation Hardening M3C Audit Cleanup Handoff

Status: M3C implementation handoff
Date: 2026-06-29
Base SHA before M3C: `401a7ecfa3807c6699d1040934aceb8ee91b50a7`
Branch: `current_work`
Authority: Handoff evidence only; product truth remains in source, tests, active docs and accepted ADRs.

## Protected Dirty Work At Start

The following paths were dirty before M3C and were treated as protected user/art
work. Do not stage, clean, normalize or regenerate them without explicit owner
approval:

- `assets/visual_packs/installed_visual_packs.json`
- `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`
- `assets/visual_packs/local_working_visuals/models/blocks/balloon/`

## Closed In M3C

- `tools/blockbench_import_studio/docs/VISUAL_ASSET_PACK_V1.md` is now a
  Studio-local pointer to canonical `docs/visual_asset_pack_v1.md`, not a forked
  schema copy.
- `docs/README.md` classifies `tools/blockbench_import_studio/docs/**` as
  tool-local or historical unless active docs explicitly link to it.
- `src/foundation/bootstrap.js` reports
  `VAW_RUNTIME_ASSEMBLY_PLAN_V3` as the runtime assembly capability.
- `PROGRAMMABLE_MACHINE_RESEARCH.md` uses
  `Future transport: Cables, bus and wireless policies.`
- Root `FOUNDATION_READINESS_REVIEW.md` was retired into
  `docs/history/reviews/FOUNDATION_READINESS_REVIEW_2026-06-18.md`.
- `tests/test_documentation_contract.py` now guards the canonical visual asset
  contract pointer, the retired readiness review, ADR 0044 and the updated
  programming research wording.
- `tests/test_game_architecture.py` now blocks new ad-hoc `window.VAW_*`
  globals except the two existing visual-asset diagnostics.
- `docs/adr/0044-workflow-checkpoint-branch-and-ci-policy.md` records the
  `current_work` checkpoint branch and CI trigger policy.
- `tools/prune_agent_validation.py` adds dry-run-first retention support for
  `.agent-validation/`; deletion requires explicit `--apply`.

## Deferred Owner Decisions

- Release artifact retention under `release/**`: keep forever, keep-N in Git, or
  move historical artifacts to GitHub Releases/tags with checksums in Git.
- ADR 0028 remains `Proposed`; Gate D acceptance needs owner direction.
- Bootstrap relocation from `src/foundation/bootstrap.js` to a runtime path is a
  separate M3D candidate because it touches startup, release build, source
  inventory and tests.
- A proper debug namespace migration remains a kernel/debug-surface decision;
  `window.VAW` is frozen, so do not treat it as a trivial rename.

## Validation Commands For This Checkpoint

Targeted:

```text
node --check src/foundation/bootstrap.js
node tests/test_foundation.js
node tools/run_with_python_env.js python tests/test_documentation_contract.py
node tools/run_with_python_env.js python tests/test_game_architecture.py
node tools/run_with_python_env.js python -m py_compile tools/prune_agent_validation.py
node tools/run_with_python_env.js python tools/prune_agent_validation.py --keep 5
```

Target-platform evidence:

```text
npm.cmd run browser:smoke
```

Full gates:

```text
npm.cmd run test
node tools/run_with_python_env.js python tools/validate_fast.py
node tools/run_with_python_env.js python tools/validate_full.py
git diff --check
git diff -- SOURCE_MANIFEST.json
git diff --cached --name-only
```

## Non-Goals

M3C does not change gameplay, physics semantics, Blueprint, CraftModel, compiler
output, save schema, Gate D, visual runtime semantics, `release/**`, or
`assets/visual_packs/local_working_visuals/**`.

## Next Work Order

1. Verify M3C with the commands above.
2. Commit and push only M3C files on `current_work`.
3. Record final `HEAD == origin/current_work` in the final report.
4. Next safe lane: M4 visual authoring proof or M3D bootstrap/debug-surface
   cleanup, but only after owner decisions are separated from mechanical
   cleanup.
