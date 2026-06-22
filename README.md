# Voxel Aeronautics Workshop

**Workbench Foundation - Gate C Stable Base**

Desktop voxel engineering sandbox where the player builds, tests and pilots their own machine. Gate C is the stable gameplay base: Blueprint v12 Assembly Spaces, deterministic multi-body compilation, articulated real-Cannon flight, strict runtime ownership and offline-capable releases.

The current milestone adds the first Workbench UI foundation: dockable/floating panels, side dock stacking, separate build and flight workspace layouts, a full-span bottom parts hotbar with a compact option, a dockable flight mission panel, and refreshed documentation authority. Gameplay, craft saves, physics/runtime contracts and current procedural visuals remain compatible.

## Run

```bash
python tools/serve.py
```

Open the printed local address. Runtime libraries and generated UI CSS are vendored; the normal and single-file builds do not require CDN scripts.

## Validate and build

```bash
npm run check:css
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

## Current contracts

- Blueprint v12: `assemblySpaces[] + blocks[] + mechanicalLinks[]`.
- CompiledCraft V5: deterministic structural, rigid, mechanical and ownership graphs.
- RuntimeAssemblyPlan V3: backend-neutral body/space/part/collider/constraint indexes.
- Workbench UI v4: user preferences only, with build/flight layout separation, side dock stacking, compact/full dock span modes and dockable mission information.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and `bodyId` are separate identity domains.
- Root-only craft remains the zero-configuration default.
- `foundation.catalog` owns gameplay block data; procedural Three visuals remain the fallback renderer.
- Gate D - Device & Port Schema - is queued behind Workbench UI and documentation preparation.

Read [`docs/README.md`](docs/README.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/adr/0042-workbench-ui-layout.md`](docs/adr/0042-workbench-ui-layout.md) and [`docs/adr/0043-visual-asset-boundary.md`](docs/adr/0043-visual-asset-boundary.md) before foundation changes.
