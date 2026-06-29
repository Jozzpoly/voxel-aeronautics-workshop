# AI Project Memory - Voxel Aeronautics Workshop

Current source of truth: **Workbench Foundation on stable Gate C**.

- `APP_VERSION=0.8.2-foundation.workbench-foundation`
- `RELEASE_ID=foundation-workbench-foundation`
- Blueprint v12, CompiledCraft V5, RuntimeAssemblyPlan V3.
- Current checkpoint branch for foundation hardening: `current_work`.

`CraftModel` is the sole workshop source of truth. `CraftCompiler` is the only verified path to compiled runtime data. Structural, mechanical and future signal graphs remain separate. AssemblyBuilder is the runtime allocation boundary; Physics Port is strict and backend-neutral.

Assembly Spaces have durable IDs, parent-local canonical poses and explicit block/link/body/runtime ownership. Root-only craft remains backward compatible. `bodyId` is not persistent device identity; Gate D ports must use `{blockId, portId}`.

Workbench UI v5/v9 preference state now covers docked/floating panels plus Authoring UX camera controls. It supports docked/floating panels, side dock stacking, compact/full dock span modes, build/flight layout separation, the parts hotbar, the dockable flight mission panel, UI-only camera mode/follow strength and manual camera target offset. UI workspace/camera data must stay out of Blueprint saves.

`foundation.catalog` owns gameplay data. `game.module-visual-factory` and `game.scene-environment` remain procedural fallback visuals. Blockbench/imported content must go through `game.visual-asset-registry`, `game.visual-asset-loader` and external Visual Asset Pack V1 manifests listed by the renderer-only pack index.

Blockbench Import Studio is integrated as a repository tool at `tools/blockbench_import_studio/`. It is an authoring/export surface, not a gameplay authority and not game runtime code.

M4E visual hardening is local: `game.visual-asset-loader` deep-clones imported renderer resources per instance, evicts rejected glTF loads for retry, mounts `bindings.nodes.visualRoot` as the imported subtree when present, applies Visual Asset Pack axis/unit metadata only to the imported child transform, and keeps procedural fallback on every failure. `assets/visual_packs/real_blockbench_thruster_pack/` is the current real glTF source-tree smoke fixture.

M4F fast iteration uses one default working pack, `assets/visual_packs/local_working_visuals/`. Studio's `Install / Update Block Visual` updates only the chosen block folder in that pack through `tools/serve.py`; the game reloads renderer-only visuals via `RELOAD VISUALS` or `Shift+V`. Do not create a new pack for every art polish pass.

M4G visual polish keeps the VAW hit proxy raycastable but render-invisible by default, with `VISUAL DEBUG` only for diagnostics. Studio can request a same-origin game reload after install; the game-side dev controls must not keep Node smoke tests alive through a long-lived `BroadcastChannel`. Use `materialPolicy.alpha: "auto"` plus `materialOverrides` for mixed assets; avoid global `blend` on whole blocks because it can make opaque nozzles/cases sort as transparent under camera angles. Overrides match glTF material names; duplicate names should warn and apply to all matches.

Known visual import limitation: the current reimported thruster/checker test asset lost its original in-game look after being extracted and reimported. Do not spend M4C/M4E effort repairing that test asset. Treat it as a fixture proving loader/fallback boundaries only; a newly designed Studio asset must be checked against the game for visual fidelity.

The release is offline-capable: Three r128, Cannon 0.6.2 and generated CSS are vendored. Fixed-step overload is measurable. Save recovery preserves the last valid backup. Hostile unknown import fields are projected away before migration.

Do not reintroduce silent numeric fallback, CDN runtime dependencies, whole-craft scans in per-body hot paths, `window.VAW_RUNTIME`, empty future frameworks, persistent `bodyId` references or asset data inside craft saves.

Current recovery delta: Authoring UX Milestone 1 is present on `current_work`. It fixes flight runtime mass display after part loss, adds a launcher Flight Focus button using the existing focus path, lowers the bottom launcher below visible panels, adds UI-only camera modes (`static`, `follow-position`, `follow-body`), enables below-craft orbit and Shift+middle camera pan, and keeps `game.js` under the 2500-line architecture guard by extracting `game.camera-controller`.

Current M2A delta: Placement targeting now uses `game.build-targeting` for tested normal math. Voxel placement converts `hitObjectLocalNormal -> sceneNormal -> activeSpaceNormal -> gridNormal -> placementCell` before returning the old-compatible target object. Right-click removal and hinge endpoint selection still receive `target.root` and `target.block`; craft mutation and Blueprint schema were not changed. Final audit polish hardened `targetOk()` against accidental result-shape poisoning and added `tests/test_build_targeting.js` to `tests/run_all.py`; broader validation-runner synthetic timeout tests remain environment-sensitive.

Current M2B/M2C delta: Placement validation now returns deterministic UI feedback instead of a bare boolean. Ghost adjacency and click-status messages distinguish no-hit, no-face, invalid-normal, wrong-assembly-space, occupied, block-limit, invalid-block, orphan-block-assembly-space, empty-plan and future symmetry-collision. Orientation readouts now use block-specific semantics for Core forward/up, Thruster thrust direction, Wing chord/lift normal, ControlSurface chord/lift normal plus mixer axis/sign, and VectorThruster thrust/gimbal normal. Telemetry now labels runtime mass as Active mass to avoid implying whole detached-craft mass.

Current foundation hardening delta: M1 is published on `current_work`; M2A moved visual asset composition wiring behind `game.visual-asset-composition`; M2B adds a direct composition test for bootstrap, dev-control loader wiring, procedural factory exposure and Node BroadcastChannel safety; M2C moves power/HUD readouts behind `game.power-control-readouts` while keeping `src/game.js` as final composition entrypoint. M3A/M3B adds `npm run browser:smoke` as separate target-platform evidence with stage-aware JSON diagnostics; missing browser/CDP/localhost support is `ENVIRONMENT`, real UI/runtime failures are `PRODUCT`, and local Chrome currently reaches a PASS path through help-modal start, contract hit-testing, starter craft load, Flight Focus and launch.
