# Mobile Playable MVP Checkpoint — 2026-07-10

Branch: `mobile/playable-mvp`  
Base checkpoint: `a3e1d7b0b49f2dd55598a10ff4a7c0d363422085`  
Draft PR: `#5`

## Product decision

This branch replaces the experimental approach of remapping the complete desktop Workbench into mobile bottom sheets.

The mobile version uses:

- the existing game as the sole gameplay authority;
- one explicit `game.mobile-command-port` registered in `src/game.js`;
- one dedicated minimal mobile shell;
- the previously validated native touch camera state machine;
- small vertical slices that end in a real player action.

The desktop workspace is not reused as the phone interface. When mobile presentation is active, the dedicated shell hides `#ui-layer` and presents only the controls needed for the current mobile slice.

## Implemented mobile build loop

The current mobile shell provides:

- a horizontal part carousel;
- selected-part status;
- explicit PLACE and REMOVE modes;
- rotate left/right;
- undo and redo;
- LAUNCH;
- RETURN TO WORKSHOP;
- SAFE RESET, currently defined honestly as return to the workshop;
- safe-area-aware controls with minimum 48 px primary touch targets;
- optional short haptic feedback after successful place/remove actions.

Canvas taps are not handled by a second event listener. They pass through the existing pointer-ownership state machine and are routed to build commands only after a valid `TAP_CANDIDATE` completes. Orbit and multi-touch gestures permanently suppress the build tap for that gesture.

## Authority boundaries

The command port delegates to existing game boundaries:

- part selection → `setSelectedTool`;
- screen targeting → `rayToNDC`;
- place → `performBuildAction(0)`;
- remove → `performBuildAction(2)`;
- rotation → `applyBuildRotation`;
- orientation → `setOrientationByVector`;
- history → `undoBlueprint` / `redoBlueprint`;
- launch and workshop return → `setMode`;
- flight input → existing named `setControlAction` actions.

The mobile command port and mobile shell do not mutate CraftModel, Blueprint, physics bodies or runtime assembly directly. They do not synthesize mouse or keyboard events.

## Executed browser evidence

Focused GitHub Actions run `29084968397` passed on commit `637f50271ede8ac12e3d25b4d4c476833f084620`.

The run passed:

- command-port unit tests;
- mobile-shell unit tests;
- explicit composition and architecture contracts;
- release source wiring contract;
- retained device-profile, pointer-ownership, adapter, camera bridge, runtime and autobind tests;
- real Chromium mobile browser smoke;
- `git diff --check`.

The mobile browser smoke used a `390 × 844` viewport at device scale factor 2 and reported:

- presentation: `mobile`;
- canvas `touch-action`: `none`;
- selected Wing through the horizontal carousel;
- placed Wing: craft size `0 → 1`;
- explicit REMOVE mode removed Wing: craft size `1 → 0`;
- selected and placed Core: craft size `0 → 1`;
- launched through the mobile LAUNCH control;
- returned to BUILD through RETURN TO WORKSHOP;
- one-finger orbit yaw: `0.7853981633974483 → 0.49739816339744825`;
- two-finger pinch distance: `18 → 17.200000000000003`;
- native touch-derived event count: `1097`;
- browser console/runtime errors: `0`.

## Provenance

After the playable build loop passed focused validation, the repository's official tools regenerated:

- `tailwind.generated.css` with Tailwind CSS `4.1.10`;
- `SOURCE_MANIFEST.json` through `tools/build_release.py`.

The generation workflow enforced a mutation scope of exactly those two generated files and removed itself after the commit.

## Current limitation

This is the first playable vertical slice, not the final phone product.

Flight mode currently exposes only RETURN TO WORKSHOP and SAFE RESET. Touch flight controls are intentionally the next separate slice and must use the existing named control actions through `game.mobile-command-port`.

## Next gate

Add a separate `game.mobile-flight-controls` module with:

- right stick: pitch and yaw;
- left stick: forward/reverse and lateral thrust;
- vertical lift/throttle control;
- roll left/right;
- gyro toggle only if an existing named action or explicit command boundary is available;
- cancellation on pointer loss, blur, hidden document, mode change and destruction.

Do not extend `mobile-playable-shell.js` with joystick state. The shell has reached its intended responsibility boundary.
