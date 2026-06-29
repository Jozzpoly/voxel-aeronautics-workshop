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
- Authoring UX Recovery Milestone 1 is present on `current_work`: runtime mass telemetry, launcher Flight Focus, panel-safe launcher z-order, camera modes, below-craft orbit and Shift+middle pan.
- Visual Asset Pack M4B is present on `current_work`: a validated glTF block visual can load as a renderer-only child of the stable VAW root/proxy, with procedural fallback preserved.
- Visual Asset Pack M4C/M4D is present on `current_work`: Studio is integrated under `tools/blockbench_import_studio/`, packs are installed through `assets/visual_packs/installed_visual_packs.json`, and the loader supports replacement coverage for every current Catalog block type.
- Visual Asset Pack M4E is present on `current_work`: imported glTF instances deep-clone renderer resources, failed model loads are retryable, `visualRoot` mounts a real subtree with full-scene fallback, a real Blockbench thruster fixture is installed for source-tree smoke, and Studio inference no longer silently defaults to `Thruster`.
- Visual Asset Pack M4F is present on `current_work`: one `local_working_visuals` pack supports repeated in-place block visual updates from Studio, and the game can reload renderer-only visual assets without restart.
- Visual Asset Pack M4G is present on `current_work`: imported hit proxies are render-invisible by default with a dev debug toggle, Studio can request same-origin game reload after install, and material policy supports `auto` plus per-material alpha overrides for mixed opaque/flame assets.

## Next: Placement and Orientation Clarity

M2A, M2B and the first M2C clarity pass are present on `current_work`: build targeting uses tested normal math, placement failure reasons are deterministic in ghost/status feedback, active Assembly Space mismatch is visible, and orientation readouts are semantic for core/thrusters/wings/control surfaces/vector thrusters. Next: manual playtest and small wording/preset polish only if still needed.

## Foundation Hardening Ladder

- M1 - Validation, CI, agent workflow and documentation authority. This is the active hardening track: bundled-Python validation trust, `current_work` checkpoint discipline, CI branch triggers and active-doc cleanup.
- M2 - Source layout and `src/game.js` pressure relief. Extract low-risk responsibilities only after M1 is green, with no gameplay or schema changes.
- M3 - Reliable browser/UI smoke. Add repeatable local-server and hit-testing smoke, reported separately from unit/runner/CI evidence.
- M4 - Visual authoring reliability. Prove one simple replacement workflow across current Catalog block types while keeping Visual Asset Pack V1 renderer-only.
- M5 - Content pipeline boundaries. Define maps, contracts, missions and content packs as separate schemas before adding broader content.
- M6 - Gate D readiness. Start Device & Port Schema only after M1-M5 are stable, using `{blockId, portId}` and not persistent `bodyId`.

## After that: Gate D - Device & Port Schema

Define stable endpoints as `{blockId, portId}` after the Workbench Foundation milestone. Keep configuration serializable, versioned and compiler-driven. Do not persist `bodyId`. Do not implement signal execution or ControlRuntime in Gate D.

## Later

- Gate E - deterministic control kernel and runtime commands by neutral IDs.
- User-facing visual pack manager, permanent multi-pack install UX, runtime animation semantics and polished multi-asset authoring workflow after the folder/index workflow and real-asset fidelity are proven.
- Broader content/gameplay only after Gate D/E contracts.

## Deferred blockers

Dynamic articulated fracture, atomic constrained-body rebase, transform gizmos, WebGL context recovery, low-end GPU support matrix, multiplayer and external mod loading remain separate milestones.

dynamic rigid-body split remains deferred until atomic constrained-body rebase and rollback are proven.
