# Foundation Phase 1D.2 Report

## Delivered

- fixed the Build workspace scroll regression;
- introduced dedicated scroll bodies for all primary panels;
- added viewport-safe restore and drag clamping;
- migrated workspace schema to v2 and UI preferences to v3;
- normalized Cannon collision callbacks to backend-neutral events;
- removed native contact interpretation from `game.js`;
- preserved deferred impact damage and existing flight behavior;
- updated deterministic release to `0.5.2-foundation.1d2`.

## Validation

The complete automated suite passes. A focused Chromium layout test confirmed that the panel scroll area moves from `scrollTop 0` to `scrollTop 500` after a wheel event while the outer panel remains fixed.

## Next boundary

Foundation Phase 1D.3 should extract `CompiledCraft -> PhysicsBody/runtime parts`, add real headless dynamics scenarios, and record collider benchmarks before any collider merging or backend decision.
