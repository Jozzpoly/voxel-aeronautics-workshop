# Voxel Aeronautics Workshop - Architecture

Current milestone: **Workbench Foundation on stable Gate C**.

```text
Blueprint v12 / CraftModel
  assemblySpaces + blocks + mechanicalLinks
        |
CraftCompiler
  structural -> mechanical authoring -> rigid islands -> mechanical graph
        |
CompiledCraft V5
        |
RuntimeAssemblyPlan V3
        |
FlightSession -> AssemblyBuilder -> Physics Port -> Cannon/headless backend
```

Pure foundation/compiler modules contain no DOM, Three or Cannon. Blueprint contains serializable authoring data only. AssemblyBuilder is the runtime allocation boundary. FlightSession owns start/stop/retry and transient presentation ownership. `window.VAW_RUNTIME` remains forbidden.

## Workbench UI

`foundation.ui-workspace` owns personal UI layout preferences. Version 4 supports docked/floating panels, side dock stacking, compact/full dock span modes, build and flight layout separation, presets, the `parts` hotbar panel and the dockable flight `mission` panel. `game.workspace-controller` applies that state to DOM panels.

Workbench state is not gameplay data. It is stored with UI preferences and must not be written into Blueprint saves.

## Identity and coordinates

`assemblySpaceId` is durable spatial identity. `blockId` and `mechanicalLinkId` are durable authoring identities. `bodyId` is deterministic compiled identity and may not persist into future device/signal schemas.

A block's grid coordinates are local to its Assembly Space. Runtime world pose is spawn x space chain x body-in-space pose x body/block-local pose. Space hierarchy indexes and root poses are canonicalized once.

## Visual assets

`foundation.catalog` owns gameplay block data such as mass, force, fuel, durability, drag and descriptions. `game.module-visual-factory` and `game.scene-environment` provide procedural Three.js fallback visuals.

Model, texture and animation packs resolve through `game.visual-asset-registry` and `game.visual-asset-loader`. Missing, invalid or unloadable visual assets fall back to procedural visuals. Loader failures are non-fatal and rejected model loads are retryable. Asset packs are not Blueprint payloads and are not loaded from localStorage.

Blockbench Import Studio lives under `tools/blockbench_import_studio/` as an authoring/export tool. The game runtime does not import Studio code. Studio output enters the renderer only through validated `VAW_VISUAL_ASSET_PACK_V1` manifests listed by `assets/visual_packs/installed_visual_packs.json`. M4F/M4G fast iteration uses the first indexed pack, `assets/visual_packs/local_working_visuals/`, updates one block visual in place through the local development server, and can request same-origin renderer reload after install.

Imported glTF content is mounted under the stable VAW visual root from `game.module-visual-factory`. M4G keeps `vawHitProxy` raycastable but render-invisible by default, with a debug toggle for diagnostics. M4F/M4G mount the manifest `bindings.nodes.visualRoot` subtree when present, deep-clone renderer resources per imported instance, and apply `unitMeters`, axis metadata, optional transform and material policy only to the imported child. Material policy supports `auto` plus per-material alpha overrides for mixed opaque/flame assets. It must never replace `root.userData.isVoxelRoot`, `vawHitProxy`, hit-testing, damage/debris ownership, physics bodies or flight lifecycle.

## Runtime health

Runtime plans carry exact indexes for block/body/space/part/collider/constraint lookup. Physics inputs and sampled outputs are finite and normalized or fail explicitly. Fixed-step scheduling exposes overload metrics. Hot paths use owner indexes rather than repeatedly scanning the whole craft.

## Distribution boundary

Three r128, Cannon 0.6.2 and generated UI CSS are vendored and recorded in third-party notices. Release verification hashes the exact canonical bytes. Runtime startup has no CDN dependency.

## Safety boundaries

Connected-body rebase and dynamic articulated fracture remain guarded. Future ports must use `{blockId, portId}` and resolve runtime bodies rather than persisting `bodyId`. Gate D must extract a real responsibility from the full-size composition shell after Workbench UI and documentation preparation.
