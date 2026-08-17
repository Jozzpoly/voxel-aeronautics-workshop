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

Owner explicitly **did not accept the current quality**. There are many visible and behavioral problems, especially UI/readability/polish. Do not convert code presence or a passing test into a product-quality claim.

## Machine evidence

The `80c0ae4` product source passed broad recovery validation across core domain/compiler/runtime, Cannon physics, articulated and multi-space assembly, flight lifecycle, damage/debris, missions, visual asset loading/Studio integration and VectorThruster orientation probing.

P0 release/repository cleanup preserved deterministic source parity and LF/CRLF reproducibility.

Known tooling caveat: validation-runner timeout/process-family tests are nondeterministic across current Windows/Ubuntu CI even after release reproducibility itself passes. Keep this classified as `HARNESS/ENVIRONMENT` unless evidence ties it to product execution.

## P1 code-reality result

P1 is complete. Detailed current evidence: [`docs/CODE_REALITY_AUDIT.md`](docs/CODE_REALITY_AUDIT.md).

Key conclusions:

- Blueprint/CraftModel/compiler and multi-body Cannon runtime are substantial technical foundations.
- The workshop editor, mechanisms, UI information architecture and test/rebuild feedback loop are much less mature than those foundations.
- Engineering analysis contains a reproduced multi-space topology bug and does not model supported secondary-body thruster routing consistently with runtime.
- Sandbox return clears the very failure evidence needed for the project's experiment -> understand -> rebuild loop.
- Runtime motor/servo, copy-subgraph and other domain capabilities exist without corresponding player workflows.
- Device tuning/direct binding is absent beyond global input settings and placement-time ControlSurface axis/sign; `portId`, device runtime, signal graph, sensors/PID and `ControlRuntime` are absent from current `src/**`.
- Visual/Blockbench tooling is technically extensive but should not lead recovery while core product truth/feedback remains weak.

## P2-A result

P2-A Engineering Analysis Truth is complete on the recovery lane.

- weak-link/fuel-exposure analysis uses compiler-owned `rigidNeighborBlockIds`, fixing the reproduced transformed-Assembly-Space error;
- control metrics are explicitly scoped to `primary-body-local` authority;
- secondary-body Gyro no longer inflates manual authority;
- articulated analysis reports runtime pilot-routed secondary thrusters but does not invent joint-coupled whole-craft authority;
- mission readiness uses the same scope and stops presenting the partial articulated estimate as exact whole-craft control;
- the new executable engineering-analysis test reproduces the old boundary and protects the corrected behavior.

A broad disposable core-suite run passed after the repair with only the known nondeterministic `test_validation_runner.py` harness excluded. Current browser smoke still cannot provide rendered proof in this environment because app bootstrap does not complete through its Chromium/CDP path.

## P2-B result — Test Evidence Continuity

P2-B Test -> Workshop Feedback Continuity is complete on the recovery lane.

- one bounded top-level `lastTestResult` survives flight cleanup without entering Blueprint/CraftModel persistence;
- sandbox return captures the result before `setMode('BUILD')` destroys transient flight evidence;
- contract completion/failure uses the same evidence shape and keeps contract-only outcome data nested;
- `FlightIntegrity` records structured `firstFailureEvent` identity (`blockId`, type, body and reason) when the runtime knows it;
- the result keeps bounded lost block IDs, max impact, final load snapshot, fuel use and integrity;
- current game composition deliberately does not pretend to persist fixed-step scheduler health or provide a finished workshop diagnosis surface yet; P2-C consumes the preserved failed `blockId`/result to make the evidence actionable.

Executable tests cover destructive cleanup continuity, shared sandbox/contract capture, cleanup reset of structured failure identity and stable failed-block identity. Startup smoke still passes single-body, articulated and multi-space UI lifecycle on the disposable candidate. This does not constitute owner acceptance of a workshop diagnosis workflow, which does not exist yet.

## Architectural boundaries currently worth preserving

- `CraftModel` is workshop authoring authority.
- `CraftCompiler` is the path from authoring state to compiled runtime data.
- Blueprint/CraftModel data stays serializable and engine-neutral.
- structural, mechanical and future signal/control concerns remain separate.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and runtime `bodyId` are different identity domains.
- future persistent device endpoints should use stable authoring identity such as `{blockId, portId}`, never runtime `bodyId`.
- Visual Asset Pack / Blockbench data is renderer-facing and must not become gameplay authority.
- UI workspace/camera preferences and transient flight damage are not craft/Blueprint data.
- manual control remains first-class; future programming should be layered rather than mandatory.

## Current priority

P2-C is active: **Workshop Editing Fundamentals**.

1. Establish stable selected-part identity distinct from hover target and selected placement tool.
2. Surface the preserved last-test failed `blockId` through that selection/inspection path when the block still exists.
3. Allow a useful edit of an already placed part without delete/re-place.
4. Reuse existing CraftModel operations where they solve the workflow; do not add future-facing APIs first.
5. Keep Blueprint/CraftModel authority and history/undo semantics intact.

After P2-C: P2-D information architecture / visual polish.

There is **no active M4/M5/M6/Gate-D feature roadmap during recovery**. Those names belong to history unless current product needs justify them.

## Documentation authority

Read current docs in this order:

1. `README.md`
2. `AI_PROJECT_MEMORY.md`
3. `PROJECT_VISION.md`
4. `ARCHITECTURE.md`
5. `ROADMAP.md`
6. `AGENTS.md`
7. `docs/README.md`

`docs/CODE_REALITY_AUDIT.md` is current evidence supporting the summary above; it does not override `ROADMAP.md` or `PROJECT_VISION.md`.

Anything under `docs/history/` is non-authoritative historical evidence.
