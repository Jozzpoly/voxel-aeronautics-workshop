# ADR 0028 — Programmable machines require separate identity, graph, transport and execution layers

Status: Proposed after the Foundation 1D.3C whole-project review.

## Context

The long-term product fantasy is to build a machine block by block, program every functional block, bind controls, observe real physics and rebuild. A single generic "wire graph" would conflate persistence, player input, device capabilities, visual cables, wireless range and runtime scheduling.

## Proposed decision

Before Phase 1E, preserve four distinct layers:

1. **Device identity and ports** — stable endpoint `{ blockId, portId }` with declared direction and type.
2. **Signal graph** — immutable saved links and logic nodes.
3. **Transport/presentation** — direct link, cable, bus, wireless channel or joint pass-through; transport may add cost, range, latency or availability but does not redefine signal semantics.
4. **Control runtime** — deterministic fixed-tick evaluation producing actuator commands through public runtime APIs.

User input profile remains a user preference. Craft control bindings remain part of the craft document. The default mixer becomes an ordinary source/controller, not a special physics exception.

Initial public signal types should remain intentionally small: boolean/event and scalar. Cycles require explicit stateful/delay nodes; arbitrary JavaScript in blueprint saves is forbidden.

## Consequences

- Moving a block preserves its endpoint identity because `blockId` survives movement.
- Removing a block produces a diagnostic dangling endpoint instead of silently rebinding by coordinates.
- Cables and wireless links can be added later without replacing the control evaluator.
- Sensor, logic and actuator tests can run headlessly and deterministically.
- A full API is not accepted by this ADR; it defines gates for the next design phase.
