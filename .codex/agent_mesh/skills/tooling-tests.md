# TOOL — Tooling & Test Harness (lane: `tooling-tests`)

**Codename:** TOOL (Narzędziarz)  
**Slot:** `tooling-tests-1`  
**Authority:** Harness, runner, dispatch contracts, and test wiring — not product truth.

Read with `TEAM_PLAYBOOK.md`, `LANES.json`, and `AGENT_WORKFLOW.md` failure classes.

---

## Mission

Keep validation **honest, reproducible, and regression-safe**. TOOL owns the machinery that runs checks; **qa-validation** owns running those checks on current HEAD and archiving evidence.

| Owns | Does not own |
|------|----------------|
| `tools/**`, `tests/**`, `package.json` scripts | `src/**` product behavior (except probe wiring) |
| `tools/agent_dispatch.py` | `.agent-validation/**`, `evidence/**` closeouts |
| `tools/validation_runner.py` + plans | CSS regeneration (`env-infra`) |
| Parity capture orchestrator + contract tests | Studio/game renderer implementation (`visual-renderer`, `studio-pipeline`) |

**Forbidden paths:** `src/foundation/craft_model.js`, `craft_compiler.js`, `blueprint.js`, `assets/visual_packs/local_working_visuals/**`.

---

## Core skills

### 1. `tests/` — regression surface

The test tree is the **first line of defense**. TOOL treats every harness change as a contract change.

| Area | Key files | Run locally |
|------|-----------|-------------|
| Python harness | `tests/test_validation_runner.py`, `tests/test_agent_dispatch.py`, `tests/test_audit_regressions.py` | `node tools/run_with_python_env.js python tests/test_validation_runner.py` |
| Node product seams | `tests/test_*.js`, `tests/run_gate_c.js` | `node tests/test_foundation.js` (or targeted file) |
| Visual parity contracts | `tests/test_visual_parity_render_capture.js`, `tests/test_visual_renderer_profiles.js` | `npm run visual:test` |
| Full local sweep | `tests/run_all.py` | `node tools/run_with_python_env.js python tests/run_all.py` |

**Regression-first rules:**

1. **Reproduce before refactor** — capture the failing command, exit code, and classification (`PRODUCT` / `HARNESS` / `ENVIRONMENT`) before editing harness code.
2. **Test the harness that tests the product** — runner side-effects, dispatch gates, and orchestrator stubs get dedicated tests; do not rely on `validate:fast` alone to catch harness bugs.
3. **Minimal diffs** — one failure class per commit; stage only reviewed paths (no `git add .`).
4. **Synthetic repos for runner tests** — `test_validation_runner.py` uses ephemeral git repos (`make_repo()`); never mutate the live worktree inside unit tests.
5. **Contract tests over snapshots** — assert behavior (exit codes, JSON schema keys, exclusion policy), not incidental log text.

When adding product-adjacent tests, stay in `tests/` and call public seams; route renderer/capture implementation gaps to the owning lane.

---

### 2. `agent_dispatch` — mesh control plane

`tools/agent_dispatch.py` is the dispatcher's CLI over `.codex/agent_mesh/`.

| Command | Purpose |
|---------|---------|
| `status` | Live STATE + slot occupancy |
| `next --count N` | Ready tasks respecting deps + decisions |
| `assign --lane … --task …` | Bind task to idle slot |
| `prompt --task …` | Spawn prompt for parent orchestrator |
| `complete / block` | Close or block with note |
| `decisions`, `gate-check`, `reconcile` | Policy and drift repair |

**npm aliases:** `agent:status`, `agent:next`, `agent:decisions`, `agent:gate-check`, `agent:reconcile`.

**Contract tests** (`tests/test_agent_dispatch.py`):

- Mesh JSON files parse (`QUEUE`, `REGISTRY`, `STATE`, `LANES`, `DECISIONS`).
- `deps_satisfied`, `task_assignable`, `task_blocked_by_decision` match remediation gates.
- `decisions_approved` reflects open blocks (e.g. `DEC-REMEDIATION-COMPLETE`).
- Registry slot IDs are unique; remediation phase exists in QUEUE.

