# ADR 0040 — Minimal workshop authoring path for mechanical links

Status: Accepted in Foundation Phase 1D.4A.

## Decision
The workshop provides a narrow Hinge Link mode: select two adjacent block faces, choose the signed hinge axis, create through CraftModel, visualize the link and remove it through the model. Import, autosave and undo/redo use the same v11 document path. Invalid choices surface structured diagnostic codes and entity IDs.

## Non-goals
This is not a node editor, device catalog, signal wiring system or final multi-joint library. Gate D/E remain unimplemented.

## Proof
The normal Flight button compiles the authored link into two bodies and a real Cannon hinge; fixtures are supplementary, not the sole production path.
