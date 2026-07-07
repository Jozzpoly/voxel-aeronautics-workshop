# Agent Mesh — struktura plików

Wersja: 2 (TEAM-FOUNDATION 2026-07-07)

## Drzewo `.codex/agent_mesh/`

```text
.codex/agent_mesh/
├── README.md                 # Indeks + quick commands
├── TEAM_ROSTER.json          # Imiona, skille, sloty (8 członków)
├── TEAM_CHARTER.md           # Misja zespołu (skrót)
├── COLLABORATION_SYSTEM.md   # Wymuszona współpraca wieloagentowa
├── FILE_STRUCTURE.md         # Ten plik
├── DISPATCHER_ROLE.md        # Kontrakt KAI
├── TEAM_PLAYBOOK.md          # Lifecycle OPEN→CLOSE
├── DECISION_MESH_RULES.md    # Push gate G1–G10
├── DECISIONS.json            # Bramki i owner approvals
├── AUDIT_FINDINGS.json       # AUD-* registry
├── REMEDIATION_PLAN.md       # R0–R4 (archiwum aktywne)
├── QUEUE.json                # DAG zadań — kiedy praca biegnie
├── STATE.json                # Żywy stan sesji
├── REGISTRY.json             # Sloty agentów busy/idle
├── LANES.json                # ALLOWED/FORBIDDEN paths
│
├── skills/                   # Skill card per lane (1:1 z roster)
│   ├── dispatcher.md         # KAI
│   ├── env-infra.md          # MIRA
│   ├── tooling-tests.md      # TOOL
│   ├── visual-renderer.md    # PIXEL
│   ├── studio-pipeline.md    # FORGE
│   ├── docs-convergence.md   # SCRIBE
│   ├── qa-validation.md      # PROOF
│   └── planner-auditor.md    # SAGE
│
├── meetings/                 # Zebrania zespołu
│   └── FOUNDATION_2026-07-07.md
│
├── sessions/                 # Runtime orchestration
│   └── active_spawn_pack.json
│
├── cycles/                   # Archiwum cykli KAI
│   └── .gitkeep
│
└── assignments/              # Dowody per task
    ├── <taskId>-closeout.json
    ├── <taskId>-closeout.md
    └── *-gate-review.json
```

## Narzędzia (`tools/agent_dispatch.py`)

| Komenda | Plik wyjściowy |
|---------|----------------|
| `cycle` | `sessions/active_spawn_pack.json` + `cycles/CYCLE-<ts>.json` |
| `spawn-pack` | stdout JSON (prompty do Task tool) |
| `fatigue` | stdout — lane load report |
| `status` / `next` / `assign` / `complete` | mutuje STATE/QUEUE/REGISTRY |

## npm scripts

```text
agent:status
agent:next
agent:cycle      # pełny cykl KAI
agent:spawn-pack # prompty do równoległego launch
agent:fatigue    # alert zmęczenia lane
agent:reconcile
agent:decisions
agent:gate-check
```

## Zasady mutacji

| Plik | Kto może pisać |
|------|----------------|
| QUEUE, STATE, REGISTRY | KAI tylko |
| DECISIONS.json | KAI + quorum (SAGE/PROOF zapis rekomendacji w assignments) |
| assignments/** | Lane agent + SAGE |
| skills/, meetings/, TEAM_* | KAI + SCRIBE na zebraniach |
| src/**, tests/** | Lane agents wg LANES.json |

## Powiązanie z repo

- `README_FOR_AGENTS.md` → sekcja Multi-agent mesh → ten folder
- `package.json` → skrypty `agent:*`
- `tests/test_agent_dispatch.py` → kontrakt CLI