# VAW Collaboration System — ciągła praca wielu agentów

Status: Active (TEAM-FOUNDATION 2026-07-07)  
Authority: Operational — product truth remains in source and ADRs.

## Problem, który rozwiązujemy

Jeden agent w jednej sesji nie może być dispatcherem, implementatorem, QA, kronikarzem i audytorem. To prowadzi do:

- przedwczesnego `done` (AUD-001)
- niereprodukowalnego PASS (AUD-002)
- driftu STATE/QUEUE (AUD-003)
- wyczerpania kontekstu i spadku jakości

## Zasada nadrzędna

**Równolegle domyślnie, seryjnie tylko gdy musi.**

```text
Parent orchestrator
    │
    ├─ KAI (dispatcher) ── spawn-pack JSON
    │
    ├─ MIRA ─┬─ TOOL ─┬─ PIXEL ─┬─ FORGE ─┬─ SCRIBE ─┬─ PROOF
    │        │         │         │         │          │
    │        └─────────┴─────────┴─────────┴──────────┘
    │                      (max 6 równolegle)
    │
    └─ SAGE (read-only, na bramkach)
```

## Cykl wymuszony (każda sesja)

| Krok | Kto | Komenda / akcja |
|------|-----|-----------------|
| 1 OPEN | KAI | `npm run agent:cycle` lub `agent:status` + `agent:reconcile` |
| 2 SPAWN | Parent | Uruchom **wszystkie** wpisy z `sessions/active_spawn_pack.json` **równolegle** |
| 3 WORK | Lane agents | Jedno zadanie, ALLOWED_PATHS, skill card |
| 4 VERIFY | PROOF / SAGE | Re-run `task.validation` na HEAD |
| 5 CLOSE | KAI | `complete` tylko po verify; commit bounded per task |
| 6 NEXT | Każdy lane | Po `complete` → sprawdź `agent:next`; nie rozszerzaj scope |

## Warstwa KAI (dispatcher)

1. **Jedyny routing** — tylko KAI mutuje STATE/QUEUE/REGISTRY.
2. **SLA 5 min** — cykl dispatch kończy się spawn-packiem lub jawny blocker.
3. **Spawn-pack mandate** — jeśli ≥2 lane idle i DAG pozwala → jedna fala równoległa.
4. **Lane cap** — max 1 `busy` writer na lane.
5. **Scope firewall** — KAI nie edytuje `src/**`; fix = nowe zadanie w QUEUE.

## Warstwa lane (7 agentów)

| Codename | Po zakończeniu zadania |
|----------|------------------------|
| MIRA | `check:css`; jeśli queue pusta → env-verify JSON |
| TOOL | regression test first; handoff harness vs PRODUCT do PROOF |
| PIXEL / FORGE | `agent:next`; **nigdy** nie bierz drugiego taska bez KAI |
| SCRIBE | docs po commicie produktu; pair z PROOF |
| PROOF | independent re-run; `mayWriteProductCode: false` |
| SAGE | gate review JSON; nigdy kod |

## Anty-wzorce (zakazane)

| Antywzorzec | Skutek | Remediacja |
|-------------|--------|------------|
| Serial hero | Jeden subagent robi wszystko | `agent:spawn-pack` → Task × N |
| Self-grade | Implementer oznacza pass | PROOF + SAGE przed complete |
| Ghost busy | Slot busy bez agenta | `agent:reconcile` co cykl |
| `git add .` | Mieszane commity | Per-task bounded commits (DEC-M4L-COMMIT-STRATEGY A) |
| Mesh bez commita | validate:fast HARNESS fail | Commit mesh po cyklu lub przed validate |

## Metryki zmęczenia

```powershell
npm run agent:fatigue
```

Alert gdy jeden lane >40% ukończonych zadań w ostatnich 20 wpisach historii — KAI powinien przerwać i zrównoważyć kolejkę.

## Pliki sesji

| Plik | Rola |
|------|------|
| `sessions/active_spawn_pack.json` | Bieżąca fala do uruchomienia przez parent |
| `cycles/CYCLE-*.json` | Archiwum cykli dispatch |
| `assignments/<taskId>-closeout.*` | Dowód pracy per zadanie |

## Integracja z ownerem

- **USER_ART**, push, destructive git → blocker `OWNER`; tylko Jozz zdejmuje.
- Owner wybiera strategię commitów i zwalnia push (G10).
- Zebrania zespołu → `meetings/*.md` + aktualizacja TEAM_ROSTER.