# Workbench Hardening Implementation Report v0.6

## Implemented

### Project Files filters

The Project Files panel now has:

- search by name/path/category/status;
- category filter: model, buffer, texture, sidecar, unknown;
- status filter: main model, dependency used, unused, missing, ambiguous, embedded, external;
- clear filters button;
- summary now reports both total loaded files and currently shown rows.

### Sidecar editor hardening

The sidecar area now has:

- visible sidecar status facts;
- `Format JSON`;
- `Apply sidecar`;
- stricter minimal sidecar shape validation;
- safer export behavior: invalid JSON blocks sidecar/VAW export instead of being silently replaced.

`Infer sidecar` is now a deliberate action, not hidden behavior.

### Animation preview hardening

Added `src/animation_report.js`.

The animation area now includes:

- clip report;
- channel/track counts;
- animated target nodes and properties;
- play;
- pause/resume;
- stop;
- loop toggle;
- speed selector;
- manual time scrub slider.

This is still not a full timeline, but it is now a real preview tool instead of a placeholder.

### Texture / mesh diagnostic expansion

`src/texture_report.js` now returns schema version 2 with diagnostics.

New facts include:

- material base color and emissive factors;
- transparency signal;
- material runtime types;
- mesh UV0/UV1 facts;
- warnings for missing/ambiguous images;
- warnings for textured meshes without UV0;
- warnings for hidden/no-position meshes.

### Global diagnostics

The diagnostics panel now combines:

- VAW readiness diagnostics;
- texture diagnostics;
- animation warnings.

### Debug package expansion

`Export Debug Package` now includes:

- `PROJECT_FILES_REPORT.json`;
- `TEXTURE_REPORT.json`;
- `ANIMATION_REPORT.json`;
- `GLTF_DEPENDENCY_REPORT.json`;
- `SIDECAR_PARSE_REPORT.json`;
- `VIEWER_FACTS.json`;
- `WORKBENCH_SESSION_REPORT.json`;
- `VAW_READINESS_REPORT.json`;
- `EVENT_LOG.txt`;
- all loaded files.

### Tests

The static test suite now checks:

- recovery gates;
- resolver behavior;
- project file used/unused/missing/ambiguous rows;
- texture diagnostic warnings;
- animation report;
- sidecar shape validation;
- debug package extra reports;
- UI strings for filters, sidecar editor and animation controls;
- old render loop bug remains absent.

## Known limitations

- No pixel-perfect WebGL test was run in this sandbox.
- Animation scrub is a preview control, not a full editor or timeline.
- Sidecar editor validates minimal readiness only; it is not a socket/semantic editor.
- Mesh/material diagnostic is still read-only.
- There is no ZIP import yet.

## Manual test order

1. Open `minimal_viewer.html` and confirm the recovery sample still renders.
2. Open `index.html`.
3. Load the same Blockbench `.gltf + .bin + texture` folder.
4. Test Project Files search and filters.
5. Test F/R, MMB controls and layout resize.
6. Test Animation Preview on a model with clips.
7. Test invalid sidecar JSON: it should show/block export safely, not silently replace it.
8. Export Debug Package and inspect the JSON reports.
