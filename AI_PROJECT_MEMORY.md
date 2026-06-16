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

## Safety constraint

Connected-body recenter is blocked until an atomic constraint-pivot rebase/rebuild with rollback is proven. Endpoint failure first breaks the constraint backend-first. Dynamic rigid-body split is not implemented.

## Next work

Next gate is Gate C: real assembly spaces/sublevels built on the stable body-in-assembly seam. Do not start Device/Port Schema or ControlRuntime in parallel. No empty future APIs.

## Mandatory reading

Read `PROJECT_VISION.md`, `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `FOUNDATION_READINESS_REVIEW.md`, `PROGRAMMABLE_MACHINE_RESEARCH.md`, `PHASE_1D4A_REPORT.md`, ADR 0033–0040 and current test/validation reports before changing foundations.
