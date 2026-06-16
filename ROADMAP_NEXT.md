# Roadmap after Foundation Phase 1D.4A

## Closed: Gate B — Rigid Islands & Mechanical Graph Compiler

Blueprint v11, stable link/body identity, pure topology compilers, per-island mass frames, Plan V2, real-Cannon vertical slice, body-correct collision/damage and minimal workshop hinge authoring are complete.

## Next: Gate C — Assembly Spaces / Sublevels

Gate C must introduce durable assembly-space ownership and transforms for interior/local simulation without changing block, link or body identity. Required outcomes:

1. define `assemblySpaceId` separately from `bodyId`;
2. make space transforms pure and serializable;
3. support root-space plus attached/local spaces without storing world pose in blueprint;
4. establish anchor/split ownership rules;
5. prove rendering, camera and runtime lookup through space changes;
6. preserve the Gate B compiler and normal flight path.

Do not implement walking, docking or broad interior gameplay until the space contract and tests are complete.

## Later gates

- Gate D — Device & Port Schema using stable `{blockId, portId}` endpoints.
- Gate E — Deterministic Control Kernel / `ControlRuntime`, fixed tick and runtime commands by neutral IDs.
- Phase 1E — broader gameplay/content only after foundation gates.

## Blockers carried deliberately

Atomic body-frame rebase with active constraints and dynamic rigid-body split remain required before generalized articulated damage. No placeholder signal links, ports, logic nodes or empty runtime classes should be added early.
