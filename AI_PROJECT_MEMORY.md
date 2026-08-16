# AI Project Memory — Voxel Aeronautics Workshop

Last recovery grounding: **2026-08-16**.

This file is intentionally short. It records current truth, not project history.

## Repository state

- Repository: `Jozzpoly/voxel-aeronautics-workshop`.
- Active recovery lane: `recovery/playable-truth`.
- Recovery lineage started from `80c0ae4aced1dd695af217cdeadea9025c6305c8` (`current_work` pre-agent-mesh snapshot).
- `main` is not the current recovery authority until an explicit promotion decision is made.
- Later branches, including `VAW_GRoK` and mobile branches, are **salvage sources only**. Never merge them wholesale or treat their documentation as current truth.
- Historical agent-mesh material is not an active operating model for VAW.

Always resolve the live remote branch head before changing the repository. Do not hardcode this document's commit SHA as the next base.

## Manual product truth

Owner test on 2026-08-16 proved only the following about the exact `80c0ae4` runtime:

- Workbench loads and renders;
- an existing craft is visible;
- `Launch Sandbox Test` enters the test/flight scene;
- physics/runtime starts;
- telemetry changes during the test.

Owner explicitly **did not accept the current quality**. There are many visible and behavioral problems, especially UI/readability/polish, and recovery is intentionally not attempting to fix them all at once.

Not currently proven as good product behavior:

- the complete manual build experience;
- clarity and ergonomics of controls;
- mechanical authoring quality;
- usefulness/readability of telemetry and diagnostics;
- save/load/rebuild flow as an enjoyable user loop;
- visual quality or scene readability;
- whether all roadmap-described features are meaningfully usable rather than merely present in code.

Do not convert code presence or a passing test into a product-quality claim.

## Machine evidence

The `80c0ae4` foundation passed broad local recovery validation across core domain/compiler/runtime, Cannon physics, articulated and multi-space assembly, flight lifecycle, damage/debris, missions, visual asset loading/Studio integration and VectorThruster 24-orientation probing.

Known recovery caveats:

- validation-runner timeout/process-family tests are environment-sensitive in the current Linux/container: the process-family case hung during H0 and a later `resume-after-timeout` run was timing-flaky; classify this as `HARNESS/ENVIRONMENT` until target-environment evidence says otherwise;
- the historical tracked-manifest ordering problem was removed during recovery: `SOURCE_MANIFEST.json` is now generated in `dist/` and embedded in release ZIPs rather than tracked as authored source;
- browser automation in the recovery environment could not provide product proof because localhost and later WebGL/EGL were blocked by environment policy.

These caveats must remain separate from actual product failures.

## Architectural boundaries currently worth preserving

- `CraftModel` is workshop authoring authority.
- `CraftCompiler` is the path from authoring state to compiled runtime data.
- Blueprint/CraftModel data stays serializable and engine-neutral.
- structural, mechanical and future signal/control concerns remain separate.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and runtime `bodyId` are different identity domains.
- future persistent device endpoints should use stable authoring identity such as `{blockId, portId}`, never runtime `bodyId`.
- Visual Asset Pack / Blockbench data is renderer-facing and must not become gameplay authority.
- UI workspace/camera preferences are not craft/Blueprint data.
- manual control remains first-class; future programming should be layered rather than mandatory.

These are architecture constraints, not claims that every surrounding feature is mature.

## Current priority

Repository/documentation convergence is complete on the recovery lane. The next phase is the code-reality and technical-debt audit.

1. Compare claimed capability with actual implementation and manual behavior.
2. Classify major surfaces as `PROVEN`, `PARTIAL`, `ROUGH`, `STUB/CLAIM` or `ABSENT`.
3. Identify architectural debt, misleading synthetic coverage, rough/stub implementations and missing product paths.
4. Only after that choose product repairs and selective salvage.

There is **no active M4/M5/M6/Gate-D feature roadmap during recovery**. Those names belong to history unless consciously reintroduced after the audit.

## Documentation authority

Read current docs in this order:

1. `README.md`
2. `AI_PROJECT_MEMORY.md`
3. `PROJECT_VISION.md`
4. `ARCHITECTURE.md`
5. `ROADMAP.md`
6. `AGENTS.md`
7. `docs/README.md`

Anything under `docs/history/` is non-authoritative historical evidence. It can explain how the project got here, but it cannot override live source, current manual evidence or the files above.
