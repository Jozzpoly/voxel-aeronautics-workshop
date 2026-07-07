# Roadmap after Gate C

Active detailed rebase: `docs/ROADMAP_REBASE_2026-07-01.md`.

`ROADMAP_NEXT.md` is the short active route map. The 2026-07-01 rebase is the detailed planning authority for the next long-term work order: M4L Visual Truth, M5 Voxel Fit, M6 Mechanical V2, M7 Device Tuning and M8 Signal/Control Runtime. Future roadmap documents must explicitly supersede that rebase instead of adding competing active plans.

## Closed

- Gate B - deterministic rigid islands and mechanical graph.
- Gate C - durable Assembly Spaces, ownership, migration, runtime presentation and minimal authoring.
- Future-readiness hardening - strict import/physics boundaries, offline dependencies, fixed-step health, indexed hot paths and persistence recovery.
- Visual authoring M4L - Visual Truth and VectorThruster proof. Evidence: `m4l-101` shared renderer profiles (`STUDIO_PREVIEW_PROFILE`, `GAME_DEFAULT_PROFILE`, `GAME_STUDIO_PARITY_PROFILE`); `m4l-102` game diagnostic render mode; `m4l-103` Studio capture harness; `m4l-104` unified parity orchestrator (`npm run parity:capture`); `m4l-105` root-cause classification `environment-policy` (`docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md`); `m4l-106a` game environment policy fix; `m4l-107` Studio duplicate-material diagnostics. Final render capture: **5/5** blocks within thresholds (`blocksWithinThresholds: 5` in `.agent-validation/m4l-capture/visual_parity_render_report.json`); Balloon SSIM **0.963**, luminance delta **−0.0102**. VectorThruster 24-orientation probe remains **synthetic-only** until M4LC `m4lc-201` wires runtime integration.

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
- Visual Asset Pack M4H/M4I-A is present on `current_work`: Studio rig-state storage no longer carries optional rig aliases or fire split state across block types, `Clear rig bindings` commits optional aliases as `null`, and visual-pack audit fixtures cover current Catalog block types.
- Visual Asset Pack M4I-B is present on `current_work`: local visual-pack audit remains read-only by default and can produce dry-run cleanup suggestions for protected-art issues such as inherited Balloon rig aliases.
- Visual Asset Pack M4J is present on `current_work`: VectorThruster can declare an optional renderer-only rig profile for `gimbalA`, `gimbalB` and roll preview axes; Studio, validators, audit tooling and runtime adapter understand the profile while keeping Blueprint/CraftModel/physics/control semantics untouched.
- Visual authoring M4K is the active polish lane: clean-candidate validation protects `SOURCE_MANIFEST.json` from dirty local visual WIP, Balloon cleanup remains owner-approved only, and real VectorThruster asset proof stays renderer-only.
- Mission Map / Terrain Authoring expansion is present on `current_work`: the proving range is materially larger, fog is reduced for long-distance navigation, all mission pads and collidable landmarks are data-driven through `TEST_RANGE`, terrain appearance is controlled through procedural material/patch/strip data, Studio Terrain Authoring V1 can edit/save the local renderer-only terrain preset, and `npm run mission:validate` checks pad/gate clearance plus local preset validity.
- Roadmap Rebase 2026-07-01 is active: owner feedback about visual darkness, effects, block gaps, VectorThruster direction, primitive hinge behavior, servo/mechanism ambitions and future block binding/programming is captured as product planning input in `docs/ROADMAP_REBASE_2026-07-01.md`.

## Next: M5 - Voxel Fit And Renderer Optimization Contract

- Remove or replace the hidden `0.96` visual shrink as an explicit render policy.
- Prove hit proxies, placement ghost readability, imported visuals and selection still work with flush blocks.
- Define which block categories can participate in future greedy meshing; functional, animated, damaged and imported blocks stay separate until proven safe.
- Add a small render-stat or benchmark baseline before claiming optimization.

## Then: M6 - Mechanical V2 Design Spike