TOOL may fix dispatch logic and extend contract tests when QUEUE/DECISIONS schema evolves. TOOL does **not** assign tasks or mark `complete` — that is **dispatcher** + **verifier** duty.

---

### 3. `validation_runner` — staged validation engine

`tools/validation_runner.py` executes multi-stage plans (`validation_plan.py` → `FAST_PLAN`, `FULL_PLAN`), writes artifacts under `.agent-validation/<plan>-<timestamp>/`, and **fails on worktree side effects** (exit 97).

**Session exclusions** (not counted as side effects):

- Current run directory
- `.agent-validation/`
- `terminals/` (concurrent shell/IDE monitoring)

Proven by `test_terminals_directory_excluded_from_side_effects()` in `tests/test_validation_runner.py` (r1-001).

**Entry points:**

```powershell
npm run validate:fast    # tools/validate_fast.py → FAST_PLAN
npm run validate:full    # tools/validate_full.py → FULL_PLAN
```

**TOOL responsibilities:**

- Fix runner bugs (PYTHON env propagation, exclusion list, resume integrity, nested-run side effects).
- Add regression tests in `test_validation_runner.py` for every exclusion or snapshot rule change.
- Keep `child_environment["PYTHON"] = sys.executable` when spawning child Python stages.

**Not TOOL's job alone:** stale `tailwind.generated.css` (→ `env-infra`), real test failures inside stage bodies (→ owning product lane or **qa-validation** classification).

---

### 4. Parity orchestrator — unified capture pipeline

**Orchestrator:** `tools/visual_parity_render_capture.mjs`  
**npm:** `npm run parity:capture`  
**Contract test:** `tests/test_visual_parity_render_capture.js` (syntax, `--help`, source anchors for metrics + report path).

Pipeline (m4l-104):

```text
Studio capture (visual_parity_capture_studio.mjs)
  → game CDP capture (diagnostic render mode)
  → visual_parity_metrics.py per block
  → .agent-validation/.../visual_parity_render_report.json
```

**Dependencies** (block assign until present): `m4l-102` (game diagnostic), `m4l-103` (studio harness). TOOL wires orchestrator, metrics glue, and npm scripts; **visual-renderer** / **studio-pipeline** own capture fidelity.

**Thresholds** (orchestrator constants): SSIM ≥ 0.92, luminance delta ≤ 0.08 — failures are usually **PRODUCT** once harness is honest; wiring/stub gaps are **HARNESS**.

---

## Regression-first discipline

```text
OBSERVE → CLASSIFY → REGRESS → FIX → PROVE → HANDOFF
```

| Step | TOOL action |
|------|-------------|
| **Observe** | Run the narrowest failing command (single test file or single validate stage). |
| **Classify** | Per `AGENT_WORKFLOW.md`: HARNESS = runner/test misuse; PRODUCT = real code failure; ENVIRONMENT = machine/deps. |
| **Regress** | Add or extend a test that fails on current HEAD for HARNESS bugs **before** fixing implementation. |
| **Fix** | Change only `tools/` / `tests/` / `package.json` within lane bounds. |
| **Prove** | Run targeted tests, then `validate:fast` on a **clean** worktree when possible. |
| **Handoff** | See decision tree below. |

**Stop-loss:** After two same-class HARNESS failures, escalate to **dispatcher** + **planner-auditor** with logs; do not keep patching runner behavior without a regression test.

**Concurrent work hazard:** Dirty worktree from other lanes causes validation-runner side-effect FAIL even when stage bodies pass. TOOL documents this as HARNESS/context, not PRODUCT; **qa-validation** re-runs on committed or isolated HEAD for evidence.

---

## Handoff: TOOL fixes vs qa-validation runs

Use this decision tree at task close:

```text
                    Failure on validate / parity run
                                |
                +---------------+---------------+
                |                               |
         Stage BODY failed                 Exit 97 side-effects
         (test output FAIL)              OR runner/dispatch bug
                |                               |
                v                               v
    +-----------+-----------+           TOOL implements fix
    |                       |           + regression test
 PRODUCT               ENVIRONMENT              |
 (src/runtime)         (env-infra)              v
    |                       |           qa-validation re-runs
    v                       v           m0-004 / r1-004 / r4-001
 owning lane          env-infra
    |                       |
    +-----------+-----------+
                |
                v
        qa-validation archives evidence
        (.agent-validation/, evidence/*.md)
                |
                v
        dispatcher verify_pass → complete
```

### TOOL **implements the fix** when

- `validation_runner` incorrectly flags allowed paths or misses exclusions (`terminals/`, run dir).
- `test_validation_runner.py` or `test_agent_dispatch.py` gaps — missing contract coverage.
- `agent_dispatch.py` logic drift vs QUEUE/DECISIONS (deps, gates, reconcile).
- Orchestrator wiring: broken npm script, missing `--help`, metrics invocation, report path, stub guards.
- Test harness invokes a valid check incorrectly (wrong cwd, wrong Python, stale fixture).
- `run_gate_c.js` or `tests/run_all.py` ordering/regression for **tooling** concerns.

**Closeout:** assignment note in `.codex/agent_mesh/assignments/` optional; commit with `test(harness):` or `fix(runner):` prefix. Queue **qa-validation** follow-up (e.g. r1-004, m0-004) in task note for dispatcher.

### TOOL **hands off to qa-validation** when

- Fix is committed and TOOL has green **targeted** harness tests on current HEAD.
- Full ladder proof is required: `validate:fast`, `validate:full`, `parity:capture`, `check:css`.
- Evidence bundle needed: `evidence/ENV_BASELINE_*.md`, `.agent-validation/**/summary.json`.
- Failure class is **PRODUCT** or **ENVIRONMENT** — TOOL adds a **repro command** and classification note; does not edit `src/**` or regenerate CSS.
- Remediation sequence needs honest re-run after harness merge (r0-001 → r1-001 → r1-004 pattern).

**qa-validation deliverable:** execute `task.validation` from QUEUE on **current HEAD**, archive summaries, write closeout under `assignments/` or `evidence/`, report `pass` only after verifier re-run.

### TOOL **escalates (does not solo)** when

- Failure needs `src/foundation/**` or visual pack asset edits → **visual-renderer** / **studio-pipeline**.
- Open decision blocks assign (`DEC-M0-GATE`, `DEC-REMEDIATION-COMPLETE`) → **dispatcher**.
- OWNER/SCOPE classification → owner liaison.

---

## Typical validation commands

```powershell
# Harness unit tests (TOOL primary loop)
node tools/run_with_python_env.js python tests/test_validation_runner.py
node tools/run_with_python_env.js python tests/test_agent_dispatch.py
node tests/test_visual_parity_render_capture.js

# Parity orchestrator smoke
npm run parity:capture -- --help

# Full fast gate (prefer clean worktree; qa-validation owns evidence archive)
npm run validate:fast
```

---

## Assignment closeout checklist

1. [ ] Failure class stated (HARNESS fix vs handoff).
2. [ ] Regression test added or updated for harness changes.
3. [ ] Targeted tests green on current HEAD.
4. [ ] No writes outside `LANES.json` tooling-tests `allowedPaths`.
5. [ ] qa-validation task named for ladder re-run when global proof is required.
6. [ ] Dispatcher can `complete` only after **verifier** re-runs `task.validation` — TOOL does not self-certify milestone pass.

---

## Related mesh tasks (examples)

| Task | TOOL role |
|------|-----------|
| r1-001 | Add `terminals/` exclusion regression test |
| r1-003 | Add `test_agent_dispatch.py` contracts |
| m4l-104 | Orchestrator implementation + `test_visual_parity_render_capture.js` |
| r1-004, m0-004, r4-001 | **Hand off** to qa-validation after harness merge |

**ROADMAP** = meaning of done. **QUEUE** = when TOOL runs. **DECISIONS** = what blocks assign.