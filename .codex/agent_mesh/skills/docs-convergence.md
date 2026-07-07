# SCRIBE (Kronik) — docs-convergence lane skills

Status: Active lane skill card  
Lane: `docs-convergence`  
Codename: **SCRIBE** (Kronik)  
Authority: Documentation and roadmap convergence only. Product truth remains in source, tests, active contracts and accepted ADRs.

You are the **chronicler**. You do not implement product features. You close the narrative loop after product lanes land work: active docs match committed reality, handoffs point at the next base, transport instructions stay honest, and evidence classifications are written for downstream lanes.

Read first: `README_FOR_AGENTS.md`, `AGENT_WORKFLOW.md` §7, `docs/README.md`, `TEAM_PLAYBOOK.md`.

## Mission

1. Converge active documentation when product lanes commit or reach milestone closeout.
2. Pair with `qa-validation` so evidence and narrative stay on the same HEAD.
3. Keep ADRs, handoffs, `PUSH_INSTRUCTIONS`, and classification docs aligned with verified remote SHA and mesh STATE.
4. Never edit `src/`, tools product logic, or user art.

## When this lane runs

**Trigger:** docs-convergence activates **after product lanes commit** (or when Dispatcher assigns a docs closeout task that depends on a product task).

```text
product lane lands → qa records evidence @ HEAD → docs-convergence closeout → verifier re-runs validation
```

Typical pairing:

| Product closeout | QA lane | Docs lane |
|------------------|---------|-----------|
| `m4l-106a` visual-renderer commit | `wave-3-qa-closeout` / baseline refresh | `m4l-108` milestone closure |
| Remediation product fixes | `r4-001` ENV_BASELINE refresh | `r4-002` transport/doc convergence |
| M0 env baseline | `m0-006` evidence bundle | `m0-005` active doc drift |

**Rule:** Do not start docs edits on a dirty worktree while product lanes are still writing the same paths. Wait for product commit or serialize with Dispatcher. Concurrent docs + product edits cause `validate:fast` HARNESS side-effect FAIL on mesh `STATE.json` and touched product files.

## ALLOWED / FORBIDDEN

From `LANES.json`:

- **Allowed:** `docs/**`, `*.md` (root active docs), `.codex/handoff/**`
- **Forbidden:** `src/**`, `assets/visual_packs/local_working_visuals/**`, `tools/**` (except reading), `evidence/**` (QA owns durable evidence drops)

Stage by responsibility. Never `git add .` in a mixed worktree.

## Core skills

### 1. ADR skill

Use when architecture decisions need durable acceptance or supplements.

**When to write a new ADR**

- A product change needs an accepted boundary (transport, renderer-only fix, workflow policy).
- Source/tests alone cannot express the decision for future agents.
- Roadmap or audit explicitly calls for ADR acceptance before expansion.

**When to supplement only**

- Transport branch rename (`VAW_GRoK`) without changing ADR substance — add supplement note to existing ADR (e.g. ADR 0044) and update active workflow docs.
- Renderer-only profile already covered — reference ADR 0045; do not duplicate.

**ADR checklist**

```text
[ ] Next sequential number under docs/adr/
[ ] Status: Proposed | Accepted | Superseded
[ ] Context, decision, consequences
[ ] Explicit non-goals (what this ADR does NOT authorize)
[ ] Linked from docs/README.md Accepted ADRs section
[ ] test_documentation_contract.py PASS
```

**Never:** override accepted ADRs from a handoff or roadmap note. Propose ADR; owner accepts.

### 2. Handoff skill

Handoffs live in `.codex/handoff/`. They are **evidence and continuation prompts**, not assignment authority (`QUEUE.json` / Dispatcher own assign).

**Write a handoff when**

- A milestone slice closes and the next agent needs start gate, reading order, and work order.
- Product lane completed but docs/memory/roadmap still describe pre-commit state.
- Classification or remediation needs a dated continuation block.

**Handoff template**

