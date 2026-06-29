# Voxel Aeronautics Workshop

**Workbench Foundation - Gate C Stable Base**

Desktop voxel engineering sandbox where the player builds, tests and pilots their own machine. Gate C is the stable gameplay base: Blueprint v12 Assembly Spaces, deterministic multi-body compilation, articulated real-Cannon flight, strict runtime ownership and offline-capable releases.

The current milestone adds the first Workbench UI foundation: dockable/floating panels, side dock stacking, separate build and flight workspace layouts, a full-span bottom parts hotbar with a compact option, a dockable flight mission panel, and refreshed documentation authority. Gameplay, craft saves, physics/runtime contracts and current procedural visuals remain compatible.

M4G keeps visual iteration fast without creating a new pack for every polish pass. Studio installs one selected block visual into the renderer-only working pack at `assets/visual_packs/local_working_visuals/`, can request in-game visual reload, and imported glTF instances remain child visuals with cloned renderer resources, `visualRoot` subtree mounting, material policy, transform controls and procedural fallback. The stable hit proxy is render-invisible by default and can be shown only through visual debug. Blueprint, CraftModel, `foundation.catalog`, CraftCompiler, physics and control semantics remain authoritative.

## Run

```bash
npm run serve
```

Open the printed local address. Runtime libraries and generated UI CSS are vendored; the normal and single-file builds do not require CDN scripts.

## Validate and build

```bash
npm run check:css
npm run test
npm run build
npm run verify-release
```

Studio can be tested and served from the same repository:

```bash
npm run studio:test
npm run studio:serve
```

`npm run studio:serve` starts the integrated VAW development server and opens Studio at `/tools/blockbench_import_studio/index.html`, with the local install endpoint enabled. Do not use the standalone Studio static server for daily install/update work unless the integrated VAW server is also running.

## Current contracts

- Blueprint v12: `assemblySpaces[] + blocks[] + mechanicalLinks[]`.
- CompiledCraft V5: deterministic structural, rigid, mechanical and ownership graphs.
- RuntimeAssemblyPlan V3: backend-neutral body/space/part/collider/constraint indexes.
- Workbench UI v4: user preferences only, with build/flight layout separation, side dock stacking, compact/full dock span modes and dockable mission information.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and `bodyId` are separate identity domains.
- Root-only craft remains the zero-configuration default.
- `foundation.catalog` owns gameplay block data; procedural Three visuals remain the fallback renderer.
- Visual Asset Pack V1 is renderer-only. Missing, invalid or unloadable packs must leave procedural fallback visuals active; imported glTF content is never allowed to replace the stable VAW root or hit proxy.
- Daily art iteration uses `tools/blockbench_import_studio/` -> `Install / Update Block Visual` -> automatic same-origin reload when possible, with in-game `RELOAD VISUALS` / `Shift+V` as fallback. This updates `local_working_visuals` in place instead of creating a new pack per edit.
- Gate D - Device & Port Schema - is queued behind Workbench UI and documentation preparation.

Agents should start with [`README_FOR_AGENTS.md`](README_FOR_AGENTS.md), then read [`docs/README.md`](docs/README.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/blockbench_import_studio.md`](docs/blockbench_import_studio.md), [`docs/visual_asset_pack_v1.md`](docs/visual_asset_pack_v1.md), [`docs/adr/0042-workbench-ui-layout.md`](docs/adr/0042-workbench-ui-layout.md) and [`docs/adr/0043-visual-asset-boundary.md`](docs/adr/0043-visual-asset-boundary.md) before foundation changes.
