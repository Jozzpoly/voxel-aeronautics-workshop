# VAW — indeks dokumentacji

**Aktualna prawda:** [README](../README.md) → [AI_PROJECT_MEMORY](../AI_PROJECT_MEMORY.md) → [wizja](../PROJECT_VISION.md) → [roadmapa](../ROADMAP.md). [Architektura](../ARCHITECTURE.md) i [AGENTS](../AGENTS.md) opisują granice oraz zasady, nie stan zaakceptowania produktu.

## Dowody i kontekst badawczy (nie osobne źródła roadmapy)

- [CODE_REALITY_AUDIT.md](CODE_REALITY_AUDIT.md) — P1 baseline z 16 VIII 2026 i historyczny ledger napraw P2. Przed cytowaniem statusów skonfrontuj z aktualnym source/CI i checkpointem.
- [Cross-project donor UX / workbench audit](research/2026-10-19-cross-project-builder-ux-donors.md) — konkretne źródła Jaskini, JES, JURE, JV, Splotu, Feniksa Studio, Medium i innych; branch+SHA to evidence z chwili badania, nie licencja na transplantację.
- [PR #16](https://github.com/Jozzpoly/voxel-aeronautics-workshop/pull/16) — chronologia i źródła red→green z kampanii odzyskiwania. Komentarze PR są historią zdarzeń, nie bieżącym statusem.
- [Retrospektywa 19–20 października](history/recovery/2026-10-20-recovery-campaign-review.md) — szczegółowy zapis kampanii, błędów, falsyfikatorów i pozostawionych problemów; **historyczny**.

## Referencje techniczne

- `adr/` — granice / architektura, sprawdzaj status i aktualny kod;
- `visual_asset_pack_v1.md`, `blockbench_import_studio.md`, `mission_map_terrain_authoring.md` — kontrakty narzędzi;
- `research/programming_model.md` — wizja urządzeń i sygnałów, **nie** dowód implementacji.

## `history/` — nieaktywne

Wszystkie dawne fazy, raporty, handoffy, review, archiwalne workflowy, stare roadmaps i eksperymenty to tylko evidence. Słowa „current”, „ready”, „next” dotyczą okresu powstania danego pliku. Nie skanuj całego `history/` na bootstrap; odzyskuj konkretne źródło na żądanie.

**Kolejność pracy agenta:** bieżąca intencja Ownera → dokładny HEAD i publiczny build SHA → minimalny checkpoint → kod i testy danego obszaru → relevant ADR/research → historia tylko gdy potrzebna. Nie wznawiaj automatycznie ostatniego backlogu.
