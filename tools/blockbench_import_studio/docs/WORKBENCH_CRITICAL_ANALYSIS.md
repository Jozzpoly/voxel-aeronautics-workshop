# Workbench Critical Analysis — after Workbench Shell v0.5

## Executive conclusion

Workbench Shell v0.5 solved the most important structural problem: `index.html` stopped being a rigid three-column mockup and became a resizable studio shell. It also preserved the recovery truth gate: `minimal_viewer.html` remained a small viewer-first page.

The weak point was not the viewer anymore. The weak point was trust in the rest of the studio UI. Several panels were technically present, but still felt partial because they did not yet provide enough real inspection, filtering, or safe editing behavior.

## What was solid enough

- `minimal_viewer.html` stayed clean and should remain the first manual test.
- `MinimalGltfViewer.clearModel()` does not kill the render loop.
- MMB/Shift+MMB/wheel controls follow the user requirement.
- `Project Files` exists and sees all loaded files, not only glTF references.
- Debug export and VAW export are separated.
- Layout persistence works through `localStorage`.

## What was still too thin

### Project Files

The panel listed files, but lacked search/filter tools. With larger Blockbench exports, this becomes noisy fast. A real workbench needs filtering by name, category and status.

### Sidecar editor

The textarea existed, but the behavior was not explicit enough. The old flow could still feel magical because some actions inferred a sidecar silently. That is dangerous for a production workflow: the user must know whether a sidecar was loaded, inferred, edited, invalid, applied, or cleared.

### Animation controls

Play/stop existed, but the tool did not yet expose a meaningful animation report or basic preview controls. This made the animation panel feel like a placeholder even when clips existed.

### Texture and mesh diagnostics

The previous report was useful but too shallow. It reported images/material slots/runtime meshes, but not enough warnings such as missing texture paths, untextured materials, single-sided transparent materials, or textured meshes without UV0.

### Debug export

The first debug export was useful, but still missed several crucial reproduction facts: dependency report, sidecar parse report, animation report, session report and event log.

## What should not be changed yet

- Do not implement game preview.
- Do not implement sockets/node picking/material authoring yet.
- Do not replace the minimal viewer with the full workbench.
- Do not bind LPM/PPM to camera controls.
- Do not make VAW readiness block model preview.

## Strategic direction

The right next step is not “more spectacular features”. The right next step is “finish the boring workbench functions until the studio feels honest”: files, diagnostics, sidecar editor, animation preview, exportable evidence, tests.
