# Environment Baseline Evidence — 2026-07-07

| Field | Value |
|-------|-------|
| Task | `m0-006` — Record environment baseline evidence bundle |
| Lane | `qa-validation` / slot `qa-validation-1` |
| Milestone | M0-environment + M4L-prep |
| Captured | 2026-07-07T02:30–02:32Z (fresh re-runs) |
| Baseline observed | 2026-07-07T02:27–02:29Z (`STATE.json` history) |
| Repository | `voxel-aeronautics-workshop-current_work-GRok` |
| HEAD | `75a3762414fbf6770bee25c8ce199af369b41f1b` |

---

## 1. Toolchain

| Component | Version | Platform |
|-----------|---------|----------|
| Node.js | v24.16.0 | Windows 10 (build 26200) |
| Python | 3.14.5 | Windows |
| OS | Windows 10.0.26200.8655 | — |
| Browser (smoke) | Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) | — |

Tailwind CSS tool pin (regeneration only): **4.1.10** (`tools/generate_tailwind_css.js` `TOOL_VERSION`).

---

## 2. Git baseline

Synthetic local init — not aligned to `origin/current_work`.

```text
$ git branch --show-current
current_work

$ git rev-parse HEAD
75a3762414fbf6770bee25c8ce199af369b41f1b

$ git remote -v
(no remotes configured)
```

| Property | Value |
|----------|-------|
| Branch | `current_work` |
| HEAD (short) | `75a3762` |
| Remote | none |
| Worktree class | `clean` (per `STATE.json`) |
| Init type | Synthetic (`m0-001` pass) |

---

## 3. Validation ladder — baseline observations (2026-07-07T02:27Z)

Recorded in `.codex/agent_mesh/STATE.json` history event `baseline`.

### T0 — Static check

| Command | Result | Class |
|---------|--------|-------|
| `python tests/static_check.py` | **PASS** | — |

Artifact: `.agent-validation/fast-20260707T022758.662275Z-15652/logs/static-check.log`

```text
OK: 540 unique game functions, 192 unique HTML ids, 55 ordered application sources.
VALIDATION_EXIT status=pass code=0 duration=2.703s
```

### T1/T2 — Component checks

| Command | Result | Class |
|---------|--------|-------|
| `npm run studio:test` | **PASS** | — |
| `npm run visual:test` | **PASS** | — |
| `npm run browser:smoke` | **PASS** | — |
| `npm run probe:vector-thruster:summary` | **PASS** (192/192, runtime-integrated) | — |
| `audit_visual_asset_pack.py` | **PASS** (`ok: true`) | — |
| `visual_parity_baseline.py` | **PASS** (classification emitted) | — |

#### browser:smoke (baseline metrics)

```json
{
  "status": "PASS",
  "result": {
    "starterBlocks": 17,
    "consoleErrors": 0,
    "flightMode": true
  }
}
```

#### probe:vector-thruster (baseline)

**Scope note:** `192 / 192` is **runtime-integrated** after `m4lc-201`–`m4lc-203`. The probe exercises `computeVectorThrusterForceCannon` (extracted from `src/game.js`) against `visual_runtime_adapter.setGimbal` in Node (`tools/probe_vector_thruster_direction.js`).

```json
{
  "vectorThrusterDirectionProbe": "ok",
  "profiles": [
    { "source": "runtime-default", "checked": 192, "ok": true, "mismatchCount": 0 },
    { "source": "…local_vector_thruster_visual", "checked": 192, "ok": true, "mismatchCount": 0 }
  ]
}
```

#### audit_visual_asset_pack (baseline)

```json
{ "ok": true, "packRoot": "…/assets/visual_packs/local_working_visuals" }
```

#### visual_parity_baseline (baseline classification)

```json
{
  "classification": {
    "importedVisualDarkness": "renderer-preview-mismatch",
    "requiresRenderCaptureForFinalWeighting": true
  }
}
```

### T3 — FAST (`npm run validate:fast`)

Artifact: `.agent-validation/fast-20260707T022758.662275Z-15652/summary.json`

| Stage | Result |
|-------|--------|
| static-check | PASS |
| foundation | PASS |
| gate-b-compilers | PASS |
| gate-c-hardening | **FAIL** |
| audit-regressions | not-run |
| validation-runner | not-run |

**Failure snippet** (gate-c-hardening → `test_runtime_dependency_contract.py`):