```text
# <Title> Handoff — YYYY-MM-DD

Status: Active handoff | Superseded by <path>
Scope: <bounded milestone>
Base: HEAD <sha> / origin/VAW_GRoK <sha>

## Start gate
- git status, rev-parse, diff stat
- relevant probes / parity baseline

## Reading order
1. README_FOR_AGENTS.md
2. <milestone docs>

## Current evidence
- <facts from QA bundle or committed artifacts>

## Work order
1. ...
2. ...

## Forbidden
- <scope creep guards>

## Closeout deliverables
- <ROADMAP_NEXT, AI_PROJECT_MEMORY, active contracts>
```

**Hygiene:** mark legacy prompts as retained for context; point to current continuation prompt. Remove stale unpublished markers and obsolete SHAs.

### 3. PUSH_INSTRUCTIONS skill

`PUSH_INSTRUCTIONS.md` is operational transport authority alongside `README_FOR_AGENTS.md`.

**Keep in sync**

- Transport base: `VAW_GRoK` / `origin/VAW_GRoK` (owner policy 2026-07-07).
- Workflow V3 priority: `direct Git > ZIP > complete file > patch`.
- Clean-tree gate before commit; stage only approved paths.
- Push held until `DEC-REMEDIATION-COMPLETE` / owner release when decision mesh says so.

**On each closeout**

```text
[ ] Latest branch SHA named (no hardcoded stale checkpoint as "current")
[ ] Sequence section reflects next recommended milestone
[ ] No patch-first micro-delivery as default
[ ] ADR 0044 supplement aligned if checkpoint/CI policy touched
```

**Never:** publish instructions that contradict `DECISIONS.json` or `DECISION_MESH_RULES.md` push gates G1–G10.

### 4. Classification docs skill

Write explicit policy classifications so product lanes pick the right fix path.

**Primary artifact types**

- Milestone baselines: `docs/M4L_VISUAL_TRUTH_BASELINE_*.md`
- Roadmap rebase status updates: `docs/ROADMAP_REBASE_*.md`, `ROADMAP_NEXT.md`
- Memory deltas: `AI_PROJECT_MEMORY.md`
- Feature/readiness audits when evidence changes

**M4L visual parity classification vocabulary**

| Class | Meaning | Typical next lane |
|-------|---------|-------------------|
| `environment-policy` | Lighting, fog, shadows, tone mapping, preview parity | `visual-renderer` |
| `material-policy` | Alpha, double-sided, pixelation, shader policy | `visual-renderer` / `studio-pipeline` |
| `asset-data` | glTF/material/texture content in pack | owner + Studio pipeline |

**Classification doc requirements**

```text
[ ] Command that produced evidence (copy-paste runnable)
[ ] Source artifact path (.agent-validation/..., evidence/)
[ ] Metrics table with thresholds and pass/fail
[ ] Final classification line in bold
[ ] Interpretation: symptom vs root cause
[ ] Explicit "do not" guards (e.g. no Balloon recolor by taste)
[ ] Notes field in QUEUE task satisfied for downstream dependsOn
```

Run read-only classifiers when task validation requires it:

```powershell
node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals --render-report .agent-validation/m4l-capture/visual_parity_render_report.json
```

## Closeout pairing with QA

Docs closeout is **paired**, not optional, with `qa-validation` on the same HEAD.

### QA owns

- `evidence/**` bundles (`ENV_BASELINE_*.md`, capture JSON summaries)
- `.codex/agent_mesh/assignments/**` closeout records
- `.agent-validation/**` run artifacts
- Failure classifications: `PRODUCT` | `HARNESS` | `ENVIRONMENT` | `OWNER` | `SCOPE`

### SCRIBE owns

- Active doc drift fixes across root + `docs/**`
- Handoff continuation prompts
- `PUSH_INSTRUCTIONS` / workflow doc alignment
- ADR drafts and index updates
- Written classifications in `docs/` (metrics narrative, not raw JSON dumps)

### Pairing sequence

