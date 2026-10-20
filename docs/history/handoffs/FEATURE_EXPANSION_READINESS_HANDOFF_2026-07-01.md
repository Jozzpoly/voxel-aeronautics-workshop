# Feature Expansion Readiness Handoff - 2026-07-01

Status: active operational handoff for the roadmap rebase continuation.
Authority: handoff evidence only. Product truth remains in source, tests, active contracts, accepted ADRs, `ROADMAP_NEXT.md` and `docs/ROADMAP_REBASE_2026-07-01.md`.

## Current Situation

The project is not ready for one broad feature-expansion push. It is ready for a staged readiness lane that removes the main uncertainties before Gate D/E work.

Current route:

1. M4L - Visual Truth and VectorThruster proof.
2. M5 - Voxel Fit and renderer optimization contract.
3. M6 - Mechanical V2 design spike.
4. M7 - Device tuning and direct binding.
5. M8 - Signal graph and deterministic ControlRuntime.

Do not collapse these into one milestone. The current risk is not lack of ideas; it is that visuals, mechanics and future control systems could start changing separate sources of truth at once.

## Start Gate

Run and record:

```text
git status --short --branch
git rev-parse HEAD origin/current_work origin/main
git diff --stat
git diff --name-status
git diff --name-only
git diff --check
```

Expected current-state caveat at the time this handoff was written:

- `HEAD == origin/current_work == 914eb88d9ad70831ccc5c800bfb68c4330d78dcf`.
- Local visual-pack files may be dirty:
  - `assets/visual_packs/installed_visual_packs.json`
  - `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`
- The owner approved a minimal Balloon cleanup in this pass. Do not broaden it into model, transform, material or unrelated asset cleanup without a separate proof.

## Reading Order

1. `README.md`
2. `README_FOR_AGENTS.md`
3. `AI_PROJECT_MEMORY.md`
4. `docs/README.md`
5. `ROADMAP_NEXT.md`
6. `docs/ROADMAP_REBASE_2026-07-01.md`
7. `docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md`
8. `PROJECT_VISION.md`
9. `ARCHITECTURE.md`
10. ADRs:
   - `docs/adr/0043-visual-asset-boundary.md`
   - `docs/adr/0045-renderer-only-vector-thruster-rig-profile.md`
   - `docs/adr/0041-assembly-spaces-and-spatial-ownership.md`
   - `docs/adr/0033-blueprint-v11-mechanical-link-schema.md`
   - `docs/adr/0028-programmable-machine-layers.md`
11. Current contracts:
   - `docs/visual_asset_pack_v1.md`
   - `docs/blockbench_import_studio.md`

Use older `.codex/handoff/M4*.md` files as evidence only. They do not override the 2026-07-01 roadmap rebase.

## Recalibration Audit Takeaways

An external recalibration audit from 2026-07-01 is useful as warning material, but it is not a new active roadmap. Integrate it through the existing roadmap rebase instead of creating a competing plan.

Preserve these takeaways:

- Inventory the local worktree before trusting remote state or staging anything.
- Classify changes as `USER_ART`, `CODE`, `DOCS`, `GENERATED` or `UNKNOWN`.
- Treat the asset pipeline as a core creative workflow, while keeping Visual Asset Pack V1 renderer-only.
- Do not implement gameplay authority, ports, control semantics or persistent identities through visual manifests.
- Keep `current_work -> main` landing as a deliberate validated checkpoint, not an incidental push.
- Treat tracked `release/**` cleanup as a separate repo-policy milestone, not part of M4L, Gate D or mechanics.

Do not use the audit to skip the current order: M4L first, then M5/M6, then M7/M8. A Gate D V0 idea is useful planning input, but broad device/schema implementation remains out of scope until the visual and mechanical uncertainty is reduced.

Use `.codex/handoff/NEXT_GOAL_PROMPT_M4L_VISUAL_TRUTH_2026-07-01.md` as the prepared prompt for the next focused implementation goal.

## Evidence Already Gathered

Commands run during the roadmap rebase work:

```text
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
npm.cmd run test
npm.cmd run validate:fast
npm.cmd run validate:full
npm.cmd run browser:smoke
npm.cmd run probe:vector-thruster:summary
npm.cmd run probe:vector-thruster
npm.cmd run probe:vector-thruster:report
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
node tools/run_with_python_env.js python tests/test_documentation_contract.py
git diff --check
```

Results:

- Browser smoke: PASS with starter craft, flight mode and zero console errors in the smoke result.
- Root `npm test`: PASS after regenerating `SOURCE_MANIFEST.json` through release tooling.
- `validate:fast`: PASS with artifact `.agent-validation/fast-20260701T141244.692937Z-19344`.
- `validate:full`: PASS with artifact `.agent-validation/full-20260701T141401.122809Z-22396`.
- Documentation contract: PASS after linking the roadmap rebase.
- Diff whitespace check: PASS.
- VectorThruster direction probe: PASS after the renderer-only profile/sign fix.
  - runtime-default profile: `192 / 192` sampled cases pass.
  - local `local_vector_thruster_visual` profile: `192 / 192` sampled cases pass.
  - mismatch count: `0`.
