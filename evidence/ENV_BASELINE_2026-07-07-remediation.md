# Environment Baseline Evidence — Post-Remediation (2026-07-07)

| Field | Value |
|-------|-------|
| Task | `r4-001` — Refresh ENV_BASELINE post-remediation commits |
| Lane | `qa-validation` / slot `qa-validation-1` |
| Phase | REMEDIATION R4 |
| Captured | 2026-07-07T03:08–03:22Z (r4-001 + wave-3 re-runs) |
| Prior bundle | `evidence/ENV_BASELINE_2026-07-07.md` (`m0-006` @ `75a3762`) |
| Repository | `voxel-aeronautics-workshop-current_work-GRok` |
| HEAD (wave-3) | `e37d630b6cd4fa2459ea92e67ea7a1192fee111d` |
| HEAD (r4-001) | `0ed0e84cc02d4830a1185d6d6b8ab62d2ac6b32a` |
| Transport branch | `VAW_GRoK` @ `80c0ae4` (per `DEC-TRANSPORT-BRANCH`) |

---

## 1. Toolchain

| Component | Version | Platform |
|-----------|---------|----------|
| Node.js | v24.16.0 | Windows 10 (build 26200) |
| Python | 3.12.13 (wave-3 runner) / 3.14.5 (r4-001) | Windows |
| OS | Windows 10.0.26200.8655 | — |
| Browser (smoke) | Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) | — |

Tailwind CSS tool pin: **4.1.10** (`tools/generate_tailwind_css.js`).

---

## 2. Git baseline — bounded commit stack C1–C5

```text
$ git rev-parse HEAD
0ed0e84cc02d4830a1185d6d6b8ab62d2ac6b32a

$ git log --oneline 80c0ae4..HEAD
0ed0e84 chore(env): regenerate tailwind.generated.css after WIP edits (r0-002)
7b1b1ca feat(m4l-107): surface duplicate material diagnostics in Blockbench Studio pipeline
5d1dc2b feat(m4l-101): shared visual renderer profile contract for game and studio parity
1e97566 feat(mesh): decision plane, audit remediation state, and dispatcher gates (R0-R2)
d3337b6 test(harness): add terminals exclusion and agent dispatch contract tests (r1-001, r1-003)
872aeeb Add agent mesh dispatcher, M0 doc drift fixes, and environment evidence
```

### Commit stack (per `DEC-M4L-COMMIT-STRATEGY`)

| Label | SHA (short) | Subject |
|-------|-------------|---------|
| **C1** harness | `d3337b6` | `test(harness): add terminals exclusion and agent dispatch contract tests (r1-001, r1-003)` |
| **C2** agent-mesh | `1e97566` | `feat(mesh): decision plane, audit remediation state, and dispatcher gates (R0-R2)` |
| **C3** m4l-101-profiles | `5d1dc2b` | `feat(m4l-101): shared visual renderer profile contract for game and studio parity` |
| **C4** m4l-107-studio-diagnostics | `7b1b1ca` | `feat(m4l-107): surface duplicate material diagnostics in Blockbench Studio pipeline` |
| **C5** css-regen | `0ed0e84` | `chore(env): regenerate tailwind.generated.css after WIP edits (r0-002)` |

| Property | Value |
|----------|-------|
| Branch | `current_work` (local) |
| HEAD (short) | `0ed0e84` |
| Remote | `https://github.com/Jozzpoly/voxel-aeronautics-workshop.git` |
| Remote SHA | `80c0ae4` (transport baseline) |
| Committed worktree @ HEAD | clean (per `DEC-STATE-SYNC`) |
| Session worktree | dirty — concurrent `r4-002` mesh/doc edits (7 modified paths) |

**Dirty paths at capture time** (not in C1–C5 stack):

```text
 M .codex/agent_mesh/DECISIONS.json
 M .codex/agent_mesh/QUEUE.json
 M .codex/agent_mesh/REGISTRY.json
 M .codex/agent_mesh/STATE.json
 M .codex/handoff/NEXT_GOAL_PROMPT_M4L_VISUAL_TRUTH_2026-07-01.md
 M PUSH_INSTRUCTIONS.md
 M docs/adr/0044-workflow-checkpoint-branch-and-ci-policy.md
```

---

## 3. Validation ladder — r4-001 session (HEAD `0ed0e84`)

### T0 — CSS check

| Command | Result | Class |
|---------|--------|-------|
| `npm run check:css` | **PASS** | — |

