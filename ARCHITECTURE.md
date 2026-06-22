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

Future model, texture and animation packs must resolve through a separate visual asset registry. Missing visual assets fall back to procedural visuals. Asset packs are not Blueprint payloads and are not loaded from localStorage.

## Runtime health

Runtime plans carry exact indexes for block/body/space/part/collider/constraint lookup. Physics inputs and sampled outputs are finite and normalized or fail explicitly. Fixed-step scheduling exposes overload metrics. Hot paths use owner indexes rather than repeatedly scanning the whole craft.

## Distribution boundary

Three r128, Cannon 0.6.2 and generated UI CSS are vendored and recorded in third-party notices. Release verification hashes the exact canonical bytes. Runtime startup has no CDN dependency.

## Safety boundaries

Connected-body rebase and dynamic articulated fracture remain guarded. Future ports must use `{blockId, portId}` and resolve runtime bodies rather than persisting `bodyId`. Gate D must extract a real responsibility from the full-size composition shell after Workbench UI and documentation preparation.
