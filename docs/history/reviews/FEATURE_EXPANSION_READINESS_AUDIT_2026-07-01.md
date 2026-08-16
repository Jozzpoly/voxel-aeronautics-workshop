# Feature Expansion Readiness Audit - 2026-07-01

Status: current readiness evidence
Scope: current `current_work` checkout, after the 2026-07-01 roadmap rebase
Authority: evidence and risk classification. This document does not override source, tests, accepted ADRs or `docs/ROADMAP_REBASE_2026-07-01.md`.

## Verdict

VAW is not ready for one broad feature-expansion push that starts filling every roadmap lane at once.

VAW is ready for staged expansion if the next work follows the rebase order:

1. M4L - Visual Truth and VectorThruster proof.
2. M5 - Voxel Fit and renderer optimization contract.
3. M6 - Mechanical V2 design spike.
4. M7 - Device tuning and direct binding.
5. M8 - Signal graph and deterministic ControlRuntime.

The project has a strong enough foundation to continue: source-of-truth boundaries are documented, fast validation passes, Studio/visual tests pass, browser smoke passes, and active agent documentation now routes future work through the roadmap rebase.

The project is not yet safe for broad feature filling because several high-coupling areas still have weak proof:

- visual fidelity between Studio and game has a static parity baseline and sRGB output fix, but still needs a rendered lighting/fog/shadow capture;
- VectorThruster visual direction is measured against actual force direction across 24 orientations and now passes for runtime-default plus local VectorThruster profiles;
- local Balloon inherited thruster bindings were removed by owner-approved minimal cleanup, and the remaining visible darkness is classified as a shared imported-visual renderer/preview mismatch rather than a Balloon-only asset problem;
- block gaps are caused by hidden renderer shrink and need an explicit Voxel Fit contract before greedy meshing;
- hinge/mechanics are still minimal and need Mechanical V2 design before schema growth;
- device tuning and programming need a ladder, not a broad Gate D/E jump.

## Current State Evidence

Start gate evidence:

```text
git status --short --branch
```

At audit time `HEAD == origin/current_work == 914eb88d9ad70831ccc5c800bfb68c4330d78dcf`; there are no local commits waiting to push. The worktree has local documentation changes and local visual-pack changes. The visual-pack files are:

```text
assets/visual_packs/installed_visual_packs.json
assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json
```

These local visual-pack changes are not disposable cache. The owner-approved cleanup in this pass is limited to the Balloon `flame` and `gimbalAssembly` bindings; do not broaden this into model, transform, material or unrelated asset cleanup without a separate proof.

Validation evidence gathered:

```text
npm.cmd run validate:fast
npm.cmd run validate:full
npm.cmd run test
npm.cmd run visual:test
npm.cmd run studio:test
npm.cmd run browser:smoke
npm.cmd run probe:vector-thruster:summary
npm.cmd run probe:vector-thruster
npm.cmd run probe:vector-thruster:report
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
node tools/run_with_python_env.js python tests/test_documentation_contract.py
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
git diff --check
```

Results:

- `validate:fast`: PASS.
  - artifact root: `.agent-validation/fast-20260701T141244.692937Z-19344`
  - stages passed: static-check, foundation, gate-b-compilers, gate-c-hardening, audit-regressions, validation-runner.
- `validate:full`: PASS.
  - artifact root: `.agent-validation/full-20260701T141401.122809Z-22396`
  - stages passed: core-suite, release-build, release-verify.
- `npm test`: PASS after regenerating `SOURCE_MANIFEST.json` through `tools/build_release.py.ensure_source_manifest`.
- `visual:test`: PASS.
- `studio:test`: PASS.
- `browser:smoke`: PASS.
  - Chrome path: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - starter blocks: `17`
  - flight mode: `true`
  - console errors: `0`
  - Chrome Google Update registry warning is environment noise, not a product failure.
- `probe:vector-thruster:report`: PASS after the renderer-only sign/profile fix.
  - model: expected force direction from `computeVectorThrusterForceCannon` vs visual `+X` after renderer rig profile.
  - runtime-default profile: `192 / 192` sampled orientation/input cases pass.
  - local `local_vector_thruster_visual` profile: `192 / 192` sampled orientation/input cases pass.
  - mismatch count: `0`.
