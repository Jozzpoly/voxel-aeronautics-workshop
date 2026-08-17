# Foundation Hardening Implementation Handoff - 2026-06-29

Audience: next Codex implementation agent.

This is an implementation handoff for a bounded foundation-hardening milestone. It is not a gameplay, physics, Gate D, asset-manager, or renderer-semantics milestone.

The goal is to make VAW easier and safer to develop for the next long phase: branch workflow, CI triggers, documentation authority, validation trust, agent entrypoints, and release-policy decision support.

## Verified Start State

Verified in this checkout on 2026-06-29 after `git fetch --all --prune`.

Repository:

```text
C:\Pliki_Joza\Gamo_devovo\VAW\voxel-aeronautics-workshop-foundation-gate-c-assembly-spaces
```

Branch state:

```text
current branch: current_work
tracking: origin/current_work
HEAD: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
origin/main: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
origin/current_work: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
local main: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
```

Branches after prune:

```text
local: current_work, main, ui-workbench-foundation, working_and_fixing
remote: origin/HEAD -> origin/main, origin/current_work, origin/main
```

Owner decisions from the context pack are verified:

- `main` was updated to the Visual Asset Pack / Studio integration commit.
- stale remote branches referenced by the older audit were pruned from the remote view.
- `current_work` exists locally and remotely.
- this run stayed in planning/handoff scope.

Worktree caveat:

```text
## current_work...origin/current_work
 M SOURCE_MANIFEST.json
```

`SOURCE_MANIFEST.json` was already modified during validation/release-generation work before these handoff docs were written. The diff is a regenerated source-manifest style delta: changed hashes for current visual-pack, Studio, Tailwind, package, and loader files plus current local working visual pack entries. Do not hand-edit it. If it remains modified, either regenerate it deliberately through `tools/build_release.py` and include it with evidence, or revert only after proving release verification still passes.

User art protection:

```text
assets/visual_packs/local_working_visuals/
```

may contain Jozz's current hand-authored block visuals, including working Thruster/VectorThruster experiments. Treat it as user work, not disposable test output. Do not delete, normalize, regenerate, replace, or "clean up" that folder during foundation hardening. If release/source-manifest tooling reports drift because user art changed, classify it explicitly and ask before taking destructive action.

## Mission

Implement Foundation Hardening M1:

```text
Workflow, CI, Documentation Authority and Validation Trust
```

The implementation should reduce future recovery risk, make the correct branch path obvious, make validation results trustworthy on Windows and CI, and make active documentation easier for agents to navigate.

Do this as one bounded milestone on `current_work`. Commit meaningful checkpoints on `current_work`; do not accumulate a large uncommitted tree again.

## Critical Self-Review Of This Handoff

The first version of this handoff was useful, but too close to the immediate audit findings. If I were the next implementation agent, the main remaining risk would be that I treat this as a checklist of small fixes and miss the deeper project problem: VAW is now large enough that unclear authority, unclear validation, and unclear branch habits can slow development as much as code bugs.

Use this handoff as a control system, not just a task list.

The deeper objective is:

```text
make future large changes boring to start, safe to pause, easy to validate, and hard to mis-scope
```

The implementation agent should therefore optimize for these qualities:

- a fresh agent can find the current truth in under 10 minutes;
- a multi-day change can be paused without leaving unique work only in the working tree;
- validation failures are classified as product, harness, environment, or owner-decision blockers;
- CI protects the branches the project actually uses;
- docs distinguish active authority, historical evidence, and temporary handoff notes;
- long-term gameplay/content ambitions are preserved, but not smuggled into this hardening milestone.

If a proposed change does not improve one of those qualities, it probably belongs outside M1.

## Non-Goals

Do not implement:

- Gate D Device and Port Schema.
- gameplay changes.
- physics changes.
- save schema changes.
- Blueprint, CraftModel, compiler, catalog, collider, mass, fuel, force, mission, or contract schema changes.
- runtime visual semantics changes.
- asset-pack manager UX.
- broad `src/game.js` rewrite.
- release artifact deletion or migration.
- destructive Git history operations.
- branch deletion.
- force push.

