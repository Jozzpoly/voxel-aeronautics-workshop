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

P2-B domknął fundament ciągłości dowodów `test -> return`: sandbox i kontrakty zapisują jeden ograniczony `lastTestResult` przed cleanupem. Wynik zachowuje pierwszą awarię z `blockId` gdy jest znane, utracone bloki oraz impact/load/fuel evidence i nie trafia do Blueprint/CraftModel. Obecna kompozycja gry nie utrwala jeszcze fixed-step scheduler health i nie ma jeszcze właściwego workshop-facing wyboru/inspekcji wyniku — to jest cel P2-C, a nie ukrywana część P2-B.

P2-A/P2-B mają wykonywalne testy i startup lifecycle proof w disposable kandydacie. Znany nondeterministyczny harness `test_validation_runner.py` pozostaje osobnym długiem infrastruktury.

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

P0 repo recovery, P1 code-reality audit, P2-A Engineering Analysis Truth i P2-B Test Evidence Continuity są zakończone na recovery lane.

**Aktualnym milestone'em jest P2-C — Workshop Editing Fundamentals.**

Cel: zbudować prawdziwą tożsamość zaznaczonej już części, połączyć ją z zachowanym `lastTestResult`/failed `blockId` i umożliwić sensowną edycję istniejącego elementu bez ciągłego delete/re-place. Najpierw wykorzystujemy istniejące capability CraftModel tam, gdzie rozwiązują realny problem warsztatu; nie dokładamy nowego Device/Signal/mechanism frameworku.

Późniejsze uproszczenie UI/visual polish ma być oparte na ręcznej ocenie realnego workflow, nie na samej obecności infrastruktury.
