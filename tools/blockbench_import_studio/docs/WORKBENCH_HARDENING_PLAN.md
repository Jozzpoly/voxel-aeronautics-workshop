# Workbench Hardening Plan v0.6

## Goal

Move the Import Studio from a useful shell to a more trustworthy diagnostic tool, without starting V4 Game Preview and without turning this into a full VAW semantic authoring system.

## Phase A — preserve recovery gates

- Keep `minimal_viewer.html` simple.
- Keep `.gltf + .bin + textures` as the main path.
- Keep render loop alive across `clearModel()`.
- Keep MMB rotate, Shift+MMB pan, wheel zoom, LPM/PPM ignored.
- Keep `viewerOk` separate from `vawReady`.

## Phase B — finish practical Workbench UI

- Add Project Files search.
- Add Project Files category/status filters.
- Keep unused files as neutral warnings.
- Add clearer file tags for extension, export inclusion, sidecar state and material usage.

## Phase C — make sidecar editing honest

- Add `Format JSON`.
- Add `Apply sidecar`.
- Add a visible sidecar status panel.
- Do not silently replace invalid user JSON with inferred sidecar.
- Validate minimal sidecar shape: `assetId`, `kind`, `model.path`, `semantics.visualRoot.node`.

## Phase D — harden animation preview

- Add animation report module.
- Report clips, channels, tracks, target nodes and animated properties.
- Add preview controls: play, pause/resume, stop, loop, speed and manual time scrub.

## Phase E — improve diagnostics

- Add texture/material/mesh diagnostics.
- Surface texture warnings in the right inspector and global diagnostics list.
- Add animation warnings to global diagnostics.

## Phase F — expand Debug Package

Debug export should include enough evidence to reproduce user reports:

- all loaded files;
- Project Files report;
- Texture report;
- Animation report;
- glTF dependency report;
- sidecar parse report;
- viewer facts;
- Workbench session report;
- VAW readiness report;
- event log.

## Deferred

- Full node picker.
- Socket editor.
- Full material editor.
- Full animation timeline.
- Game preview.
- ZIP import.
