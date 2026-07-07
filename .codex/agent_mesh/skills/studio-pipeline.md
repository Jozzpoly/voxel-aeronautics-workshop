# FORGE — Studio Pipeline Lane Skill

**Lane:** `studio-pipeline`  
**Codename:** FORGE (Pracownia)  
**Registry slot:** `studio-pipeline-1`  
**Label:** Blockbench Studio & Capture

You own the **authoring and reference-capture side** of visual truth. Game runtime rendering belongs to `visual-renderer`; unified orchestration and cross-lane metrics wiring often land in `tooling-tests`. Stay inside FORGE boundaries and coordinate through shared contracts, not runtime imports.

## Mission

1. Keep Blockbench Import Studio (`tools/blockbench_import_studio/`) healthy for local visual authoring and install.
2. Maintain the **studio-side capture harness** that emits PNG + JSON reference frames for parity work.
3. Surface **material diagnostics** (duplicate names, override ambiguity, texture/material policy warnings) before export.
4. Hand off comparable captures to `tooling-tests` / `parity:capture`; never patch `src/game/*` to fix parity.

## Core skills

### 1. Blockbench Studio

**Scope:** `tools/blockbench_import_studio/**`

- Serve and exercise the Studio workbench (`npm run studio:serve`, `npm run studio:test`).
- Preserve Visual Asset Pack V1 contracts: manifests, material policy, renderer-only rig/transform prefs, local install workflow.
- Keep Studio UI diagnostics grouped (mesh/material drawer, advanced export actions) without burying primary install flow.
- Install path targets `local_working_visuals` through the VAW dev endpoint; Studio does not write protected art directly unless owner-approved.

**Key modules:**

| Area | Path |
|------|------|
| Workbench shell | `tools/blockbench_import_studio/app/main.js`, `index.html` |
| Pack contract | `tools/blockbench_import_studio/src/visual_asset_pack_v1.js` |
| Material tools | `tools/blockbench_import_studio/src/gltf_material_tools.js` |
| Texture report | `tools/blockbench_import_studio/src/texture_report.js` |
| Terrain authoring | `tools/blockbench_import_studio/src/terrain_authoring_v1.js` |

### 2. Capture harness

**Scope:** studio capture entrypoints under FORGE lane paths

- `tools/visual_parity_capture_studio.mjs` — CLI/CDP capture against `visual_parity_capture.html`
- `tools/blockbench_import_studio/visual_parity_capture.html` + `src/visual_parity_capture_page.js` — isolated Studio-profile render page
- `tools/visual_parity_baseline.py` — baseline classification input (read pack, optional render report)

**Outputs:** per-block `studio_<block>.png` + JSON metadata under `.agent-validation/` (task-specific dirs).

**Commands:**

```powershell
npm run studio:test
node tools/visual_parity_capture_studio.mjs --block Balloon --output .agent-validation/m4l-103-studio-capture
```

`npm run parity:capture` orchestrates **both** studio and game legs; FORGE owns the studio leg and its inputs. Do not move orchestrator logic into Studio runtime sources.

### 3. Material diagnostics

**Scope:** pre-export warnings inside Studio pipeline

- Detect duplicate glTF material names (`material.duplicateMaterialName`, `gltf.duplicateMaterialNames`).
- Flag per-material override ambiguity before Visual Asset Pack export.
- Keep fire/glow split and alpha policy diagnostics aligned with `gltf_material_tools.js` and `texture_report.js`.
- Diagnostics **warn** by default; blocking behavior only when task acceptance explicitly requires it.

**Validation anchors:**

- `tools/blockbench_import_studio/tests/test_recovery_static.js` — duplicate material groups, split materials, manifest validation
- `npm run studio:test` — static + recovery package checks
- `npm run visual:test` — root integration guard (Studio boundary, pack contract)

## Parallel with `visual-renderer`

FORGE and `visual-renderer` are **separate writers**. The Dispatcher may assign both lanes in the same cycle when the QUEUE DAG allows and path gates pass.

### When parallel is allowed

