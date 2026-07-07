# M4L Visual Truth Closure Handoff — 2026-07-07

Status: Active handoff — M4L closed; next lanes M5 and M4LC  
Scope: Visual Truth milestone closeout (render parity, environment-policy fix, capture pipeline)  
Authority: handoff evidence only. Product truth remains in source, tests, active contracts, accepted ADRs, `ROADMAP_NEXT.md` and `docs/ROADMAP_REBASE_2026-07-01.md`.  
Base: HEAD `319eeb7b58cd01112eec8eac5b4793824b3b3966` (docs closeout `m4l-108`)

## Summary

M4L Visual Truth is **closed** on `current_work`. The milestone proved Studio-vs-game imported-visual parity under matched framing and the `game-studio-parity` profile, classified the pre-fix darkness symptom as **`environment-policy`** (not asset recolor), and landed the expected environment-policy fix without touching Visual Asset Pack V1 gameplay boundaries.

### Task evidence (`m4l-101`–`m4l-107`)

| Task | Lane | Deliverable |
| --- | --- | --- |
| `m4l-101` | visual-renderer | Shared renderer profile contract (`STUDIO_PREVIEW_PROFILE`, `GAME_DEFAULT_PROFILE`, `GAME_STUDIO_PARITY_PROFILE`) |
| `m4l-102` | visual-renderer | Game visual parity diagnostic render mode (`?visualParity=1&block=…&profile=game-studio-parity`) |
| `m4l-103` | studio-pipeline | Studio-side capture harness (PNG + JSON per block) |
| `m4l-104` | tooling-tests | Unified orchestrator `npm run parity:capture` → `visual_parity_render_report.json` |
| `m4l-105` | docs-convergence | Root-cause classification **`environment-policy`** with render metrics |
| `m4l-106a` | visual-renderer | Game environment policy tune (lighting/fog/shadow parity under normal game rendering) |
| `m4l-107` | studio-pipeline | Studio duplicate-material diagnostics surfaced before export |

Earlier M4L prep (`m4l-000`, Balloon binding cleanup, Studio/game sRGB alignment) remains valid context; do not reopen Balloon manifest cleanup without fresh diagnostics.

## Final metrics

Source: `.agent-validation/m4l-capture/visual_parity_render_report.json` (captured `2026-07-07T03:24:03Z`)

- Profile: `game-studio-parity`
- Viewport: `640×480`
- Thresholds: `ssimMin >= 0.92`, `|luminanceDelta| <= 0.08`
- **Blocks captured: 5 / 5 within thresholds** (`blocksWithinThresholds: 5`)

| Block | SSIM | Luminance Δ (game − studio) | Pass |
| --- | ---: | ---: | --- |
| **Balloon** | **0.963** | **−0.0102** | yes |
| Hull | 0.964 | −0.0031 | yes |
| Fuel | 0.964 | −0.0042 | yes |
| Thruster | 0.979 | +0.0025 | yes |
| VectorThruster | 0.977 | +0.0028 | yes |

Pre-`m4l-106a` baseline (committed @ `e37d630`) had `blocksWithinThresholds: 0` with Balloon SSIM `0.3553` and luminance delta `−0.1872`, confirming `m4l-105` `environment-policy` classification. Post-fix capture is the M4L closeout gate.

### Classification

- **Selected policy:** `environment-policy` (`m4l-105`)
- **Ruled out as primary:** `material-policy`, `asset-data` (cross-block luminance skew; Balloon not a texture outlier)
- **Post-fix hint:** `unclassified` (all blocks within thresholds — no further root-cause lane required)

## Validation ladder (M4L closeout)

```text
npm run parity:capture          # exit 0; 5/5 within thresholds
npm run probe:vector-thruster  # 192/192 synthetic-only until m4lc-201
npm run visual:test
npm run browser:smoke
npm run validate:fast
node tools/run_with_python_env.js python tests/test_documentation_contract.py
```

Wave-3 QA evidence: `evidence/ENV_BASELINE_2026-07-07-remediation.md` §8.

## Closed non-goals (carry forward)

- Do not recolor or rebake imported assets to chase parity; environment policy was the fix lane.
- Do not treat the 24-orientation VectorThruster probe as in-game nozzle-vs-force proof until M4LC lands.
- Do not broaden `local_working_visuals` rewrites beyond owner-approved audit evidence.
- Visual Asset Pack V1 stays renderer-only; no gameplay/schema authority through manifests.

## Next milestones

### M5 — Voxel Fit And Renderer Optimization Contract (primary roadmap next)

`ROADMAP_NEXT.md` now lists M5 as the active **Next** lane:

- Remove or replace the hidden `0.96` visual shrink as an explicit render policy.
- Prove hit proxies, placement ghost readability, imported visuals and selection still work with flush blocks.
- Define greedy-meshing participation boundaries before optimization claims.

Start reading: `ROADMAP_NEXT.md`, `docs/ROADMAP_REBASE_2026-07-01.md` M5 section, `docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md`.

### M4LC — VectorThruster runtime proof (parallel follow-on)

Synthetic probe green (`192 / 192` in Node) is **not** runtime-integrated proof. Queue task **`m4lc-201`** wires real integration through `computeVectorThrusterForceCannon` and `setGimbal`. **`m4lc-202`** follows for thruster fire renderer-only effects MVP after direction correctness is testable in-game.

Do not hardcode one-off runtime Euler-axis patches; keep renderer-only profile/sign alignment under ADR 0045.

## Reading order

1. `README_FOR_AGENTS.md`
2. `ROADMAP_NEXT.md` (M4L in **Closed**, M5 in **Next**)
3. `AI_PROJECT_MEMORY.md` (M4L closed paragraph)
4. `docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md`
5. `.agent-validation/m4l-capture/visual_parity_render_report.json`
6. `docs/ROADMAP_REBASE_2026-07-01.md`
7. `.codex/handoff/FEATURE_EXPANSION_READINESS_HANDOFF_2026-07-01.md` (staged expansion context)

Supersedes prepared prompt: `.codex/handoff/NEXT_GOAL_PROMPT_M4L_VISUAL_TRUTH_2026-07-01.md` for implementation start gates; keep that file as historical evidence only.

## Start gate (next agent)

```text
git status --short --branch
git rev-parse HEAD
npm run parity:capture
npm run probe:vector-thruster:summary
```

Expected: parity capture exit `0` with Balloon SSIM ≥ `0.92`; probe summary notes synthetic-only scope until `m4lc-201`.