- Treat the current hinge as a minimal Gate C proof, not the final mechanism model.
- Write a Mechanical V2 ADR/design doc before expanding persistent schema.
- Design explicit joint frames, pivots, axes, limits, motor/servo modes and multi-axis joint capability.
- Spike solver support and failure modes before accepting UI or save-schema changes.
- Keep Device/Port Schema, signal graph and ControlRuntime out of the joint model.

## Then: M7/M8 - Device Tuning, Binding And Control Runtime

- Start with per-block tuneable parameters and direct input/action binding.
- Use stable `{blockId, portId}` endpoint identity; never persist runtime `bodyId`.
- Add groups, gain, invert, trim and clamp before visual graph programming.
- Add deterministic signal graph and ControlRuntime only after direct binding is useful and testable.

## Foundation Hardening Ladder

- M1 - Validation, CI, agent workflow and documentation authority is present on `current_work`: bundled-Python validation trust, `current_work` checkpoint discipline, CI branch triggers and active-doc cleanup.
- M2A-M2C - Source layout hardening is present on `current_work`: visual asset composition wiring moved behind `game.visual-asset-composition`, direct composition tests cover that seam, and power/HUD readouts moved behind `game.power-control-readouts`. `src/game.js` remains the final composition entrypoint and stays below the architecture guard without gameplay, physics, schema or visual-runtime semantic changes.
- M3A-M3B - Reliable browser/UI smoke is present as `npm run browser:smoke`: it starts a local static server, probes for a real Chromium/Chrome/Edge CDP target, enters the normal help-modal start path, checks starter-craft/UI/Flight Focus/contract-panel hit-testing, and reports stage-aware `PASS`/`ENVIRONMENT`/`PRODUCT` evidence outside the default core gate. M3B also tightens `game.js` architecture guards and expands seam tests for visual composition plus power/HUD readouts.
- M3C - Audit ledger cleanup is present on `current_work`: Visual Asset Pack V1 has one canonical contract doc, stale workflow/research strings are corrected, root readiness evidence moved to history, new `window.VAW_*` globals are guarded, checkpoint/CI policy is captured in ADR 0044, and `.agent-validation/` pruning is dry-run-first.
- M4 - Visual authoring reliability. M4K protects provenance and local visual WIP; M4L visual truth is closed (render parity 5/5, `environment-policy` fix). M4LC remains for runtime VectorThruster proof (`m4lc-201`); synthetic 24-orientation probe is not in-game parity until that lane lands.
- M5 - Voxel Fit and renderer optimization contract. Remove hidden visual gaps deliberately, preserve hit testing and prepare greedy meshing boundaries.
- M6 - Mechanical V2 design spike. Redesign hinge/joint capability before schema growth.
- M7 - Device tuning and direct binding. Introduce stable device endpoints and simple user-facing control without a broad programming system.
- M8 - Signal graph and deterministic ControlRuntime. Add programming only after device tuning and direct binding are usable.

## Gate D Boundary - Device & Port Schema

Define stable endpoints as `{blockId, portId}` only after M4L/M5/M6 have removed the current visual and mechanical uncertainty. Keep configuration serializable, versioned and compiler-driven. Do not persist `bodyId`. Do not implement signal execution or ControlRuntime in the schema milestone.

## Later

- Content pipeline boundaries. Define maps, contracts, missions and content packs as separate schemas before adding broader content.
- Mission map polish. Keep the `docs/mission_map_terrain_authoring.md` workflow Studio-driven for renderer-only terrain appearance and source-driven for pads/contracts/obstacles, then add manual flight balance passes for par times, reward pacing and route readability.
- Gate E - deterministic control kernel and runtime commands by neutral IDs, if not already covered by a later accepted M8/Gate E plan.
- User-facing visual pack manager, permanent multi-pack install UX, runtime animation semantics and polished multi-asset authoring workflow after the folder/index workflow and real-asset fidelity are proven.
- Broader content/gameplay only after Gate D/E contracts.

## Deferred blockers

Dynamic articulated fracture, atomic constrained-body rebase, transform gizmos, WebGL context recovery, low-end GPU support matrix, multiplayer and external mod loading remain separate milestones.

dynamic rigid-body split remains deferred until atomic constrained-body rebase and rollback are proven.
