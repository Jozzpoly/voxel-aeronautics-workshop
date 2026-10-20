# Changelog

## Unreleased - Authoring UX Recovery Milestone 1

### Added

- Deterministic placement failure feedback for ghost adjacency and click-status toasts, including occupied cells, block limits and active Assembly Space mismatch.
- Semantic orientation readouts for Core, Thruster, Wing, ControlSurface and VectorThruster modules.
- `tests/test_orientation_service.js` coverage for block-specific orientation labels.
- `game.build-targeting` module with unit-tested placement normal snapping, active assembly-space conversion and hardened stable target result shapes.
- Launcher-level Flight Focus button that reuses the existing fullscreen/focus path.
- Telemetry camera controls for `static`, `follow-position` and `follow-body` modes.
- Shift + middle mouse drag camera panning in build and flight.
- `game.camera-controller` service module to keep camera UX out of the monolithic entrypoint.

### Changed

- Ghost placement feedback now reports `NO: <REASON>` instead of a bare `NO`.
- Telemetry labels runtime mass as Active mass while flight still reports active/lost blocks.
- Voxel placement targeting now transforms hit-object local normals into scene space, converts them into the active Assembly Space, snaps to grid space, and then computes the adjacent placement cell.
- `tests/run_all.py` now includes `tests/test_build_targeting.js` so M2A targeting math stays in the core validation path.
- UI preferences bumped to v9 and now persist camera mode/follow strength only as UI state, never Blueprint data.
- Flight telemetry mass/block readouts now use runtime state in FLIGHT and blueprint analysis in BUILD.
- Camera pitch clamp now allows viewing craft from below.
- Bottom launcher z-order is lower than visible workspace panels, preventing panel button click stealing.
- Startup smoke coverage now checks camera UI and both Flight Focus toggle entry points.

### Deferred

Full orientation panel redesign, microcraft balance, aero tuning and Gate D device/port schema remain separate milestones.

## 0.8.2-foundation.workbench-foundation - 2026-06-21

### Added

- Workbench UI layout v4 with docked/floating placements and separate build/flight layouts.
- Dockable parts hotbar backed by the existing gameplay block catalog.
- ADR 0042 for Workbench UI layout and ADR 0043 for the visual asset boundary.

### Changed

- Documentation authority now treats Gate C as the stable base and Workbench Foundation as the immediate milestone.
- Old root-level recovery, validation and support snapshots are archived under `docs/recovery/` and `docs/history/`.

### Deferred

Blockbench importer, VisualAssetRegistry implementation, Gate D Device/Port Schema and broader visual redesign remain later milestones.

## 0.8.1-foundation.gate-c-hardening — 2026-06-18

### Added

- Blueprint v12 Assembly Spaces, CompiledCraft V5 and RuntimeAssemblyPlan V3.
- Deep-hierarchy-safe canonical ownership indexes and atomic reparent/reassignment.
- Fixed-step scheduler health metrics and bounded diagnostics.
- Offline vendored Three r128/Cannon 0.6.2 and generated UI CSS.
- Future-hardening, hostile-import, persistence, backend parity and dependency tests.

### Fixed

- corrupt primary save overwriting a valid backup;
- order-dependent anonymous IDs across spaces;
- silent invalid actuator/physics values;
- owner-space hinge-axis validation;
- headless/Cannon axis-angle mismatch;
- repeated whole-craft runtime scans;
- authoring-only names perturbing executable signatures.

### Deferred

Dynamic articulated fracture, atomic constrained rebase, WebGL context recovery, transform gizmos, multiplayer, mobile/touch and external mod loading.

## 0.7.0-foundation.1d4a — 2026-06-16

Gate B Mechanical Platform Convergence. Historical details remain in `docs/history/phases/PHASE_1D4A_REPORT.md`.
