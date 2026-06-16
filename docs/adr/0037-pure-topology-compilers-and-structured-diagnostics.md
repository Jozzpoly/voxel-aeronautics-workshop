# ADR 0037 — Pure compiler pipeline and structured diagnostics

Status: Accepted in Foundation Phase 1D.4A.

## Decision
CraftCompiler orchestrates pure `StructuralGraphCompiler`, `MechanicalAuthoringResolver`, `RigidIslandCompiler` and `MechanicalGraphCompiler`. They have no DOM, Three or Cannon dependency. User topology errors return canonical diagnostics `{code,severity,entities,details}` in deterministic order; `ready` is derived from severity. Legacy code arrays are projections only.

## Consequences and proof
Backend allocation never sees unresolved endpoints, invalid axes or invalid hinge configuration. Signatures include link geometry/configuration and are invariant to input order. Seeded property tests verify output invariants and diagnostic stability.
