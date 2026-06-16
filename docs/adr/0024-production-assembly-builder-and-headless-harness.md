# ADR 0024 — Production Assembly Builder and Deterministic Headless Harness

Status: Accepted in Foundation Phase 1D.3A.

## Context

Phase 1D.2F introduced a neutral `RuntimeAssemblyPlan`, persistent block identities and explicit mass properties. Production flight still rebuilt the craft body and voxel colliders inside `game.js`, so the new boundary was descriptive rather than executable. Physics scenarios also required browser globals, making lifecycle and dynamics regressions expensive to test.

## Decision

1. `runtime.assembly-builder` is the only production layer that turns `RuntimeAssemblyPlan` bodies and colliders into Physics Port objects.
2. The builder supports multiple body plans, stable maps, transactional rollback, collider removal, recentering and idempotent disposal.
3. `game.js` may create visuals and gameplay records but may not rebuild the main craft body or colliders.
4. Point velocity and recenter kinematics cross the Physics Port boundary.
5. A deterministic headless backend implements free-flight dynamics for automated contract tests without DOM or WebGL.
6. The headless backend deliberately omits contacts and constraints and cannot be used to select a production backend or raise flight limits.
7. Constraint creation remains an extension seam until a real-backend joint capability spike defines the necessary neutral contract.

## Consequences

### Positive

- Runtime assembly plans are now executed by one reusable layer.
- Multi-body lifecycle can be tested before user-facing joints exist.
- Partial construction failures do not leak bodies or listeners.
- COM changes can be tested without native Cannon calls in gameplay code.
- Core dynamics tests run quickly in Node.

### Negative

- The production game still has one root craft body.
- Visual and damage state remain in `game.js`.
- The headless backend does not validate collision or joint behavior.
- A separate real-Cannon harness remains required.

## Follow-up

Phase 1D.3B validates parity and performance on real Cannon. Phase 1D.3C creates free and powered hinge spikes. Only then may the Physics Port gain a stable constraints API.
