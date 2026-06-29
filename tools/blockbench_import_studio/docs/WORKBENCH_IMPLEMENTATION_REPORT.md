# Workbench Shell Implementation Report

## Implemented

### Workbench layout

`index.html` now uses a workbench shell instead of a rigid grid:

- left Project Files / import panel is resizable;
- right inspector panel is resizable;
- bottom log panel is resizable;
- each of those panels can be collapsed;
- layout state is saved in `localStorage`;
- `Reset layout` restores defaults;
- resizing/collapsing triggers viewer renderer resize.

Implementation:

- `src/layout_manager.js`
- updated `index.html`
- updated `app/styles.css`

### Project Files panel

The left panel now contains `Project Files`, which reports all loaded files, not only glTF dependencies.

Implementation:

- `src/project_files_report.js`
- `app/main.js` integration

The report classifies:

- model;
- buffer;
- texture;
- sidecar;
- unknown.

It reports statuses:

- main model;
- dependency used;
- unused;
- missing;
- ambiguous;
- embedded;
- external.

Unused files are shown as neutral warnings, not import errors.

### UI status cleanup

UI sections and controls are now visibly labeled:

- READY;
- PARTIAL;
- EXPERIMENTAL.

Empty future features are not presented as finished functionality.

### F vs R camera behavior

`F` and `R` are now separated:

- `F` / Frame-Fit keeps the current camera orientation and reframes the current model;
- `R` / Reset Camera returns to the default model orientation and distance.

Implementation:

- `src/fit_camera.js` adds `frameCameraToBounds()`;
- `src/minimal_gltf_viewer.js` uses `fit()` for frame-preserve orientation and `resetCamera()` for default orientation.

### Debug export

`Export Debug Package` is separate from `Export VAW Package`.

Debug export is available when a model/bundle is loaded, even when VAW readiness fails.

It includes:

- every loaded file;
- `PROJECT_FILES_REPORT.json`;
- `TEXTURE_REPORT.json`;
- `VIEWER_FACTS.json`;
- `VAW_READINESS_REPORT.json` or a not-validated note;
- `README_DEBUG_PACKAGE.txt`.

Implementation:

- `src/package_exporter.js` adds `buildDebugPackageEntries()`;
- `app/main.js` adds `downloadDebugPackageZip()`.

## Tests added or maintained

`npm test` now checks:

- `minimal_viewer.html` exists;
- `MinimalGltfViewer.clearModel()` does not cancel the render loop;
- old `cancelAnimationFrame(state.animationFrame)` pattern did not return;
- MMB rotate;
- Shift+MMB pan;
- LPM/PPM ignored;
- `.gltf + .bin + texture` resolver path;
- `viewerOk` separate from `vawReady`;
- Project Files used/unused/missing/ambiguous reports;
- texture used by material slot;
- sidecar recognized as sidecar;
- layout manager defaults and `localStorage` sanitization;
- UI contains Project Files and Reset layout;
- Debug export exists;
- VAW export and Debug export are separated.

## Validation run

```bash
npm test
```

Result after implementation: passed.

```bash
unzip -t VAW_BLOCKBENCH_IMPORT_STUDIO_WORKBENCH_SHELL.zip
```

Result: passed after packaging.

## Honest limitation

This environment validates static behavior and package integrity. It does not provide a reliable pixel-perfect WebGL browser test. The user should still run `minimal_viewer.html` first, then `index.html`, with the same sample that passed Recovery Gate 1.
