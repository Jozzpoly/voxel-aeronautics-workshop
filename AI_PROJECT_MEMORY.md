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

## Next work

Next gate is Gate C: real assembly spaces/sublevels built on the stable body-in-assembly seam. Do not start Device/Port Schema or ControlRuntime in parallel. No empty future APIs.

## Mandatory reading

Read `PROJECT_VISION.md`, `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `FOUNDATION_READINESS_REVIEW.md`, `PROGRAMMABLE_MACHINE_RESEARCH.md`, `docs/history/phases/PHASE_1D4A_REPORT.md`, ADR 0033–0040 and current test/validation reports before changing foundations.

## Workflow repair state — 2026-06-17

- Trusted remote base: `d386bc56659b2fa99ed406dd68ed9781cc6dba1e` on `recovery/2026-06-16-regression-repair`.
- `maintenance/workflow-bootstrap` is an incomplete remote branch at `a983f02f86184798fb804d582c0da15264fccab1`; it contains only four entry-point files and must not be merged or extended.
- The clean delivery target is `maintenance/workflow-repair-clean`, created from the trusted base without rewriting the incomplete branch.
- The remote clean branch exists and currently points exactly to `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`. Stage 1 has not yet been published to it; use the complete Stage 1-R1 patch until a normal atomic publication from a real checkout is available.
- The repaired validation candidate detects tracked, ordinary untracked and ignored final-state effects, file modes and symlink targets; controlled interruption and timeout clean the known process family and persist non-pass state.
- FULL validation builds and verifies HTML, ZIP and SHA256 evidence inside the unique run directory (`.agent-validation/full-<run-id>/release/`); concurrent FULL runs do not share artifacts and no pre-existing `dist/` is required.
- `tools/apply-agent-delivery.ps1` remains experimental. Dotfiles retain leading dots; after commit the helper requires a clean tree and successful reverse-apply check. Its Git semantic contract is tested outside Windows, but Windows PowerShell 5.1 and pwsh 7 execution remain `NOT-RUN` until real Windows evidence exists.
- Independent review caught and blocked the former `TrimStart([char[]]'./')` dotfile corruption before acceptance. The matrix now includes `.gitignore` and `.github/workflows/example.yml`; do not regress this normalization contract.
- Do not begin Gate 4 optimization from the abandoned P3 patch. Re-measure from the repaired candidate after remote/fresh-apply evidence is reviewed.
- Current handoff: `docs/WORKFLOW_REPAIR_HANDOFF.md`.

## Repository structure increment — 2026-06-17

- Workflow repair COMPLETE v2 is embedded in the local clean-branch checkpoint `3078ea95e3124635f81a00614ed4d849282062a5`; this SHA belongs to the synthetic local reconstruction and is not a GitHub commit.
- Repository structure audit and target live in `docs/repository/REPOSITORY_STRUCTURE_AUDIT.md` and `docs/repository/REPOSITORY_STRUCTURE_TARGET.md`.
- First migration checkpoint `727966e117fa7738d5b32ba759a932ae75014d10` moved all sixteen `PHASE_*_REPORT.md` files from root to `docs/history/phases/` with no compatibility copies.
- Current Phase 1D.4A delivery evidence is now `docs/history/phases/PHASE_1D4A_REPORT.md`; active architecture documents and accepted ADRs remain authoritative.
- Documentation, release ZIP, FAST and FULL validations pass with zero side effects and no lingering processes. Windows execution remains `NOT-RUN`; the remote clean branch remains at the trusted base and Stage 1 is unpublished.
- Next repository migration should create an active docs index and classify reviews. Do not combine it with recovery, tools, tests, tracked releases or `src/` moves.
