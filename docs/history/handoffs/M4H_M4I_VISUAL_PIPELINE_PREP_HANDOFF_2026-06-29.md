# M4H/M4I Visual Pipeline Prep Handoff - 2026-06-29

## Purpose

This handoff prepares the repository for the next long Visual Asset / Studio work pass and records the M4J VectorThruster renderer-rig checkpoint.

The goal is to make the current state easier to resume, validate and extend without rediscovering the whole pipeline.

## Non-Negotiable Boundary

The engine is not the source of truth.

Blueprint, CraftModel, `foundation.catalog`, CraftCompiler, RuntimeAssemblyPlan, physics, collider generation, control semantics, mission data and save schema remain authoritative outside Visual Asset Pack V1.

Studio and Visual Asset Packs are renderer-facing only. They may provide:

- glTF model paths;
- renderer-only transforms;
- node aliases;
- material policy;
- future renderer-only rig hints for visual motion.
- optional VectorThruster renderer rig profiles for imported visual pivots.

They must not provide:

- mass;
- force;
- fuel rate;
- durability;
- colliders or collision;
- control axis semantics;
- Blueprint or CraftModel data;
- mission, map or contract data.

## Current Working State

- Studio is integrated under `tools/blockbench_import_studio/`.
- Fast iteration uses one working pack:
  `assets/visual_packs/local_working_visuals/`.
- `Install / Update Block Visual` updates only the selected block folder in that working pack.
- The game can reload renderer-only visual assets without restart.
- Imported visuals are mounted under the stable VAW root/proxy.
- `vawHitProxy` stays present and raycastable; it is render-invisible by default and visible only through visual debug.
- Material policy supports `auto`, `opaque`, `mask`, `blend`, `from-gltf` and per-material overrides.
- Studio can split fire/glow primitives to a separate blend material when a Blockbench model shares one material across body/nozzle/fire.
- Studio now stores last authoring settings per VAW block type in browser `localStorage`:
  - block type;
  - `visualRoot`;
  - `flame`;
  - `flameGlow`;
  - `gimbalAssembly`;
  - `controlFlapPivot`;
  - transform;
  - material policy;
  - fire/glow material split settings.

The per-block Studio preferences are authoring state only. They do not belong in Blueprint, saves or gameplay data.

## Latest User-Confirmed Findings

- User confirmed Thruster import works in game.
- User confirmed VectorThruster can be imported and partially rigged, but visual nozzle motion is not logically correct for every input:
  - forward/back can look right;
  - left/right can rotate around the wrong imported model axis;
  - Q/E roll is also visually wrong.
- This is likely visual rig mapping, not necessarily force/physics failure.
- Current adapter hardcodes gimbal visual motion:
  - `gimbalB -> rotation.y`;
  - `gimbalA -> rotation.z`.
- That is only safe for the procedural model's axis layout. It is not safe for arbitrary Blockbench pivot axes.

## M4I-A Critical Audit Update

Audit baseline before this polish checkpoint:

- `HEAD == origin/current_work == 943bfde44c5e682f0095f674ff4454daa244613b`.
- `origin/main == 873933f1ebd8e98d05ad644a9dda2de47d467b1f`.
- The only dirty worktree state at audit start was protected user art:
  - `assets/visual_packs/installed_visual_packs.json`;
  - `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`;
  - `assets/visual_packs/local_working_visuals/models/blocks/balloon/`.

M4I-A closes the remaining M4H workflow gap: global/default Studio authoring prefs are now sanitized at write time as well as read time. Defaults may preserve transform and material policy, but they must not store `visualRoot`, optional rig aliases or fire/glow split rig state. Exact per-block profiles remain restorable for the same block type.

Current read-only local pack audit evidence:

- all current local visual models exist;
- Thruster and VectorThruster still contain `thuster` spelling diagnostics;
- Balloon has unresolved inherited `thuster_fire` and `thuster_nozzle` bindings;
- Balloon has warning diagnostics for `flame` and `gimbalAssembly`, which are unusual for `Balloon`;
- these are protected art/workflow diagnostics, not permission to edit `local_working_visuals`.

