# M4G Visual Iteration Polish Handoff - 2026-06-29

## Intent

The user confirmed the Studio-to-game workflow now works: imported Thruster visuals appear in game, local working pack iteration is useful, and flame alias scaling can simulate a simple fire animation.

The next polish target is not a new schema authority or gameplay editor. M4G addresses real visual iteration pain:

- hide the faint ghost/proxy cube by default while keeping VAW hit-testing stable;
- reduce manual reload clicks after Studio install;
- prevent global alpha `blend` from making solid parts such as a thruster nozzle render as transparent under camera angles;
- keep all visual asset data renderer-only.

Blueprint, CraftModel, `foundation.catalog`, CraftCompiler, physics, collision, controls, missions and contracts remain authoritative outside Visual Asset Pack V1.

## Implemented In This Turn

- `src/game/visual_asset_loader.js`
  - Added render-invisible hit proxy handling: `vawHitProxy` remains present/raycastable, but imported visuals set proxy material opacity to `0`, `depthWrite=false`, and `colorWrite=false`.
  - Added `setDebugVisualsVisible(enabled)` and `debugVisualsVisible()` so the proxy can be shown only for visual debugging.
  - Added `materialPolicy.alpha: "auto"` handling.
  - Added per-material alpha overrides via `materialPolicy.materialOverrides[]`.
  - Follow-up hardening: material override resolution is precomputed per imported asset and records diagnostics when duplicate material names make an override ambiguous.
  - Added alpha behavior:
    - `opaque`: `transparent=false`, `alphaTest=0`, `opacity=1`, `depthWrite=true`;
    - `mask`: `transparent=false`, `alphaTest` nonzero, `depthWrite=true`;
    - `blend`: `transparent=true`, `alphaTest=0`, `depthWrite=false`, `depthTest=true`;
    - `auto`: keep opaque materials opaque, but use blend/mask for materials with alpha signals.

- `src/game/visual_asset_dev_controls.js`
  - Added `VISUAL DEBUG` toggle support and `Shift+D` hotkey.
  - Added `BroadcastChannel('vaw-visual-assets')` listener to reload visuals when Studio installs a block.
  - Kept manual `RELOAD VISUALS` and `Shift+V`.
  - Follow-up hardening: added `dispose()`, listener cleanup and Node smoke gating so global Node `BroadcastChannel` cannot keep `tests/startup_smoke.js` / `tests/run_all.py` alive after `STARTUP_OK`.

- `index.html`
  - Added `VISUAL DEBUG OFF` button next to `RELOAD VISUALS`.
  - Regenerated `tailwind.generated.css` after HTML change.

- `src/foundation/visual_asset_manifest.js`
  - Added engine-side validator support for `materialPolicy.alpha: "auto"`.
  - Added validation/normalization for `materialPolicy.materialOverrides[]`.

- `tools/blockbench_import_studio/src/visual_asset_pack_v1.js`
  - Added Studio validator support for `auto` and `materialOverrides`.
  - Inferred manifests now default to `materialPolicy.alpha: "auto"`.

- `tools/blockbench_import_studio/schemas/visual_asset_pack_v1.schema.json`
  - Added schema support for `auto` and `materialOverrides`.

- `tools/serve.py`
  - Local install endpoint now preserves normalized `materialOverrides` into `local_working_visuals`.

- `tools/blockbench_import_studio/index.html`
  - Added `auto` alpha policy option.
  - Added material override textarea (`MaterialName=opaque/blend/mask` lines).
  - Added a clickable per-material override list so normal use does not require editing override text lines.
  - Added `Use Material Doctor policy`.
  - Added quick transform buttons: rotate +/-90 on axes, center, fit 1 block, reset transform.

- `tools/blockbench_import_studio/app/main.js`
  - Added parser/formatter for simple material override lines.
  - Added per-material override selectors backed by the same `materialPolicy.materialOverrides` manifest field.
  - Added localStorage-backed Studio authoring preferences for last block type, transform and material policy. This is Studio UI state only, not gameplay/save data.
  - Added quick transform button behavior.
  - Added Material Doctor suggestion flow for mixed opaque/alpha models.
  - Added same-origin reload request after install via `BroadcastChannel`.

- Tests updated:
  - `tests/test_visual_asset_manifest.js` covers `auto` and per-material overrides.
  - `tests/test_visual_asset_loader.js` covers invisible-by-default proxy, debug toggle, auto/override material policy and opaque nozzle regression.
  - `tests/test_visual_asset_dev_controls.js` covers BroadcastChannel gating, reload events and cleanup.
  - `tests/test_blockbench_import_studio_integration.js` checks Studio UI/static presence for new controls and BroadcastChannel.
  - `tests/test_local_visual_pack_install.py` checks endpoint preservation of material overrides.