- Default VectorThruster gate: PASS.
- Visual parity baseline: PASS as a read-only diagnostic report.
  - checked local imported visuals: Balloon, Hull, Fuel, Thruster and VectorThruster.
  - classification: shared imported-visual renderer/preview mismatch.
  - game and Studio now both set sRGB renderer output.
  - remaining likely cause: lighting/fog/shadow/preview mismatch.
- Visual-pack audit: PASS with `ok: true`.
  - `local_balloon_visual`: no diagnostics and no cleanup suggestions after cleanup.
  - remaining `thuster_*` diagnostics are info-level spelling reviews for Thruster/VectorThruster model node names.

The Balloon cleanup is complete. That is not permission to rewrite user art broadly.

## Critical Findings To Preserve

### Visual darkness

The Balloon looking darker in game than in Studio/Blockbench is not a proven asset-color problem. The current baseline shows this is a shared imported-visual renderer/preview mismatch that Balloon makes more visible:

- Studio preview and game lighting/shadow/fog setup still differ.
- Game and Studio sRGB renderer output are now aligned.
- Material override duplicate names may apply policy more broadly than intended.
- Imported texture luminance does not make Balloon an obvious dark asset-data outlier.

### VectorThruster direction

The current renderer-only rig profile was sufficient for the local VectorThruster fix. The 24-orientation probe now exists and the current runtime/default plus local VectorThruster profiles pass it.

Required proof gate:

```text
npm.cmd run probe:vector-thruster
```

Use report mode while diagnosing:

```text
npm.cmd run probe:vector-thruster:report
```

The probe iterates all 24 VectorThruster orientations, drives representative pitch/yaw/roll-like samples, computes actual gameplay force direction, computes visual nozzle direction from the renderer rig profile, and reports orientation/input/vector diagnostics.

No future VectorThruster axis fix should be accepted unless the default probe command still passes or a newer ADR explicitly accepts the remaining mismatch.

### Block gaps

The visible block gap is caused by renderer-side shrink, not by the Blueprint grid. Removing it belongs to M5 Voxel Fit, with hit proxy and placement proof. Do not treat it as a one-line cosmetic change if future greedy meshing depends on it.

### Hinge and mechanisms

The current hinge is a minimal Gate C proof. Advanced servos, multi-axis joints, custom pivots and richer mechanical connections require Mechanical V2 design before schema expansion.

### Device tuning and programming

Do not jump directly into broad programming. The ladder is:

1. inspect block;
2. tune block parameters;
3. bind direct actions;
4. group devices;
5. add gain/invert/trim/clamp;
6. add dependencies and diagnostics;
7. later add signal graph and deterministic ControlRuntime.

## Next Work Order

### M4L-A - Owner-approved Balloon cleanup

Status: done in this pass.

Completed scope:

1. Balloon optional bindings were set to `null`:
   - `assets[4].bindings.nodes.flame`
   - `assets[4].bindings.nodes.gimbalAssembly`
2. Model files, transforms, material policy and unrelated assets were not touched.
3. The visual-pack audit reports `local_balloon_visual` clean.

Do not repeat or broaden this cleanup unless a new audit gives a concrete product reason.

### M4L-B - Studio/game visual parity baseline

1. Use `tools/visual_parity_baseline.py` as the static local imported-visual baseline.
2. Establish a diagnostic render mode or capture procedure.
3. Compare local imported visuals in Studio preview and game under matched camera/framing.
4. Classify the remaining mismatch as material policy, tone mapping, lighting/shadow/fog or preview mismatch.
5. Do not recolor assets until this is known.

### M4L-C - VectorThruster 24-orientation proof

Status: done in this pass.

1. Keep using `tools/probe_vector_thruster_direction.js` as the proof.
2. Keep report-mode output as evidence for future rig changes.
3. The current fix passes under the existing ADR 0045 contract; write a richer renderer-only gimbal-frame ADR only if a future imported rig cannot pass through profile metadata.

## Non-Goals

- No broad Gate D implementation.
- No persistent `bodyId`.
- No Blueprint/CraftModel/compiler schema expansion for visual issues.
- No gameplay force changes to fix renderer nozzle direction.
- No hardcoded one-off Euler patch.
- No full particle editor before renderer-only Effects V1 is shaped.
- No greedy meshing before Voxel Fit proves cell-fit and hit-testing.
- No hinge schema growth before Mechanical V2 joint frames are designed.

## Suggested Validation Ladder

For documentation-only updates:

```text
node tools/run_with_python_env.js python tests/test_documentation_contract.py
git diff --check
```

For M4L visual work:

```text
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
npm.cmd run visual:test
npm.cmd run studio:test
npm.cmd run browser:smoke
npm.cmd run probe:vector-thruster:summary
npm.cmd run probe:vector-thruster:report
npm.cmd run probe:vector-thruster
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
```

For release-grade evidence while protected local visuals are dirty:

```text
npm.cmd run validate:clean
```

Use root `npm.cmd run test` only when you understand whether protected visual WIP can affect `SOURCE_MANIFEST.json` evidence.

## Stop Conditions

Stop and write a design note instead of patching when:

- a visual fix needs gameplay force/control changes;
- VectorThruster correctness cannot pass all 24 orientations;
- a hinge improvement needs persistent schema before joint frames are modeled;
- an effects feature starts carrying gameplay authority;
- a device/control feature wants to persist `bodyId`;
- a new roadmap document would duplicate `docs/ROADMAP_REBASE_2026-07-01.md` instead of superseding it explicitly.
