# Environment Baseline Evidence — Post-Remediation (2026-07-07)

| Field | Value |
|-------|-------|
| Task | `r4-001` — Refresh ENV_BASELINE post-remediation commits |
| Lane | `qa-validation` / slot `qa-validation-1` |
| Phase | REMEDIATION R4 |
| Captured | 2026-07-07T03:08–03:10Z (fresh re-runs) |
| Prior bundle | `evidence/ENV_BASELINE_2026-07-07.md` (`m0-006` @ `75a3762`) |
| Repository | `voxel-aeronautics-workshop-current_work-GRok` |
| HEAD | `0ed0e84cc02d4830a1185d6d6b8ab62d2ac6b32a` |
| Transport branch | `VAW_GRoK` @ `80c0ae4` (per `DEC-TRANSPORT-BRANCH`) |

---

## 1. Toolchain

| Component | Version | Platform |
|-----------|---------|----------|
| Node.js | v24.16.0 | Windows 10 (build 26200) |
| Python | 3.14.5 | Windows |
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
| `npm run probe:vector-thruster:summary` | **PASS** (192/192) | — |

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

```json
{
  "vectorThrusterDirectionProbe": "ok",
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
| `probe:vector-thruster` | PASS 192/192 | — | Synthetic probe per `DEC-PROBE-SCOPE` |

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