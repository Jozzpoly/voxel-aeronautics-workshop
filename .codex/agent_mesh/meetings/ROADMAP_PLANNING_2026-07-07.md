# Roadmap Planning Session — 2026-07-07

**Facilitator:** KAI (dispatcher)  
**Participants:** MIRA, TOOL, PIXEL, FORGE, SCRIBE, PROOF, SAGE (+ owner observer)  
**Base:** `origin/VAW_GRoK` @ post-M4L publication  
**Outcome:** Consensus execution plan for **M4LC → M5 → M6 spike**

---

## 1. Burza mózgów — propozycje per agent

### KAI (dispatcher)
- **Propozycja:** Zamknąć M4LC w jednej fali (TOOL), potem M5 w trzech równoległych ścieżkach: polityka renderu (PIXEL), dowód placement (TOOL+PROOF), ADR (SCRIBE). M6 tylko spike read-only do czasu M5 gate.
- **Krytyka SAGE:** Nie zaczynać M5 product code przed `m4lc-202` w FAST_PLAN — inaczej zielony validate:fast bez runtime thruster proof.

### MIRA (env-infra)
- **Propozycja A:** Każdy milestone = bounded commit + `validate:fast` na czystym drzewie.  
- **Propozycja B:** M5 od razu zmienić `0.96` → `1.0` w jednym PR.  
- **Krytyka PROOF:** B odrzucone — brak hit-proxy baseline = fałszywy PASS. Najpierw `m5-000` audit + test harness.

### TOOL (tooling-tests)
- **Propozycja:** `m4lc-201` przez `vector_thruster_runtime_harness.js` (extract `computeVectorThrusterForceCannon` + real `setGimbal`). `m4lc-202` dodać `test_vector_thruster_runtime_probe.js` do `run_all.py` + FAST_PLAN stage.  
- **Krytyka PIXEL:** Harness extract z `game.js` jest kruche — dodać contract test na anchor string + test_visual_runtime_adapter parity.

### PIXEL (visual-renderer)
- **Propozycja A:** M5 — named constant `MODULE_VISUAL_CELL_SCALE` w `module_visual_factory.js`, domyślnie `0.96` (no behavior change), potem owner flag na `1.0`.  
- **Propozycja B:** Natychmiast `1.0` + fix ghost opacity.  
- **Krytyka SAGE:** A wygrywa — jawna polityka bez zmiany wyglądu = bezpieczny pierwszy commit; B wymaga `m5-002` dowodu.

### FORGE (studio-pipeline)
- **Propozycja:** M5 nie dotyka Studio poza opcjonalnym capture re-baseline po scale change. Parity profile z M4L zostaje.  
- **Krytyka SCRIBE:** Udokumentować że Studio preview i game muszą używać tej samej cell scale policy — ADR 0046 spike.

### SCRIBE (docs-convergence)
- **Propozycja:** ADR 0046 Voxel Fit Render Policy + update `ROADMAP_NEXT.md` M4LC closed. Handoff `M5_VOXEL_FIT_KICKOFF`.  
- **Krytyka TOOL:** ADR przed kodem M5-001 — accepted.

### PROOF (qa-validation)
- **Propozycja:** Każda fala kończy się: `validate:fast` 6/6 + task.validation + evidence JSON w `.codex/agent_mesh/assignments/`.  
- **Krytyka KAI:** Zatwierdzone — PROOF nie pisze kodu, tylko re-run po bounded commit.

### SAGE (planner-auditor)
- **Propozycja:** Kolejność gate: **M4LC complete → M5-000 audit → M5-001 explicit policy (no visual change) → M5-002 hit/ghost tests → M5-003 scale 1.0 experiment behind dev flag → M6 spike doc only**.  
- **Odrzucone:** Równoległe M5 product + M6 schema — narusza ROADMAP_REBASE sekcję M6.

---

## 2. Konkurencyjne warianty M5 (test krytyczny)

| Wariant | Opis | Głosy | Werdykt |
|---------|------|-------|---------|
| **W1** | Jedno PR: usuń `0.96` | MIRA-B, PIXEL-B | **Odrzucony** — brak baseline |
| **W2** | Trzy PR: audit → named policy @0.96 → tests → optional 1.0 | SAGE, TOOL, PROOF, SCRIBE | **Wybrany** |
| **W3** | M5 po M6 hinge ADR | — | **Odrzucony** — owner priorytet visual fit |

---

## 3. Consensus DAG (execution order)

```text
WAVE 1 — M4LC close (serial TOOL → PROOF)
  m4lc-201  runtime harness + probe 192/192
  m4lc-202  run_all + FAST_PLAN integration
  m4lc-203  PROOF evidence + DEC-M4LC-COMPLETE (SAGE quorum)

WAVE 2 — M5 audit + policy (parallel max 3)
  m5-000    SCRIBE  ADR 0046 spike + audit doc (0.96 inventory)
  m5-001    PIXEL   named MODULE_VISUAL_CELL_SCALE @ 0.96 (no visual delta)
  m5-002    TOOL    hit-proxy + ghost placement regression tests

WAVE 3 — M5 scale experiment (after m5-002 pass)
  m5-003    PIXEL   dev-flag path to 1.0 + visual parity re-capture
  m5-004    TOOL    render-stat baseline script
  m5-005    SCRIBE  greedy-meshing boundary classification doc

WAVE 4 — M6 spike (read-only, parallel docs)
  m6-000    SCRIBE  Mechanical V2 ADR outline
  m6-001    SAGE    joint-frame failure-mode review assignment
```

---

## 4. Podział pracy — aktywne sloty

| Slot | Task | Status |
|------|------|--------|
| tooling-tests-1 | m4lc-201 → m4lc-202 | **in progress / next** |
| qa-validation-1 | m4lc-203 (after 202) | queued |
| docs-convergence-1 | m5-000 | ready after M4LC |
| visual-renderer-1 | m5-001 | pending m5-000 |
| tooling-tests-1 | m5-002 | pending m5-001 |
| planner-auditor-1 | gate review @ M4LC close | on demand |

**KAI monitoring:**  
- TOOL nie rozszerza scope poza `tools/**`/`tests/**` dla M4LC.  
- PIXEL nie edytuje `module_visual_factory.js` przed SCRIBE ADR 0046 draft (m5-000).  
- Każdy agent po `complete` → idle; KAI `agent:cycle` co zamkniętą falę.

---

## 5. Definition of Done (milestones)

### M4LC
- `npm run probe:vector-thruster` 192/192, `integration: runtime-harness`
- `tests/test_vector_thruster_runtime_probe.js` w `run_all.py`
- DEC-M4LC-COMPLETE approved

### M5 (phase 1)
- `0.96` jest named policy, nie magic number
- Hit proxy + ghost tests green przy scale 0.96
- ADR 0046 accepted

### M6 (spike only)
- Design doc draft, zero schema changes

---

## 6. Ryzyka i mitigacje

| Ryzyko | Mitigacja |
|--------|-----------|
| Harness extract z game.js | Contract test + anchor grep w CI |
| validate:fast HARNESS fail (dirty mesh) | Commit mesh po każdym cyklu KAI |
| Parity regression po scale 1.0 | `parity:capture` gate w m5-003 |
| Agent fatigue (TOOL >40%) | `agent:fatigue` → rotacja na PROOF/SCRIBE |

---

*Next KAI action: `complete m4lc-201`, assign wave 2, `npm run agent:cycle --max-parallel 4`*