# M4L Visual Truth Baseline - 2026-07-01

Status: classified from rendered evidence (m4l-105)
Scope: imported local visual-pack parity baseline, with Balloon as the most visible reported symptom
Authority: evidence only. Visual Asset Pack V1 remains renderer-only; gameplay truth remains in Catalog, Blueprint, CraftModel and compiler output.

## Command

```text
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals --render-report .agent-validation/m4l-capture/visual_parity_render_report.json
```

## Render Capture Evidence (m4l-104)

Source: `.agent-validation/m4l-capture/visual_parity_render_report.json`

- Profile: `game-studio-parity`
- Viewport: `640x480`
- Thresholds: `ssimMin >= 0.92`, `|luminanceDelta| <= 0.08`
- Blocks captured: `5`
- Blocks within thresholds: `0`
- Orchestrator `classificationHint`: `environment-policy`

## Final Classification

**Root cause policy: `environment-policy`**

Rendered Studio-vs-game captures under matched camera framing and the `game-studio-parity` profile still show a shared luminance deficit in game versus Studio preview. The cross-block average absolute luminance delta is `0.1162`, above the `0.08` threshold. Balloon is the most visible symptom because it has a large bright surface and above-average texture luminance, not because Balloon asset data is uniquely dark.

### Balloon rendered metrics

| Metric | Value | Threshold | Pass |
| --- | ---: | ---: | --- |
| SSIM | `0.3553` | `>= 0.92` | no |
| Luminance delta (game - studio) | `-0.1872` | `|delta| <= 0.08` | no |
| Studio average luminance | `0.3247` | — | — |
| Game average luminance | `0.1375` | — | — |

### All-block rendered metrics

| Block | SSIM | Luminance delta | Within thresholds |
| --- | ---: | ---: | --- |
| Balloon | `0.3553` | `-0.1872` | no |
| Hull | `0.3460` | `-0.1408` | no |
| Fuel | `0.3496` | `-0.2182` | no |
| Thruster | `0.4744` | `+0.0174` | no |
| VectorThruster | `0.4744` | `+0.0174` | no |

Interpretation:

- Balloon, Hull and Fuel share the same directional failure: game renders materially darker than Studio under matched framing.
- Thruster and VectorThruster keep luminance close but still miss SSIM, which is consistent with secondary material/alpha differences after the environment gap is removed.
- The primary fix lane is game environment policy (lighting, fog, shadows, preview parity), not Balloon recolor or asset rebaking.

## Static Baseline Context

Static asset and renderer-source evidence still supports the same conclusion:

- `local_balloon_visual`, `local_hull_visual`, `local_fuel_visual`, `local_thruster_visual` and `local_vector_thruster_visual` all use texture-backed glTF materials.
- Balloon, Hull and Fuel share `materialPolicy.alpha: auto`, `pixelated: true` and `doubleSided: from-gltf`.
- Thruster and VectorThruster add renderer-only material overrides for body/fire alpha, but they still share the same game scene renderer settings.
- Balloon has no material overrides and no duplicate material-name override ambiguity.
- Studio preview sets sRGB output when available and uses a no-fog preview scene with stronger key/rim lighting.
- The game scene now sets sRGB renderer output through `src/game/scene_environment.js`, matching Studio's output-color policy.
- The game scene still has fog, shadow mapping and lower lighting than Studio preview.

Static texture luminance evidence:

- Hull: `0.4349`
- Fuel: `0.6586`
- Thruster: `0.4467`
- VectorThruster: `0.4467`
- Balloon: `0.5153`

Balloon is not an obvious dark asset-data outlier. It is bright enough that a global renderer/preview mismatch is more noticeable on it.

## Policy Decision Matrix

| Policy | Status | Evidence |
| --- | --- | --- |
| `environment-policy` | **selected** | Cross-block rendered luminance delta `0.1162 > 0.08`; Balloon/Hull/Fuel all darker in game; static renderer flags show fog/shadow/lighting mismatch |
| `material-policy` | ruled out as primary | Balloon shares plain imported `materialPolicy` with Hull/Fuel; luminance skew is cross-block, not Balloon-only |
| `asset-data` | ruled out | Balloon texture luminance `0.5153` is near pack average `0.5004`; no duplicate-material ambiguity on Balloon |

Closed in earlier passes:

- color-space/output mismatch between Studio and game. The game renderer now uses `outputColorSpace = THREE.SRGBColorSpace` when available and falls back to `outputEncoding = THREE.sRGBEncoding` for Three r128.

Ruled out for now:

- Balloon inherited rig-binding cleanup: audit is clean and this is not a rig issue.
- Balloon-specific materialPolicy difference versus other plain imported blocks.
- broad local visual-pack normalization.
- asset-data as the primary root cause for the visible darkness symptom.

## Next Proof

Proceed to `m4l-106a`: tune game environment policy so normal game rendering moves Balloon within luminance and SSIM thresholds without recoloring imported assets.

Validation ladder for the fix lane:

```text
npm run parity:capture
npm run browser:smoke
npm run validate:fast
```

If Balloon still diverges after environment parity is aligned, reopen `material-policy` or `asset-data` with a fresh render report.