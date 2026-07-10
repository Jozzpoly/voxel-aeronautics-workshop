# Mobile Playable MVP Checkpoint — 2026-07-10

Branch: `mobile/playable-mvp`  
Base checkpoint: `a3e1d7b0b49f2dd55598a10ff4a7c0d363422085`  
Draft PR: `#5`

## Product decision

This branch replaces the experimental approach of remapping the complete desktop Workbench into mobile bottom sheets.

The mobile version uses:

- the existing game as the sole gameplay authority;
- one transport-only `game.mobile-command-port`;
- one `game.mobile-game-command-adapter` that delegates to existing game authorities;
- one compact registration in `src/game.js`, the accepted composition root;
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

The game-command adapter delegates to existing game boundaries:

- part selection → `setSelectedTool`;
- screen targeting → `rayToNDC`;
- place → `performBuildAction(0)`;
- remove → `performBuildAction(2)`;
- rotation → `applyBuildRotation`;
- orientation → `setOrientationByVector`;
- history → `undoBlueprint` / `redoBlueprint`;
- launch and workshop return → `setMode`;
- flight input → existing named `setControlAction` actions.

The mobile command port remains transport-only. The adapter and mobile shell do not mutate CraftModel, Blueprint, physics bodies or runtime assembly directly. They do not synthesize mouse or keyboard events.

The first direct implementation made `src/game.js` exceed its architectural budget (`2508 > 2420` lines). That implementation was rejected rather than increasing the limit. Command implementation was extracted into `game.mobile-game-command-adapter`, leaving only dependency injection and registration in the composition root. `tests/test_game_architecture.py` and the product-first architecture guard both pass with the compact composition.

## Executed browser evidence

Focused GitHub Actions run `29084968397` passed on commit `637f50271ede8ac12e3d25b4d4c476833f084620`.

After adapter extraction, focused run `29085879174` also passed the same real browser loop, confirming that the extraction changed structure without changing behavior.

The focused runs passed:

- command-port unit tests;
- game-command-adapter unit tests after extraction;
- mobile-shell unit tests;
- explicit composition and architecture contracts;
- `game.js` architectural budget validation;
- release source wiring contract;
- retained device-profile, pointer-ownership, pointer adapter, camera bridge, camera runtime and autobind tests;
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

After the playable build loop and extracted command adapter passed focused validation, the repository's official tools regenerated:

- `tailwind.generated.css` with Tailwind CSS `4.1.10`;
- `SOURCE_MANIFEST.json` through `tools/build_release.py`.

The generation workflows enforced a mutation scope of exactly those two generated files and removed themselves after their commits. The latest adapter-aware provenance commit is `632a45888c863aeb16ffd02ad85b244ccd38dd45`.

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
