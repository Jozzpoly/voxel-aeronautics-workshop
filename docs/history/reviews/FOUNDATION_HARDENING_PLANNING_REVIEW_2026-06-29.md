# Foundation Hardening Planning Review - 2026-06-29

Status: planning review for the next implementation agent.

This review re-triages the external foundation audit and the 2026-06-29 context pack against the current repository. It intentionally avoids broad implementation. The companion operational handoff is:

```text
.codex/handoff/FOUNDATION_HARDENING_IMPLEMENTATION_HANDOFF_2026-06-29.md
```

## Executive Judgment

The project is in a better state than the older audit snapshot: the Visual Asset Pack and Blockbench Import Studio work is committed on `main`, stale remote branches were removed, and `current_work` exists as a safer branch for frequent checkpoints.

The audit was still directionally correct. The biggest remaining problems are no longer "the work only exists in a dirty tree"; they are now:

- CI still points at branch names that no longer exist.
- `AGENT_WORKFLOW.md` does not yet explain how `current_work` should be used.
- validation has a real environment-sensitivity bug around Python propagation.
- documentation authority is too diffuse for future agents.
- release artifact policy remains a deferred owner decision.

The next milestone should be Foundation Hardening M1, not Gate D and not more visual feature work.

## Self-Critique Of This Planning Pass

The first planning document was accurate but not ambitious enough for the importance of the pause. It identified immediate fixes, but it did not fully model how the project fails under long-running agent work.

The real pattern is:

```text
large ambition -> many active docs -> unclear branch habit -> validation ambiguity -> oversized dirty tree -> recovery risk
```

The next implementation agent must break that pattern, not merely patch one workflow file.

What this planning pass improved:

- verified the actual branch state instead of trusting stale audit assumptions;
- identified a concrete `validate_fast.py` Python propagation issue;
- separated product failures from harness/environment failures;
- preserved the source-of-truth boundary around Blueprint, CraftModel, compiler and visual packs;
- created durable repo files under `.codex/handoff` and `docs/history/reviews`.

What the first version underweighted:

- the need for explicit stop conditions;
- commit slicing as a first-class safety mechanism;
- long-horizon sequencing after M1;
- the risk that "foundation hardening" becomes a vague cleanup umbrella;
- the need to protect future content ambitions without implementing them prematurely.

This revision corrects that by treating M1 as a control surface for future development rather than a narrow cleanup checklist.

## Verified Repository State

Verified commands and conclusions:

```text
git fetch --all --prune
git branch -a
git status --short --branch
git log --oneline --decorate -8
git rev-parse HEAD
git rev-parse origin/main
git rev-parse origin/current_work
```

Current facts:

```text
branch: current_work
tracking: origin/current_work
HEAD: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
origin/main: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
origin/current_work: 873933f1ebd8e98d05ad644a9dda2de47d467b1f
latest commit: Add Visual Asset Pack pipeline and Blockbench Studio integration
```

Remote branches now visible:

```text
origin/main
origin/current_work
```

Planning-run caveat:

```text
SOURCE_MANIFEST.json is modified in the worktree.
```

This appears to be a regenerated source-manifest delta caused by current committed Studio/visual-pack source and local working visual pack inventory. It must not be edited manually. The next implementation agent should either deliberately include a regenerated manifest after `tools/build_release.py`, or prove it should be reverted.

Important user-work caveat:

```text
assets/visual_packs/local_working_visuals/
```

can contain Jozz's current hand-authored block visuals. Treat it as user work, not generated cache. Foundation hardening must not delete, normalize, regenerate, or replace it. If source provenance drift points at this folder, classify the issue and ask before action.

## Updated Audit Triage

| Finding | Current status | Reason |
| --- | --- | --- |
| P0-1 uncommitted visual pipeline | RESOLVED | The relevant work is committed in `873933f` on both `main` and `current_work`. The process failure remains as a workflow lesson. |
| P0-2 CI targets dead branches | ACTIVE | Workflow YAML still references `recovery/2026-06-16-regression-repair` and `maintenance/workflow-repair-clean`. |
| P1-1 docs described uncommitted implementation | RESOLVED | The implementation is now committed. Some wording still needs freshness cleanup. |
| P1-2 stale research branch | OBSOLETE / RESOLVED | The branch is no longer present after prune. Do not revive without owner request. |
| P1-3 checkpoint commit discipline gap | ACTIVE / TRANSFORMED | `current_work` is the new answer, but workflow docs do not encode it. |
| P1-4 tracked release history | NEEDS_OWNER | 14 tracked files, 5,466,925 bytes. No deletion approved. |
| P2-1 documentation contract too shallow | ACTIVE | It checks presence/classification more than active-doc reality. |
| P2-2 inconsistent doc metadata | ACTIVE | Active docs still lack a uniform status/freshness convention. |
| P2-3 readiness review duplication | ACTIVE | `docs/README.md` lists both readiness documents as separate active entries. |
| P2-4 bilingual slip | ACTIVE, low severity | Useful cleanup, not milestone-critical. |

## Validation Review

