# ADR 0019 — Rebindable Input and Flight Focus

- Status: Accepted
- Phase: Foundation 1D.2D
- Supersedes the fixed-key portion of ADR 0018

## Context

`Left Ctrl` matched the desired aircraft controls but collided with browser shortcuts when combined with W/A/S/D. Replacing it with Shift avoided Chrome chords but introduced Windows Sticky Keys when tapped repeatedly. Replacing one hardcoded key with another cannot solve platform and preference differences.

A normal page-level `keydown.preventDefault()` is not a reliable guarantee for all browser-reserved combinations. Chromium exposes Keyboard Lock in JavaScript-initiated fullscreen, but support, permissions and operating-system limits vary.

## Decision

1. Physical keyboard mapping is part of `foundation.input-profile`, not `game.js`.
2. Input profile v2 introduced up to two `KeyboardEvent.code` values per bindable action. Phase 1D.2E/ADR 0020 advances the schema to v3 by adding both vertical-power adjustment pairs; the ownership decision remains unchanged.
3. Older profiles without bindings migrate to current defaults.
4. Assigning an occupied code moves it to the new action.
5. `Left Ctrl` remains the default `lift-` binding requested by the user.
6. Shift is not a default flight binding.
7. The Controls panel exposes rebinding and precise conflict warnings.
8. Flight Focus optionally combines JavaScript fullscreen and Keyboard Lock for the current binding set.
9. Outside Flight Focus, the UI must not claim that Ctrl chords are guaranteed; the supported fallback is rebinding.
10. Bindings remain user preferences and never enter the craft blueprint.

## Consequences

- Key conflicts no longer require source-code hotfixes.
- The preferred Ctrl layout remains available.
- Safe simultaneous Ctrl chords depend on Flight Focus support and permission.
- The project now has a stable path toward gamepad presets and profile import/export.