Targeted M4I-A validation evidence:

- `node tools/blockbench_import_studio/tests/test_authoring_state.js` PASS;
- `node tools/blockbench_import_studio/tests/test_authoring_state_flow.js` PASS;
- `npm.cmd run studio:test` PASS, including recovery package guard;
- `node tools/run_with_python_env.js python tests/test_visual_asset_pack_audit.py` PASS;
- `npm.cmd run visual:test` PASS;
- `node tools/run_with_python_env.js python tests/test_documentation_contract.py` PASS;
- `node tools/run_with_python_env.js python tests/test_game_architecture.py` PASS;
- `npm.cmd run browser:smoke` PASS in this checkout;
- `npm.cmd run test` PASS;
- `node tools/run_with_python_env.js python tools/validate_fast.py` PASS;
- `node tools/run_with_python_env.js python tools/validate_full.py` PASS;
- `git diff --check` PASS.

## M4I-B Dry-Run Repair Prep Update

M4I-B adds read-only repair preparation without editing protected art.

Use:

```powershell
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
```

The audit report now includes:

- top-level `diagnostics` for compatibility with earlier checks;
- `assetReports[]` entries with `assetId`, `blockTypes`, model status, per-asset diagnostics and dry-run cleanup suggestions;
- `suggestedManifestCleanup.mode == "dry-run"`;
- `suggestedManifestCleanup.actions[]` with manifest paths, current values, suggested values and reasons.

For Balloon-style inherited rig aliases, the dry-run report can suggest setting optional aliases such as `flame` or `gimbalAssembly` to `null`. It does not modify `local_working_visuals`, does not regenerate art, does not touch `visualRoot` and does not update `installed_visual_packs.json`.

Next ordering:

1. Owner-approved Balloon cleanup may apply the dry-run suggestions to protected local art.
2. M4J can proceed independently because it does not edit protected Balloon art.
3. Do not fix VectorThruster by swapping hardcoded Euler axes in runtime code.

## M4J Renderer-Only VectorThruster Rig Profile Update

M4J adds an optional `bindings.rig.vectorThruster` profile to Visual Asset Pack V1.

The profile maps renderer inputs to imported node rotations:

- `input`: `gimbalA`, `gimbalB` or `roll`;
- `node`: a `bindings.nodes` alias, normally `gimbalAssembly`;
- `axis`: `x`, `y` or `z`;
- `direction`: `1` or `-1`.

Runtime uses the profile only to rotate imported renderer nodes from a cached base pose. Missing metadata falls back to the legacy gimbal mapping. Invalid metadata is caught by manifest validation, Studio validation and read-only pack audit diagnostics.

Studio now exposes explicit VectorThruster profile controls and keeps that profile in exact per-block authoring prefs only. Global/default prefs still strip rig state so it cannot leak into Balloon or other block types.

This is infrastructure support, not an owner-art edit. The current protected `local_working_visuals` VectorThruster remains unmodified until the owner chooses to author/install a profile for that asset.

This checkpoint does not edit:

- `assets/visual_packs/local_working_visuals/**`;
- `assets/visual_packs/installed_visual_packs.json`;
- Blueprint/CraftModel/compiler output;
- physics, force/control semantics, save schema or Gate D.

## Current Prep Artifacts

Added for long-change workflow:

- `tools/run_visual_asset_checks.py`
  - focused visual pipeline test runner;
  - uses bundled Python automatically when available;
  - can optionally include broader release gates.
- `tools/run_visual_asset_checks.js`
  - Node wrapper for `npm run visual:test`;
  - avoids requiring global `python` on Windows by selecting the bundled runtime.
- `run_visual_checks.bat`
  - Windows shortcut for the focused runner.
- `package.json`
  - `visual:test` script now runs `tools/run_visual_asset_checks.py`.

Use these before and after substantial Studio/visual changes.

## Recommended Read Order For Next Agent