The visual pipeline boundary remains authoritative: Visual Asset Pack V1 and Studio are renderer-facing. They must not become gameplay source of truth.

## Operating Principles For The Implementation Agent

1. Start by making validation trustworthy, not by editing docs. A green documentation cleanup is not useful if the quick validation runner lies or behaves differently per shell.
2. Prefer small mechanical fixes with direct evidence. This milestone is not where architectural taste should outrun proof.
3. Treat `SOURCE_MANIFEST.json` as generated provenance. Do not hand-repair hashes.
4. Do not let `current_work` become a dumping ground. It is a checkpoint branch, not an excuse for unreviewed scope growth.
5. When changing docs, remove ambiguity instead of adding more prose. A shorter active-doc index is better than a large explanation nobody trusts.
6. Keep session handoffs under `.codex/handoff/`; keep product truth in root docs, `docs/README.md`, ADRs, and current contract docs.
7. Every final claim should map to a command, diff, or explicit owner decision.
8. Protect user-created local working visuals. They are not safe to treat as generated cache.

## Claude Finding Triage

| ID | Status | Current evidence | Implementation action |
| --- | --- | --- | --- |
| P0-1 uncommitted multi-milestone visual pipeline | RESOLVED, with residual process risk | `main`, `origin/main`, and `origin/current_work` now point at `873933f` containing the Visual Asset Pack / Studio integration. Worktree is no longer the only copy of M4F-M4H work. | Do not redo visual pipeline work. Address the process failure by documenting `current_work` checkpoint rules. |
| P0-2 workflows target deleted branches | ACTIVE | `.github/workflows/recovery-validation.yml` still pushes on `recovery/2026-06-16-regression-repair`; `.github/workflows/release-reproducibility.yml` still pushes on `maintenance/workflow-repair-clean`. Those remotes are gone after prune. | Retarget workflow events. See CI section below. |
| P1-1 docs described uncommitted implementation | RESOLVED | Docs and implementation now live in committed `873933f`. | Keep docs active, but clarify "pipeline works" versus "all final art exists". |
| P1-2 stale research branch | RESOLVED / OBSOLETE after owner cleanup | `origin/research/blockbench-asset-pipeline-lab` is gone after prune. | Do not revive unless Jozz asks. If old notes appear in external context, mark historical. |
| P1-3 checkpoint discipline not followed | TRANSFORMED / ACTIVE | `current_work` now exists, but `AGENT_WORKFLOW.md` does not explain how future agents should use it for frequent checkpoint commits. | Update workflow docs and agent entrypoint. |
| P1-4 tracked `release/` history unresolved | NEEDS_OWNER | 14 tracked files, 5,466,925 bytes. No deletion approved. | Prepare decision packet or ADR recommendation only. Do not delete release files. |
| P2-1 documentation contract checks presence, not committed reality | ACTIVE | Current tests verify document existence/classification, not whether active docs point to tracked/committed source paths. | Add a small docs-authority check or a manual rule in the docs contract. |
| P2-2 no consistent metadata headers | ACTIVE | Root docs and ADRs use mixed freshness/status conventions. | Add lightweight metadata convention for active docs only. |
| P2-3 readiness review duplication | ACTIVE | `docs/README.md` still lists both `FOUNDATION_READINESS_REVIEW.md` and `FUTURE_READINESS_REVIEW.md`. | Collapse/pointer-cleanup after verifying intended authority. |
| P2-4 bilingual slip | ACTIVE, low priority | Reported in `PROGRAMMABLE_MACHINE_RESEARCH.md`; not a blocker. | Fix opportunistically only if already editing docs. |

## Branch And Workflow Reality

Answers the next agent should preserve:

