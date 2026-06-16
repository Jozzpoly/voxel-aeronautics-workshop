# ADR 0027 — Physics Port exposes a hinge-only constraint contract

Status: Accepted in Foundation Phase 1D.3C.

## Context

`RuntimeAssemblyPlan.constraints[]` existed as a future slot, while production assembly construction only handled bodies and colliders. Designing a universal joint API before testing the real Cannon.js backend would encode assumptions that the solver might not support.

## Decision

The public constraint boundary initially supports only `kind: "hinge"`.

The immutable mechanical plan contains body identities, local pivots, local axes, collision policy, solver force, passive friction and optional soft limits. Mutable runtime commands are separate and use `free`, `motor` or `servo` modes.

`AssemblyBuilder` owns constraint construction and lifecycle. Native solver objects remain inside the backend. A backend must declare `capabilities.constraints.hinge === true`; unsupported backends reject the plan before body allocation.

Constraint removal is backend-first and state-second. Body removal while a live constraint references it is rejected. Full assembly cleanup remains retryable after transient failures.

## Consequences

- The gameplay layer does not receive native Cannon constraints.
- Mechanical graph data does not change when a player/controller changes motor speed or servo target.
- Signal graph work can later address a hinge actuator by stable identity.
- Cannon 0.6.2 limits are documented as soft controller limits, not native hard stops.
- Other joint types require separate capability spikes and ADRs.
