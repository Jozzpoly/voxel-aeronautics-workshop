# M4A Critical Polish After User Smoke — 2026-06-23

## Trigger

User smoke feedback reported two issues:

1. `V1 preview pack` did not load in the user's browser.
2. Importing an animated Blockbench model produced diagnostics that looked like errors:
   - `gltf.duplicateNodeNames` for a duplicated `group` node name;
   - `pack.noManifest` because no `VAW_VISUAL_ASSET_PACK_V1` manifest was loaded.

## Critical interpretation

The two diagnostics are not model-load failures:

- Duplicate `group` node names are common in Blockbench exports. Preview must remain allowed. Export is blocked only if a binding uses an ambiguous bare node name or ambiguous path.
- No manifest means the model is only in preview/import-lab mode. Export to VAW must remain blocked until the user loads, infers, or edits a valid V1 manifest.

However, the UI and packaging still had two real risks:

1. The warnings could be read as a fatal import failure.
2. The Visual Asset Pack ZIP could pass validation while placing engine-facing model files under `source/`, even though `manifest.model.path` pointed elsewhere. A future engine loader would reasonably reject or fail to load that package.

## Fixes applied

### 1. Export package layout now matches manifest paths

`src/package_exporter.js` now writes engine-facing files at the paths declared by the manifest / loaded bundle, not under `source/`.

Before:

```text
pack/VAW_VISUAL_ASSET_PACK_V1.json
pack/source/sample_visual_asset_pack_v1/models/test_anim.gltf
```

The manifest still pointed to:

```text
sample_visual_asset_pack_v1/models/test_anim.gltf
```

That was validator-green but loader-hostile.

After:

```text
pack/VAW_VISUAL_ASSET_PACK_V1.json
pack/sample_visual_asset_pack_v1/models/test_anim.gltf
pack/validation/...
```

The debug package remains the correct artifact for exact troubleshooting copies. The Visual Asset Pack is now engine-facing first.

### 2. No-manifest diagnostic softened

`pack.noManifest` is now `info`, not `warning`.

It still blocks VAW export through `vawReady: false`, but it no longer implies that preview/import failed.

### 3. Blob resolver noise hardened

The event log now suppresses `blob:` URL resolver noise from `GLTFLoader` object URL resolution. Real missing dependencies remain visible in Project Files and `GLTF_DEPENDENCY_REPORT.json`.

### 4. V1 preview deep link added

`index.html?sample=visual` and `index.html?sample=v1` now auto-load the V1 preview pack. This makes smoke testing less dependent on clicking the button manually.

### 5. Local server hardened

`tools/serve.py` now:

- uses `allow_reuse_address = True`;
- supports `--host` and `--port`;
- prints the V1 preview smoke URL;
- flushes startup output.

This reduces false startup failures caused by the port being temporarily stuck after a previous server run.

## Mental tests / expected behavior

### Import raw Blockbench animated glTF without manifest

Expected:

- model preview loads;
- animation list works;
- duplicate `group` names may show as warning;
- `pack.noManifest` shows as info;
- Export Debug Package is enabled;
- Export Visual Asset Pack V1 is blocked;
- user can click Infer V1 Manifest to create a draft.

### Import Blockbench model with duplicate node names

Expected:

- preview still allowed;
- export allowed if bindings use unique stable paths;
- export blocked if bindings use ambiguous bare names like `group`;
- export blocked if duplicated sibling paths make a path ambiguous.

### V1 preview pack

Expected:

- direct button load and `?sample=visual` should fetch:
  - `assets/sample_visual_asset_pack_v1/models/test_anim.gltf`;
  - `assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json`;
- model preview should load;
- `up_down` should appear in animation UI;
- V1 validation should be OK with duplicate-node-name warning only;
- Visual Asset Pack export should be enabled.

### Exported Visual Asset Pack ZIP

Expected:

- `VAW_VISUAL_ASSET_PACK_V1.json` is at the pack root;
- the model file exists at `manifest.assets[0].model.path` relative to the pack root;
- validation reports are under `validation/`;
- no engine-facing model is hidden only under `source/`.

## Compatibility with engine-side M4A contract

The Studio validator remains synchronized with the M4A contract from the user's prompt:

- exact allowed block types;
- exact allowed node aliases;
- exact allowed clip aliases;
- required `materialPolicy` object;
- strict relative `model.path` rules;
- forbidden gameplay-authority fields;
- preview/export separation.

The new package layout fix closes an additional compatibility gap not covered by pure manifest validation: future engine-side loading depends on files existing where the manifest says they exist.

## Remaining limitation

This environment could not complete a real interactive WebGL browser smoke. Static tests and HTTP serving checks passed, but the final model-visible smoke should still be run locally in Chrome/Edge via:

```bash
npm test
python tools/serve.py
```

Open:

```text
http://127.0.0.1:8080/index.html?sample=visual
```
