# Repository Structure Audit

Date: 2026-06-17

## Input identity and evidence level

- Project: Voxel Aeronautics Workshop.
- Trusted remote content base: `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`.
- Local working branch: `maintenance/workflow-repair-clean`.
- Local workflow checkpoint: `3078ea95e3124635f81a00614ed4d849282062a5`.
- The local repository is a synthetic Git reconstruction of the trusted base content and has no `origin` remote. Its local commit SHA is evidence of a reproducible local checkpoint, not an original GitHub commit.
- Workflow repair content was compared path-by-path against `VAW_WORKFLOW_REPAIR_COMPLETE_V2.patch`; all 18 patch paths matched before the local checkpoint was created.
- Remote publication and Windows PowerShell execution remain outside the evidence of this audit.

## Current top-level shape

The repository currently has these major areas:

- product entry files and launch scripts in the root;
- application source under `src/foundation`, `src/runtime`, `src/game`, plus `src/game.js` as the composition root;
- tests under `tests`, including vendored Cannon and experimental Windows workflow coverage;
- developer/release/workflow utilities together under `tools`;
- ADRs under `docs/adr` and one workflow handoff under `docs`;
- historical reports, current entry documents, recovery evidence and review reports mixed together in the root;
- tracked historical single-file releases under `release`;
- generated local release output under ignored `dist` and `.agent-validation`.

Measured before the first migration increment:

| Area | Files |
| --- | ---: |
| repository root | 51 |
| `src` | 43 |
| `tests` | 47 |
| `docs` | 41 |
| `release` | 14 |
| `tools` | 8 |

## What is already structurally sound

### Product source boundaries

The source tree broadly matches the accepted architecture:

- `src/foundation` owns domain state, pure compilation, diagnostics, transforms and neutral plans;
- `src/runtime` owns physics ports/backends and assembly allocation;
- `src/game` owns application services and presentation/runtime coordination;
- `src/game.js` remains the explicit composition root.

This audit found no reason to move product source during the first increment. Moving it now would create broad import, loader, manifest, release and startup-smoke risk without solving the largest repository-navigation problem.

### ADR history

`docs/adr` is coherent, sequential and already names decisions rather than phases. ADR 0033–0040 correctly preserve the current Mechanical Platform Convergence contracts. No ADR migration is required.

### Generated artifact separation

`dist/` and `.agent-validation/` are ignored. FULL validation now writes its exact HTML, ZIP and SHA256 set beneath a unique run directory. This is an appropriate generated-artifact boundary.

## Confirmed structural problems

### 1. Root mixes active contracts with historical narrative

Sixteen `PHASE_*_REPORT.md` files live beside active entry points such as `README.md`, `PROJECT_VISION.md`, `ARCHITECTURE.md` and `ROADMAP_NEXT.md`. Most phase reports are historical evidence, while `PHASE_1D4A_REPORT.md` is current-phase evidence. The identical location gives them equal apparent authority and makes agent onboarding unnecessarily expensive.

### 2. Reviews and validation reports have unclear lifecycle

Files such as `FOUNDATION_REVIEW.md`, `CRITICAL_REVIEW.md`, `CODE_REVIEW_REPORT.md`, `TEST_REPORT.md` and `VALIDATION_REPORT.md` are useful evidence but are not clearly divided into active contracts versus historical snapshots. They should not be moved in the same increment as phase reports because several still participate in the current documentation/release contract.

### 3. Recovery evidence is mixed into the root

The four recovery reports plus the browser recovery scenario are operational evidence for the 2026-06-16 recovery baseline. They deserve a dedicated recovery area, but they remain active mandatory reading for sensitive seams. Moving them safely requires a separate reference and workflow audit.

### 4. `release/` is both history and current output

The tracked `release/` directory contains historical single-file builds from several phases plus the current Phase 1D.4A build and a shared `SHA256.txt`. This is distinct from ignored build output in `dist/`. A later migration must decide whether tracked release history belongs under an archive or whether only a current release should remain tracked. It is intentionally out of scope for the first increment.

### 5. Workflow, release and development tools share one flat namespace

`tools/` currently mixes serving, release building, release verification, validation running and delivery application. Eight files are still manageable, and moving them would affect package scripts, shell scripts, Python imports, tests and documentation. The first migration should not combine this with documentation movement.

### 6. Workflow tests are only partly grouped

Windows workflow tests are grouped under `tests/windows`, while Python workflow tests remain in the test root. A future focused migration can create `tests/workflow/`, but changing test import/entry paths in the same increment as historical documentation would expand risk without additional user value.

## Reference and release impact of phase-report movement

Before migration, explicit references to phase-report paths existed in:

- `README.md`;
- `AI_PROJECT_MEMORY.md`;
- `tests/test_documentation_contract.py`;
- `tests/test_release_build.py`;
- the historical `PHASE_1D3D_REPORT.md`.

`tools/build_release.py` archives the repository tree recursively, so moved documents remain in source ZIPs under their new paths without a builder code change. `SOURCE_MANIFEST.json` does not list narrative documents; no manifest-path change is required for this migration. Release tests must nevertheless assert the new archive paths.

## Risk classification

| Candidate change | Value | Risk | First increment? |
| --- | --- | --- | --- |
| Move phase reports to a history archive | high | low/moderate | yes |
| Move review and validation reports | medium | moderate | deferred |
| Move recovery evidence/tools | medium | moderate | deferred |
| Split workflow/release tools | medium | moderate/high | deferred |
| Group workflow tests | medium | moderate | deferred |
| Reorganize `src` | low immediate value | high | no |
| Reorganize tracked historical releases | high cleanliness value | high evidence/release risk | deferred |

## Audit conclusion

The product architecture is not the primary structural problem. The first safe repository improvement is a documentation-only migration of all sixteen phase reports into `docs/history/phases/`, with one index and complete reference/test updates. This reduces root ambiguity while preserving every historical document byte-for-byte through `git mv`.
