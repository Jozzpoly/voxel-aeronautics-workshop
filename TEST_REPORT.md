# Test Report — Phase 1D.3A

## Wynik

```bash
python tests/run_all.py
```

**PASS — wszystkie testy rdzenia przeszły.**

Ostatni startup smoke:

```text
STARTUP_OK {
  ids: 160,
  elements: 544,
  modules: 20,
  sources: 23,
  interaction: 'ok'
}
```

## Nowe pokrycie 1D.3A

### Mass properties

- bezwładność pojedynczego cuboidu;
- parallel-axis theorem;
- niezmienność przy wspólnej translacji;
- payload;
- puste assembly.

### Assembly Builder

- wiele body;
- stabilne mapy body/collider/part;
- transakcyjny rollback;
- constraint extension point;
- usuwanie collidera przez `blockId`;
- recenter z zachowaniem prędkości punktu;
- idempotentny lifecycle.

### Headless dynamika

- free fall;
- jawna inertia parity;
- dokładny hover przy równych siłach;
- odpowiedź na moment;
- offset thrust tworzący translację i moment;
- 12 000 kroków soak;
- skończony stan i znormalizowany kwaternion.

### Granice architektury

- produkcyjny lot używa `AssemblyBuilder.build()`;
- `buildFlightBody()` nie tworzy ręcznie body/colliderów konstrukcji;
- recenter i point velocity przechodzą przez Physics Port;
- source loader zawiera wszystkie 23 źródła w prawidłowej kolejności;
- single HTML i ZIP mają source parity.

## Benchmark headless

Ostatni pomiar:

```text
100 colliderów:  median 1.009 ms, max 2.630 ms
500 colliderów:  median 2.796 ms, max 3.348 ms
1000 colliderów: median 5.660 ms, max 6.479 ms
2500 colliderów: median 9.002 ms, max 18.623 ms
```

To baseline architektury, nie benchmark solvera Cannon.

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
- startup smoke;
- deterministyczny build;
- embedded source parity.

## Ograniczenie automatyzacji

`tests/browser_runtime_harness.html` sprawdza prawdziwy adapter Cannon, ale wymaga dostępnych bibliotek przeglądarkowych. W środowisku dostawy bez dostępu do CDN nie został uczciwie zaliczony jako automatyczny PASS. Znajduje się w manualnej checkliście 1D.3B.
