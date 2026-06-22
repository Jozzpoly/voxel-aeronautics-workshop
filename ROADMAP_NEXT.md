# Roadmap after Gate C

## Closed

- Gate B - deterministic rigid islands and mechanical graph.
- Gate C - durable Assembly Spaces, ownership, migration, runtime presentation and minimal authoring.
- Future-readiness hardening - strict import/physics boundaries, offline dependencies, fixed-step health, indexed hot paths and persistence recovery.

## Current: Workbench Foundation / Authoring UX Recovery

- Upgrade `foundation.ui-workspace` to dockable/floating panel layout v4.
- Keep separate build and flight layout presets.
- Add a dockable parts hotbar backed by the existing block catalog, with compact/full bottom dock span modes.
- Add side dock stacking and a dockable flight mission panel so mission/contract information remains supporting UI.
- Refresh documentation authority and archive stale root-level reports.
- Authoring UX Recovery Milestone 1 is implemented locally: runtime mass telemetry, launcher Flight Focus, panel-safe launcher z-order, camera modes, below-craft orbit and Shift+middle pan.
- Define the visual asset boundary before Blockbench importer work.

## Next: Placement and Orientation Clarity

M2A, M2B and the first M2C clarity pass are implemented locally: build targeting uses tested normal math, placement failure reasons are deterministic in ghost/status feedback, active Assembly Space mismatch is visible, and orientation readouts are semantic for core/thrusters/wings/control surfaces/vector thrusters. Next: manual playtest and small wording/preset polish only if still needed.

## After that: Gate D - Device & Port Schema

Define stable endpoints as `{blockId, portId}` after the Workbench Foundation milestone. Keep configuration serializable, versioned and compiler-driven. Do not persist `bodyId`. Do not implement signal execution or ControlRuntime in Gate D.

## Later

- Gate E - deterministic control kernel and runtime commands by neutral IDs.
- VisualAssetRegistry, asset packs and Blockbench import workflow after the boundary is implemented deliberately.
- Broader content/gameplay only after Gate D/E contracts.

## Deferred blockers

Dynamic articulated fracture, atomic constrained-body rebase, transform gizmos, WebGL context recovery, low-end GPU support matrix, multiplayer and external mod loading remain separate milestones.

dynamic rigid-body split remains deferred until atomic constrained-body rebase and rollback are proven.