- `current_work` is present locally and remotely.
- local `main`, `origin/main`, and `origin/current_work` currently share the same SHA.
- stale workflow branch references still exist in YAML and must be fixed.
- CI should protect `main` and PRs to `main`; a lighter validation path should also protect `current_work` checkpoint pushes.
- `AGENT_WORKFLOW.md` should explicitly describe `current_work` as the default checkpoint branch for multi-session work unless Jozz names a more specific branch.

Recommended workflow doc rule:

```text
For multi-session or high-risk work, use `current_work` as the default checkpoint branch unless Jozz explicitly names a milestone branch. Commit coherent checkpoints there frequently. Keep `main` for reviewed milestone landings and read back the remote SHA after push.
```

## CI Recommendation

Current stale lines:

```text
.github/workflows/recovery-validation.yml: push -> recovery/2026-06-16-regression-repair
.github/workflows/release-reproducibility.yml: push -> maintenance/workflow-repair-clean
```

Recommended events:

`recovery-validation.yml`:

```yaml
on:
  push:
    branches:
      - main
      - current_work
  pull_request:
    branches:
      - main
  workflow_dispatch:
```

Reason: this is the everyday safety net. It should run on `current_work` checkpoint pushes and on PR/main.

`release-reproducibility.yml`:

```yaml
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:
```

Reason: Windows + Ubuntu release reproducibility is heavier. It should protect final integration and remain manually runnable during `current_work`. Add `current_work` only if Jozz accepts the CI cost.

After YAML changes, run `workflow_dispatch` manually if GitHub access is available. If not, document that browser/GitHub smoke was not performed.

## Agent Navigation Audit

Future agents should read, in order:

1. `README_FOR_AGENTS.md` if the implementation agent creates it; otherwise `README.md`.
2. `AGENT_WORKFLOW.md`.
3. `AI_PROJECT_MEMORY.md`.
4. `docs/README.md`.
5. `ARCHITECTURE.md`.
6. `ROADMAP_NEXT.md`.
7. `docs/adr/0043-visual-asset-boundary.md`.
8. `docs/visual_asset_pack_v1.md` and `docs/blockbench_import_studio.md` only when visual pipeline work is in scope.
9. latest relevant `.codex/handoff/*.md`.

Active authority docs should be:

- `README.md`
- `AGENT_WORKFLOW.md`
- `AI_PROJECT_MEMORY.md`
- `ARCHITECTURE.md`
- `ROADMAP_NEXT.md`
- `docs/README.md`
- accepted ADRs under `docs/adr/`
- current contract docs such as `docs/visual_asset_pack_v1.md`

Historical or pointer-only docs should be clearly marked and not listed as independent active truth.

Recommended doc changes:

- Add `README_FOR_AGENTS.md` or a similarly named root entrypoint with a 10-minute reading route and current non-goals.
- Update `docs/README.md` so active, historical, pointer-only, and workflow docs are visibly separated.
- Add a minimal status/date header convention to active docs.
- Resolve the `FOUNDATION_READINESS_REVIEW.md` / `FUTURE_READINESS_REVIEW.md` duplication.
- Update `ROADMAP_NEXT.md` line that says Visual Asset Pack M4C/M4D is "implemented locally"; it is now committed on `main/current_work`.
- Keep `.codex/handoff` as session-specific operational context, not product authority.

## Validation Evidence From Planning Run

Commands run in this planning pass:

```text
git fetch --all --prune                         PASS after escalation approval
python tests/run_all.py                         PASS
python tools/validate_full.py                   PASS
npm.cmd run visual:test                         PASS
npm.cmd run studio:test                         FAIL without global python
npm.cmd run studio:test with bundled Python PATH PASS
python tests/test_validation_runner.py          PASS
node tests/run_gate_c.js with PYTHON/PATH       PASS
python tools/validate_fast.py                   FAIL without PYTHON env
python tools/validate_fast.py with PYTHON env   PASS
```

Important validation finding:

`tools/validate_fast.py` fails in this Windows environment when no explicit `PYTHON` environment variable is set. The failure occurs inside `node tests/run_gate_c.js` at:

```text
spawnSync python EPERM
```

Direct `node tests/run_gate_c.js` passes when the bundled Python path is available. `validate_fast.py` also passes when `PYTHON` is set to:

```text
C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
```

Likely implementation fix:

- In `tools/validation_runner.py`, set `child_environment["PYTHON"] = sys.executable` when absent.
- Or make the `gate-c-hardening` stage pass a Python path explicitly.
- Add or update a test so validation does not depend on global `python` being installed.

Do not weaken tests to hide this. It is a harness reliability bug, not a product failure.

`npm.cmd run studio:test` has the same broad class of issue because Studio static tests call `python tools/validate_recovery_package.py`. It passes when the bundled Python directory is added to `PATH`.

## Failure Classification Rules

Use these labels in notes and final reports:

| Label | Meaning | Example | Required response |
| --- | --- | --- | --- |
| PRODUCT | A real game, Studio, compiler, visual pipeline, release, or documentation contract bug. | `tests/run_all.py` fails in a deterministic product test. | Fix or explicitly defer with owner approval. |
| HARNESS | The validation tool mis-invokes a valid test or leaks environment assumptions. | `validate_fast.py` fails because child Node cannot find the intended Python. | Fix the runner or stage wiring; do not weaken product tests. |
| ENVIRONMENT | Local machine lacks global dependency, browser runtime, or GitHub access. | `npm.cmd run studio:test` fails only because global `python` is missing. | Use bundled dependency path or document exact environment gap. |
| OWNER | The next step changes repository policy or product direction. | Deleting old `release/` files. | Stop and ask Jozz before implementing. |
| SCOPE | The change belongs to Gate D, gameplay, visual semantics, or future UX. | Starting a new device/port schema while fixing CI. | Do not implement in M1. Move to backlog/handoff. |

This classification is not bureaucracy. It prevents the common failure mode where an agent fixes the wrong layer because a test failure "looks red."

## Allowed Paths For M1

Primary allowed paths:

- `AGENT_WORKFLOW.md`
- `README.md`
- `README_FOR_AGENTS.md` if created
- `AI_PROJECT_MEMORY.md` only for concise current-state memory updates
- `ROADMAP_NEXT.md`
- `docs/README.md`
- `docs/history/reviews/**`
- `docs/repository/**`
- `.codex/handoff/**`
- `.github/workflows/**`
- `tools/validation_runner.py`
- `tools/validation_plan.py`
- `tools/validate_fast.py`
- `tools/validate_full.py`
- `tests/test_validation_runner.py`
- `tests/run_gate_c.js` only if needed for Python-path handling
- `tests/test_documentation_contract.py`
- `package.json` only if script names or validation command wrappers need alignment
- `SOURCE_MANIFEST.json` only through deliberate `tools/build_release.py` regeneration

Avoid `src/**` in this milestone unless a validation harness bug is proven to require a tiny supporting change. Do not edit `src/game.js` for foundation hardening.

Treat `assets/visual_packs/local_working_visuals/**` as read-only unless Jozz explicitly asks for visual pipeline work in the same turn. The folder can contain current user-designed visuals.

## Forbidden Paths And Changes

Do not touch for M1:

- `src/game.js` broad rewrites.
- `src/foundation/blueprint.js`, CraftModel/compiler/catalog gameplay semantics.
- physics/runtime gameplay code.
- save schema files.
- asset install UX or visual runtime semantics.
- `assets/visual_packs/**` except passive audit/documentation.
- `assets/visual_packs/local_working_visuals/**` cleanup or regeneration.
- `release/**` deletion or migration.
- Git history rewrites.

## Proposed Implementation Sequence

1. Re-run the start gate:
   ```text
   git fetch --all --prune
   git status --short --branch
   git rev-parse HEAD origin/main origin/current_work
   ```
2. Confirm whether `SOURCE_MANIFEST.json` is still modified. Decide whether to include it only after release validation.
3. Run baseline:
   ```text
   C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tests/run_all.py
   C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools/validate_full.py
   ```
