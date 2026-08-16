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

To **nie jest akceptacja jakości produktu**. Aktualny UI, czytelność, zachowanie i ogólny poziom dopracowania zostały ocenione jako wyraźnie niewystarczające i wymagające późniejszego, osobnego audytu. Nie zakładamy, że funkcja opisana w starym roadmapie działa dobrze tylko dlatego, że istnieje kod albo test.

### Co zostało potwierdzone maszynowo

Na bazowym `80c0ae4` szeroka walidacja foundation/runtime przeszła dla m.in. CraftModel/CraftCompiler, RuntimeAssemblyPlan, Cannon, articulated/multi-space runtime, flight lifecycle, missions, damage/debris, Visual Asset Pack, Blockbench Studio oraz VectorThruster probe.

Znane wyjątki z recovery:

- testy timeout/process-family `validation_runner` są środowiskowo niestabilne w obecnym Linux/container: jeden process-family zawisł w H0, a późniejszy `resume-after-timeout` wykazał timingową flakiness — klasyfikacja `HARNESS/ENVIRONMENT`;
- `SOURCE_MANIFEST.json` jest generowany podczas buildu i pakowany do source ZIP; nie jest już wersjonowaną, ręcznie utrzymywaną prawdą repo;
- automatyczny browser proof nie był możliwy w środowisku recovery z powodu blokady localhost/WebGL.

Testy są dowodem technicznym, **nie dowodem jakości gry**.

## Aktualna dokumentacja

Bieżącą prawdę projektu tworzą tylko:

1. [`AI_PROJECT_MEMORY.md`](AI_PROJECT_MEMORY.md) — krótki snapshot aktualnego stanu i niepewności;
2. [`PROJECT_VISION.md`](PROJECT_VISION.md) — trwała wizja i filary projektu;
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — aktualne granice architektury zaobserwowane w kodzie;
4. [`ROADMAP.md`](ROADMAP.md) — obecna kolejność pracy;
5. [`AGENTS.md`](AGENTS.md) — zasady pracy agentów z repozytorium;
6. [`docs/README.md`](docs/README.md) — indeks kontraktów, researchu i historii.

Wszystko pod `docs/history/` jest **wyłącznie historią**. Stare milestone'y, Gate'y, readiness review, handoffy i workflowy nie są aktywnym planem, nawet jeśli kiedyś były opisane jako `current`, `stable`, `ready` albo `complete`.

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

1. zakończyć recovery dokumentacji i repozytorium;
2. wykonać krytyczny audyt kodu oraz długu technicznego;
3. sklasyfikować każdą ważną funkcję jako `PROVEN`, `PARTIAL`, `ROUGH`, `STUB/CLAIM` albo `ABSENT`;
4. dopiero wtedy wybrać najmniejszy sensowny zestaw napraw prowadzący do rzeczywiście przyjemnego loopu `build -> test -> understand -> rebuild`.