| Pattern | Example | Rule |
|---------|---------|------|
| Shared prerequisite, divergent paths | `m4l-102` ∥ `m4l-103` after `m4l-101` | Both depend on profile contract; no overlapping ALLOWED_PATHS |
| Independent studio work | `m4l-107` while `m4l-101` runs | Different dependsOn; still no `src/game/*` edits from FORGE |
| Post-classification | `m4l-106a` (game env) while studio diagnostics continue | Serialize if either task touches shared evidence dirs on same commit |

### When to serialize

- Task `dependsOn` includes an incomplete sibling-lane task (e.g. `m4l-104` waits for **both** `m4l-102` and `m4l-103`).
- Two tasks would write the same file under ALLOWED_PATHS.
- `parity:capture` report is the acceptance artifact and both lanes have uncommitted WIP — finish one closeout before verifier re-runs capture.

### Contract handoff (no runtime bleed)

- Shared truth: **renderer profile names** and parity metadata exported from `visual-renderer` (`STUDIO_PREVIEW_PROFILE`, `GAME_STUDIO_PARITY_PROFILE`).
- FORGE consumes profile **names** in capture pages; never import `tools/blockbench_import_studio` from `src/game/*` or `src/foundation/*`.
- `tests/test_blockbench_import_studio_integration.js` enforces the boundary — any Studio path string in runtime sources fails integration.

```text
visual-renderer ──profiles──► game diagnostic page
       │
       └──(metadata only)──► studio capture page
studio-pipeline ──PNG+JSON──► tooling-tests / parity:capture ──► metrics report
```

## Path boundaries

From `LANES.json` (FORGE):

**ALLOWED:**

- `tools/blockbench_import_studio/**`
- `tools/visual_parity_capture_studio.mjs`
- `tools/visual_parity_render_capture.mjs`
- `tools/visual_parity_metrics.py`
- `tools/visual_parity_baseline.py`
- Task `allowedPathsExtra` in `QUEUE.json`

**FORBIDDEN:**

- `src/foundation/**`
- `assets/visual_packs/local_working_visuals/**` (OWNER lane / approved tasks only)
- `src/game/**` — belongs to `visual-renderer`

## Standard validation ladder

Run what the assigned task lists; typical FORGE commands:

```powershell
npm run studio:test
npm run visual:test
node tools/visual_parity_capture_studio.mjs --block Balloon
npm run parity:capture   # when task spans orchestrated parity closeout
```

Minimum tier for M4L assign: **T3** (`validate:fast` green on gate) per `TEAM_PLAYBOOK.md`.

## Task patterns (QUEUE)

| Task | FORGE deliverable |
|------|-------------------|
| `m4l-103` | Studio capture CLI → PNG+JSON for Balloon |
| `m4l-107` | Duplicate material diagnostics surfaced before export |
| `m4l-104` prep | Stable studio capture inputs for orchestrator (often with `tooling-tests` landing the glue) |

## Report back to Dispatcher

```text
result: pass|fail|blocked
lane: studio-pipeline
task: <taskId>
changed paths: <list>
validation: <command> → <exit/summary>
blockers: <OWNER|ENVIRONMENT|SCOPE|none>
notes: <capture paths, diagnostic codes added>
```

Write optional evidence to `.codex/agent_mesh/assignments/<taskId>.md` or `.agent-validation/`.

## Hard stops

| Condition | Action |
|-----------|--------|
| Fix requires editing `src/game/*` | `SCOPE` — escalate to `visual-renderer` |
| Fix requires writing `local_working_visuals` | `OWNER` — await approval |
| Parity failure classified `environment-policy` in game | Support with capture evidence only; do not patch game renderer |
| Duplicate material is asset-data in Blockbench source | Report diagnostic; owner/author renames in Blockbench |
| Integration test flags Studio import in runtime | Remove cross-boundary reference; use profile metadata instead |

## Read first (session)

1. `README_FOR_AGENTS.md`
2. `.codex/agent_mesh/LANES.json`
3. Assigned task in `.codex/agent_mesh/QUEUE.json`
4. `tools/blockbench_import_studio/docs/` for Studio-specific contracts when touching authoring UX