# ADR 0012 — Input profiles and UI workspace are user preferences

## Status

Accepted for preferences; mobile projection clause superseded by ADR 0018 in Foundation Phase 1D.2C.

## Decision

Axis inversion and sensitivity belong to `foundation.input-profile`. Window visibility, position, size and minimized state belong to `foundation.ui-workspace`.

Both are stored under the versioned UI preference key. Neither is serialized inside the craft blueprint.

## Consequences

- Sharing a blueprint does not overwrite another player's controls or screen layout.
- All major panels use one registry and one persistence path instead of panel-specific booleans.
- Desktop panels may float and resize. The former mobile-projection option was retired by ADR 0018 when the runtime became desktop-only.
- Future gamepad curves, deadzones, docking and workspace presets can evolve without changing the craft save schema.
