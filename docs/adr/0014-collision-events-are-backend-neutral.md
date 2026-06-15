# ADR 0014 — Collision events are backend-neutral

## Status

Accepted in Foundation Phase 1D.2.

## Context

Gameplay read Cannon-specific `event.contact`, `bi`, `ri`, `rj` and `getImpactVelocityAlongNormal()`. This leaked backend contact semantics beyond the adapter.

## Decision

`runtime.cannon-physics-backend` maps native collide events to:

```text
{ otherBody, impactSpeed, relativePoint }
```

`relativePoint` is a plain immutable vector relative to the observed body. Gameplay may transform it through the physics port but cannot inspect native contact objects.

## Consequences

- Impact damage and ground detection no longer depend on Cannon contact field names.
- A future backend must implement the same event contract.
- Damage remains queued and processed after the solver step.
- Native body and vector operations still require later reduction.