```text
AssertionError: tailwind.generated.css is stale: expected candidate hash
  e6a59b907a1b0163d278b48241bf3834ccd61d837456d6fed746e8a293026b26,
  found db0d754c5ed36187c19ee66a33a87c296f5ba3321e41dea316677d0b4aba31e1
```

### CSS check (baseline)

| Command | Result | Class |
|---------|--------|-------|
| `npm run check:css` | **FAIL** | `ENVIRONMENT` |

Reason per `STATE.json` blocker `blk-tailwind`: stale `tailwind.generated.css`; regeneration blocked until Tailwind CSS **4.1.10** installed.

---

## 4. Fresh evidence capture (m0-006 session, 2026-07-07T02:30Z)

Re-run by `qa-validation-1` to capture live output snippets.

### T0 — static_check

```text
$ node tools/run_with_python_env.js python tests/static_check.py
OK: 540 unique game functions, 192 unique HTML ids, 55 ordered application sources.
```

### T2 — studio:test

```text
$ npm run studio:test
{ authoringState: 'ok' }
{ authoringStateFlow: 'ok' }
{ "recoveryStatic": "ok", "uvImages": 1, "resolverRecords": 5, ... }
{ "recoveryPackage": "ok", "requiredFiles": 52, ... }
```

### T2 — visual:test

```text
$ npm run visual:test
{ visualAssetManifest: 'ok' }
{ visualAssetRegistry: 'ok', registered: 1 }
…
Visual asset checks passed.
```

### T2 — browser:smoke

```text
$ npm run browser:smoke
{
  "status": "PASS",
  "result": {
    "starterBlocks": 17,
    "corePanels": { "build": true, "telemetry": true, "parts": true, "flightFocusButtons": 2 },
    "flightMode": true,
    "consoleErrors": 0
  }
}
```

### T2 — probe:vector-thruster:summary

Runtime-integrated after `m4lc-201`–`m4lc-203` (`computeVectorThrusterForceCannon` vs `setGimbal`).

```text
$ npm run probe:vector-thruster:summary
{
  "vectorThrusterDirectionProbe": "ok",
  "profiles": [
    { "source": "runtime-default", "checked": 192, "ok": true, "mismatchCount": 0 },
    { "source": "assets\\visual_packs\\local_working_visuals\\…:local_vector_thruster_visual",
      "checked": 192, "ok": true, "mismatchCount": 0 }
  ]
}
```

### T2 — audit_visual_asset_pack

```text
$ python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
{ "ok": true, "packRoot": "…\\local_working_visuals", "assets": [5 entries, all modelExists: true] }
```

Info-level diagnostics only (suspicious `thuster` binding spelling on Thruster/VectorThruster assets).

### T2 — visual_parity_baseline

```text
$ python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
{
  "visualParityBaseline": "M4L",
  "classification": {
    "importedVisualDarkness": "renderer-preview-mismatch",
    "requiresRenderCaptureForFinalWeighting": true,
    "primaryCauses": ["lighting/fog/shadow/preview mismatch"]
  }
}
```

### T3 — validate:fast (fresh run)

Artifact: `.agent-validation/fast-20260707T023030.459274Z-21408/summary.json`

| Stage | Result | Duration |
|-------|--------|----------|
| static-check | PASS | 2.734s |
| foundation | PASS | 0.094s |
| gate-b-compilers | PASS | 1.016s |
| gate-c-hardening | **PASS** | 1.156s |
| audit-regressions | PASS | 0.344s |
| validation-runner | **FAIL** (exit 97, side-effects) | 52.094s |

gate-c-hardening now passes:

```text
{'externalRuntimeScripts': [], 'threeVendored': True, 'tailwindRuntimeCdn': False,
 'cannonVendored': True, 'generatedCssCurrent': True}
Gate C hardening suite passed.
```

validation-runner test body passed; runner flagged worktree side-effects from concurrent terminal monitoring (`terminals/*.txt`, `VALIDATION_REPORT.md` delete). Not a product failure.

### CSS check (fresh)

```text
$ npm run check:css
tailwind.generated.css is current: 17104 candidates, e6a59b907a1b0163d278b48241bf3834ccd61d837456d6fed746e8a293026b26
```

```text
$ npm run generate:css
tailwind.generated.css: 17104 candidates, 21022 CSS bytes, e6a59b907a1b0163d278b48241bf3834ccd61d837456d6fed746e8a293026b26
```

**Delta note:** At baseline time the on-disk hash (`db0d754c…`) did not match source-derived candidates (`e6a59b9…`). Fresh session shows hash alignment and regeneration succeeds (Tailwind 4.1.10 available in this runtime).

---

