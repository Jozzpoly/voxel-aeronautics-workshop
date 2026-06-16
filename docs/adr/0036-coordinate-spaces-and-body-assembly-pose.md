# ADR 0036 — Coordinate-space vocabulary and body-in-assembly pose

Status: Accepted in Foundation Phase 1D.4A.

## Decision
Positions are named by space: blueprint grid / `assemblyPosition` / `bodyLocalPosition` / world. Each island origin is its own center of mass. `bodyLocalPosition = assemblyPosition - islandCOM`; `assemblyPose.position = islandCOM`; startup rotation is identity. Joint pivots are derived in assembly space, then converted independently to local A/B. World spawn is `spawnTransform × assemblyPose` through pure transform helpers.

## Rejected alternative
One global craft COM was rejected because it corrupts multi-body collider, torque, pivot and spawn semantics.

## Consequences and proof
CompiledCraft V4 and RuntimeAssemblyPlan V2 expose explicit fields. Round-trip and rotated spawn tests prove both body poses and pivot equivalence. Gate C can extend the transform seam without rewriting topology.
