# Test Report — Phase 1D.3B

## Wynik końcowy

```bash
python tests/run_all.py
```

**PASS — wszystkie testy rdzenia przeszły po zmianach.**

Startup smoke:

```text
STARTUP_OK {
  ids: 160,
  elements: 544,
  modules: 20,
  sources: 23,
  interaction: 'ok'
}
```

## Bazowy test przed zmianami

Pełna bateria 1D.3A została uruchomiona przed modyfikacją plików i zakończyła się `All core tests passed.`. Dzięki temu nowe awarie można było przypisać zmianom, a nie zastanemu stanowi paczki.

## Nowe pokrycie 1D.3B

### Real Cannon 0.6.2

- free fall;
- explicit inertia parity;
- torque response;
- rotated asymmetric inertia;
- offset force tworząca obrót;
- payload detach/recenter podczas translacji i rotacji;
- prawdziwy plane contact;
- normalizacja collision event;
- 12 000 kroków soak;
- quaternion finite/normalized;
- build i step benchmark do 2500 colliderów;
- 50 cykli lifecycle;
- zero pozostawionych body;
- kontrola heap delta po GC.

### Assembly Builder

- plan validation przed backend allocation;
- body/collider/part/constraint cross-references;
- dodatnia inertia body dynamicznego;
- reserved userData;
- atomic collider removal retry;
- rollback zachowujący oryginalny wyjątek;
- cleanup error aggregation;
- multi-body i constraint seam;
- recenter point velocity;
- idempotent dispose.

### Mass properties i planner

- odrzucenie NaN/Infinity;
- odrzucenie ujemnej masy;
- odrzucenie wadliwych center/half-extents;
- odrzucenie brakujących i powielonych `blockId`;
- odrzucenie pustego snapshotu;
- jawny payload offset;
- strict finite mass/COM/inertia.

### Backend headless

- rotated inertia parity;
- zerowanie akumulatorów statycznego body;
- STATIC ↔ DYNAMIC transition;
- wszystkie poprzednie free-flight i soak tests.

### CraftCompiler

- praca ograniczona do `GRID.maxBlocks`;
- rekord poza limitem nie trafia do normalizacji ani wyniku.

## Benchmark real Cannon

```text
100:  build median 3.101 ms, max 6.165 ms; step median 0.0131 ms, p99 0.0217 ms
500:  build median 26.888 ms, max 26.966 ms; step median 0.0622 ms, p99 0.0791 ms
1000: build median 85.201 ms, max 91.459 ms; step median 0.1260 ms, p99 0.1524 ms
2500: build median 482.791 ms, max 495.693 ms; step median 0.3292 ms, p99 0.3744 ms
```

50 cykli lifecycle: heap delta po GC `424816` B.

## Benchmark headless

```text
100:  median build 0.740 ms, max 3.647 ms
500:  median build 4.022 ms, max 4.452 ms
1000: median build 5.874 ms, max 9.063 ms
2500: median build 15.446 ms, max 18.645 ms
```

Headless jest baseline-em architektury i nie rozwiązuje kontaktów. Wyników nie wolno traktować jako porównania solverów.

## Pełna bateria regresji

Nadal przechodzą:

- blueprint v10 i migracje;
- trwałe `blockId`;
- CraftModel i historia;
- CraftCompiler;
- input profile v3;
- aerostatyka i guided vertical controls;
- misje, lądowanie i payload;
- damage, detach i fuel leaks;
- workspace;
- granice `game.js` / Physics Port / Assembly Builder;
- startup smoke;
- deterministyczny build;
- embedded source parity i ZIP parity.

## Ograniczenia testów

- real-Cannon benchmark używa pustego świata i nie reprezentuje tysiąca aktywnych kontaktów;
- browser harness nie zastępuje pełnego testu WebGL/GPU;
- brak jeszcze jointów, więc nie ma testu constraint drift ani powered motor;
- produkcyjne biblioteki aplikacji nadal są ładowane zgodnie z `index.html`.
