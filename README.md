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
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

## Current contracts

- Blueprint v11: `blocks[] + mechanicalLinks[]`.
- CompiledCraft V4: pure structural, rigid-island and mechanical graphs.
- RuntimeAssemblyPlan V2: explicit `assemblyPosition`, `bodyLocalPosition` and `assemblyPose`.
- `mechanicalLinkId` maps 1:1 to runtime `constraintId`.
- Connected-body recenter is intentionally blocked until atomic constraint rebasing is proven.

## Documentation

Start with `PROJECT_VISION.md`, `AI_PROJECT_MEMORY.md`, `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `FOUNDATION_READINESS_REVIEW.md`, `PROGRAMMABLE_MACHINE_RESEARCH.md` and `PHASE_1D4A_REPORT.md`. Decisions for this phase are ADR 0033–0040.
