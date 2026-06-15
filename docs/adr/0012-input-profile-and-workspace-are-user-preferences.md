# ADR 0012 — Input profiles and UI workspace are user preferences

## Status

Accepted in Foundation Phase 1C.2.

## Decision

Axis inversion and sensitivity belong to `foundation.input-profile`. Window visibility, position, size and minimized state belong to `foundation.ui-workspace`.

Both are stored under the versioned UI preference key. Neither is serialized inside the craft blueprint.

## Consequences

- Sharing a blueprint does not overwrite another player's controls or screen layout.
- All major panels use one registry and one persistence path instead of panel-specific booleans.
- Desktop panels may float and resize; mobile presentation may use a different projection of the same state.
- Future gamepad curves, deadzones, docking and workspace presets can evolve without changing the craft save schema.
