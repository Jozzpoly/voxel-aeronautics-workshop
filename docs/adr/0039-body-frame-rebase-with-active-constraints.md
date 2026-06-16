# ADR 0039 — Body-frame rebase with active constraints

Status: Accepted with an enforced narrow limitation in Foundation Phase 1D.4A.

## Context
Moving a connected body's local frame without rebuilding constraint pivots causes real-Cannon pivot drift. Atomic constraint rebuild with rollback is not yet a proven Physics Port capability.

## Decision
Phase 1D.4A forbids non-zero `recenterBody` on a body with active constraints. RuntimeAssembly throws; FlightIntegrity emits `connected-body-recenter-blocked` and leaves backend/state unchanged. Endpoint destruction first removes its constraint backend-first. Further detachment on a still-connected body is blocked. Unconstrained bodies retain point-velocity-preserving rebase.

## Capability evidence
Real-Cannon tests cover hinge drift soak, endpoint break, cleanup ordering and the guard. This is a named `per-rigid-island-static-frame-guard`, not silent support for generalized articulated fracture.

## Follow-up
Before dynamic split or arbitrary payload mutation on connected bodies, implement atomic local-pivot rebase/rebuild with rollback and motor/servo/limit preservation.
