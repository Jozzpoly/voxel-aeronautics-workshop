# VAW Blockbench Import Studio — Feedback Review 2026-06-23

## Verdict

The feedback is correct.

This prototype has real value as a separate Import Lab / proof of concept, but it should not be merged directly into the main VAW game as a production asset pipeline. Its strongest value is viewer recovery, diagnostics, debug export, and discovery of what real Blockbench exports look like. Its weakest point is that the VAW sidecar contract is still preview-level and not strict enough to become gameplay authority.

The next stage should stay focused on **Blockbench Import Contract + Studio Hardening**, not full integration into VAW runtime.

## What was verified in this pass

- Baseline `npm test` passed before changes.
- The code-level feedback about `animation-list` was confirmed: the HTML node existed, but `app/main.js` did not include it in the `el` map, so the detail list could never render.
- The code-level feedback about animation time was confirmed: the viewer had a mixer and manual `setAnimationTime`, but the render loop did not expose live current time back to the UI.
- The embedded-data feedback was confirmed: `data:` dependencies were recognized as embedded, but their long base64 URI could still appear in UI-facing dependency/project rows and resolver logs.
- The embedded-texture summary feedback was confirmed: physical texture files and embedded glTF images were not clearly separated, which made embedded textures look like `textures: 0` in Project Files.

## Changes made

### 1. Animation details panel fixed

`animation-list` is now added to the `el` map in `app/main.js`.

Why it matters: a static test that only checks `index.html` can pass even if the UI is dead at runtime. The panel must be wired in the app layer, not merely present in markup.

### 2. Animation timeline gets live playback facts

`src/minimal_gltf_viewer.js` now accepts an `animationCallback` and emits animation facts during the render loop:

- active clip name;
- duration;
- current playback time;
- speed;
- paused state;
- loop state.

`app/main.js` consumes those facts through `handleAnimationTick()` and updates the scrubber/label at a throttled UI rate.

This is still a preview timeline, not a full animation editor.

### 3. Embedded dependency display is compact

`src/file_bundle_resolver.js` now provides compact `displayUri` values for embedded data URIs, for example:

```text
data:image/png;base64,… (294 chars)
```

The full source glTF still contains the original embedded data. The UI should not spam it.

### 4. Resolver log no longer treats `data:` as unresolved

`app/main.js` now short-circuits `data:` URIs in the GLTFLoader URL modifier. This prevents false/noisy log lines like `resolver: unresolved data:image/...`.

### 5. Project Files now represents embedded textures honestly

`src/project_files_report.js` now creates virtual embedded rows for embedded buffer/image dependencies and counts embedded textures separately:

- `textures`: all texture rows, including embedded;
- `physicalTextures`: texture files loaded as separate files;
- `embeddedTextures`: texture images embedded inside the glTF.

This prevents the misleading case where Texture Diagnostic sees an embedded PNG but Project Files says `textures: 0`.

### 6. Regression coverage added

`tests/test_recovery_static.js` now checks the embedded Blockbench-like regression sample:

- embedded buffer is recognized and displayed compactly;
- embedded image is recognized and displayed compactly;
- embedded texture contributes to Project Files texture count;
- embedded texture keeps material-slot usage;
- `animation-list` wiring is tested, not just HTML presence;
- live animation facts/callback code is tested by static contract checks.

## Architectural boundary to preserve

Import Studio may produce renderer-facing visual packages, diagnostics, and candidate manifests.

It must not become gameplay authority. In VAW, gameplay truth should stay in:

- Blueprint;
- CraftModel;
- compiler/runtime domain logic;
- physics/gameplay module definitions.

Visual assets may describe:

- model path;
- stable node paths;
- clip bindings;
- material slots;
- sockets/pivots as visual attachment hints;
- orientation/scale/unit corrections;
- debug facts.

Visual assets must not decide:

- thrust power;
- lift authority;
- durability;
- cost;
- gameplay module behavior;
- simulation rules.

## Recommended next milestone

Name: **Blockbench Import Contract + Studio Hardening**

Scope:

1. Define `VisualAssetManifest` as a strict renderer-facing contract.
2. Stabilize node path generation and rename handling.
3. Define clip bindings without gameplay meaning.
4. Define material slots, including emissive/glow metadata.
5. Define sockets/pivots as visual attachment anchors only.
6. Add unit/scale/orientation correction fields.
7. Add fixtures from real Blockbench exports, especially embedded and external variants.
8. Keep Export VAW Package blocked unless sidecar/manifest passes the stricter contract.
9. Keep Debug Package available even when VAW readiness fails.

## Risks still open

- Browser-only playback behavior is still not fully covered by automated tests.
- There is no Playwright/browser regression suite yet.
- The sidecar schema remains too loose for production import.
- Node-path stability needs deliberate design before assets are referenced from VAW.
- Debug package reports may still include raw glTF data indirectly because the source model is included by design.
- GLB support is still preview-level compared with `.gltf + .bin + textures` workflows.

## Recommendation for the next agent

Do not rewrite the app from scratch.

Start from this v0.6.1 feedback-hardened workbench. First manually verify `assets/regression_embedded_blockbench_like/test_model_alfa_anim_BaA.gltf` in `index.html?sample=regression`, then design `VisualAssetManifest` as a renderer-facing contract. Treat the current sidecar as a sketch, not as a stable VAW import schema.
