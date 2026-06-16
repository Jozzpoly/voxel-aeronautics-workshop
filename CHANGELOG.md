# Changelog

## 0.7.0-foundation.1d4a — 2026-06-16

### Added

- Blueprint v11 mechanical-link entities and pure stepwise legacy migration through v11.
- Atomic CraftModel block/link transactions, copy remapping and revision-aware compiler cache.
- Structured diagnostics with entity references.
- StructuralGraphCompiler, MechanicalAuthoringResolver, RigidIslandCompiler and MechanicalGraphCompiler.
- Anchor-based rigid-island body IDs and per-island mass properties.
- CompiledCraft V4 and RuntimeAssemblyPlan V2 with explicit coordinate spaces and body assembly poses.
- Owner-body launch payload compilation and pivot recalculation.
- Runtime block/body/part/collider/constraint indexes.
- Minimal workshop Hinge Link authoring and visualization.
- Normal compiled two-body real-Cannon gameplay path.
- Endpoint constraint break and connected-body rebase guard.
- Gate B deterministic, fuzz, performance, real-Cannon and 50-cycle lifecycle tests.
- Example `examples/articulated_hinge_v11.json`.

### Changed

- Collision/damage routing retains body identity and selects parts only inside the impacted body.
- Structural support and damage propagation use compiled rigid neighbors rather than raw grid adjacency.
- Root body remains Core-owned for camera, mission and default pilot policy; other bodies use their own transforms and forces.
- Release identity advanced to Foundation Phase 1D.4A.

### Removed

- Production `body:root` hardcoding, obsolete native-body compatibility aliases and the private `window.VAW_RUNTIME` aggregate.
- Global-COM interpretation of multi-body part/collider locations.
- Test-only topology as evidence of gameplay support.

### Known limitation

- Dynamic connected-body frame rebase/split is not implemented; non-zero recenter with active constraints is rejected before mutation.
