# M4K Workflow Provenance Handoff - 2026-06-30

Status: active handoff for the next visual-authoring checkpoint.

## Baseline

- Branch: `current_work`
- Baseline SHA before M4K work: `6ce52fc12c6835be345ca288dd77c6fd2e302dc0`
- `origin/current_work`: `6ce52fc12c6835be345ca288dd77c6fd2e302dc0`
- `origin/main`: `873933f1ebd8e98d05ad644a9dda2de47d467b1f`

Protected local visual work present at start:

- `assets/visual_packs/installed_visual_packs.json`
- `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`
- `assets/visual_packs/local_working_visuals/models/blocks/balloon/` (untracked)

Treat these paths as user/art work. Do not stage, normalize, delete or regenerate them without explicit owner approval.

## What M4K Adds

- `tools/validate_clean_candidate.py` validates a clean staged/HEAD candidate in `.agent-validation/**`.
- The helper reports protected root dirty paths, refuses staged protected visual-pack paths by default, applies staged diff when present, and runs bundled `tools/validate_full.py` by default.
- `.gitattributes` now pins `.gltf` to LF and `.glb` to binary to reduce provenance hash drift.
- Studio now surfaces VectorThruster renderer-profile diagnostics for fallback, missing `gimbalAssembly`, missing `gimbalA`/`gimbalB`/roll channels and invalid axes.

Follow-up audit note: the first M4K checkpoint exposed a `SOURCE_MANIFEST.json` mismatch in clean `--head-only` validation. The preparation hotfix corrected the manifest from clean-checkout evidence and added the staged protected-art refusal guard. Treat clean-candidate `--head-only` as the proof that the published checkpoint is release-grade.

## Why This Matters

`tools/build_release.py` includes `assets/visual_packs/**` in `SOURCE_MANIFEST.json`. When the local working pack is dirty, root validation can produce provenance for protected WIP art instead of the intended code candidate. M4K keeps root visual WIP and release-grade candidate validation separate.

## Current Visual Diagnostics

Run:

```text
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
```

Expected protected-art evidence before owner cleanup:

- Balloon can report inherited `thuster_fire` at `bindings.nodes.flame`.
- Balloon can report inherited `thuster_nozzle` at `bindings.nodes.gimbalAssembly`.
- Suggested cleanup is advisory only: set those optional bindings to `null`.
- VectorThruster real-asset profile proof remains pending and must stay renderer-only.

## Owner-Pending Decisions

- Whether to edit the local Balloon manifest under `local_working_visuals`.
- Whether to commit any local visual art. Default is no.
- Whether to author the real local VectorThruster profile under protected art. Default is no until approved.

## Recommended Next Order

1. Keep protected visual paths out of staging.
2. Validate code/docs/tooling candidates with:

   ```text
   node tools/run_with_python_env.js python tools/validate_clean_candidate.py
   ```

3. If owner approves Balloon cleanup, make only the manifest changes:
   - `bindings.nodes.flame = null`
   - `bindings.nodes.gimbalAssembly = null`
4. Prove VectorThruster with `bindings.rig.vectorThruster` diagnostics/profile, not runtime force/control patches.

## Non-Goals

- No gameplay, physics, Blueprint, CraftModel, compiler output, save schema or Gate D changes.
- No release artifact migration.
- No cleanup of protected visual art without owner approval.
- No hardcoded runtime Euler-axis patch for VectorThruster.
