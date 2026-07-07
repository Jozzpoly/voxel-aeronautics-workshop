# Voxel Aeronautics Workshop

**Workbench Foundation - Gate C Stable Base**

Desktop voxel engineering sandbox where the player builds, tests and pilots their own machine. Gate C is the stable gameplay base: Blueprint v12 Assembly Spaces, deterministic multi-body compilation, articulated real-Cannon flight, strict runtime ownership and offline-capable releases.

The current milestone adds the first Workbench UI foundation: dockable/floating panels, side dock stacking, separate build and flight workspace layouts, a full-span bottom parts hotbar with a compact option, a dockable flight mission panel, and refreshed documentation authority. Gameplay, craft saves, physics/runtime contracts and current procedural visuals remain compatible.

M4G keeps visual iteration fast without creating a new pack for every polish pass. Studio installs one selected block visual into the renderer-only working pack at `assets/visual_packs/local_working_visuals/`, can request in-game visual reload, and imported glTF instances remain child visuals with cloned renderer resources, `visualRoot` subtree mounting, material policy, transform controls and procedural fallback. The stable hit proxy is render-invisible by default and can be shown only through visual debug. Blueprint, CraftModel, `foundation.catalog`, CraftCompiler, physics and control semantics remain authoritative.

## Run

```bash
npm run serve
```

Open the printed local address. Runtime libraries and generated UI CSS are vendored; the normal and single-file builds do not require CDN scripts.

## Validate and build

```bash
npm run check:css
npm run test
npm run validate:fast
npm run parity:capture
npm run build
npm run verify-release
```

Studio can be tested and served from the same repository:

```bash
npm run studio:test
npm run studio:serve
```

`npm run studio:serve` starts the integrated VAW development server and opens Studio at `/tools/blockbench_import_studio/index.html`, with the local install endpoint enabled. Do not use the standalone Studio static server for daily install/update work unless the integrated VAW server is also running.

Multi-agent dispatch (optional, for agent workflows):

```bash
npm run agent:status
npm run agent:cycle
```

## Current contracts

- Blueprint v12: `assemblySpaces[] + blocks[] + mechanicalLinks[]`.
- CompiledCraft V5: deterministic structural, rigid, mechanical and ownership graphs.
- RuntimeAssemblyPlan V3: backend-neutral body/space/part/collider/constraint indexes.
- Workbench UI v4: user preferences only, with build/flight layout separation, side dock stacking, compact/full dock span modes and dockable mission information.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and `bodyId` are separate identity domains.
- Root-only craft remains the zero-configuration default.
- `foundation.catalog` owns gameplay block data; procedural Three visuals remain the fallback renderer.
- Visual Asset Pack V1 is renderer-only. Missing, invalid or unloadable packs must leave procedural fallback visuals active; imported glTF content is never allowed to replace the stable VAW root or hit proxy.
- Daily art iteration uses `tools/blockbench_import_studio/` -> `Install / Update Block Visual` -> automatic same-origin reload when possible, with in-game `RELOAD VISUALS` / `Shift+V` as fallback. This updates `local_working_visuals` in place instead of creating a new pack per edit.
- Gate D - Device & Port Schema - is queued behind Workbench UI and documentation preparation.

