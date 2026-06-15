# ADR 0023 — Explicit mass properties cross the physics boundary

## Status

Accepted in Foundation Phase 1D.2F.

## Context

`CraftCompiler` calculated a diagonal inertia used by engineering analysis, while Cannon.js recalculated body inertia from the compound body's AABB. Analysis and simulation could therefore disagree, especially for long or asymmetric craft.

Mass also changes after payload attachment, part detachment and COM recentering.

## Decision

Physics Port exposes `setBodyMassProperties(body, descriptor)` with:

- `mass`;
- body-local `centerOfMass`;
- `inertiaDiagonal`.

The current builder centers collider offsets around the COM before calling the backend. The Cannon backend therefore requires `centerOfMass = (0,0,0)` and rejects a non-zero value rather than silently ignoring it.

The backend updates mass, inverse mass, diagonal inertia, inverse inertia, world inertia and solve properties.

After detach, runtime recalculates COM and diagonal inertia before atomically applying the new properties.

## Consequences

- Engineering analysis and solver use the same diagonal mass model.
- `setBodyMass()` remains available for simple auxiliary bodies.
- Full off-diagonal inertia is deferred until a backend and assembly representation can support it honestly.
- Multi-body builders must calculate and apply mass properties independently for every rigid island.