1. `README.md`
2. `PROJECT_VISION.md`
3. `AI_PROJECT_MEMORY.md`
4. `ARCHITECTURE.md`
5. `ROADMAP_NEXT.md`
6. `docs/blockbench_import_studio.md`
7. `docs/visual_asset_pack_v1.md`
8. `docs/adr/0043-visual-asset-boundary.md`
9. `.codex/handoff/M4G_VISUAL_ITERATION_POLISH_HANDOFF_2026-06-29.md`
10. this file

Then inspect code:

1. `src/foundation/visual_asset_manifest.js`
2. `src/game/visual_asset_registry.js`
3. `src/game/visual_asset_loader.js`
4. `src/game/visual_runtime_adapter.js`
5. `src/game/module_visual_factory.js`
6. `tools/blockbench_import_studio/app/main.js`
7. `tools/blockbench_import_studio/src/visual_asset_pack_v1.js`
8. `tools/blockbench_import_studio/src/gltf_material_tools.js`

## Validation Commands

Focused visual pipeline:

```powershell
npm run visual:test
```

M4J targeted checks:

```powershell
node tests/test_visual_runtime_adapter.js
node tests/test_visual_asset_manifest.js
node tools/blockbench_import_studio/tests/test_authoring_state_flow.js
node tools/run_with_python_env.js python tests/test_visual_asset_pack_audit.py
```

Windows shortcut:

```powershell
.\run_visual_checks.bat
```

Focused visual pipeline plus broader gates:

```powershell
.\run_visual_checks.bat --include-release-gates
```

Full suite only after the focused runner is green:

```powershell
.\run_visual_checks.bat --include-release-gates --include-run-all
```

If global Python is missing, use the bundled Python directly:

```powershell
C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\run_visual_asset_checks.py --include-release-gates
```

## Long-Change Protocol

Before a large change:

1. Run `git status --short`.
2. Read the latest handoff and current relevant source files.
3. Run `npm run visual:test`.
4. Write down the exact failure or baseline if it is not green.
5. Do not add feature logic directly to `src/game.js`; it is effectively at its architecture size limit.

During the change:

1. Keep implementation in small modules.
2. Preserve procedural fallback on every failure path.
3. Do not make visual assets authoritative.
4. Add relational tests, not only static string checks, when behavior changes.
5. Prefer Studio UI state and manifest renderer metadata over hidden magic.

After the change:

1. Run `npm run visual:test`.
2. Run `.\run_visual_checks.bat --include-release-gates`.
3. If `index.html`, loader inventory, release inventory or `APP_SOURCES` changed, run the required release/build checks before claiming done.
4. Regenerate `SOURCE_MANIFEST.json` only through `tools/build_release.py`.
5. Do not claim full WebGL smoke unless Browser/manual game flow was actually verified.

## Current M4J Validation Targets

- existing Thruster workflow still works;
- VectorThruster forward/back, left/right and Q/E visual motion can be made understandable by authoring a renderer-only profile for the specific imported rig;
- no Blueprint/save schema changes;
- no gameplay-force/control-axis data in Visual Asset Pack;
- procedural fallback remains intact;
- missing or invalid rig metadata does not crash startup or flight.

## Known Risks

- `src/game.js` is near the architecture size limit. Future work must go through modules.
- The worktree is intentionally dirty from M4F/M4G work. Do not revert unrelated changes.
- `SOURCE_MANIFEST.json` may be stale until rebuilt by `tools/build_release.py`.
- Browser/WebGL smoke has not been consistently available in every session. Be explicit about what was and was not manually verified.
- Studio preferences are stored in browser `localStorage`; they are convenient but can be stale when a new model has different node names.
- Per-material override matching by glTF material name is still fragile with duplicate/generic Blockbench material names.

## Non-Goals For The Next Preparation Pass

- Gate D Device/Port Schema.
- map editor.
- contract editor.
- mission editor.
- Blueprint/save schema changes.
- making Studio a runtime dependency.
- making Visual Asset Pack a gameplay authority.
- full AnimationMixer playback.
- user-facing mod manager.