Baseline evidence gathered in this planning run:

| Command | Result | Interpretation |
| --- | --- | --- |
| `python tests/run_all.py` | PASS | Core suite is healthy. |
| `python tools/validate_full.py` | PASS | Full release validation path is healthy. |
| `npm.cmd run visual:test` | PASS | Visual Asset Pack and Studio integration tests pass through the visual wrapper. |
| `npm.cmd run studio:test` | FAIL without global Python | Environment sensitivity, not product failure. |
| `npm.cmd run studio:test` with bundled Python in PATH | PASS | Studio package is healthy when Python is available. |
| `python tests/test_validation_runner.py` | PASS | Runner contract tests pass, including known Windows-gated cases. |
| `python tools/validate_fast.py` | FAIL without `PYTHON` env | Harness issue: Gate C JS runner spawns literal `python`. |
| `python tools/validate_fast.py` with `PYTHON` set to bundled Python | PASS | Confirms the failure is Python propagation, not Gate C. |
| `node tests/run_gate_c.js` with bundled Python available | PASS | Product/hardening tests themselves are fine. |

Critical validation finding:

`tools/validate_fast.py` should be the quick trust path for future agents, but it currently fails in this Windows setup unless `PYTHON` is explicitly set. This is worth fixing before CI/doc cleanup, because otherwise every later result is easier to misread.

Recommended fix:

- make `tools/validation_runner.py` set `PYTHON=sys.executable` for child stages when `PYTHON` is not already present; or
- update the Gate C stage wiring so Node receives the exact Python executable.

The fix should be covered by `tests/test_validation_runner.py` or a focused new regression. Do not weaken `tests/run_gate_c.js`; its `process.env.PYTHON || 'python'` fallback is a reasonable local/developer behavior.

## Validation Trust Model

Future reports should distinguish four levels:

1. Unit or contract test result.
2. Suite result.
3. Runner result.
4. CI result.

A suite can pass while a runner is still unreliable. That is exactly what happened here:

- `node tests/run_gate_c.js` passes with bundled Python available;
- `tools/validate_fast.py` failed until `PYTHON` was explicitly set.

Therefore M1 should not merely rerun tests. It should make the path from runner to suite explicit and portable.

Recommended validation contract after M1:

```text
validate_fast.py = cheap local trust path
validate_full.py = release-grade local trust path
GitHub Actions recovery-validation = current_work/main/PR guard
GitHub Actions release-reproducibility = main/PR/manual release reproducibility guard
```

If any of these four layers disagree, the final report must classify the disagreement as PRODUCT, HARNESS, ENVIRONMENT, OWNER, or SCOPE.

## CI Review

Current workflow problem:

```text
.github/workflows/recovery-validation.yml:
  push.branches = recovery/2026-06-16-regression-repair

.github/workflows/release-reproducibility.yml:
  push.branches = maintenance/workflow-repair-clean
```

Those branch names are stale after owner cleanup.

Recommended policy:

- `recovery-validation.yml`: run on push to `current_work`, push to `main`, PR to `main`, and manual dispatch.
- `release-reproducibility.yml`: run on PR to `main`, push to `main`, and manual dispatch.
- Add push to `current_work` for release reproducibility only if Jozz accepts the heavier CI cost.

This keeps `current_work` useful without making every checkpoint pay the full Windows + Ubuntu release matrix cost.

## Branch Strategy Review

`current_work` is useful, but only if it gets a precise meaning.

Recommended meaning:

```text
current_work is the default checkpoint branch for active multi-session work.
main is the reviewed stable line.
feature branches are optional for isolated experiments, but not required for every agent run.
```

This keeps the workflow low-friction enough that agents actually follow it. A policy that requires a new branch for every small change may sound cleaner but can reintroduce hesitation, which was part of the reason work accumulated uncommitted.

Minimum rules:

- always start with `git status --short --branch`;
- checkpoint coherent chunks on `current_work`;
- do not push to `main` without explicit owner direction or PR process;
- final reports must include local HEAD and remote SHA if pushed;
- do not use branch names from historical handoffs unless Git verifies they still exist.

## Documentation Authority Review

The active reading route is currently too spread out. The repository has good docs, but a fresh agent can still read the wrong layer first.

Recommended active authority stack:

1. `README_FOR_AGENTS.md` if created.
2. `README.md`.
3. `AGENT_WORKFLOW.md`.
4. `AI_PROJECT_MEMORY.md`.
5. `docs/README.md`.
6. `ARCHITECTURE.md`.
7. `ROADMAP_NEXT.md`.
8. accepted ADRs.
9. specific contracts such as `docs/visual_asset_pack_v1.md`.

Recommended changes:

- Create a root `README_FOR_AGENTS.md` with a short reading order, branch rule, validation rule, and non-goals.
- Link it from `README.md` and/or `AGENT_WORKFLOW.md`.
- Update `docs/README.md` to separate active authority, workflow docs, contract docs, historical reviews, and pointer-only docs.
- Add a light metadata header convention to active docs:
  ```text
  Status:
  Last verified:
  Authority:
  ```
