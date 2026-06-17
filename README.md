# Voxel Aeronautics Workshop

**Foundation Phase 1D.4A — Mechanical Platform Convergence**

Desktop voxel engineering sandbox where the player builds, programs, tests and pilots their own machine. This release closes Gate B with Blueprint v11 mechanical links, deterministic rigid islands, per-body coordinate frames and a normal real-Cannon articulated-flight path.

## Run

Open `index.html` through a local server, for example:

```bash
python tools/serve.py
```

Then open the printed local address. The generated one-file release in `dist/` can also be opened directly when network access to the external Three.js/Cannon.js libraries is available.

## Validate and build

```bash
python tools/validate_fast.py
python tools/validate_full.py
```

Use targeted tests while editing. Run FULL once on a frozen release-sensitive candidate.

## Current contracts

- Blueprint v11: `blocks[] + mechanicalLinks[]`.
- CompiledCraft V4: pure structural, rigid-island and mechanical graphs.
- RuntimeAssemblyPlan V2: explicit `assemblyPosition`, `bodyLocalPosition` and `assemblyPose`.
- `mechanicalLinkId` maps 1:1 to runtime `constraintId`.
- Connected-body recenter is intentionally blocked until atomic constraint rebasing is proven.
- Gate C — Assembly Spaces / Sublevels — is next; Device/Port Schema and ControlRuntime remain deferred.

## Documentation

Start with [`docs/README.md`](docs/README.md). It classifies active product truth, workflow contracts, accepted ADRs, current supporting evidence, recovery evidence and historical reports.
