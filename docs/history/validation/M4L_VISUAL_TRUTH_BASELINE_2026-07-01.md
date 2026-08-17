# M4L Visual Truth Baseline - 2026-07-01

Status: current diagnostic evidence
Scope: imported local visual-pack parity baseline, with Balloon as the most visible reported symptom
Authority: evidence only. Visual Asset Pack V1 remains renderer-only; gameplay truth remains in Catalog, Blueprint, CraftModel and compiler output.

## Command

```text
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
```

## Current Classification

The visible darkness is classified as a shared renderer/preview parity mismatch for imported visuals, not as a Balloon recolor target.

Current static baseline evidence:

- `local_balloon_visual`, `local_hull_visual`, `local_fuel_visual`, `local_thruster_visual` and `local_vector_thruster_visual` all use texture-backed glTF materials.
- Balloon, Hull and Fuel share `materialPolicy.alpha: auto`, `pixelated: true` and `doubleSided: from-gltf`.
- Thruster and VectorThruster add renderer-only material overrides for body/fire alpha, but they still share the same game scene renderer settings.
- Balloon has no material overrides and no duplicate material-name override ambiguity.
- The baseline computes texture luminance for every local imported block before any recolor is proposed.
- Studio preview sets sRGB output when available and uses a no-fog preview scene with stronger key/rim lighting.
- The game scene now sets sRGB renderer output through `src/game/scene_environment.js`, matching Studio's output-color policy.
- The game scene still has fog, shadow mapping and lower lighting than Studio preview.

Current texture luminance evidence:

- Hull: `0.4349`
- Fuel: `0.6586`
- Thruster: `0.4467`
- VectorThruster: `0.4467`
- Balloon: `0.5153`

Balloon is not an obvious dark asset-data outlier. It is bright enough that a global renderer/preview mismatch is more noticeable on it.

Primary likely causes:

1. lighting/fog/shadow/preview mismatch between Studio and game.

Closed in this pass:

- color-space/output mismatch between Studio and game. The game renderer now uses `outputColorSpace = THREE.SRGBColorSpace` when available and falls back to `outputEncoding = THREE.sRGBEncoding` for Three r128.

Ruled out for now:

- Balloon inherited rig-binding cleanup: audit is clean and this is not a rig issue.
- Balloon-specific materialPolicy difference versus other plain imported blocks.
- broad local visual-pack normalization.

## Next Proof

The next useful M4L visual proof is a game diagnostic render mode or capture that temporarily matches Studio preview conditions: no fog, no shadows, same camera framing and the same imported asset. If Balloon still differs under those conditions, investigate asset data or GLTFLoader texture handling. If it matches, tune the game lighting/fog/shadow policy rather than recoloring the asset.