Agents should start with [`README_FOR_AGENTS.md`](README_FOR_AGENTS.md), then read [`docs/README.md`](docs/README.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/blockbench_import_studio.md`](docs/blockbench_import_studio.md), [`docs/visual_asset_pack_v1.md`](docs/visual_asset_pack_v1.md), [`docs/adr/0042-workbench-ui-layout.md`](docs/adr/0042-workbench-ui-layout.md) and [`docs/adr/0043-visual-asset-boundary.md`](docs/adr/0043-visual-asset-boundary.md) before foundation changes.

---

## Progress since last push to `VAW_GRoK`

**Transport branch:** `VAW_GRoK` (`origin/VAW_GRoK`)  
**Previous remote HEAD:** `80c0ae4` — *Refine VAW visual asset onboarding and runtime integration* (2026-07-01 area)  
**This publication HEAD:** `142d834` — 30 commits (incl. README + mesh sync), 85+ files, +9456 / −89 lines  
**Published:** 2026-07-07 (owner-approved push after remediation R0–R4)

### Executive summary

| Area | Status |
|------|--------|
| **Remediation R0–R4** | Complete — honest M0 gate, bounded M4L commits, doc convergence, synthetic probe scope labeled |
| **M4L Visual Truth** | **Closed** — Studio/game render parity **5/5** blocks within thresholds |
| **Agent mesh** | Operational — 8-slot team, dispatcher `agent:cycle`, decision plane |
| **`validate:fast`** | **6/6 PASS** at publication HEAD |
| **Next primary milestone** | **M5 Voxel Fit** (explicit render policy vs hidden `0.96` shrink) |
| **Follow-up lane** | **M4LC** — runtime VectorThruster probe wiring (`m4lc-201`, `m4lc-202`) |

### 1. Agent mesh and remediation (R0–R4)

A multi-agent control plane was added under `.codex/agent_mesh/`:

- **Decision plane** — `DECISIONS.json`, `QUEUE.json`, `REGISTRY.json`, `STATE.json`, `LANES.json`
- **Team foundation** — roster (`TEAM_ROSTER.json`), charter, collaboration system, per-lane skill cards
- **Dispatcher** — `tools/agent_dispatch.py` with `npm run agent:cycle`, `agent:spawn-pack`, `agent:status`, `agent:reconcile`
- **Harness regressions** — `tests/test_agent_dispatch.py`, `terminals/` exclusion in validation runner (`r1-001`)

Remediation gates closed honestly:

- **DEC-M0-GATE** — environment and `validate:fast` trustworthy
- **DEC-M4L-COMMIT-STRATEGY (A)** — per-task bounded commits C1–C5 for M4L WIP
- **DEC-PROBE-SCOPE** — VectorThruster `192/192` labeled synthetic-only until `m4lc-201`
- **DEC-REMEDIATION-COMPLETE** — R0–R4 done; transport unlocked for owner push

Evidence: `evidence/ENV_BASELINE_2026-07-07.md`, `.codex/handoff/M4L_VISUAL_TRUTH_CLOSURE_2026-07-07.md`

### 2. M4L Visual Truth — closed

M4L proved imported-visual parity between Blockbench Studio and the game under matched framing and the `game-studio-parity` renderer profile. Root cause of pre-fix darkness was classified as **`environment-policy`** (not asset recolor).

| Task | Deliverable |
|------|-------------|
| `m4l-101` | Shared renderer profiles: `STUDIO_PREVIEW_PROFILE`, `GAME_DEFAULT_PROFILE`, `GAME_STUDIO_PARITY_PROFILE` (`src/game/visual-renderer-profiles.js`) |
| `m4l-102` | Game diagnostic render mode via `?visualParity=1&block=…&profile=game-studio-parity` |
| `m4l-103` | Studio capture harness — PNG + JSON per block |
| `m4l-104` | Unified orchestrator `npm run parity:capture` → `visual_parity_render_report.json` |
| `m4l-105` | Root-cause classification `environment-policy` with render metrics |
| `m4l-106a` | Environment-policy fix — hide UI overlays during capture; align studio parity renderer policy |
| `m4l-107` | Studio duplicate-material diagnostics before export |
| `m4l-108` | ROADMAP/handoff closeout |

**Final parity metrics** (`.agent-validation/m4l-capture/visual_parity_render_report.json`):

| Block | SSIM | Luminance Δ | Pass |
|-------|-----:|------------:|:----:|
| Balloon | **0.963** | **−0.0102** | yes |
| Hull | 0.964 | −0.0031 | yes |
| Fuel | 0.964 | −0.0042 | yes |
| Thruster | 0.979 | +0.0025 | yes |
| VectorThruster | 0.977 | +0.0028 | yes |

Thresholds: SSIM ≥ 0.92, |luminance delta| ≤ 0.08. Pre-fix Balloon SSIM was **0.355** (environment-policy confirmed).

### 3. VectorThruster probe (scope note)

`npm run probe:vector-thruster` reports **192/192** pass for runtime-default and `local_working_visuals` rig profiles. This exercises shadow-model math in Node (`tools/probe_vector_thruster_direction.js`). It is **not yet** runtime-integrated proof through `computeVectorThrusterForceCannon` and `visual_runtime_adapter.setGimbal` — that is queued as **M4LC** (`m4lc-201`, `m4lc-202`).

### 4. Documentation and transport convergence

- `ROADMAP_NEXT.md` — M4L moved to **Closed**; M5 Voxel Fit is next primary lane
- `PUSH_INSTRUCTIONS.md` — transport authority aligned to `VAW_GRoK` only
- `docs/adr/0044-workflow-checkpoint-branch-and-ci-policy.md` — supplement for VAW_GRoK transport
- `AI_PROJECT_MEMORY.md` — current milestone and validation state
- `README_FOR_AGENTS.md` — agent onboarding and validation ladder

### 5. Validation at publication

```text
npm run check:css          PASS
npm run validate:fast      PASS  6/6 stages
npm run parity:capture     PASS  5/5 blocks within thresholds
npm run probe:vector-thruster  PASS  192/192 (synthetic-only scope)
```

Latest fast gate artifact: `.agent-validation/fast-20260707T033957.729292Z-19428/`

### 6. What comes next

1. **M5 Voxel Fit** — remove or replace hidden `0.96` visual shrink as explicit render policy; prove hit proxies, ghost placement and imported visuals with flush blocks.
2. **M4LC** — wire VectorThruster probe to real runtime modules; add integration to default validation path.
3. **M6 Mechanical V2** — joint/hinge design spike before schema growth (per `ROADMAP_NEXT.md`).

Detailed planning authority: `docs/ROADMAP_REBASE_2026-07-01.md`.

---

## Commit log (since `80c0ae4`)

28 commits on the path to this publication. Grouped by theme:

**Mesh & remediation:** agent dispatcher, decision plane, harness tests (r1-001, r1-003), team foundation, `agent:cycle`, STATE/QUEUE sync, DEC-REMEDIATION-COMPLETE.

**M4L product:** m4l-101 profiles, m4l-102 diagnostic mode, m4l-103 studio capture, m4l-104 parity orchestrator, m4l-105 classification, m4l-106a environment fix, m4l-107 studio diagnostics, m4l-108 closeout.

**Docs & evidence:** r4-002 transport convergence, r3-003 probe scope relabel, r4-001 remediation baseline, m4l-108 QA evidence.

**Infra:** CSS regeneration after WIP, `visual-parity-diagnostic` in APP_SOURCES/manifest.