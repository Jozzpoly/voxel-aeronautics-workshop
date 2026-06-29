# M4F Fast Visual Iteration Handoff - 2026-06-28

## Intent
User corrected the previous pack-per-edit direction. The daily workflow must use one editable working pack:
`assets/visual_packs/local_working_visuals/`.

Each Studio iteration should update one block visual in place, with no automatic backups:
Studio import -> choose block type -> choose visualRoot -> transform/material controls -> `Install / Update Block Visual` -> game `Reload Visuals` / `Shift+V`.

Visual assets remain renderer-only. Do not move mass, force, fuel, durability, collider/collision, controls, Blueprint, CraftModel, compiler, physics, mission, map, or contract authority into visual packs.

## Implemented In This Turn
- `src/foundation/visual_asset_manifest.js`
  - Added optional renderer-only `model.transform.position`, `rotationDegrees`, `scale` validation and normalization.
- `tools/blockbench_import_studio/src/visual_asset_pack_v1.js`
  - Added transform validation.
  - Draft manifests now include transform defaults.
  - Default `materialPolicy.alpha` changed to `from-gltf`.
- `src/game/visual_asset_registry.js`
  - Added optional source `revision` metadata and richer coverage fields.
- `src/game/visual_asset_loader.js`
  - Added revision cache-bust for glTF URL loads.
  - Added `clearModelCache`, `detachImportedVisual`, `reloadInstalledPacks`.
  - Reload removes old imported children, disposes renderer resources, restores procedural fallback/proxy, clears registry/cache, reloads installed packs, and reattaches.
  - Added material policy handling for `blend`, `mask`, `opaque`, `from-gltf`, `pixelated`, `doubleSided`.
  - Added renderer-only transform application on imported child.
  - Added visualRoot subtree mounting with world transform preservation.
- `tools/serve.py`
  - Replaced simple static server with same static server plus `POST /__vaw/install_visual_block`.
  - Endpoint writes only under `assets/visual_packs/local_working_visuals/`.
  - Endpoint updates only the chosen block folder and manifest asset, increments revision, updates installed index, rejects unsafe paths.
- `assets/visual_packs/installed_visual_packs.json`
  - `local_working_visuals` added as first pack.
- `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`
  - Added empty working-pack manifest with revision 0.
- `tools/build_release.py`
  - Visual pack provenance now uses folder inventory via `files_under(Path('assets/visual_packs'))`.
- `index.html` / `src/game.js`
  - Added `RELOAD VISUALS` button.
  - Added `Shift+V` hotkey.
  - Added `window.VAW_VISUAL_ASSET_DIAGNOSTICS()`.
- `tools/blockbench_import_studio/index.html`
  - Added form controls for node picker, suggested root, transform, material policy, Material Doctor, Advanced JSON details, and Install/Update button.
- `tools/blockbench_import_studio/app/main.js`
  - Added auto draft after import.
  - Added form-to-manifest syncing without requiring `Infer -> Apply`.
  - Added node path picker and suggested root.
  - Added Material Doctor summary.
  - Added local install payload builder and POST to `/__vaw/install_visual_block`.
- `tools/blockbench_import_studio/src/minimal_gltf_viewer.js`
  - Added 1x1x1 VAW block proxy preview helper.
- `tests/test_visual_asset_loader.js`
  - Updated URL assertion for cache-bust.
  - Added reload/revision/material/transform/disposal coverage.
- `tests/test_local_visual_pack_install.py`
  - Added Python test for local install endpoint helper functions using a temporary root.

## Validation Done
Passed:
- `node tests/test_visual_asset_manifest.js`
- `node tests/test_visual_asset_registry.js`
- `node tests/test_visual_asset_loader.js`
- `node tests/test_blockbench_import_studio_integration.js`

Not completed:
- Python test using global `python` failed because `python` is not on PATH.
  Next agent should run:
  `C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tests/test_local_visual_pack_install.py`

## Immediate Next Steps
1. Run the bundled Python local install test above.
2. Add `tests/test_local_visual_pack_install.py` to `tests/run_all.py` if it is not already included.
3. Re-run:
   - `node tests/test_visual_asset_manifest.js`
   - `node tests/test_visual_asset_registry.js`
   - `node tests/test_visual_asset_loader.js`
   - `node tests/test_blockbench_import_studio_integration.js`
   - bundled Python `tests/test_local_visual_pack_install.py`
4. Run broader baseline:
   - `node tests/test_build_targeting.js`
   - `node tests/test_flight_integrity.js`
   - bundled Python `tests/test_game_architecture.py`
   - bundled Python `tests/test_audit_regressions.py`
   - `node tools/generate_tailwind_css.js --check`
5. Check Studio browser workflow:
   - Start `tools/serve.py`.
   - Open Studio through server, not file://.
   - Import a glTF, choose block type, visualRoot, alpha `blend` if semi-transparent, adjust transform.
   - Click `Install / Update Block Visual`.
   - In game click `RELOAD VISUALS` or press `Shift+V`.
   - Verify same working pack path is updated, no new pack folder is created.
6. Only after tests pass, run bundled Python:
   - `tools/build_release.py`
   - `tools/verify_release.py --zip dist/Voxel_Aeronautics_Workshop_Workbench_Foundation.zip --hashes dist/SHA256.txt`

## Known Risks To Recheck
- `tools/blockbench_import_studio/app/main.js` changed heavily; check browser console for syntax/runtime errors.
- `src/game/visual_asset_loader.js` fallback restore should be checked visually after reload.
- `Material Doctor` field names depend on current `texture_report.js`; if alpha detection looks empty, inspect actual report object names.
- `SOURCE_MANIFEST.json` is currently dirty from previous work. Regenerate through `tools/build_release.py`, never by hand.
- Browser/WebGL smoke is still not claimed until actually run.

## Non-Goals
- No Gate D.
- No Blueprint/save schema changes.
- No gameplay fields in visual packs.
- No full map/contract/mission editor yet.
- No automatic backups for working pack updates.
