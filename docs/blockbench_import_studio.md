# Blockbench Import Studio

Blockbench Import Studio is vendored into this repository at `tools/blockbench_import_studio/`.

Studio is an authoring/export tool. It is not the game runtime and it is not a gameplay authority. Blueprint, CraftModel, `foundation.catalog`, CraftCompiler and RuntimeAssemblyPlan remain authoritative for every gameplay field.

## Run Studio

From the repository root:

```bash
npm run studio:test
npm run studio:serve
npm run visual:test
```

`npm run studio:serve` starts the integrated VAW development server and opens Studio under:

`http://127.0.0.1:8765/tools/blockbench_import_studio/index.html`

Use this integrated server for `Install / Update Block Visual`. It exposes `GET/POST /__vaw/install_visual_block`, writes to `local_working_visuals` and lets the game reload visuals. Do not use direct `file://` testing for built-in samples or install/update work.

For focused validation during long visual-pipeline changes, use `npm run visual:test` or `run_visual_checks.bat`. The runner covers engine manifest/registry/loader checks, Studio integration checks, local install endpoint checks and Studio static tests. Add `--include-release-gates` when a change touches build inventory, runtime lifecycle or game architecture gates.

## Fast Install To The Game

For day-to-day visual polish, do not create a new pack per edit. Use the single working pack:

`assets/visual_packs/local_working_visuals/`

1. Start the integrated local VAW server with `npm run studio:serve`, `python tools/serve.py --studio`, or the bundled Python equivalent.
2. Open Studio through that server.
3. Import a glTF model.
4. Choose the target block type.
5. Pick or confirm `visualRoot`; the picker stores full node paths to avoid duplicate-name ambiguity.
6. Adjust renderer-only position, rotation, scale and material policy. Use `auto` for mixed models. Keep body/nozzle materials `opaque` or `mask`; use `blend` only for flame, glass or glow materials. Prefer the material selector list over raw manifest JSON; the textarea remains an advanced escape hatch.
7. Click `Install / Update Block Visual`.
8. If the game is open on the same local origin, Studio requests reload automatically. Otherwise click `RELOAD VISUALS` or press `Shift+V`.

The install endpoint writes only under `local_working_visuals`, overwrites only the selected block folder, updates that block asset in the working manifest and increments the working revision. It does not create backup folders and does not touch Blueprint/save/gameplay data.

Studio stores the last authoring settings per VAW block type in browser `localStorage`: target block, node aliases, renderer-only transform, material policy and fire/glow material split settings. This is an authoring convenience only. It must not be serialized into Blueprint, CraftModel, saves or gameplay data. If a newly imported model uses different node names, review `visualRoot` and aliases before install; the saved block profile is meant to speed iteration, not to become an asset authority.

`Clear rig bindings` clears only optional node aliases: `flame`, `flameGlow`, `gimbalAssembly` and `controlFlapPivot`. It does not clear `visualRoot`, transform, material policy or block type. Studio may reuse transform and material defaults across block types, but global defaults must not carry optional rig aliases or fire/glow split state from one block type to another. Exact per-block profiles remain restorable for the same block type.

If Studio reports `Install failed: Failed to fetch`, it usually means Studio is not connected to the integrated VAW dev endpoint. Click `Check install endpoint`. If it is unavailable, start `npm run studio:serve` from the repository root and reopen Studio from the printed `/tools/blockbench_import_studio/index.html` URL. Standalone Studio preview servers can load models, but they cannot write into the game unless the integrated VAW server is reachable.

If solid parts look transparent or edges appear to show geometry behind them, check the material policy first. A global `blend` applies transparent sorting to the whole imported model. Prefer Material Doctor's `auto` policy with per-material overrides such as `NozzleMat=opaque` and `FlameMat=blend`. If several glTF materials share the same name, an override by name applies to every match; rename materials in Blockbench when you need separate policies.

For a read-only pack sanity check, run:

```bash
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics
```

The local working pack is user art. Audit diagnostics for `local_working_visuals` are evidence for manual review; they are not permission to normalize, delete or auto-fix the art.

For an actionable dry-run cleanup report, add `--suggest-cleanup`:

```bash
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
```

The JSON report keeps the original `diagnostics` list and also includes `assetReports` entries with `assetId`, `blockTypes`, model status, per-asset diagnostics and dry-run `cleanupSuggestions`. The top-level `suggestedManifestCleanup` object is always advisory; it never writes files.

## Export Pack Artifact

1. Design or load a visual model in Studio.
2. Choose the target VAW block type explicitly and review the `visualRoot` binding. Studio must not silently default an inferred asset to `Thruster`.
3. Validate/export a `VAW_VISUAL_ASSET_PACK_V1` package.
4. Put the exported folder under `assets/visual_packs/<packId>/`.
5. Add the manifest to `assets/visual_packs/installed_visual_packs.json`.
6. Serve the VAW game from the source tree and verify the visual in Workshop and Flight.

Example index entry:

```json
{
  "source": "local:my_thruster_pack",
  "manifestUrl": "my_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json"
}
```

`manifestUrl` is relative to `assets/visual_packs/installed_visual_packs.json`. The manifest path points to renderer-facing files only. This folder/index workflow remains useful for fixtures or shareable packs; it is not the preferred rapid edit loop.

## Runtime Boundary

The game validates every manifest before registration. Invalid manifests, missing models and GLTFLoader failures are non-fatal and must leave procedural fallback active.

Imported glTF content is mounted as a child of the stable VAW visual root. M4G keeps `vawHitProxy` raycastable but render-invisible by default; `VISUAL DEBUG` shows it only for diagnostics. M4F/M4G mount the manifest `visualRoot` subtree when it can be found, fall back to the full scene when it cannot, deep-clone renderer resources per instance, apply renderer-only transform/material policy, support reload/retry and keep procedural fallback available. Imported visuals must never replace `root.userData.isVoxelRoot`, `vawHitProxy`, hit-testing, damage/debris ownership, physics bodies or control semantics.

The standalone single-file release remains playable without adjacent visual pack folders. It may fall back procedurally when external source-tree packs are not present.

## Known Limitation

The current reimported thruster/checker sample lost its original in-game look after being extracted and reimported. This is recorded intentionally and is not fixed in M4C/M4E.

Use that sample only as a loader/fallback fixture. The acceptance target is different: a newly designed Studio asset should look in the game like it looked in Studio after export. If it does not, document the mismatch as a visual pipeline issue while keeping gameplay data out of the pack.

`assets/visual_packs/real_blockbench_thruster_pack/` and `tools/blockbench_import_studio/assets/real_blockbench_*` are M4E regression fixtures copied from real Blockbench exports. They prove the folder/index and validator path, not final art direction.

VectorThruster visual motion is still limited by the current V1 node alias set. `gimbalAssembly` is a single renderer node, and the runtime currently applies `gimbalA/gimbalB` to fixed local rotation axes. That can look correct for forward/back input but wrong for left/right or roll when the imported model's nozzle pivot axes do not match the procedural VAW model. The next hardening step should add an explicit renderer-only vector-thruster rig profile in Studio and runtime diagnostics, without adding control semantics to the visual pack.
