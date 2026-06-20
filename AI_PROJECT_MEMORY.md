# AI Project Memory — Voxel Aeronautics Workshop

Current source of truth: **Foundation Gate C Future Hardening**.

- `APP_VERSION=0.8.1-foundation.gate-c-hardening`
- `RELEASE_ID=foundation-gate-c-future-hardening`
- Blueprint v12, CompiledCraft V5, RuntimeAssemblyPlan V3.
- True remote base for this local milestone: `fa125064426c8a77586864035dc8dbad4af6b44b`.

`CraftModel` is the sole workshop source of truth. `CraftCompiler` is the only verified path to compiled runtime data. Structural, mechanical and future signal graphs remain separate. AssemblyBuilder is the runtime allocation boundary; Physics Port is strict and backend-neutral.

Assembly Spaces have durable IDs, parent-local canonical poses and explicit block/link/body/runtime ownership. Root-only craft remains backward compatible. `bodyId` is not persistent device identity; Gate D ports must use `{blockId, portId}`.

The release is offline-capable: Three r128, Cannon 0.6.2 and generated CSS are vendored. Fixed-step overload is measurable. Save recovery preserves the last valid backup. Hostile unknown import fields are projected away before migration.

Do not reintroduce silent numeric fallback, CDN runtime dependencies, whole-craft scans in per-body hot paths, `window.VAW_RUNTIME`, empty future frameworks or persistent `bodyId` references.

Next recommended milestone: Gate D Device & Port Schema. Read `FUTURE_READINESS_REVIEW.md`, ADR 0041 and active architecture before implementation.
