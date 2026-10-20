# Programmable Machine Model — design intent

Status: **concept/reference, not an implementation claim**.

VAW is intended to let a machine evolve from simple manual control toward programmable behavior without forcing programming on every player.

## Layer separation

The intended model keeps different concerns separate:

- structural graph — rigid support/connectivity;
- mechanical graph — joints and constraints between rigid bodies;
- device endpoints — stable authored endpoints such as `{blockId, portId}`;
- control bindings — player/controller actions mapped to devices or groups;
- signal graph — future deterministic signal/data connections;
- transport — future cable/bus/wireless availability and routing;
- ControlRuntime — future deterministic execution that issues commands through stable neutral IDs.

A hinge is not a signal port. A cable is not the meaning of the signal it carries. Runtime `bodyId` is not a durable device identity.

## Intended complexity ladder

1. useful default behavior;
2. direct action/button binding;
3. device groups plus gain/invert/trim/clamp;
4. visual signal graph;
5. sensors, memory, PID and reusable behavior modules;
6. scripting only after deterministic APIs exist.

Each level should remain useful without requiring the next one.

## Current truth

The recovery source contains structural/mechanical/runtime foundations, but this document does **not** claim that a complete device schema, user-facing ports, direct-binding UX, signal graph or ControlRuntime currently exists.

Their real state must be established by the planned code-reality audit before any roadmap commitment is made.
