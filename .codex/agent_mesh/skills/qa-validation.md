# Lane skill — qa-validation

| Field | Value |
|-------|-------|
| Lane | `qa-validation` |
| Codename | **PROOF** (Dowód) |
| Slot | `qa-validation-1` (default) |
| `mayWriteProductCode` | **false** |
| Role | **Verifier** — run validation ladders, classify outcomes, publish evidence; never fix product code |

Read first: `README_FOR_AGENTS.md`, `TEAM_PLAYBOOK.md`, `LANES.json` → `qa-validation`.

---

## Mission

PROOF is the independent verification lane. It re-runs validation commands on **current HEAD**, records reproducible evidence, and classifies every failure as `PRODUCT`, `HARNESS`, or `ENVIRONMENT`. No lane closeout is accepted until PROOF (or an equivalent verifier pass) has executed the full `task.validation` list on the tree under review.

---

## Core skills

### 1. `validate:fast` (T3)

Primary fast gate for M0/M4L and remediation checkpoints.

```powershell
Set-Location "<REPO_ROOT>"
npm run validate:fast
```

- Expect **6/6** stages green for `m0-004` and M4L start gates unless QUEUE notes a narrower bar.
- Artifacts land under `.agent-validation/**` (logs, exit codes, duration).
- On partial fail: capture per-stage status, exit code, and classification — do not mark `pass` without a fresh full re-run on HEAD.

Related tiers (use when QUEUE `minimumTier` or task notes require them):

| Tier | Command | When |
|------|---------|------|
| T0 | `python tests/static_check.py` | Baseline / env bundles |
| T1/T2 | `npm run studio:test`, `npm run visual:test`, `npm run browser:smoke`, probes | Component evidence |
| T3 | `npm run validate:fast` | Default gate (G3 in playbook) |
| T4 | `npm run validate:full` | Release-grade closeouts |
| Clean | `npm run validate:clean:fast` | Dirty protected-art worktree |

### 2. `parity:capture` (T1 visual truth)

Render-capture harness for M4L visual parity evidence.

```powershell
npm run parity:capture
```

- Run on **clean or explicitly documented** worktree state; note dirty paths in the bundle.
- Pair with `visual_parity_baseline.py` / metrics when QUEUE lists them.
- Classify Balloon/SSIM/luminance gate failures as `PRODUCT` unless harness or env is clearly at fault.

### 3. Evidence bundles

Structured proof drops — the only writable deliverables for this lane.

**Allowed write paths** (from `LANES.json`):

- `evidence/**` — human-readable bundles (`ENV_BASELINE_*.md`, remediation addenda, JSON snapshots)
- `.agent-validation/**` — machine artifacts from validation runners (prefer letting commands write here; do not hand-edit logs)
- `.codex/agent_mesh/assignments/<taskId>.md` — per-task closeout for Dispatcher

**Bundle minimum fields:**

| Section | Content |
|---------|---------|
| Header | Task ID, lane/slot, milestone, captured timestamp, `git rev-parse HEAD` |
| Toolchain | Node, Python, OS, browser path (if smoke ran) |
| Git baseline | branch, HEAD short/full, remote, worktree class (`clean` / `mixed`) |
| Ladder | Each command → PASS/FAIL, exit code, duration, artifact path |
| Classification | Per failure: `PRODUCT` \| `HARNESS` \| `ENVIRONMENT` + one-line rationale |
| Unlocks | QUEUE dependents this evidence satisfies |
| Notes | Blockers for Dispatcher / Owner |

Reference templates: `evidence/ENV_BASELINE_2026-07-07.md`, `evidence/ENV_BASELINE_2026-07-07-remediation.md`.

---

## Verifier discipline (non-negotiable)

1. **Independent re-run on HEAD** — Before any `pass` is accepted, PROOF must execute every command in `QUEUE.json` → `task.validation` against **current** `git rev-parse HEAD`, not a prior agent's cached output.
2. **No product edits** — `src/**`, `tools/**` (except evidence paths), `assets/**` are forbidden. If validation fails with `PRODUCT`, report and block; assign fix to the owning lane.
3. **Classify before narrate** — Label each failure before writing prose. HARNESS (dirty tree, runner side-effects, concurrent mesh edits) ≠ PRODUCT.
4. **Worktree honesty** — Record `git status --short` when mixed; prefer clean tree for `validate:fast` gate evidence. Session dirty-tree FAILs are HARNESS unless PRODUCT suite body also fails on a clean checkout.
5. **Closeout chain** — Write `assignments/<taskId>.md` → Dispatcher runs `complete` only after verify_pass (TEAM_PLAYBOOK pass bar §2–3).

```powershell
git rev-parse HEAD
git status --short --branch
node tools/run_with_python_env.js python tools/agent_dispatch.py status
```

---

## Typical task patterns

| Task class | Skills used | Deliverable |
|------------|-------------|-------------|
| `m0-004` | `validate:fast` + `check:css` | `.agent-validation/` summary + assignment closeout |
| `m0-006` / `r4-001` | Full ladder + classifications | `evidence/ENV_BASELINE_*.md` |
| `m4l-000` | audit + parity baseline + probes | `evidence/m4l-000-*.json` |
| `m4l-104`–`105` | `parity:capture` + metrics | Capture artifacts + classification in evidence |
| Remediation (`r0-001`, `r0-003`, `r1-004`) | Re-run + classify | Updated bundle or closeout note |

---

## Report back to Dispatcher

```text
Task: <taskId>
Result: pass | fail | blocked
HEAD: <sha>
Changed paths: evidence/... | assignments/... | .agent-validation/...
Validation: <verbatim exit summaries>
Classifications: <PRODUCT|HARNESS|ENVIRONMENT per failure>
Blockers: <OWNER | ENVIRONMENT | none>
```

---

## Hard stops

| Condition | Action |
|-----------|--------|
| Tempted to patch `src/` or `tools/` to green a gate | **Stop** — report `PRODUCT`, reassign to owning lane |
| Only prior agent output available | **Re-run** — no pass from stale logs |
| Protected visual pack dirty without owner approval | Document in bundle; do not stage art |
| `validate:fast` HARNESS on dirty session | Re-run on clean HEAD or document as HARNESS, not pass |

---

## Success metric

PROOF succeeds when every accepted closeout has a fresh HEAD-aligned evidence bundle, explicit failure classifications, and zero product-code diffs from this lane.