- `probe:vector-thruster:summary`: PASS.
- `probe:vector-thruster`: PASS.
- `tools/visual_parity_baseline.py`: PASS as a read-only diagnostic report.
  - checked local imported visuals: Balloon, Hull, Fuel, Thruster, VectorThruster.
  - classification: shared imported-visual renderer/preview mismatch.
  - game and Studio now both set sRGB renderer output.
  - remaining likely cause: lighting/fog/shadow/preview mismatch.
- `tests/test_documentation_contract.py`: PASS.
- `git diff --check`: PASS.
- local visual-pack audit: PASS with `ok: true`.
  - `local_balloon_visual`: no diagnostics and no cleanup suggestions after the owner-approved binding cleanup.
  - remaining `thuster_*` diagnostics are info-level spelling reviews for Thruster/VectorThruster model node names, not inherited Balloon bindings.

## Readiness Matrix

| Area | Readiness | Evidence | Main Gap |
| --- | --- | --- | --- |
| Source-of-truth boundaries | Strong | ADRs, architecture docs, agent entrypoint, roadmap rebase | Must keep future work from bypassing Blueprint/CraftModel/compiler authority |
| Validation harness | Strong for current foundation | `validate:fast` PASS, validation-runner stage PASS | Full clean-candidate validation still needed before publication |
| Browser/UI smoke | Good current signal | `browser:smoke` PASS with zero console errors | Smoke does not prove visual fidelity or advanced workflows |
| Visual Asset Pack contract | Good foundation | `visual:test` PASS, Studio tests PASS, local audit `ok: true` | Balloon inherited binding cleanup is done; rendered lighting/fog/shadow parity still needs proof |
| Studio authoring workflow | Good for static/contract path | `studio:test` PASS, parity baseline tool PASS | Game-vs-Studio rendered capture is not yet a test |
| Imported visual fidelity | Improving, not ready for broad asset expansion | Static parity baseline covers local imported visuals and game sRGB output is aligned | Need diagnostic render/capture for lighting, fog and shadow parity |
| VectorThruster visuals | Current M4L proof green | `probe:vector-thruster` passes the 24-orientation matrix for runtime/default and local profiles | Keep the gate green for future rig/profile edits |
| Block fit and renderer optimization | Not ready for greedy meshing | Code evidence: renderer shrink is the source of gaps | Need Voxel Fit contract, hit-proxy proof and render-stat baseline |
| Mechanics and hinge | Not ready for feature expansion | Gate C minimal hinge ADRs and tests exist | Need Mechanical V2 joint-frame design and solver capability spike |
| Device tuning and programming | Conceptually routed, not implementation-ready | Project vision and ADR 0028 layer separation | Need direct binding and tuneable parameters before signal graph |
| Agent context and handoff routing | Improved | `README_FOR_AGENTS.md`, `AI_PROJECT_MEMORY.md`, active handoff updated | Must keep future roadmap updates from creating competing active plans |

## Critical Risks

### R1 - Visual symptoms may be misclassified

The visible imported-visual darkness could be caused by tone mapping, lighting, fog, shadowing, material policy, duplicate material names, asset data or Studio preview mismatch. The current M4L baseline has ruled out a Balloon-only texture-luminance outlier and aligned game renderer sRGB output with Studio.

Risk if ignored: future agents may recolor assets to compensate for a pipeline bug, making every later asset harder to calibrate.

Required mitigation: M4L must add a rendered game-vs-Studio diagnostic capture for lighting/fog/shadow parity before asset recoloring.

### R2 - VectorThruster axes can be fixed in one case and broken in others

The current renderer profile maps scalar inputs to local Euler axes. Gameplay force uses block basis vectors and body-local torque math. The 24-orientation gate now proves the current runtime-default and local VectorThruster profiles stay aligned, but this remains a regression risk for future rigs.

Risk if ignored: repeated one-off axis edits will make the visual rig feel random and will erode trust in imported assets.

Required mitigation: make `npm.cmd run probe:vector-thruster` pass before accepting any VectorThruster rig/profile fix.

### R3 - Hidden block shrink can hide future renderer assumptions

