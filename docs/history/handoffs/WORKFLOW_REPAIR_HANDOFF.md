# Workflow and Product Handoff

```text
repository=Jozzpoly/voxel-aeronautics-workshop
clean_main_base=ddce6b4
product_state=Workbench Foundation on stable Gate C
blueprint=V12
compiled_craft=V5
runtime_plan=V3
workspace=V4 dockable build/flight layouts with side stacking
current_milestone=Workbench Foundation
queued_gate=Gate D Device & Port Schema
```

Stage 1, documentation convergence and Stage 1.1 established durable validation and canonical cross-platform releases. Gate C adds durable Assembly Spaces, explicit block/link/body/runtime ownership, migration and minimal authoring. The hardening pass adds strict persistence/physics/import boundaries, offline runtime dependencies, fixed-step health and indexed runtime hot paths.

The active milestone is Workbench Foundation plus M4E visual asset hardening: dockable/floating UI panels, side dock stacking, build/flight layout separation, dockable flight mission information, documentation authority cleanup, Studio-in-repo authoring, renderer-only visual pack replacement and real glTF fixture safety.

Known visual limitation: the current reimported thruster/checker sample lost its original in-game look after extraction/reimport. Do not fix that fixture as part of M4C/M4E. It is only a loader/fallback boundary test; newly authored Studio assets must be checked in-game for visual fidelity.

Do not use historical bootstrap/recovery branches as transport. Re-read remote state before publication. Prefer normal Git; when unavailable deliver one final milestone ZIP.

Gate D must use `{blockId, portId}`. Do not persist `bodyId`, start ControlRuntime, walking, broad interiors or dynamic fracture in the Device/Port milestone. Gate D resumes after Workbench Foundation is validated.
