# Wielkie zebranie założycielskie — 2026-07-07

Uczestnicy: KAI, MIRA, TOOL, PIXEL, FORGE, SCRIBE, PROOF, SAGE + Owner (Jozz)

## Feedback właściciela (krytyczna analiza)

| Obserwacja | Diagnoza | Ustalenie zespołu |
|------------|----------|-------------------|
| „Jeden agent się męczy” | Brak twardego podziału ról; ten sam kontekst robi dispatch + kod + QA + docs | **Jeden slot = jedna rola.** Dispatcher nigdy nie pisze `src/`. |
| Praca seryjna zamiast równoległej | `agent:next` zwracał 0–1 zadanie; parent uruchamiał jednego subagenta | **Spawn-pack:** do 6 lane agentów w jednej fali |
| Fałszywe „done” | Brak niezależnego weryfikatora na HEAD | **PROOF** musi re-run validation przed `complete pass` |
| Drift mesh/git | STATE nie aktualizowany po commitach | **MIRA + KAI:** każdy cykl: `headSha`, `check:css`, `reconcile` |
| Brak tożsamości agentów | Sloty anonimowe → brak odpowiedzialności | **TEAM_ROSTER.json** — imiona, skille, skill cards |

## Ustalenia strukturalne

1. **Pliki autorytetu:** DECISIONS → ROADMAP → QUEUE → assignments (dowód)
2. **Cykl sesji:** OPEN → RECONCILE → SPAWN-PACK → VERIFY → CLOSE → CYCLE++
3. **Limit zmęczenia:** max 1 zadanie `in_progress` na lane; po `complete` → `agent:next` lub idle
4. **Transport:** tylko `VAW_GRoK`; push po G1–G10 + owner

## Plan na przyszłość (fazy)

| Faza | Cel |
|------|-----|
| TEAM-FOUNDATION | Roster, collaboration system, dispatch cycle/spawn-pack |
| REMEDIATION close | m4l-108, DEC-REMEDIATION-COMPLETE |
| M4L-C′ / M5 | Kolejne milestone wg ROADMAP |

## Rozdane zadania zebrania

| ID | Owner slot | Status |
|----|------------|--------|
| team-001 | KAI | TEAM_ROSTER + meeting notes |
| team-002 | KAI | COLLABORATION_SYSTEM + FILE_STRUCTURE |
| team-003 | TOOL | `agent_dispatch cycle` + `spawn-pack` |
| team-004 | SCRIBE | README_FOR_AGENTS mesh section |
| team-005 | SAGE | assignments/foundation-gate-review.json |
| team-006 | All | skills/*.md skill cards |