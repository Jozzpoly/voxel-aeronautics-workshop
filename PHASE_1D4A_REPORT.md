# Voxel Aeronautics Workshop — Phase 1D.4A Report

## Release identity

- App: `0.7.0-foundation.1d4a`
- Release: `foundation-1d4a-rigid-islands-mechanical-graph`
- Blueprint: v11
- CompiledCraft: `VAW_COMPILED_CRAFT_V4`
- RuntimeAssemblyPlan: `VAW_RUNTIME_ASSEMBLY_PLAN_V2`
- Exact clean 1D.3E working baseline commit: `9cca3be1b39d6276e2db8e99f847a19f10560dab`
- Historical 1D.3D reference carried by the source package: `5cf38926623a17290ff2c6caad24d1c36fe77ad3`
- Uploaded 1D.3E source tree SHA256: `fd2f60125a5db11cd5830f602316e006e2ec37f897c752f65ac5d675ea0d9d4e`

## Result

Gate B — Rigid Islands & Mechanical Graph Compiler is closed. A hinge is now a durable document entity, not a test-only native constraint. The production path is:

```text
BlueprintDocument v11
-> CraftModel blocks + mechanicalLinks
-> StructuralGraphCompiler
-> MechanicalAuthoringResolver
-> RigidIslandCompiler
-> MechanicalGraphCompiler
-> CompiledCraft V4
-> RuntimeAssemblyPlan V2
-> FlightSession / AssemblyBuilder / Physics Port
-> real Cannon hinge
```

The browser startup harness also imports the supplied articulated v11 example through the real file-input path, verifies the workshop link visualization and launches it through the normal Flight button. Gate B is therefore not based on a manually assembled test plan.

## Delivered behavior

- Pure stepwise schema pipeline from legacy v3 through v11; `migrateV10ToV11` adds `mechanicalLinks: []` without changing block IDs.
- Strict current-schema identity validation: explicit duplicate block or mechanical-link IDs are diagnostics/errors, never silently repaired.
- Atomic CraftModel block/link revision model, deletion cleanup, move identity, copy remapping, autosave/import/export parity and undo/redo restoration.
- Stable anchor-based `bodyId` and 1:1 `mechanicalLinkId === constraintId`.
- Structured deterministic diagnostics with concrete block/link entities.
- Structural edge cuts, rigid-bypass detection and combined assembly connectivity.
- Per-island mass, COM, inertia, body-local parts/colliders and explicit assembly poses.
- Body-in-assembly spawning for root and sub-bodies through pure transform composition.
- Payload ownership and loaded mass properties per owner body only, including owner-side constraint-pivot recalculation.
- Exact block/body/part/collider/constraint/endpoint indexes.
- Minimal workshop Hinge Link authoring, axis selection, visualization, deletion and history support.
- Normal Flight path for a two-body blueprint; no game-shell topology assembly.
- Collision/damage filtering by body and propagation only through compiled rigid neighbors.
- Endpoint destruction removes its constraint backend-first.
- Root-only pilot mixer policy with passive per-body aerodynamics; sub-body actuators are not accidentally driven by the root command frame.
- Single-body controls, missions, camera and root-body policy preserved.
- The former private `window.VAW_RUNTIME` dependency shortcut was removed; application composition uses explicit kernel modules and `runtime.active-context`.

## Performance and robustness evidence

On the delivery host (Node `v22.16.0`, Python `3.13.5`):

- full runner: `34.91 s`, maximum RSS `312520 KB`;
- 2500-block structural graph: `77.81 ms`;
- 2500-block / 361-link articulated compile: `185.65 ms`;
- matching RuntimeAssemblyPlan V2 build: `41.72 ms`;
- 300 invalid-link diagnostics: `115.40 ms`;
- deterministic permutations: 100;
- seeded authoring fuzz operations: 200;
- articulated start/stop cycles: 50, orphan bodies: 0, orphan constraints: 0;
- real-Cannon lifecycle cycles: 50, measured heap delta: 424 bytes;
- real-Cannon and joint soaks: 12,000 steps each.

Timings are evidence of architecture and are not raised into host-dependent hard limits.

## Deliberate limitation

Dynamic body-frame rebase while active constraints remain is blocked before mutation. This prevents silent pivot drift in Cannon 0.6.2. General articulated fracture or connected-body payload detach requires an atomic constraint-rebuild/rebase capability with rollback before it is enabled.

## Gate C–E readiness

Gate C receives explicit `assemblyPose`, stable anchor-based body ownership and pure transform helpers without conflating `bodyId` with future `assemblySpaceId`. Gate D can later resolve `{blockId, portId}` through stable maps; no placeholder ports were added. Gate E can command constraints through neutral IDs while immutable graph configuration remains separate from runtime motor/servo state. No empty DeviceCatalog, signal graph or ControlRuntime façade was added.
