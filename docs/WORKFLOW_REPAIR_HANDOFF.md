# Workflow and Product Handoff

```text
repository=Jozzpoly/voxel-aeronautics-workshop
true_hardening_base=fa125064426c8a77586864035dc8dbad4af6b44b
product_state=Gate C Future Hardening candidate
blueprint=V12
compiled_craft=V5
runtime_plan=V3
next_gate=Gate D Device & Port Schema
```

Stage 1, documentation convergence and Stage 1.1 established durable validation and canonical cross-platform releases. The hosted-Windows-only historical CI debt remains nonblocking unless reproduced locally or on Ubuntu.

Gate C adds durable Assembly Spaces, explicit block/link/body/runtime ownership, migration and minimal authoring. The hardening pass adds strict persistence/physics/import boundaries, offline runtime dependencies, fixed-step health and indexed runtime hot paths.

Do not use historical bootstrap/recovery branches as transport. Re-read remote state before publication. Prefer normal Git; when unavailable deliver one final milestone ZIP.

Gate D must use `{blockId, portId}`. Do not persist `bodyId`, start ControlRuntime, walking, docking, broad interiors or dynamic fracture in the Device/Port milestone.
