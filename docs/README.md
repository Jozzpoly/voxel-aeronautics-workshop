# VAW Documentation Index

Status: Active documentation index
Last verified: 2026-07-01
Authority: Navigation and authority classification for current repository docs.

Authority order: current user decision, latest verified remote SHA, source/tests from that SHA, active contracts, accepted ADRs, current evidence, recovery evidence, then history.

## Active product authority

- `README.md`
- `PROJECT_VISION.md`
- `AI_PROJECT_MEMORY.md`
- `ARCHITECTURE.md`
- `ROADMAP_NEXT.md`
- `docs/ROADMAP_REBASE_2026-07-01.md`
- `PROGRAMMABLE_MACHINE_RESEARCH.md`

Current state: Gate C is the stable gameplay base. The immediate foundation concern is no longer only workflow/provenance; the 2026-07-01 roadmap rebase makes Visual Truth, VectorThruster direction proof, Voxel Fit, Mechanical V2 and Device Tuning the ordered planning path before broad Gate D/E work.

`ROADMAP_NEXT.md` remains the short active route map. `docs/ROADMAP_REBASE_2026-07-01.md` is the detailed active rebase behind it. Future roadmap reviews must explicitly supersede that rebase instead of adding competing active plans.

## Active workflow authority

- `README_FOR_AGENTS.md`
- `AGENT_WORKFLOW.md`
- `DELIVERY_WORKFLOW.md`
- `PUSH_INSTRUCTIONS.md`

Transport priority remains:

```text
direct Git > one final milestone ZIP > complete single file > patch
```

Default branch rule: `current_work` is the checkpoint branch for multi-session work; `main` is the reviewed stable landing line.

## Active contract docs

- `docs/blockbench_import_studio.md`
- `docs/visual_asset_pack_v1.md`

`docs/visual_asset_pack_v1.md` is the canonical Visual Asset Pack V1 contract.
`tools/blockbench_import_studio/docs/**` is Studio-local development or
historical material unless an active doc explicitly links to a file there.

## Accepted ADRs

ADRs 0033-0041 preserve Gate B/C architecture. ADR 0042 defines the Workbench UI layout foundation. ADR 0043 defines the visual asset boundary for external models, textures and animations. ADR 0044 defines the checkpoint branch and CI trigger policy. ADR 0045 defines the renderer-only VectorThruster rig profile.

## Current supporting evidence

- `docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md`
- `docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md`
- `FUTURE_READINESS_REVIEW.md`
- `docs/repository/RELEASE_ARTIFACT_POLICY_RECOMMENDATION.md`
- `docs/history/phases/PHASE_1D4A_REPORT.md`
- `docs/history/validation/TEST_REPORT.md`
- `docs/history/validation/VALIDATION_REPORT.md`
- `docs/history/reviews/CODE_REVIEW_REPORT.md`
- `docs/history/reviews/FOUNDATION_CONVERGENCE_REVIEW.md`

## Recovery evidence

Recovery evidence is archived in `docs/recovery/`. Read it before changing input focus, thruster routing, mechanical visuals, hinge cancellation or lifecycle cleanup.

## Historical and superseded material

Historical phase/review/validation documents describe earlier checkpoints and do not override current source/tests. Cosmetic repository reorganization remains frozen unless a concrete blocker affects source-of-truth clarity, release construction or validation.