- Fix the `FOUNDATION_READINESS_REVIEW.md` / `FUTURE_READINESS_REVIEW.md` duplication.
- Update stale wording in `ROADMAP_NEXT.md` where it says Visual Asset Pack M4C/M4D is "implemented locally"; it is now committed.

## Agent Entry Point Design

The project should have one short permanent file for agents. It should not replace existing docs; it should route to them.

Recommended `README_FOR_AGENTS.md` shape:

```text
1. Current branch rule.
2. First commands.
3. Active authority docs.
4. Current non-goals.
5. Validation tiers.
6. Generated files rule.
7. Where handoffs live.
8. What to do when blocked.
```

Keep it short enough to read before any code search. If it becomes a second `AI_PROJECT_MEMORY.md`, it has failed.

## Release Artifact Review

Measured current `release/`:

```text
tracked files: 14
total size: 5,466,925 bytes
contents: SHA256.txt plus 13 historical single-file HTML builds
```

Do not delete anything in the hardening implementation without Jozz approval.

Recommended decision packet:

- keep all historical releases in Git;
- keep only latest N in Git;
- move historical release HTML files to GitHub Releases/tags;
- keep source manifests and checksums in Git while moving binaries outside Git.

The implementation agent may prepare an ADR or repository policy recommendation, but deletion/migration remains an owner decision.

## What Could Make This Review Wrong

The next agent should re-check assumptions before acting. This review may be stale if:

- `current_work` moved after this handoff;
- `SOURCE_MANIFEST.json` was intentionally changed by Jozz after this planning run;
- `assets/visual_packs/local_working_visuals/` changed because Jozz iterated on real art;
- GitHub Actions were already fixed remotely;
- `validate_fast.py` was fixed in a newer commit;
- Jozz decided a release artifact policy outside this thread;
- another agent created `README_FOR_AGENTS.md` or reorganized docs.

If any of these are true, do not mechanically execute the sequence. Re-triage and update the handoff.

## Implementation Milestone Proposal

Name:

```text
Foundation Hardening M1 - Workflow, CI, Docs Authority and Validation Trust
```

Scope:

1. Fix validation-runner Python propagation.
2. Retarget CI workflow triggers.
3. Update `AGENT_WORKFLOW.md` for `current_work` checkpoint discipline.
4. Add a stronger agent entrypoint.
5. Clarify docs authority and readiness-review duplication.
6. Add or improve a docs-authority regression.
7. Prepare release artifact policy recommendation.

Explicitly defer:

- Gate D.
- gameplay and physics.
- save schema.
- visual runtime semantics.
- asset manager UX.
- broad source refactors.
- release deletion.

## Why This Order

Validation-runner trust should come first. If `validate_fast.py` cannot be trusted on this machine, every later "PASS" needs extra explanation.

CI comes second because it is currently pointed partly at dead branches.

Workflow docs come third because `current_work` exists but the protocol does not yet teach agents to use it.

Documentation cleanup comes after that because it is safer once branch and validation behavior are unambiguous.

Release artifact policy should be prepared but not executed until Jozz chooses a policy.

## Hardening Ladder Beyond M1

The project needs more than one cleanup pass. Recommended ladder:

### M1 - Workflow, CI, Docs Authority, Validation Trust

This is the immediate milestone. It should be boring, small, and high-confidence.

### M2 - Source Modularity And Game Shell Pressure Relief

`src/game.js` is already near architectural pressure limits. The next hardening stage should identify extraction seams that reduce size and coupling without changing behavior. This should be test-first and incremental.

### M3 - Visual Authoring Reliability

After foundation hardening, return to Studio and Visual Asset Pack workflow with better controls for transforms, materials, aliases, and VectorThruster rig semantics. This should remain renderer-only.

### M4 - Content Pipeline Boundaries

Plan maps, contracts, missions, and future content packs as separate schemas. Do not reuse Visual Asset Pack V1 for gameplay content.

### Gate D Readiness

Only after validation, docs, source layout, and content boundaries are stable should the project enter Device and Port Schema work.

This ladder is deliberately ordered to protect Jozz's larger ambitions. A game with ambitious systems needs boring foundations first.

## Acceptance Criteria For M1

The next implementation milestone should be accepted only if:

- `tools/validate_fast.py` passes in the bundled-Python Windows environment without hidden manual `PYTHON` setup.
- `tools/validate_full.py` still passes.
- `npm.cmd run visual:test` passes.
- `npm.cmd run studio:test` has a reliable Windows invocation or wrapper.
- GitHub Actions no longer reference deleted branches.
- `AGENT_WORKFLOW.md` clearly explains `current_work`.
- active docs are easier to navigate and less ambiguous.
- no forbidden gameplay/runtime changes were made.
- release policy is documented as a recommendation or owner decision, not silently executed.

## Final Warning

The next agent should not use this hardening milestone as permission to start a giant architectural rewrite. The project needs sharper workflow, clearer authority, and more trustworthy validation before the next big feature push. Keep the edits boring, evidence-backed, and reviewable.
