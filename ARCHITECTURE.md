# Voxel Aeronautics Workshop — Architecture

Current phase: **Foundation Phase 1D.4A**.

## Layer boundaries

```text
Blueprint v11 / CraftModel
  blocks[] + mechanicalLinks[] + one revision
        |
CraftCompiler orchestration
  StructuralGraphCompiler
  MechanicalAuthoringResolver
  RigidIslandCompiler
  MechanicalGraphCompiler
        |
CompiledCraft V4
        |
RuntimeAssembly.createPlan(compiled, launchLoadout)
        |
RuntimeAssemblyPlan V2
        |
FlightSession -> AssemblyBuilder -> Physics Port -> backend
        |
RuntimeAssembly indexes / visual roots / game services
```

Pure domain/compiler modules contain no DOM, Three or Cannon. Physics Port is the backend boundary. AssemblyBuilder is the only main-flight allocator. FlightSession owns start/stop/retry and publishes the runtime through the validated `runtime.active-context` kernel module. `game.js` is a composition shell and does not consume a private `window.VAW_RUNTIME` aggregate.

## Document contract

Blueprint v11 persists blocks and typed mechanical links. It never persists body IDs, COM, world poses, native handles or current actuator commands. Parsing is followed by stepwise migration, current-schema validation and canonicalization. Current duplicate IDs fail rather than being repaired.

## Topology

Structural graph contains every face-adjacent edge once. A hinge resolves two opposite faces, a signed in-plane axis and one cut edge. Rigid islands are structural components after cuts. Mechanical graph connects body IDs. Alternate rigid paths produce `mechanical-rigid-bypass`; unconnected combined components produce `assembly-disconnected`; mechanical cycles are allowed.

## Identity

Block and link IDs are persistent authoring identities. Body IDs are anchor-based and deterministic. Constraint IDs are link IDs; native handles remain private. Future assembly-space, device endpoint and signal identities are separate domains.

## Coordinate spaces

`assemblyPosition` is a block center in blueprint/assembly coordinates. Each body origin is its loaded island COM. `bodyLocalPosition = assemblyPosition - bodyCOM`. `assemblyPose` places the body in assembly space. Startup world pose is pure composition of spawn transform and assembly pose. Pivots round-trip from local A/B to one assembly point.

## Runtime ownership

Plan/runtime indexes provide block->body/part/collider, body->parts/constraints and endpoint->constraints. Collision routing preserves body ID. Damage and support use rigid neighbors, not raw grid adjacency. Camera and mission sampling intentionally follow the Core/root body.

Manual pilot intent is expressed in the primary control frame, then `FlightThrusterRouter` converts that intent primary-local -> world -> owning-body-local before the existing mixer evaluates each functional part. Force direction and application point are converted through the owning body's current transform and applied only to that body. Missing ownership is a controlled failure/skip, never an implicit root fallback. Passive vertical thrust remains a base command composed with manual input rather than a cap on the player command.

## Runtime presentation

Workshop mechanical-link authoring remains BUILD state. FLIGHT presentation is owned separately by `FlightMechanicalVisuals`. It creates one visual per live runtime constraint, computes pivot A and pivot B from their respective current body transforms on every synchronization, and registers disposal through `FlightSession.registerTransient`. Constraint removal deactivates its visual; stop, failed start and start-after-stop are idempotent and cannot retain or duplicate link objects.

## Rebase limitation

Unconstrained bodies may recenter while preserving point velocity. A body with active constraints cannot be rebased in Phase 1D.4A. Runtime rejects the operation before mutation, preventing pivot drift. Generalized articulated fracture remains a named future capability.
