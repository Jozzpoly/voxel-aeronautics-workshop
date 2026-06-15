# ADR 0011 — Oriented Command Core defines the craft control frame

## Status

Accepted in Foundation Phase 1C.2.

## Decision

The single Command Core stores a normal 24-way basis orientation. During compilation it produces an immutable `CompiledCraft.controlFrame` containing `forward`, `up`, `right`, origin and source part key.

Pilot commands are expressed as semantic intent in the Core frame and transformed into body-local translation and rotation axes before actuator mixing.

## Consequences

- A craft may be built in any grid orientation without rewriting its controls.
- Vertical rockets, side-facing cockpits and future control seats use the same foundation.
- Core position remains unrestricted and is separate from its orientation.
- Blueprint v9 preserves Core orientation. Versions v3–v8 migrate to the historical +X forward / +Y up frame.
- Vehicle categories are not hard-coded into the solver.
