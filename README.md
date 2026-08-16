# Voxel Aeronautics Workshop

**VAW jest eksperymentalnym warsztatem do budowania maszyn blok po bloku, uruchamiania ich w fizyce i rozumienia, dlaczego działają albo się rozpadają.**

## Stan projektu — 2026-08-16

Repozytorium jest w trakcie świadomego recovery. To **nie jest deklaracja stabilnego wydania ani ukończonego gameplay loopu**.

Aktywny lane recovery to `recovery/playable-truth`. Został rozpoczęty z pre-mesh snapshotu `80c0ae4aced1dd695af217cdeadea9025c6305c8`. `main` pozostaje starszą linią i nie powinien być traktowany jako bieżąca prawda produktu, dopóki recovery nie zostanie zakończone i świadomie promowane.

### Co zostało potwierdzone ręcznie

Właściciel uruchomił exact single-file build z `80c0ae4` 2026-08-16. Potwierdzone jest tylko to, że:

- aplikacja startuje i renderuje Workbench;
- widoczny jest istniejący craft;
- można wejść w `Launch Sandbox Test`;
- scena testowa/fizyczna startuje;
- telemetry aktualizuje stan podczas testu.

To **nie jest akceptacja jakości produktu**. Aktualny UI, czytelność, zachowanie i ogólny poziom dopracowania zostały ocenione jako wyraźnie niewystarczające. Nie zakładamy, że funkcja opisana w starym roadmapie działa dobrze tylko dlatego, że istnieje kod albo test.

### Co zostało potwierdzone maszynowo

Bazowy produkt ma szeroko testowany foundation/runtime: CraftModel/CraftCompiler, RuntimeAssemblyPlan, Cannon, articulated/multi-space runtime, flight lifecycle, missions, damage/debris, Visual Asset Pack i Blockbench Studio.

P1 code-reality audit jest zapisany w [`docs/CODE_REALITY_AUDIT.md`](docs/CODE_REALITY_AUDIT.md). P2-A naprawił pierwszy potwierdzony błąd prawdy produktu: Engineering Analysis korzysta teraz z compiled rigid adjacency dla weak links, a procenty sterowności są jawnie ograniczone do **primary-body local authority** zamiast udawać whole-craft prediction dla maszyn przegubowych. Mission readiness sygnalizuje to ograniczenie zamiast podawać pozornie dokładny wynik.

P2-A przeszedł nowy wykonywalny test multi-space/multi-body oraz szeroki core suite w disposable kandydacie. Jedynym świadomie wyłączonym elementem był wcześniej zidentyfikowany nondeterministyczny harness `test_validation_runner.py`.

Znane wyjątki:

- timeout/process-family `validation_runner` jest niestabilny także między Windows/Ubuntu CI — klasyfikacja `HARNESS/ENVIRONMENT`;
- `SOURCE_MANIFEST.json` jest generowany podczas buildu i pakowany do source ZIP; nie jest wersjonowaną, ręcznie utrzymywaną prawdą repo;
- obecne środowisko recovery nadal nie dostarcza wiarygodnego browser/rendered proof: Chromium/CDP nie dochodzi do bootstrapu aplikacji. Nie jest z tego deklarowany browser PASS.

Testy są dowodem technicznym, **nie dowodem jakości gry**.

## Aktualna dokumentacja

Bieżącą prawdę projektu tworzą tylko:

1. [`AI_PROJECT_MEMORY.md`](AI_PROJECT_MEMORY.md) — krótki snapshot aktualnego stanu i niepewności;
2. [`PROJECT_VISION.md`](PROJECT_VISION.md) — trwała wizja i filary projektu;
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — aktualne granice architektury zaobserwowane w kodzie;
4. [`ROADMAP.md`](ROADMAP.md) — obecna kolejność pracy;
5. [`AGENTS.md`](AGENTS.md) — zasady pracy agentów z repozytorium;
6. [`docs/README.md`](docs/README.md) — indeks bieżących dowodów, kontraktów, researchu i historii.

Wszystko pod `docs/history/` jest **wyłącznie historią**. Stare milestone'y, Gate'y, readiness review, handoffy i workflowy nie są aktywnym planem.

## Uruchomienie lokalne

```bash
npm run serve
```

Główna walidacja techniczna:

```bash
npm test
```

Nie używaj wyniku testów jako substytutu ręcznej oceny produktu.

## Najbliższy kierunek

P0 repo recovery, P1 code-reality audit i P2-A Engineering Analysis Truth są zakończone na recovery lane.

**Aktualnym milestone'em jest P2-B — Test → Workshop Feedback Continuity.**

Cel: po powrocie z sandboxowego testu nie wyrzucać informacji potrzebnych do zrozumienia awarii. Zachować jeden ograniczony, strukturalny wynik ostatniego testu — m.in. pierwszą istotną awarię, utracone części i najważniejsze impact/load/fuel-loss evidence — bez zapisywania transient damage do Blueprintu.

Dopiero potem przechodzimy do P2-C Workshop Editing Fundamentals i późniejszego uproszczenia UI/visual polish.
