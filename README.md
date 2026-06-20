# Voxel Aeronautics Workshop

**Foundation Gate C Hardening — Assembly Spaces and Future Readiness**

Desktop voxel engineering sandbox where the player builds, tests and pilots their own machine. The current foundation provides Blueprint v12 Assembly Spaces, deterministic multi-body compilation, articulated real-Cannon flight, strict runtime ownership and offline-capable releases.

## Run

```bash
python tools/serve.py
```

Open the printed local address. Runtime libraries and generated UI CSS are vendored; the normal and single-file builds do not require CDN scripts.

## Validate and build

```bash
npm run check:css
python tools/validate_fast.py
python tools/validate_full.py
python tools/build_release.py
python tools/verify_release.py
```

## Current contracts

- Blueprint v12: `assemblySpaces[] + blocks[] + mechanicalLinks[]`.
- CompiledCraft V5: deterministic structural, rigid, mechanical and ownership graphs.
- RuntimeAssemblyPlan V3: backend-neutral body/space/part/collider/constraint indexes.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and `bodyId` are separate identity domains.
- Root-only craft remains the zero-configuration default.
- Gate D — Device & Port Schema — is next; signal graph and ControlRuntime remain deferred.

Read [`docs/README.md`](docs/README.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`FUTURE_READINESS_REVIEW.md`](FUTURE_READINESS_REVIEW.md) and [`docs/adr/0041-assembly-spaces-and-spatial-ownership.md`](docs/adr/0041-assembly-spaces-and-spatial-ownership.md) before foundation changes.
