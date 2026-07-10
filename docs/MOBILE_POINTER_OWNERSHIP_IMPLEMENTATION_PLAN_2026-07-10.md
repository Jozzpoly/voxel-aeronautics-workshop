# Mobile Pointer Ownership — Test-First Implementation Plan

Branch: `mobile/touch-foundation`  
Gate: MT2A preparation  
Status: contract design before integration

## Objective

Introduce a deterministic pointer-ownership state machine before any touch event is allowed to reach camera movement or craft mutation.

The controller must not know about Three.js, DOM layout, CraftModel, physics, Blueprint, flight state or concrete UI elements. It receives normalized pointer samples and emits semantic intents through callbacks.

## Existing boundaries confirmed

- Desktop mouse state currently lives in `STATE.input` as `orbitDrag`, `panDrag`, `downMoved`, `dragStartX` and `dragStartY`.
- The camera authority exposes `panCameraTargetByPixels(dx, dy)` and camera state normalization/clamping.
- Build mutation is already centralized in `performBuildAction(button)`.
- Existing touch events are rejected in `game.js`; these guards must remain until the controller is integrated and browser-tested.

## Rejected approaches

1. Reusing desktop `STATE.input.orbitDrag/panDrag` for touch. This would couple two input lifecycles and make cancellation ambiguous.
2. Using touch count alone inside `game.js`. That would spread gesture state through the monolith and make testing difficult.
3. Treating pointer-up after any drag as a build tap. Camera motion must permanently invalidate tap eligibility for the gesture.
4. Demoting two-finger gestures back to a tap or orbit when one finger lifts. Gesture promotion is one-way until every participating pointer ends.
5. Long press removal or synthetic right-click. Destructive behavior requires an explicit later UX mode.

## Normalized input contract

Each pointer sample contains:

- `pointerId`: stable finite identifier;
- `x`, `y`: CSS-pixel coordinates;
- `owner`: `canvas` or `ui` on pointer-down;
- optional timestamp for future timing policy, not needed for the first state machine.

UI-owned pointers are tracked only to guarantee they never become canvas gestures.

## Semantic output contract

The controller emits callbacks only:

- `onOrbit({ dx, dy, pointerIds })`
- `onPan({ dx, dy, pointerIds })`
- `onZoom({ delta, scale, pointerIds })`
- `onTap({ x, y, pointerId })`
- `onCancel({ reason, pointerIds })`
- `onStateChanged(snapshot)` for diagnostics/tests

No callback is required. Missing callbacks are no-ops.

## State model

### IDLE

No active canvas pointers.

### TAP_CANDIDATE

Exactly one active canvas pointer. Movement is below threshold and a tap remains possible.

### ORBIT

One canvas pointer exceeded the movement threshold. Orbit deltas are emitted. Tap eligibility is permanently lost.

### MULTI

At least two canvas pointers participated. The gesture emits centroid pan and distance-based zoom. Tap eligibility is permanently lost. MULTI remains the gesture mode until all participating canvas pointers are released or cancelled, even if only one remains.

UI pointers never change these canvas modes.

## Deterministic thresholds

- Default movement threshold: 8 CSS px radial distance from pointer-down.
- Threshold comparison uses squared Euclidean distance.
- The first movement crossing the threshold emits only the delta from the immediately previous sample, not the full down-to-current distance, preventing a camera jump.
- Zoom delta is the change in two-pointer distance; scale is current distance divided by previous distance.

Thresholds are constructor options and validated as finite non-negative values.

## Cancellation requirements

The integration layer must call `cancelAll(reason)` for:

- `pointercancel`;
- `lostpointercapture`;
- window `blur`;
- document becoming hidden;
- BUILD/FLIGHT mode switch;
- adapter destruction;
- presentation changing away from mobile.

Cancellation emits at most one cancel callback per non-idle gesture and clears every pointer and ownership record.

## Test matrix before integration

1. Stationary canvas pointer down/up emits one tap.
2. Movement below threshold still emits tap.
3. Threshold crossing promotes to ORBIT and suppresses tap.
4. Orbit emits incremental deltas.
5. Second canvas pointer promotes to MULTI and permanently suppresses tap.
6. MULTI emits centroid pan.
7. MULTI emits zoom delta and scale.
8. Releasing one pointer from MULTI does not demote to TAP_CANDIDATE or ORBIT.
9. UI pointer never emits camera or tap intents.
10. UI pointer added during a canvas gesture does not promote the canvas gesture.
11. Duplicate pointer-down is rejected without corrupting state.
12. Unknown pointer move/up is ignored.
13. `cancelAll` clears all pointers and emits one cancellation.
14. Repeated cancellation while idle emits nothing.
15. Snapshot data is immutable from the caller's perspective.

## Step-by-step implementation

1. Add tests describing the complete state contract.
2. Implement `game.mobile-touch-controller` as a pure CommonJS/browser module.
3. Run syntax and unit tests.
4. Add the test to `tests/run_all.py`.
5. Do not add the module to release/bootstrap sources yet.
6. Audit emitted deltas against `camera-controller` semantics.
7. Add an integration adapter in a separate commit.
8. Add browser Pointer Event smoke tests before removing any existing touch guard.
9. Only after browser evidence, route `tap` into the existing raycast/build action boundary.

## Gate to integration

Integration is forbidden until the pure controller passes all contract tests and code review confirms:

- no DOM access;
- no Three.js access;
- no gameplay mutation;
- no dependency on desktop mouse flags;
- complete cancellation behavior;
- one-way gesture promotion.
