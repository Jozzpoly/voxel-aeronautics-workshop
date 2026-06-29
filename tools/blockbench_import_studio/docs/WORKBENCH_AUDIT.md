# VAW Blockbench Import Studio — Workbench Audit

## Scope

This audit starts from `VAW_BLOCKBENCH_IMPORT_STUDIO_RECOVERY_VIEWER_FIRST.zip` and treats `minimal_viewer.html` as the recovery truth gate.

Command run before implementation:

```bash
npm test
```

Result: passed.

## Production-ready / ready enough for current recovery

- `minimal_viewer.html` recovery gate:
  - `.gltf + .bin + textures` loading;
  - MMB rotate;
  - Shift + MMB pan;
  - wheel zoom;
  - LPM/PPM ignored;
  - render loop remains alive after import reset.
- `src/file_bundle_resolver.js`:
  - path normalization;
  - relative dependency lookup;
  - basename fallback;
  - missing/ambiguous/embedded dependency statuses.
- `src/viewport_controls.js`:
  - custom controls with the requested mouse policy.
- `src/texture_report.js` as a diagnostic, not as a full material editor:
  - glTF image rows;
  - material texture slots;
  - runtime mesh/material facts.
- Viewer/import vs VAW readiness split:
  - `viewerOk` and `vawReady` are separate concepts;
  - lack of sidecar does not block model preview.

## Partial

- `index.html` full studio shell before this iteration:
  - useful, but too rigid;
  - many sections existed at the same importance level;
  - no full loaded-files overview.
- VAW readiness:
  - enough to block VAW package export;
  - not a full semantic authoring system.
- Sidecar textarea/editor:
  - can load/validate/generate minimal JSON;
  - not a real structured editor.
- Animation controls:
  - can play/stop clips;
  - no timeline, event track, scrubbing, blend controls, or binding inspection.
- Mesh/material diagnostic:
  - useful facts;
  - not a complete material inspector.

## Experimental

- Checker override:
  - useful for visual debugging;
  - intentionally labeled experimental because it replaces runtime materials temporarily.
- Diagnostic double-sided:
  - useful to diagnose invisible backfaces;
  - partial because it can hide real authoring/culling issues.

## Disabled or intentionally not implemented

The following are intentionally not implemented in this iteration:

- game preview;
- gimbal slider;
- flame intensity;
- socket editor;
- node picking;
- full material editor;
- full animation timeline;
- ZIP import.

## UI rigidity found

Before Workbench Shell, the full studio used a fixed three-column grid:

- left panel width was hard-coded;
- right panel width was hard-coded;
- bottom log had fixed height;
- the viewport did not explicitly coordinate resizing with panel changes;
- no layout persistence existed.

## What must remain unchanged to protect recovery

- Do not make `minimal_viewer.html` depend on VAW sidecars or Workbench UI.
- Do not bind LPM/PPM to camera controls.
- Do not reintroduce `cancelAnimationFrame(state.animationFrame)` or any equivalent app-level import reset pattern.
- `MinimalGltfViewer.clearModel()` must not kill the render loop.
- `.gltf + .bin + textures` remains the main workflow; GLB remains secondary.
- The model must render even when VAW semantics are missing or invalid.