4. Fix validation-runner Python propagation first. This removes ambiguity from later checks.
5. Prove:
   ```text
   C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools/validate_fast.py
   ```
   passes without manually setting `PYTHON` outside the runner.
6. Retarget GitHub Actions triggers.
7. Update `AGENT_WORKFLOW.md` for `current_work` checkpoint discipline.
8. Add or update agent entrypoint docs and `docs/README.md` active/historical classification.
9. Add a small documentation-authority check if feasible. Keep it concrete: active docs should not imply untracked source is shipped.
10. Prepare release artifact policy recommendation without deleting files.
11. Run final validation:
    ```text
    npm.cmd run visual:test
    npm.cmd run studio:test
    C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\validate_fast.py
    C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\validate_full.py
    ```
12. Commit a coherent checkpoint on `current_work` and record the final local and remote SHA if pushed.

## Recommended Commit Slices

Do not make one giant hardening commit unless the entire change is tiny. Recommended checkpoint slices:

1. `validation: stabilize bundled Python propagation`
   - likely files: `tools/validation_runner.py`, `tests/test_validation_runner.py`, possibly `tests/run_gate_c.js`;
   - proof: `tools/validate_fast.py` passes without external `PYTHON` setup.
2. `ci: retarget workflows to current branch policy`
   - files: `.github/workflows/*.yml`;
   - proof: YAML diff is minimal; if GitHub access is available, manual workflow dispatch result is recorded.
3. `docs: document current_work and agent entrypoint`
   - files: `AGENT_WORKFLOW.md`, `README_FOR_AGENTS.md`, `README.md`, `docs/README.md`;
   - proof: `tests/test_documentation_contract.py` passes.
4. `docs: clarify release artifact policy decision`
   - files: `docs/repository/**` or ADR/review doc;
   - proof: no `release/**` deletion; owner decision clearly marked.
5. `release: regenerate source manifest` only if required by actual release tooling evidence.
   - proof: `tools/build_release.py` and `tools/verify_release.py` pass.

After each slice:

```text
git status --short --branch
```

If a slice grows beyond its purpose, stop and split it.

## Stop Conditions

Stop and ask Jozz before proceeding if:

- fixing CI requires changing branch strategy beyond `main`, `current_work`, PR to `main`, or manual dispatch;
- release history deletion/migration becomes tempting;
- `SOURCE_MANIFEST.json` cannot be explained by deterministic build tooling;
- `local_working_visuals` appears to be the reason source provenance changed;
- any product test fails after validation harness fixes;
- a doc cleanup would require deciding which product direction is canon rather than merely clarifying existing authority;
- the work starts touching `src/game.js`, gameplay semantics, physics, save schema, visual runtime semantics, or asset-manager UX;
- the milestone needs more than about 5 coherent commits to remain understandable.

If blocked, leave a new `.codex/handoff/*` note with exact commands, outputs, and the narrow decision needed.

## Mental Simulation: If I Took Over This Handoff

Expected first-day path:

1. I would reproduce the current `validate_fast.py` failure without `PYTHON`, then fix environment propagation.
2. I would prove the fix with `validate_fast.py`, `validate_full.py`, and `tests/test_validation_runner.py`.
3. I would retarget CI YAML only after local validation is trustworthy.
4. I would update `AGENT_WORKFLOW.md` and create `README_FOR_AGENTS.md`.
5. I would run documentation contract tests.

Expected second-day path:

1. I would reduce active-doc ambiguity in `docs/README.md`.
2. I would update stale "implemented locally" wording and readiness review duplication.
3. I would write a release artifact policy recommendation without deleting release files.
4. I would run full validation and inspect `SOURCE_MANIFEST.json`.

Expected failure traps:

- I might over-fix docs and accidentally make history harder to find.
- I might assume `validate_full.py` passing means `validate_fast.py` is safe; it is not.
- I might start solving current visual pipeline UX because it is fresh in the conversation; M1 should not.
- I might commit `SOURCE_MANIFEST.json` without understanding whether it represents user working visuals or release provenance.
- I might make `current_work` too magical. It still needs normal status checks, scoped commits, and SHA readback.

