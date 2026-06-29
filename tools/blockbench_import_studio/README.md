# VAW Blockbench Import Studio — M4A Visual Asset Contract v0.7

## VAW repository integration

This copy is vendored into the VAW repository as `tools/blockbench_import_studio/`.

Studio is an authoring and export tool only. It must not become the source of truth for mass, thrust, fuel, durability, colliders, control axes, Blueprint data, CraftModel data or runtime assembly data. The game consumes Studio output only through validated `VAW_VISUAL_ASSET_PACK_V1` manifests and the renderer-only visual asset loader.

From the repository root:

```bash
npm run studio:test
npm run studio:serve
```

For fast local iteration, use `Install / Update Block Visual` while Studio is served through `tools/serve.py`. It updates only the selected block inside `assets/visual_packs/local_working_visuals/`; it does not create a new pack for every edit. Then use `RELOAD VISUALS` or `Shift+V` in the game.

Exported packs can still be copied to `assets/visual_packs/<packId>/` and listed in `assets/visual_packs/installed_visual_packs.json` when you need a fixture or shareable artifact.

Known limitation: the current reimported thruster/checker sample lost its original gameplay look after extraction/reimport. Do not fix that fixture here; use it only to validate loader and fallback boundaries. Newly designed assets must be checked in the game after export.

M4E hardening adds real Blockbench regression fixtures under `assets/real_blockbench_regression/` and `assets/real_blockbench_thruster_pack/`. Inferred Visual Asset Pack V1 manifests no longer silently default to `Thruster`: choose the block type explicitly and review `visualRoot` before export.

This package restarts the Studio export path around a named renderer-facing contract:

```text
VAW_VISUAL_ASSET_PACK_V1
```

The viewer-first rule still stands:

> A Blockbench `.gltf + .bin + textures` model must be visible in the Studio preview even when VAW export metadata is missing, invalid, or incomplete.

The new rule is stricter:

> Export to VAW must pass the Visual Asset Pack V1 contract. Preview can be permissive; export cannot.

## What changed in v0.7

- Added `src/visual_asset_pack_v1.js`, a contract validator/inferencer independent from Three.js runtime rendering.
- Added `docs/VISUAL_ASSET_PACK_V1.md`.
- Added `schemas/visual_asset_pack_v1.schema.json`.
- Added `assets/sample_visual_asset_pack_v1/` with embedded `test_anim.gltf` as a **preview/test asset**, not final gameplay content.
- Export now builds a Visual Asset Pack V1 package with:
  - source model/texture/buffer files;
  - `VAW_VISUAL_ASSET_PACK_V1.json`;
  - validation report;
  - project files report;
  - texture report;
  - animation report;
  - dependency report;
  - README explaining renderer-only authority.
- Export is blocked by:
  - missing `visualRoot`;
  - unknown block type;
  - forbidden gameplay-authority fields;
  - missing node binding;
  - missing clip binding;
  - ambiguous duplicate node-name binding;
  - unsafe/mismatched model path.
- Preview still works when the manifest is absent or invalid.

The previous v0.6.1 hardening fixes are kept:

- `animation-list` is wired into `app/main.js`;
- animation time updates live from the render loop;
- embedded `data:` URIs are compacted in UI-facing reports;
- resolver noise for `data:image...` is suppressed;
- embedded textures count as textures;
- embedded Blockbench-like regression coverage remains in tests.

## Start here

```bash
npm test
python tools/serve.py
```

Open:

```text
http://127.0.0.1:8080/index.html
```

Also keep the recovery gate alive:

```text
http://127.0.0.1:8080/minimal_viewer.html
```

## What to test first

1. Open `index.html`.
2. Click `V1 preview pack`.
3. Confirm the model appears.
4. Confirm animation list and live scrubber work.
5. Confirm `Visual Asset Pack V1 OK` appears, with duplicate node names only as warning.
6. Click `Export Visual Asset Pack V1`.
7. Confirm a `.zip` package downloads.
8. Edit the manifest and intentionally break `visualRoot`, `blockTypes`, or a clip binding.
9. Confirm preview still works, but export is blocked.
10. Click `Export Debug Package` and confirm it remains available even when VAW export is blocked.

## Minimal viewer vs full Studio

### `minimal_viewer.html`

This is the recovery truth gate:

- glTF + bin + textures;
- camera controls;
- render loop;
- basic status;
- no VAW manifest requirement;
- no heavy Workbench UI.

### `index.html`

This is the import-lab shell:

- resizable panels;
- Project Files panel;
- texture/material/mesh diagnostics;
- animation preview;
- Visual Asset Pack V1 editor/validator;
- Debug Package export;
- Visual Asset Pack V1 export.

## Project Files

The Project Files panel shows every loaded file, not only glTF dependencies.

It reports:

- model, buffer, texture, manifest/sidecar, and unknown files;
- main model, dependency used, unused, missing, ambiguous, embedded, and external states;
- debug/export inclusion;
- texture material slot usage;
- manifest recognition state.

Unused files are neutral warnings, not import errors.

## Visual Asset Pack V1 editor

The editor can:

- load a `VAW_VISUAL_ASSET_PACK_V1.json` file from the import bundle;
- fall back to showing legacy `.vaw.json` as invalid/legacy data instead of silently converting it;
- infer a minimal preview/test manifest from loaded nodes/clips;
- format JSON;
- apply edited JSON;
- validate the V1 contract;
- download the current manifest.

Invalid manifest JSON blocks VAW export and manifest download. It is not silently replaced with inferred JSON.

## Export Debug Package

`Export Debug Package` works when a model is loaded, even if Visual Asset Pack V1 export fails.

It includes:

- all loaded files;
- `PROJECT_FILES_REPORT.json`;
- `TEXTURE_REPORT.json`;
- `ANIMATION_REPORT.json`;
- `GLTF_DEPENDENCY_REPORT.json`;
- `SIDECAR_PARSE_REPORT.json` / manifest parse diagnostics;
- `VIEWER_FACTS.json`;
- `WORKBENCH_SESSION_REPORT.json`;
- `VAW_READINESS_REPORT.json`;
- `EVENT_LOG.txt`.

Use this when reporting import/viewer/texture/animation problems.

## Export Visual Asset Pack V1

`Export Visual Asset Pack V1` is strict by design.

It does **not** mean the asset is a finished gameplay object. It only means the visual pack is well-formed enough for the engine-side registry/fallback work to start consuming it safely.

## Important docs

- `docs/VISUAL_ASSET_PACK_V1.md`
- `schemas/visual_asset_pack_v1.schema.json`
- `docs/M4A_STUDIO_RESTART_CRITICAL_REVIEW.md`
- `docs/WORKBENCH_FEEDBACK_REVIEW_2026-06-23.md`
- `docs/NEXT_STEPS_AFTER_WORKBENCH.md`

## Honest limitation

This package has static/package tests, but this sandbox does not provide reliable pixel-perfect WebGL browser validation. Manual browser testing is still required.


## M4A engine compatibility sync

See `docs/M4A_ENGINE_COMPATIBILITY_REPORT_2026-06-23.md` for the Studio validator/schema sync against the current engine-side M4A `VAW_VISUAL_ASSET_PACK_V1` contract.


## User smoke polish after v0.7

After user feedback, one important export-layout issue was fixed: Visual Asset Pack ZIPs now place engine-facing files at the paths declared by `manifest.assets[0].model.path`, instead of hiding them under `source/`. This avoids a validator-green package that a future engine loader cannot locate.

`pack.noManifest` is now informational: preview is allowed, Debug Package export is allowed, and only Visual Asset Pack export is blocked until a manifest is loaded or inferred.

For direct smoke testing, open:

```text
http://127.0.0.1:8080/index.html?sample=visual
```

or:

```text
http://127.0.0.1:8080/index.html?sample=v1
```

See `docs/M4A_CRITICAL_POLISH_AFTER_USER_SMOKE_2026-06-23.md`.


## Final audit after user smoke report

This v0.7 package was re-audited after user smoke feedback. The main fixes are:

- plain Blockbench imports without a manifest now present `pack.noManifest` as a normal informational state, not as a scary warning;
- duplicate Blockbench node names are informational until a manifest binding makes them ambiguous;
- the built-in V1 sample uses pack-root-relative paths (`models/test_anim.gltf`) even though files are fetched from the Studio `assets/` folder;
- Visual Asset Pack export writes files at manifest-declared paths and no longer leaks Studio folder prefixes into the engine-facing package.

Use `python tools/serve.py` and open the printed local URL. Do not test built-in sample buttons from a direct `file://` page.
