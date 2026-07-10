# Mobile / Touch Foundation Plan — 2026-07-10

Branch: `mobile/touch-foundation`
Base: `VAW_GRoK`
Status: planning and architecture checkpoint

## Goal

Prepare Voxel Aeronautics Workshop for practical play on a phone-sized screen using touch input, without forking gameplay authority or weakening the desktop build.

The mobile implementation must remain an alternate presentation and input layer over the same CraftModel, compiler, runtime assembly, physics, save schema and gameplay systems.

## Critical findings

1. `index.html` currently displays an explicit `desktop-required` blocker and states that touch-only play is outside project scope.
2. The current build workspace is dense and optimized for floating/docked desktop panels.
3. Build interaction documentation and runtime assumptions are mouse/keyboard-centric: left click place, right click remove, middle/Alt orbit and keyboard shortcuts.
4. Flight input already converges through named control actions and `recomputePilotAxes()`. Mobile controls should feed that existing action/profile boundary rather than mutate physics or flight systems directly.
5. Camera behavior is already isolated behind `game.camera-controller`; touch orbit, pan and pinch zoom should adapt to this controller rather than create a second camera implementation.
6. Mobile work must not enter Blueprint saves. Layout and touch preferences belong to UI preference state only.

## Architecture decision

Create a mobile presentation/input adapter rather than a separate mobile game:

- `game.mobile-device-profile`: capability and viewport classification.
- `game.mobile-touch-controller`: pointer ownership, virtual sticks, hold buttons and gesture state.
- `game.mobile-workspace-controller`: compact panel policy, bottom sheet behavior and mobile mode transitions.
- Existing `game.camera-controller`: remains the sole camera authority.
- Existing control-action / input-profile boundary: remains the sole flight input authority.
- Existing build targeting and craft mutation paths: remain the sole build authority.

No mobile module may write gameplay data directly to physics, Blueprint, CraftModel or runtime assembly internals.

## Delivery stages

### MT0 — Safe foundation

- Remove the hard phone blocker only when the mobile adapter initializes successfully.
- Add touch capability detection and a manual desktop/mobile override.
- Add safe-area and dynamic viewport-height CSS.
- Prevent browser scrolling, text selection and accidental zoom only inside the game interaction surface.
- Preserve keyboard/mouse behavior unchanged.

### MT1 — Small-screen workspace

- Introduce a compact mobile toolbar.
- Convert large workspace panels to one-at-a-time bottom sheets.
- Keep parts as a horizontal thumb-accessible tray.
- Ensure all interactive targets meet a practical touch size.
- Keep critical canvas area visible in portrait and landscape.

### MT2 — Build touch controls

- One-finger canvas drag: orbit camera.
- Two-finger drag: pan camera target.
- Pinch: zoom.
- Tap: select/place through the existing target and mutation path.
- Explicit remove-mode button instead of emulating right click ambiguously.
- Long press is reserved until tested; it must not become a hidden destructive gesture.
- Add visible buttons for roll, undo, redo, launch/build mode and panel access.

### MT3 — Flight controls

- Left virtual stick: configurable primary translation/attitude pair.
- Right virtual stick or touchpad: configurable attitude/camera mode.
- Hold buttons for lift up/down and other binary actions.
- Feed existing named control actions and input profile semantics.
- Release all active actions on pointer cancellation, visibility loss, mode switch and focus loss.

### MT4 — Validation and performance

- Add pure tests for gesture interpretation and pointer ownership.
- Extend browser smoke coverage with a mobile viewport and synthetic pointer events.
- Validate portrait, landscape, narrow tablet and desktop regression.
- Cap renderer pixel ratio on constrained devices through a documented renderer policy.
- Profile UI layout, draw calls, memory pressure and sustained physics performance.

## First implementation checkpoint acceptance criteria

- The game opens on a touch-capable phone viewport without the desktop-required blocker.
- Desktop keyboard and mouse controls remain operational.
- Mobile UI does not require horizontal page scrolling.
- A player can orbit, pan and zoom the workshop camera using touch.
- A player can open the parts tray, choose a part, place it, switch to remove mode and remove it.
- A player can launch and use at least the essential flight axes through visible touch controls.
- Pointer cancellation cannot leave a flight command latched.
- Blueprint and runtime schemas remain unchanged.

## Non-goals for the foundation checkpoint

- Native Android/iOS packaging.
- Separate mobile physics tuning.
- Simplified mobile-only craft schema.
- Automatic destructive long-press actions.
- Full parity for every advanced desktop authoring panel in the first checkpoint.

## Risk controls

- Prefer Pointer Events over parallel touch/mouse implementations.
- Assign each pointer to exactly one owner: UI, camera gesture, build gesture or flight control.
- Never synthesize right-click as the primary remove interaction.
- Keep gesture thresholds deterministic and testable.
- Use feature modules and tests; do not expand `src/game.js` into another monolith.
- Treat browser UI occlusion and safe-area insets as runtime layout inputs.

## Immediate implementation order

1. Add device profile and touch-controller modules with tests.
2. Wire modules through the existing bootstrap source list.
3. Replace the hard blocker with adapter-init fallback behavior.
4. Add mobile layout CSS and compact workspace policy.
5. Implement camera gestures through `game.camera-controller`.
6. Implement explicit build/place/remove touch interaction.
7. Implement flight virtual controls through existing control actions.
8. Run fast, full and browser mobile smoke validation before opening a PR.