```text
tailwind.generated.css is current: 18230 candidates, 107d94a7882ea204c616f7f413825e1f9343ccbb592c3ee2ede8b82c32f1f872
```

**Delta vs m0-006:** candidate count 17104 → 18230; hash updated after C5 css-regen.

### T3 — FAST (`npm run validate:fast`)

Artifact: `.agent-validation/fast-20260707T030824.701157Z-4268/summary.json`

| Stage | Result | Duration |
|-------|--------|----------|
| static-check | PASS | 3.063s |
| foundation | PASS | 0.094s |
| gate-b-compilers | PASS | 1.078s |
| gate-c-hardening | **FAIL** (exit 97, side-effects) | 1.250s |
| audit-regressions | not-run | — |
| validation-runner | not-run | — |

gate-c test body **passed**; runner flagged pre-existing dirty paths:

```text
side-effect modified: .codex/handoff/NEXT_GOAL_PROMPT_M4L_VISUAL_TRUTH_2026-07-01.md
side-effect modified: PUSH_INSTRUCTIONS.md
side-effect modified: docs/adr/0044-workflow-checkpoint-branch-and-ci-policy.md
```

gate-c hardening excerpt:

```text
{'externalRuntimeScripts': [], 'threeVendored': True, 'tailwindRuntimeCdn': False,
 'cannonVendored': True, 'generatedCssCurrent': True}
Gate C hardening suite passed.
```

**Reference:** prior honest 6/6 @ `872aeeb` — `.agent-validation/fast-20260707T025709.527245Z-23408` (`DEC-VALID-FAST-VERDICT`).

### T2 — Component checks

| Command | Result | Class |
|---------|--------|-------|
| `npm run studio:test` | **PASS** | — |
| `npm run visual:test` | **FAIL** | **PRODUCT** |
| `npm run browser:smoke` | **PASS** | — |
| `npm run probe:vector-thruster:summary` | **PASS** (192/192, runtime-integrated) | — |

#### studio:test

```text
{ authoringState: 'ok' }
{ authoringStateFlow: 'ok' }
{ "recoveryStatic": "ok", "uvImages": 1, "resolverRecords": 5, ... }
{ "recoveryPackage": "ok", "requiredFiles": 53, ... }
```

#### visual:test (failure)

```text
AssertionError: src/game/visual-renderer-profiles.js must not import Studio tool code at runtime.
  at tests/test_blockbench_import_studio_integration.js:87
```

Trigger: C3 (`m4l-101`) added `source: 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js'` string in `visual-renderer-profiles.js` (line 22). Integration guard treats any Studio path reference in runtime sources as a boundary violation.

#### browser:smoke