The current block gap comes from renderer-side `0.96` scaling, not from the logical grid. Removing it without proof may affect hit testing, ghost readability and imported visual bounds.

Risk if ignored: greedy meshing work may start on an unclear cell-fit contract.

Required mitigation: M5 Voxel Fit must make cell fit explicit and test hit proxies before optimization.

### R4 - Hinge expansion can corrupt the mechanical model

The current hinge is a minimal Gate C proof. Adding center/orientation/multi-axis fields directly to the existing path could lock the project into a poor joint model.

Risk if ignored: advanced servos and mechanisms become hard to serialize, debug or simulate.

Required mitigation: Mechanical V2 design spike before schema expansion.

### R5 - Device programming can start too broadly

The owner wants block binding, dependencies and simple programming. That is correct product direction, but the first implementation should be direct tuning and binding, not a full graph/runtime.

Risk if ignored: Gate D/E becomes a vague platform rewrite.

Required mitigation: M7 direct binding and tuneable parameters before M8 signal graph/ControlRuntime.

## What Is Ready

The following foundations are credible enough to build on:

- Gate C source-of-truth boundaries are documented and protected by ADRs.
- Fast validation is currently green.
- Visual/Studio static and contract tests are green.
- Browser smoke reaches the normal app path and flight mode with zero console errors.
- Agent entrypoint, project memory, roadmap and handoff now point to the same staged route.
- Release/provenance workflow has a clean-candidate path for dirty protected visual art.
- Owner-approved Balloon inherited binding cleanup is done and the local visual-pack audit reports Balloon clean.

## What Is Not Ready

The following should not be treated as done:

- Visual fidelity is not proven between Studio and game.
- Balloon color/material parity is not proven between Studio/Blockbench and the game.
- VectorThruster visual direction has a 24-orientation probe, and the current runtime-default plus local profiles pass it.
- Effects/particles do not yet have a renderer-only Effects V1 contract.
- Flush block rendering and future greedy meshing have no explicit cell-fit contract.
- Mechanical V2 has no accepted joint-frame design.
- Device tuning/direct binding has no accepted schema or implementation path yet.

## Required Next Proofs

Before claiming the project is ready for broad roadmap filling, gather these proofs:

1. Keep the local visual-pack audit clean for owner-approved visual changes.
2. Rendered Studio-vs-game material/color parity capture for local imported visuals under matched lighting/fog/shadow conditions.
3. Keep `npm.cmd run probe:vector-thruster` passing without hardcoded one-off runtime exceptions.
4. Voxel Fit hit-proxy/selection/placement proof after removing or replacing hidden shrink.
5. Mechanical V2 design note or ADR with solver capability evidence.
6. Direct binding/tuneable-device design before any signal graph implementation.
7. Clean-candidate full validation before publishing a milestone.

## Recommended Next Milestone

Do not start Gate D.

Continue M4L-B. M4L-A Balloon inherited binding cleanup and M4L-C VectorThruster 24-orientation direction proof are complete in this pass:

1. Do not broaden the Balloon cleanup. The remaining Balloon work is visual parity evidence, not more JSON cleanup by default.
2. Use `tools/visual_parity_baseline.py` as the static baseline for local imported visuals.
3. Add a rendered diagnostic capture/procedure that isolates lighting, fog and shadow differences between Studio preview and game.

## Completion Criteria For The Active Goal

The broader thread goal should not be marked complete until current evidence proves:

- active documentation points to one coherent roadmap and no competing active roadmap remains;
- agent entrypoint and project memory route future agents to the same work order;
- handoff context is active, concrete and not stale;
- current validation status is recorded with exact commands and results;
- readiness gaps are classified with next proofs;
- local visual-art changes remain intentionally scoped and are not accidentally normalized into release evidence;
- at least one clean-candidate validation path is available before publication;
- `npm.cmd run probe:vector-thruster` passes or the remaining mismatch is explicitly accepted by a newer ADR.

At the time of this audit update, the documentation/context/handoff side is substantially improved and the VectorThruster direction probe is green. Feature-expansion readiness remains incomplete because M4L rendered visual truth still needs lighting/fog/shadow capture proof, and M5/M6/M7 remain intentionally staged after that.
