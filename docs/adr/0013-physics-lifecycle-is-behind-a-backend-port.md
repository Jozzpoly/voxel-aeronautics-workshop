# ADR 0013 — Physics lifecycle is behind a backend port

## Status

Accepted in Foundation Phase 1D.1.

## Context

`game.js` directly created Cannon worlds, bodies and shapes, mutated collider arrays, added and removed bodies, applied forces and stepped the solver. This made a backend comparison impossible and mixed gameplay with backend lifecycle details.

## Decision

Introduce:

- `runtime.physics-port` for normalized descriptors and backend contract validation;
- `runtime.cannon-physics-backend` as the reference implementation.

`game.js` must not directly instantiate world/body/box/plane objects or call add/remove/step on the native world. The adapter owns collider removal, offset shifting after COM changes, mass refresh, force/torque application and local/world transforms.

## Consequences

The current behavior remains based on Cannon.js. The boundary now permits controlled tests and later backend experiments. Native body/vector fields remain temporarily visible. Cannon contact semantics were removed from gameplay in Phase 1D.2, but the project still does not claim complete backend interchangeability.
