# M4A Final Audit After User Report — 2026-06-23

## Summary

This pass treats the user's smoke feedback as a real release blocker. Static tests were passing, but the UI path was still capable of confusing a normal Blockbench import with contract failure, and the built-in V1 sample used a Studio-folder-relative model path instead of a clean pack-root-relative path.

The goal remains unchanged: Studio produces and validates renderer-facing `VAW_VISUAL_ASSET_PACK_V1` packages. It does not author gameplay data and does not implement the game-side glTF loader.

## User-reported symptoms

1. Importing a Blockbench model with animations showed:
   - `gltf.duplicateNodeNames`
   - `pack.noManifest`
2. The user perceived those as errors.
3. `V1 preview pack` still did not reliably load/communicate readiness.

## Critical findings

### 1. Diagnostics were technically correct but UX-wrong

`pack.noManifest` is normal after a plain Blockbench import. Preview and debug export should be allowed; only VAW Visual Asset Pack export should be blocked.

`gltf.duplicateNodeNames` is common in Blockbench exports, especially with generic names such as `group` or repeated bones. Duplicate names are not by themselves an export failure. Export should only block when a manifest binding uses an ambiguous name/path.

### 2. Built-in sample used the wrong path semantics

The sample manifest previously pointed at a Studio-folder-relative path:

```json
"path": "sample_visual_asset_pack_v1/models/test_anim.gltf"
```

For an actual Visual Asset Pack, `model.path` must be relative to the pack root:

```json
"path": "models/test_anim.gltf"
```

The Studio now loads the built-in sample with pack-root-relative virtual paths, while still fetching files from `assets/sample_visual_asset_pack_v1/` internally.

### 3. Export needed to respect manifest paths, not loaded browser paths

When users load a folder, browsers often include an extra directory prefix in `webkitRelativePath`. That prefix is not part of the pack contract. Export now copies engine-facing files to paths declared by the manifest, not to whatever browser folder path happened to be loaded.

## Changes made

### app/main.js

- Built-in V1 sample now maps fetched assets to pack-root relative paths:
  - `models/test_anim.gltf`
  - `VAW_VISUAL_ASSET_PACK_V1.json`
- Added `sidecarRecordPath` and `sidecarBasePath` state.
- V1 validation now receives `manifestBasePath`, so folder uploads with an outer prefix can still validate against pack-root paths.
- `pack.noManifest` no longer makes the UI look like a warning/error state.
- Diagnostics now show a summary:
  - blocking export errors;
  - non-blocking warnings;
  - informational notices.
- Diagnostic rows explain whether a message blocks V1 export or is just normal preview information.
- Sample fetch failures now explicitly tell the user to run `python tools/serve.py` instead of opening via `file://`.

### src/visual_asset_pack_v1.js

- Added manifest-base-aware model path validation.
- Duplicate node names/paths are informational when no manifest is loaded.
- Duplicate node names/paths still become warnings once a manifest is present, and ambiguous bindings remain errors.
- `pack.noManifest` message now states that this is normal after a plain Blockbench import.
- Removed duplicate recursion in forbidden gameplay field scanning.

### src/package_exporter.js

- Visual Asset Pack export now writes model files at `manifest.assets[].model.path`.
- Folder/browser prefixes are stripped from engine-facing export paths.
- Export no longer leaks `sample_visual_asset_pack_v1/` or other Studio folder prefixes into the final pack.
- Provenance is preserved in `validation/LOADED_SOURCE_FILES_REPORT.json`.

### assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json

- Changed `model.path` to `models/test_anim.gltf`.
- Sample remains marked as preview/test asset only.

### tests/test_recovery_static.js

Added/updated regression coverage for:

- `pack.noManifest` is informational;
- duplicate Blockbench node names are informational before a manifest exists;
- sample manifest uses pack-root-relative `models/test_anim.gltf`;
- sample loaded from `sample_visual_asset_pack_v1/` validates using `manifestBasePath`;
- exported sample contains `models/test_anim.gltf`;
- exported sample does not contain `sample_visual_asset_pack_v1/models/test_anim.gltf`;
- UI contains the friendly no-manifest state text;
- built-in sample uses explicit pack-root relative paths.

## Compatibility with engine-side M4A contract

The Studio-side contract remains aligned with M4A:

- format is `VAW_VISUAL_ASSET_PACK_V1`;
- known block types are limited to current M4A catalog types;
- unknown node aliases and clip aliases fail;
- `materialPolicy` is required;
- gameplay-authority fields are forbidden;
- `model.path` is a safe pack-root-relative path;
- preview is allowed without a manifest;
- VAW export is blocked without a valid manifest;
- procedural fallback remains an engine-side obligation and is not replaced by Studio.

## Current expected behavior

### Plain Blockbench import without manifest

Expected:

- model preview loads;
- animation list works if clips exist;
- debug export is allowed;
- V1 export is disabled;
- diagnostics may show informational `pack.noManifest`;
- duplicate node names are informational unless used ambiguously in a manifest binding.

### Built-in V1 preview pack

Expected:

- model loads from `assets/sample_visual_asset_pack_v1/models/test_anim.gltf`;
- Studio internally treats it as `models/test_anim.gltf` inside the pack;
- manifest loads from `VAW_VISUAL_ASSET_PACK_V1.json`;
- Visual Asset Pack V1 validates;
- export writes `models/test_anim.gltf`, not `sample_visual_asset_pack_v1/models/test_anim.gltf`.

## Validation performed

```bash
npm test
python tools/validate_recovery_package.py
```

Both passed in the Linux sandbox.

Full interactive browser smoke could not be completed in this sandbox because local HTTP navigation is blocked by the environment policy, but the code path is covered with stronger static/regression tests and HTTP serving was previously confirmed. The final smoke still needs to be run locally by the user.

## Remaining risks

1. If the user opens `index.html` directly via double-click / `file://`, built-in sample buttons may fail because browsers block local `fetch()`.
2. Full WebGL smoke must still be verified locally.
3. Duplicate names from Blockbench are normal, but final production assets should eventually use explicit stable aliases/paths to reduce confusion.