If this simulation stops matching reality, update the handoff rather than forcing the plan.

## Longer Horizon Map

M1 is not the whole "reawakening." It is the first stabilizing layer.

Suggested future order after M1:

1. Foundation Hardening M2 - Source layout and `game.js` pressure relief.
   - Goal: continue modular extraction without changing gameplay semantics.
   - Non-goal: broad rewrite or engine swap.
2. Visual Pipeline M4I/M4J - authoring reliability and VectorThruster semantics.
   - Goal: make all block visuals easier to replace and rig.
   - Non-goal: gameplay authority in Studio.
3. Content Pipeline Planning - maps, contracts, missions as separate schemas.
   - Goal: define boundaries before implementation.
   - Non-goal: mixing mission data into Visual Asset Pack V1.
4. Gate D Planning - device/port schema and gameplay expansion.
   - Goal: start only after foundation validation, docs, and branch workflow are stable.

This matters because Jozz has long-term ambitions beyond the current visible plan. The project needs a foundation that can carry that ambition without every feature becoming a recovery incident.

## Acceptance Criteria

M1 is complete when:

- Workflows no longer target deleted branches.
- `current_work` checkpoint behavior is documented clearly enough for a fresh agent.
- `validate_fast.py` and `validate_full.py` pass in this Windows setup using bundled Python without requiring hidden manual environment state.
- `npm.cmd run studio:test` has either a reliable wrapper/script path or a documented bundled-Python invocation.
- active documentation authority is clearer than before.
- release artifact policy has a recommendation and explicit owner decision marker.
- no gameplay, physics, save-schema, or renderer-semantic changes were made.
- final handoff includes exact validation commands and results.

## Risks And Rollback

Risks:

- CI YAML changes can make Actions too noisy on `current_work`.
- Validation-runner fixes can accidentally mask failures if they over-normalize environment.
- Documentation cleanup can accidentally move active product authority into history.
- `SOURCE_MANIFEST.json` can be mishandled if edited manually.

Rollback:

- CI trigger changes are a one-file revert per workflow.
- Workflow/doc changes are safe to revert as one commit.
- Validation-runner changes should be small and covered by `tests/test_validation_runner.py`.
- No release deletion should occur, so release rollback should not be needed.
- If `SOURCE_MANIFEST.json` becomes suspect, regenerate using `tools/build_release.py`; do not hand-repair hashes.

## Owner Decisions Still Required

Jozz should decide:

- Whether heavy Windows + Ubuntu release reproducibility should run on every `current_work` push or only PR/main/manual.
- Long-term release artifact policy:
  - keep all historical `release/` files in Git;
  - keep only latest N;
  - move historical HTML builds to GitHub Releases/tags;
  - keep checksums/provenance in Git and binaries outside Git.
- Whether future work uses only `current_work` for checkpoints, or `current_work` plus named `feature/<milestone>` branches.
- Whether to create a root `README_FOR_AGENTS.md` as a permanent entrypoint. Recommendation: yes.

## First 30 Minutes For Next Agent

1. Open this file and `docs/history/reviews/FOUNDATION_HARDENING_PLANNING_REVIEW_2026-06-29.md`.
2. Run:
   ```text
   git status --short --branch
   git rev-parse HEAD origin/main origin/current_work
   ```
3. Inspect the `SOURCE_MANIFEST.json` diff before editing anything.
4. Reproduce the validation finding:
   ```text
   C:\Users\Pioter\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\validate_fast.py
   ```
   If it fails on `spawnSync python EPERM`, fix Python propagation first.
5. After `validate_fast.py` is trustworthy, retarget CI and update `AGENT_WORKFLOW.md`.

Do not start by editing gameplay or visual runtime code. This milestone exists because the project needs safer ground before the next feature push.