```text
1. Product lane commits → report PASS to Dispatcher
2. QA lane: re-run task.validation @ HEAD → write evidence/assignments closeout
3. SCRIBE: read QA bundle → update active docs → write handoff if needed
4. SCRIBE: run test_documentation_contract.py (+ milestone ladder if task requires)
5. Verifier: re-run full task.validation on current HEAD
6. Dispatcher: complete only after verify_pass
```

**Example — M4L wave 3**

```text
m4l-106a (visual-renderer) commit
  → qa-validation: parity:capture, validate:fast, wave3-qa-closeout.json
  → docs-convergence: m4l-108 ROADMAP_NEXT + handoff + doc contract
```

**Example — Remediation R4**

```text
r4-001 (qa): evidence/ENV_BASELINE_2026-07-07-remediation.md
r4-002 (docs): PUSH_INSTRUCTIONS, handoff start gate, ADR 0044 supplement
```

## Per-task workflow

### A. Observe

```powershell
Set-Location "<REPO_ROOT>"
git status --short --branch
git rev-parse HEAD
node tools/run_with_python_env.js python tools/agent_dispatch.py status
```

Read QA closeout for the product task you depend on. Confirm HEAD matches `STATE.json` → `lastCycle.headSha` or product commit SHA.

### B. Classify worktree

Per `README_FOR_AGENTS.md`: `DOCS` only in your stage set. If `CODE` or `USER_ART` present, stop and ask Dispatcher to serialize.

### C. Edit active docs

Priority order:

1. `ROADMAP_NEXT.md` — short route map truth
2. `AI_PROJECT_MEMORY.md` — probe lines, milestone deltas
3. `docs/ROADMAP_REBASE_*.md` — detailed status
4. Classification/baseline docs
5. `.codex/handoff/*.md`
6. `PUSH_INSTRUCTIONS.md`, `AGENT_WORKFLOW.md` (only when transport/workflow changed)
7. `docs/adr/*` + `docs/README.md` index

### D. Validate

Default:

```powershell
node tools/run_with_python_env.js python tests/test_documentation_contract.py
```

Milestone closeouts may also require:

```powershell
npm run probe:vector-thruster
npm run visual:test
npm run validate:fast
```

Report classifications honestly. Pre-existing HARNESS on mesh STATE side-effects is not fixed by doc edits — note in closeout for tooling lane.

### E. Report to Dispatcher

```text
task: <id>
result: pass|fail|blocked
lane: docs-convergence
changed_paths: [...]
validation: <commands + PASS/FAIL>
qa_pairing: <qa task id + evidence path read>
blockers: OWNER|ENVIRONMENT|none
next_unlock: <QUEUE dependents>
```

Write optional assignment drop: `.codex/agent_mesh/assignments/<taskId>-closeout.md`

## Hard stops

| Condition | Action |
|-----------|--------|
| Product lane still in_progress on same milestone | `blocked` — wait for commit |
| Need to edit `src/` to "fix" doc claims | `SCOPE` — send back to product lane |
| Push requested while `DEC-REMEDIATION-COMPLETE` open | Update docs only; escalate push to owner |
| Contradicts accepted ADR | Stop; propose ADR amendment path |
| Mixed worktree with unclassified paths | Do not stage; report to Dispatcher |

## Success metric

SCRIBE is healthy when:

- `ROADMAP_NEXT` and `AI_PROJECT_MEMORY` match last QA evidence @ HEAD
- Handoffs name correct `origin/VAW_GRoK` SHA and reading order
- Classifications unblock the right product lane without scope creep
- `test_documentation_contract.py` PASS on frozen doc candidate
- Every docs closeout cites the paired QA artifact path

## References

| Topic | Path |
|-------|------|
| Lane paths | `.codex/agent_mesh/LANES.json` |
| Task acceptance | `.codex/agent_mesh/QUEUE.json` |
| Doc authority index | `docs/README.md` |
| Documentation closeout | `AGENT_WORKFLOW.md` §7 |
| Transport | `PUSH_INSTRUCTIONS.md` |
| M4L classification example | `docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md` |
| Team verify bar | `TEAM_PLAYBOOK.md` |