```json
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

#### probe:vector-thruster

Runtime-integrated after `m4lc-201`–`m4lc-203` (`computeVectorThrusterForceCannon` vs `visual_runtime_adapter.setGimbal`).

```json
{
  "vectorThrusterDirectionProbe": "ok",
  "model": "runtime-integrated: computeVectorThrusterForceCannon (extracted from src/game.js) vs visual_runtime_adapter.setGimbal",
  "profiles": [
    { "source": "runtime-default", "checked": 192, "ok": true, "mismatchCount": 0 },
    { "source": "assets\\visual_packs\\local_working_visuals\\…:local_vector_thruster_visual",
      "checked": 192, "ok": true, "mismatchCount": 0 }
  ]
}
```

---

## 4. Failure classifications (AGENT_WORKFLOW §5)

| Item | Observed result | Class | Rationale |
|------|-----------------|-------|-----------|
| `check:css` | PASS | — | C5 regen current; 18230 candidates |
| `validate:fast` gate-c (session) | FAIL exit 97 | **HARNESS** | Dirty worktree from concurrent `r4-002` doc/mesh edits; gate-c suite body passed |
| `validate:fast` @ clean `0ed0e84` | expected PASS | — | `DEC-STATE-SYNC` + prior 6/6 pattern; re-run after `r4-002` lands |
| `studio:test` | PASS | — | Studio static/recovery contract (53 required files) |
| `visual:test` | FAIL | **PRODUCT** | C3 profile module references Studio tool path in runtime source scan |
| `browser:smoke` | PASS | — | Core panels + zero console errors |
| `probe:vector-thruster` | PASS 192/192 (runtime-integrated) | — | Runtime-harness probe via `computeVectorThrusterForceCannon` and `setGimbal` (`m4lc-203` closeout) |

---

## 5. Remediation gate context

| Decision | Status | Relevance |
|----------|--------|-----------|
| `DEC-STATE-SYNC` | approved | HEAD `0ed0e84`; C1–C5 landed |
| `DEC-VALID-FAST-VERDICT` | approved @ `872aeeb` | Honest fast ladder baseline; session dirty-tree caveat |
| `DEC-M0-GATE` | approved | M0 closed pre-remediation |
| `DEC-M4L-COMMIT-STRATEGY` | approved | Per-task commits C1–C5 |
| `DEC-REMEDIATION-COMPLETE` | proposed | Pending `r4-001` + `r4-002` + quorum |

### Open product follow-up (not blockers for evidence capture)

| ID | Item | Lane | Notes |
|----|------|------|-------|
| `visual-test-c3` | `visual-renderer-profiles.js` Studio path string | visual-renderer | Fix metadata/source annotation to satisfy `test_blockbench_import_studio_integration.js` |
| `r4-002` | Doc convergence in flight | docs-convergence | Causes session dirty-tree `validate:fast` side-effect FAIL |

---

## 6. Artifact index

| Path | Purpose |
|------|---------|
| `.agent-validation/fast-20260707T030824.701157Z-4268/` | r4-001 FAST run (gate-c side-effect FAIL) |
| `.agent-validation/fast-20260707T025709.527245Z-23408/` | Reference 6/6 @ `872aeeb` (`DEC-VALID-FAST-VERDICT`) |
| `evidence/ENV_BASELINE_2026-07-07.md` | Pre-remediation m0-006 bundle |
| `evidence/ENV_BASELINE_2026-07-07-remediation.md` | **This bundle** |
| `.codex/agent_mesh/assignments/r4-001-closeout.json` | Task closeout |

---

## 7. Task closeout

| Field | Value |
|-------|-------|
| r4-001 result | **pass** |
| Acceptance | Ladder results @ HEAD `0ed0e84`, C1–C5 stack, classifications documented |
| Product edits | none (evidence-only lane) |
| File created | `evidence/ENV_BASELINE_2026-07-07-remediation.md` |

---

## 8. Wave-3 QA closeout — M4L capture gate @ HEAD `e37d630`

| Field | Value |
|-------|-------|
| Task | wave-3 QA closeout (`m4l-106a` gate context) |
| Lane | `qa-validation` / slot `qa-validation-1` |
| Captured | 2026-07-07T03:18–03:22Z |
| HEAD | `e37d630b6cd4fa2459ea92e67ea7a1192fee111d` |
| Worktree @ capture end | dirty — `m4l-106a` WIP uncommitted in `src/game/*` (visual-renderer lane) |

### Commit stack (C5 → wave-3 HEAD)

```text
$ git log --oneline 0ed0e84..HEAD
e37d630 chore(mesh): r2-001 final STATE sync
a3107be chore(mesh): wave-2 sync — HEAD fa202b8, m4l-104/105 done, all agents idle
d7ba9ee docs(m4l-105): classify visual truth root cause as environment-policy with render metrics
fa202b8 feat(m4l-104): unified studio vs game parity capture orchestrator with metrics report
f259c53 fix(m4l-102): register visual-parity-diagnostic in APP_SOURCES and manifest
3a65b03 chore(mesh): sync QUEUE/STATE after 7-agent parallel wave (r2-001)
821298b chore: refresh CSS after m4l-102 and fix dispatch gate test assertion
a307a2b evidence(r4-001): remediation baseline ladder at post-C5 HEAD
6130441 docs(r4-002,r3-003): converge VAW_GRoK transport and relabel synthetic probe scope
ffe7b2c feat(m4l-104): parity capture orchestrator scaffold and metrics tooling
caca09a feat(m4l-103): studio-side Balloon capture harness with PNG and JSON output
d3a51e2 feat(m4l-102): game visual parity diagnostic render mode via query params
93dbc5c chore(evidence): env verification @ HEAD 0ed0e84 after C1-C5
```

### T0 — CSS check (wave-3)

| Command | Result | Class |
|---------|--------|-------|
| `npm run check:css` | **PASS** | — |

```text
tailwind.generated.css is current: 18546 candidates, 7d08e2f75944a049f168c72533fa7902ed29a46b54739fe49af7d986165e1532
```

**Delta vs r4-001:** candidate count 18230 → 18546 (m4l-102 manifest/source additions).

### T1 — Parity capture (`npm run parity:capture`)

Thresholds: `ssimMin >= 0.92`, `|luminanceDelta| <= 0.08`, profile `game-studio-parity`, viewport `640×480`.

#### A — Pre-`m4l-106a` baseline (committed tree @ `e37d630`, captured `2026-07-07T03:18:33Z`)

Orchestrator exit **1**; `blocksWithinThresholds: 0`; `classificationHint: environment-policy`.

| Block | SSIM | Luminance Δ (game − studio) | Within thresholds |
|-------|------|-------------------------------|-------------------|
| **Balloon** | **0.3553** | **−0.1872** | no |
| Hull | 0.3460 | −0.1408 | no |
| Fuel | 0.3496 | −0.2182 | no |
| Thruster | 0.4744 | +0.0174 | no |
| VectorThruster | 0.4744 | +0.0174 | no |

Balloon studio/game average luminance: `0.3247` / `0.1375`.

#### B — `m4l-106a` WIP interim (concurrent visual-renderer edits, captured `2026-07-07T03:20:28Z`)

Report overwritten at `.agent-validation/m4l-capture/visual_parity_render_report.json` during concurrent `m4l-106a` work. Interim metrics (uncommitted WIP):

| Block | SSIM | Luminance Δ | Within thresholds |
|-------|------|-------------|-------------------|
| **Balloon** | **0.9630** | **−0.0102** | **yes** |
| Hull | 0.9640 | −0.0031 | yes |
| Fuel | 0.9641 | −0.0042 | yes |
| Thruster | 0.9786 | +0.0025 | yes |
| VectorThruster | 0.9765 | +0.0028 | yes |

`blocksWithinThresholds: 5`; `classificationHint: unclassified` (all blocks within thresholds).

**Note:** Interim capture reflects uncommitted `m4l-106a` profile/diagnostic tuning (`visual-renderer-profiles.js`, `visual-parity-diagnostic.js`). Not a committed closeout until visual-renderer lane lands and commits.

### T3 — FAST (`npm run validate:fast`)

#### Clean committed tree @ `e37d630` (mesh/product WIP stashed)

Artifact: `.agent-validation/fast-20260707T032120.449642Z-9304/summary.json`

| Stage | Result | Duration |
|-------|--------|----------|
| static-check | PASS | 2.860s |
| foundation | PASS | 0.094s |
| gate-b-compilers | PASS | 1.000s |
| gate-c-hardening | PASS | 1.203s |
| audit-regressions | PASS | 0.360s |
| validation-runner | **FAIL** (exit 97, side-effects) | 52.406s |

validation-runner **test body passed** (`VALIDATION_EXIT status=pass code=0`); outer runner flagged nested side-effect:

```text
side-effect modified: .codex/agent_mesh/STATE.json
```

**Classification:** **HARNESS** — nested validation-runner contract exercise touches mesh `STATE.json`; stages 1–5 honest green on committed tree.

#### Session dirty-tree runs (concurrent mesh / `m4l-106a` edits)

| Artifact | Stages | Failure | Class |
|----------|--------|---------|-------|
| `fast-20260707T031836.680854Z-2316` | 3/6 | gate-c `STATE.json` side-effect | **HARNESS** |
| `fast-20260707T031917.444690Z-13096` | 5/6 | validation-runner WIP side-effects on `src/game/*` | **HARNESS** |

### Wave-3 failure classifications

| Item | Result | Class | Rationale |
|------|--------|-------|-----------|
| `check:css` | PASS | — | 18546 candidates current |
| `parity:capture` pre-106a | FAIL (Balloon gate) | **PRODUCT** | Confirms m4l-105 `environment-policy`; Balloon SSIM/luminance out of threshold on committed tree |
| `parity:capture` m4l-106a WIP | PASS (interim) | — | Uncommitted visual-renderer tuning; pending commit |
| `validate:fast` @ clean `e37d630` | 5/6 FAIL | **HARNESS** | validation-runner nested `STATE.json` side-effect; suite bodies pass |
| `validate:fast` @ dirty session | 3/6 or 5/6 FAIL | **HARNESS** | Concurrent mesh/`m4l-106a` edits |

### `agent:next` (qa lane)

```text
ready: [] (no qa-validation tasks)
next ready mesh-wide: m4l-108 (docs-convergence) — depends on m4l-106a commit
```

### Wave-3 artifact index

| Path | Purpose |
|------|---------|
| `.agent-validation/m4l-capture/visual_parity_render_report.json` | Latest capture (m4l-106a WIP interim @ 03:20:28Z) |
| `.agent-validation/fast-20260707T032120.449642Z-9304/` | Clean-tree FAST @ `e37d630` (5/6 HARNESS) |
| `.codex/agent_mesh/assignments/wave3-qa-closeout.json` | Wave-3 closeout record |