- Docs updated:
  - `README.md`
  - `ARCHITECTURE.md`
  - `ROADMAP_NEXT.md`
  - `AI_PROJECT_MEMORY.md`
  - `docs/README.md`
  - `docs/blockbench_import_studio.md`
  - `docs/visual_asset_pack_v1.md`
  - `docs/adr/0043-visual-asset-boundary.md`

## Validation Done

Passed in this handoff pass:

- `node tests/test_visual_asset_manifest.js`
- `node tests/test_visual_asset_loader.js`
- `node tests/test_visual_asset_dev_controls.js`
- `node tests/test_blockbench_import_studio_integration.js`
- bundled Python `tests/test_local_visual_pack_install.py`
- `npm.cmd run studio:test` with bundled Python prepended to `PATH`
- bundled Python `tests/test_game_architecture.py`
- `node tools/generate_tailwind_css.js --check`

Important notes:

- `npm.cmd run studio:test` fails if run with the default shell PATH because global `python` is not installed. It passes when launched with:
  `PATH=C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python;%PATH%`
- `tests/test_game_architecture.py` currently reports `game_js_bytes: 119996`. The limit is effectively exhausted. Do not add bytes to `src/game.js`; keep future work in extracted modules.
- A targeted `startup_smoke.js` run with `APP_SOURCES` exits cleanly after `STARTUP_OK`; this confirms the previous hanging-process symptom was addressed.
- No Browser/WebGL smoke was completed in this handoff pass.
- No release build/verify was run after the latest M4G patches.
- `SOURCE_MANIFEST.json` is dirty from prior build/provenance work. Regenerate only through `tools/build_release.py`, never by hand.

## Critical Recheck For Next Agent

1. Re-run the targeted M4G tests:
   - `node tests/test_visual_asset_manifest.js`
   - `node tests/test_visual_asset_loader.js`
   - `node tests/test_visual_asset_dev_controls.js`
   - `node tests/test_blockbench_import_studio_integration.js`
   - `C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tests/test_local_visual_pack_install.py`

2. Re-run Studio test with Python in PATH:
   - PowerShell:
     `$env:PATH = 'C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python;' + $env:PATH; npm.cmd run studio:test`

3. Run broader baseline before claiming done:
   - `node tests/test_visual_asset_registry.js`
   - `node tests/test_build_targeting.js`
   - `node tests/test_flight_integrity.js`
   - bundled Python `tests/test_game_architecture.py`
   - bundled Python `tests/test_audit_regressions.py`
   - bundled Python `tests/run_all.py`
   - `node tools/generate_tailwind_css.js --check`

4. Build/release only after tests pass:
   - bundled Python `tools/build_release.py`
   - bundled Python `tools/verify_release.py --zip dist/Voxel_Aeronautics_Workshop_Workbench_Foundation.zip --hashes dist/SHA256.txt`

5. Manual smoke needed:
   - Start `tools/serve.py`.
   - Open game and Studio from the same local origin.
   - Import the user's VIP Thruster model.
   - Use Material Doctor policy or set overrides manually:
     - body/nozzle material names -> `opaque`;
     - flame/glass/glow material names -> `blend`.
   - Click `Install / Update Block Visual`.
   - Confirm the game reloads automatically, or use `RELOAD VISUALS` / `Shift+V`.
   - Confirm the ghost/proxy cube is not visible with `VISUAL DEBUG OFF`.
   - Toggle `VISUAL DEBUG ON` and confirm proxy appears for diagnostics.
   - Confirm nozzle is not camera-angle transparent and flame still blends/scales.
   - Launch flight and confirm detach/dispose lifecycle does not crash.

## Known Risks

- Material override matching is by exact glTF material name, case-insensitive. If Blockbench exports generic or duplicate material names, the UI needs clearer material picker support later.
- `auto` currently detects alpha from runtime material properties (`transparent`, `alphaMap`, `alphaTest`, `opacity < 1`). This is pragmatic, not a full glTF alpha authoring system.
- `BroadcastChannel` only helps when Studio and game share the same origin. Manual reload remains required otherwise.
- The debug proxy button is in the game toolbar and could crowd the UI; acceptable for dev milestone, not final UX.
- Browser plugin previously had incomplete WebGL/global verification. Do not claim full WebGL smoke until actually verified.

## Non-Goals

- No Gate D.
- No Blueprint/save schema changes.
- No gameplay data in Visual Asset Pack V1.
- No physics/collider/control semantics in imported assets.
- No full AnimationMixer runtime yet.
- No map/contract/mission editor yet.
- No user-facing visual pack manager yet.
