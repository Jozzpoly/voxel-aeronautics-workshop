# AI Project Memory — Voxel Aeronautics Workshop

Current source of truth: **Foundation Phase 1D.4A — Mechanical Platform Convergence**.

## Identity

- `APP_VERSION`: `0.7.0-foundation.1d4a`
- `RELEASE_ID`: `foundation-1d4a-rigid-islands-mechanical-graph`
- Blueprint v11, CompiledCraft V4, RuntimeAssemblyPlan V2.

## Product truth

> Buduję, programuję, testuję i pilotuję własną voxelową maszynę.

The sandbox comes before checklist pressure. Any module may be the first block, Core is movable/removable while editing, manual piloting remains first-class, and programming must grow in layers rather than replace direct control.

## Current architecture

`CraftModel` is the sole workshop source of truth for `blocks[] + mechanicalLinks[]`. `CraftCompiler` is the only verified path to CompiledCraft. Topology is pure and split into structural graph, mechanical authoring resolution, rigid-island compilation and mechanical graph compilation. RuntimeAssemblyPlan is backend-neutral; AssemblyBuilder alone allocates the main assembly through Physics Port. `game.js` composes explicit kernel modules through `runtime.active-context`; the removed `window.VAW_RUNTIME` aggregate must not return. The game shell must not rebuild topology.

## Identity and spaces

- `blockId`: durable block identity; move preserves, copy remaps.
- `mechanicalLinkId`: durable authoring identity and runtime constraint ID.
- `bodyId`: deterministic rigid-island identity anchored by Core or smallest block ID.
- `bodyId` is not future `assemblySpaceId`.
- Coordinates are explicit: `assemblyPosition`, `bodyLocalPosition`, `assemblyPose`, world transform.

## Recovery baseline — 2026-06-16

The verified recovery branch is `recovery/2026-06-16-regression-repair`, based on remote `main` at `f6082e84d3a352cea47a8e43d2260ae4d4226715`. The unpushed local commit prefix `1b42ef6` was not present on GitHub and could not be recovered without the former local object database.

Input focus is governed by one editable-interaction policy based on the event target and `document.activeElement`; key release and window blur always clear active flight actions. Manual flight intent remains root-frame-relative for the pilot, but `FlightThrusterRouter` remaps it through world space to each functional part's owning body and never falls back silently to the root body. `FlightMechanicalVisuals` owns FLIGHT-only hinge/link presentation, derives both endpoints from current body transforms, and is registered in the `FlightSession` transient lifecycle for idempotent cleanup.

Mechanical hinge authoring is workshop state, not pointer-hover state: leaving the canvas only hides placement ghosts. Hinge authoring is cancelled explicitly on successful launch, blueprint load/import, undo/redo restoration and new blueprint creation.

Dedicated regression coverage exists in `tests/test_input_focus_policy.js`, `tests/test_flight_thruster_routing.js`, `tests/test_flight_mechanical_visuals.js`, and `tests/run_browser_recovery.mjs`. Read `RECOVERY_AUDIT_2026-06-16.md`, `RECOVERY_BASELINE_TESTS.md`, `BROWSER_RECOVERY_SCENARIO_2026-06-16.md`, and `RECOVERY_VALIDATION_REPORT_2026-06-16.md` before changing these seams.

## Safety constraint

Connected-body recenter is blocked until an atomic constraint-pivot rebase/rebuild with rollback is proven. Endpoint failure first breaks the constraint backend-first. Dynamic rigid-body split is not implemented.

## Next product work

Gate B is closed. The next product gate is Gate C: real Assembly Spaces / Sublevels built on the stable body-in-assembly seam.

Do not start Device & Port Schema, ControlRuntime, walking, docking, broad interiors or empty future APIs before Gate C stabilizes spatial ownership.

## Mandatory reading

Read `PROJECT_VISION.md`, `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `FOUNDATION_READINESS_REVIEW.md`, `PROGRAMMABLE_MACHINE_RESEARCH.md`, `docs/history/phases/PHASE_1D4A_REPORT.md`, accepted ADR 0033–0040 and current test/validation reports before changing foundations.

## Workflow and repository state — Stage 1 closed 2026-06-17

- Active continuation branch: `maintenance/workflow-repair-clean`.
- Published Stage 1 commit: `306d5690cae647066acc00a80bcf26a1d47c0441`.
- Trusted parent commit: `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`.
- `maintenance/workflow-bootstrap` at `a983f02f86184798fb804d582c0da15264fccab1` is incomplete historical evidence. Do not merge it, extend it, use it as transport, reset it or force-push it.
- Stage 1 delivered durable validation, exact resume identity, tracked/untracked/ignored/mode/symlink side-effect detection, controlled interruption and timeout cleanup, isolated FULL artifacts, delivery tooling and the first repository-structure migration.
- All sixteen `PHASE_*_REPORT.md` files live under `docs/history/phases/`; do not restore root duplicates.
- Linux documentation, release, FAST and FULL validation passed for the published Stage 1 candidate with no repository side effects.
- Windows targeted path/process-family/run-directory tests, the validation runner and FAST passed.
- Windows FULL is `PARTIAL` only because the pre-existing raw-worktree `SOURCE_MANIFEST.json` contract is CRLF-sensitive. This is deferred to Stage 1.1 and is not a Stage 1 or gameplay regression.
- The next infrastructure milestones are Documentation Convergence Stage 2 and, separately, Stage 1.1 Cross-platform release reproducibility.
- After Stage 2 and Stage 1.1, freeze cosmetic repository reorganization and return to Gate C.
- Current handoff: `docs/WORKFLOW_REPAIR_HANDOFF.md`.
