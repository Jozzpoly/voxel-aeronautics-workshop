# AI Project Memory - Voxel Aeronautics Workshop

Current source of truth: **Workbench Foundation on stable Gate C**.

- `APP_VERSION=0.8.2-foundation.workbench-foundation`
- `RELEASE_ID=foundation-workbench-foundation`
- Blueprint v12, CompiledCraft V5, RuntimeAssemblyPlan V3.
- Clean main base for this milestone: `ddce6b4`.

`CraftModel` is the sole workshop source of truth. `CraftCompiler` is the only verified path to compiled runtime data. Structural, mechanical and future signal graphs remain separate. AssemblyBuilder is the runtime allocation boundary; Physics Port is strict and backend-neutral.

Assembly Spaces have durable IDs, parent-local canonical poses and explicit block/link/body/runtime ownership. Root-only craft remains backward compatible. `bodyId` is not persistent device identity; Gate D ports must use `{blockId, portId}`.

Workbench UI v5/v9 preference state now covers docked/floating panels plus Authoring UX camera controls. It supports docked/floating panels, side dock stacking, compact/full dock span modes, build/flight layout separation, the parts hotbar, the dockable flight mission panel, UI-only camera mode/follow strength and manual camera target offset. UI workspace/camera data must stay out of Blueprint saves.

`foundation.catalog` owns gameplay data. `game.module-visual-factory` and `game.scene-environment` remain procedural fallback visuals. Future Blockbench/imported content must go through a separate visual asset registry and external asset-pack workflow.

The release is offline-capable: Three r128, Cannon 0.6.2 and generated CSS are vendored. Fixed-step overload is measurable. Save recovery preserves the last valid backup. Hostile unknown import fields are projected away before migration.

Do not reintroduce silent numeric fallback, CDN runtime dependencies, whole-craft scans in per-body hot paths, `window.VAW_RUNTIME`, empty future frameworks, persistent `bodyId` references or asset data inside craft saves.

Current recovery delta: Authoring UX Milestone 1 is implemented in the local working package. It fixes flight runtime mass display after part loss, adds a launcher Flight Focus button using the existing focus path, lowers the bottom launcher below visible panels, adds UI-only camera modes (`static`, `follow-position`, `follow-body`), enables below-craft orbit and Shift+middle camera pan, and keeps `game.js` under the 2500-line architecture guard by extracting `game.camera-controller`.

Current M2A delta: Placement targeting now uses `game.build-targeting` for tested normal math. Voxel placement converts `hitObjectLocalNormal -> sceneNormal -> activeSpaceNormal -> gridNormal -> placementCell` before returning the old-compatible target object. Right-click removal and hinge endpoint selection still receive `target.root` and `target.block`; craft mutation and Blueprint schema were not changed. Final audit polish hardened `targetOk()` against accidental result-shape poisoning and added `tests/test_build_targeting.js` to `tests/run_all.py`; broader validation-runner synthetic timeout tests remain environment-sensitive.

Next recommended milestone: M2B deterministic placement validity reasons, then M2C orientation labels/presets after semantic audit. Do not start Gate D Device & Port Schema until Workbench placement/orientation clarity is stable.
