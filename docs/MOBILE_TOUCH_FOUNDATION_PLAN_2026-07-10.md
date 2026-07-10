# Mobile / Touch Foundation Plan — 2026-07-10

Branch: `mobile/touch-foundation`  
Base: `VAW_GRoK`  
Status: implementation active — MT0A

## Goal

Prepare Voxel Aeronautics Workshop for practical phone-sized touch play without forking gameplay authority. Mobile remains an alternate presentation and input layer over the same CraftModel, compiler, runtime assembly, physics, save schema and gameplay systems.

## Critical revalidation

The original direction was correct, but its first checkpoint was too broad: it combined device detection, workspace replacement, camera gestures, build mutation and flight controls. That would make regressions difficult to isolate and would encourage unsafe growth of `src/game.js`.

The corrected plan uses strict gates. A gate must be validated before work enters its dependent subsystem.

1. **MT0A — device profile:** pure classification and manual presentation override; no gameplay behavior.
2. **MT0B — lifecycle shell:** bootstrap wiring, safe fallback, viewport/safe-area updates and teardown.
3. **MT1 — workspace:** compact toolbar, one active bottom sheet and horizontal parts tray.
4. **MT2A — camera gestures:** pointer ownership, orbit, pan and pinch; no craft mutation.
5. **MT2B — build actions:** tap placement and explicit remove mode through existing build targeting.
6. **MT3 — flight controls:** virtual controls through named control actions with mandatory cancellation.
7. **MT4 — validation/performance:** mobile browser smoke, desktop regression and viewport matrix.

## Confirmed architectural facts

- `index.html` contains an explicit desktop-only blocker.
- `src/game.js` deliberately rejects `pointerType === "touch"`; mobile support cannot be achieved through CSS alone.
- `performBuildAction(button)` and the existing raycast path are the authoritative build boundary. Mobile code must call that path rather than reproduce placement/removal logic.
- Flight input converges through named control actions and `recomputePilotAxes()`. Mobile controls must feed this boundary rather than mutate pilot or physics state directly.
- Camera state is owned by `game.camera-controller`; touch code may emit deltas but cannot become a second camera authority.
- Mobile presentation state must never enter Blueprint saves.
- Touch capability and mobile presentation are separate decisions. A hybrid touch laptop must remain desktop in automatic mode.

## Module boundaries

- `game.mobile-device-profile`: capability/viewport classification, DOM profile attributes and manual override.
- `game.mobile-touch-controller`: pointer ownership, gesture state, virtual controls and cancellation.
- `game.mobile-workspace-controller`: compact panel policy and mobile mode transitions.
- Existing camera controller: sole camera authority.
- Existing input-profile/control-action boundary: sole flight-input authority.
- Existing build targeting/CraftModel mutation paths: sole build authority.

No mobile module may write directly to physics, Blueprint, CraftModel or runtime assembly internals.

## Device-profile policy

Automatic mobile presentation requires touch/coarse-pointer capability plus a compact viewport or lack of hover. Touch support alone is insufficient.

Presentation override values:

- `auto`
- `mobile`
- `desktop`

The override is UI-local and never serialized into a craft.

## Gesture contract

- Every active pointer has exactly one owner.
- UI-owned pointers never reach canvas gestures.
- One-finger movement becomes orbit only after a deterministic threshold.
- A stationary short tap may become a build action only in BUILD mode.
- Two canvas pointers promote the gesture to pan/pinch and permanently cancel tap eligibility for that gesture.
- Remove is an explicit visible mode; no destructive long press and no hidden right-click emulation.
- `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange`, mode switch and controller destruction clear all transient state and held actions.

## Layout contract

- Use dynamic viewport height and a `visualViewport` fallback.
- Respect all safe-area insets.
- Disable browser gestures only on the game interaction surface, never globally.
- Primary touch targets: minimum 44 CSS px; gameplay controls preferably 48–56 CSS px.
- Phone viewport: one large workspace panel at a time.
- Portrait prioritizes camera visibility and the parts tray.
- Landscape reserves thumb zones and keeps destructive controls away from virtual sticks.

## Validation matrix

Viewport coverage:

- 360×800, 390×844 and 412×915 portrait phones;
- 844×390 and 915×412 landscape phones;
- 768×1024 tablet;
- 1366×768 and 1920×1080 desktop regression.

Input coverage:

- touch-only phone;
- coarse pointer with touch;
- hybrid touch laptop with hover;
- mouse/keyboard desktop;
- forced mobile on desktop;
- forced desktop on phone viewport.

## Gate acceptance

### MT0A — Device profile

- deterministic pure classifier;
- hybrid touch laptop remains desktop in auto mode;
- manual mobile/desktop override;
- DOM dataset/class projection;
- resize/orientation/visualViewport observer;
- unit tests.

### MT0B — Lifecycle shell

- module loaded through bootstrap and release source manifest;
- blocker removed only after successful adapter initialization;
- useful fallback remains on initialization failure;
- safe-area and viewport variables update without reload;
- desktop behavior unchanged.

### MT1 — Workspace

- no page-level horizontal scrolling;
- one large panel at a time;
- horizontal parts tray;
- minimum touch targets;
- portrait/landscape policies;
- advanced features remain reachable.

### MT2A — Camera

- orbit, pan and pinch zoom;
- no placement after camera movement;
- cancellation always clears gesture state.

### MT2B — Build

- visible PLACE/REMOVE mode;
- tap uses existing build action path;
- hinge authoring remains authoritative;
- undo, redo and roll remain accessible;
- no duplicate mutation logic.

### MT3 — Flight

- essential axes available;
- existing named actions are used;
- no latched action after cancellation/backgrounding/mode switch;
- controls do not hide critical telemetry.

### MT4 — Evidence

- pure gesture tests;
- mobile Pointer Event browser smoke;
- desktop browser smoke regression;
- sustained render/physics profile;
- renderer pixel-ratio policy based on measurements, not user-agent guessing.

## Non-goals

- Native Android/iOS packaging.
- Separate mobile physics.
- Mobile-only craft schema.
- Destructive long-press actions.
- Permanent removal of advanced desktop functionality.
- User-agent sniffing as the source of truth.

## Current implementation

MT0A has started with `src/game/mobile-device-profile.js` and `tests/test_mobile_device_profile.js`. Next is source-manifest/test-runner wiring, followed by the MT0B lifecycle shell.
