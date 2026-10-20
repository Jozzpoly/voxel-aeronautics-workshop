# ADR 0045 - Renderer-only VectorThruster rig profile

Status: Accepted

## Context

Imported VectorThruster visuals can have nozzle pivot axes that do not match the procedural VAW model. The old runtime fallback applied `gimbalA` and `gimbalB` to fixed local Euler axes, which can make forward/back motion readable while left/right or roll-looking motion is wrong for a specific Blockbench rig.

This must remain a visual authoring problem. Blueprint, CraftModel, CraftCompiler, flight controls, force application, physics and saves remain authoritative outside the visual asset pack.

## Decision

Visual Asset Pack V1 may declare an optional renderer-only profile at `bindings.rig.vectorThruster`.

The profile contains `channels`, where each channel maps one renderer input to a node alias and local rotation axis:

- `input`: `gimbalA`, `gimbalB` or `roll`
- `node`: a `bindings.nodes` alias, normally `gimbalAssembly`
- `axis`: `x`, `y` or `z`
- `direction`: `1` or `-1`

The game runtime uses this only to rotate imported renderer nodes from their cached base pose. If a profile is absent, the existing procedural/fallback gimbal behavior remains active. If a profile is invalid or points at a missing node, validation/audit should report it and runtime should no-op rather than changing gameplay behavior.

Studio exposes the profile as explicit VectorThruster authoring controls. Global/default Studio preferences must not carry the profile between block types; exact per-block profiles may be restored for the same block type.

## Consequences

VectorThruster visual motion can be corrected per imported rig without hardcoding a one-off Euler patch in runtime code and without moving control semantics into the visual pack.

The profile is safe to iterate with `local_working_visuals`, but edits to that local pack remain owner-controlled art work. Audit diagnostics can recommend or report rig issues, but they are not permission to rewrite user art.