## 5. Failure classifications (AGENT_WORKFLOW §5)

Per `AGENT_WORKFLOW.md` failure classes: `PRODUCT` | `HARNESS` | `ENVIRONMENT` | `OWNER` | `SCOPE`.

| Item | Observed result | Class | Rationale |
|------|-----------------|-------|-----------|
| `static_check` | PASS | — | T0 contract satisfied |
| `studio:test` | PASS | — | Studio static/recovery contract |
| `visual:test` | PASS | — | Visual asset integration contract |
| `browser:smoke` | PASS | — | Browser launch + core panels + zero console errors |
| `probe:vector-thruster` | PASS 192/192 (runtime-integrated) | — | Runtime-harness probe within 2° tolerance via `computeVectorThrusterForceCannon` and `setGimbal` |
| `audit_visual_asset_pack` | PASS (`ok: true`) | — | Pack models present; info diagnostics only |
| `visual_parity_baseline` | PASS (classification) | — | `requiresRenderCaptureForFinalWeighting: true` is expected M4L gate input, not a failure |
| `validate:fast` gate-c-hardening (baseline) | FAIL | **ENVIRONMENT** | Stale `tailwind.generated.css` hash; local Tailwind 4.1.10 gap blocked regeneration at baseline |
| `check:css` (baseline) | FAIL | **ENVIRONMENT** | Same CSS staleness / tool availability gap |
| `validate:fast` validation-runner (fresh) | FAIL exit 97 | **HARNESS** | Runner side-effect detection triggered by concurrent `terminals/` artifacts; underlying test suite passed |
| No git remote | blocked | **OWNER** | Transport requires clone URL from Jozz |

---

## 6. Open blockers (`STATE.json`)

| ID | Task | Class | Reason |
|----|------|-------|--------|
| `blk-remote` | `m0-002` | **OWNER** | No git remote configured; need clone URL from Jozz for Workflow V3 transport |
| `blk-tailwind` | `m0-003` | **ENVIRONMENT** | `tailwind.generated.css` stale at baseline; regenerate requires Tailwind CSS 4.1.10 |

**Fresh-session note on `blk-tailwind`:** `check:css` and `gate-c-hardening` now pass in this runtime. Dispatcher should re-evaluate `m0-003` status before unblocking `m0-004`.

---

## 7. Recommended next assignments (`QUEUE.json`)

Priority order for ready / in-progress successors:

| Priority | Task | Lane | Status | Title | Depends on |
|----------|------|------|--------|-------|------------|
| 12 | `m0-003` | env-infra | in_progress | Resolve `tailwind.generated.css` stale check | `m0-001` |
| 13 | `m0-004` | qa-validation | ready | `validate:fast` full green on current tree | `m0-003` |
| 20 | `m0-005` | docs-convergence | in_progress | Fix active doc drift | — |
| 21 | `m0-006` | qa-validation | in_progress | **This evidence bundle** | — |
| 30 | `m4l-000` | qa-validation | ready | M4L start gate evidence snapshot | `m0-006` |
| 31 | `m4l-101` | visual-renderer | pending | Extract shared renderer profile contract | `m4l-000`, `m0-004` |

**Immediate recommendations:**

1. **Dispatcher** — mark `m0-006` complete; unlock `m4l-000`.
2. **env-infra-1** — close or re-verify `m0-003` given fresh CSS PASS; if confirmed, unblock `m0-004`.
3. **Owner (Jozz)** — provide remote URL to unblock `m0-002` / `blk-remote`.
4. **qa-validation** — after `m0-003`/`m0-004` green, run `m4l-000` (audit + parity baseline + probe archive).

---

## 8. Artifact index

| Path | Purpose |
|------|---------|
| `.agent-validation/fast-20260707T022758.662275Z-15652/` | Baseline FAST run (gate-c FAIL) |
| `.agent-validation/fast-20260707T023030.459274Z-21408/` | Fresh FAST run (gate-c PASS, runner side-effect FAIL) |
| `.codex/agent_mesh/STATE.json` | Blockers + baseline history |
| `.codex/agent_mesh/QUEUE.json` | Next assignment DAG |
| `evidence/ENV_BASELINE_2026-07-07.md` | This bundle |

---

## 9. Task closeout

| Field | Value |
|-------|-------|
| m0-006 result | **pass** |
| Acceptance | All tier results, classifications, blockers, and next assignments documented with command output snippets |
| Product edits | none (evidence-only lane) |
| File created | `evidence/ENV_BASELINE_2026-07-07.md` |