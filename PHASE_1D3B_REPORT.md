# Phase 1D.3B Report — Real-Cannon Parity & Runtime Contract Hardening

## Cel

Skonfrontować granice zbudowane w 1D.3A z prawdziwym Cannon.js, automatycznie sprawdzić zachowanie payloadu, recenteru, kontaktów i lifecycle oraz usunąć długi kontraktowe wykryte podczas krytycznego code review.

## Zakres odpowiedzialności

Zmiany wykonano w:

- `foundation.mass-properties`;
- `foundation.runtime-assembly`;
- `foundation.craft-compiler`;
- `runtime.assembly-builder`;
- `runtime.cannon-physics-backend`;
- `runtime.headless-physics-backend`;
- testach, harnessach i dokumentacji.

`game.js` nie został zmodyfikowany. Granica produkcyjnego assembly pozostała nienaruszona.

## Najważniejsze naprawy

### 1. Preflight validation przed alokacją

`AssemblyBuilder.validatePlan()` sprawdza cały plan zanim backend utworzy pierwsze body:

- unikalne `bodyId`, `colliderId`, `blockId` i `constraintId`;
- poprawne body/collider/part references;
- zgodność `blockIdToBodyId` i `blockIdToPartIndex`;
- dodatnie inertia dla body dynamicznych;
- collidery wycentrowane względem lokalnego COM;
- poprawne box center/half-extents/quaternion;
- brak self-constraint;
- istnienie dynamicznego root body.

Błędny plan nie może już pozostawić częściowo zaalokowanych zasobów.

### 2. Atomowe mutacje runtime

Usunięcie collidera zmienia mapy i flagę `removed` dopiero po potwierdzeniu sukcesu backendu. Gdy backend zwróci `false` albo rzuci wyjątek, runtime zachowuje możliwość ponowienia operacji.

Rollback:

- zawsze próbuje usunąć wszystkie listenery, constraints i body;
- zachowuje pierwotny błąd konstrukcji;
- błędy cleanup dołącza jako `cleanupErrors`, zamiast nimi maskować przyczynę;
- jawny `dispose()` raportuje zbiorczy błąd cleanup.

Metadane `assemblyBodyId` i `assemblyRole` są zastrzeżone i nie mogą zostać nadpisane przez `bodyDescriptor.userData`.

### 3. Rygorystyczne mass properties i plan runtime

`foundation.mass-properties` odrzuca teraz:

- nieobiekty;
- NaN/Infinity;
- ujemną masę;
- niepełne wektory;
- zerowe lub ujemne half-extents.

`foundation.runtime-assembly` nie tworzy już cichych legacy ID ani nie naprawia wadliwych wektorów fallbackami. Snapshot lotu musi posiadać jawne, skończone dane i co najmniej jedną część.

### 4. Parity obu backendów

Cannon:

- body dostaje jawny typ STATIC/DYNAMIC przy tworzeniu;
- zmiana masy synchronizuje typ i właściwości solvera;
- dynamiczne body jest wybudzane;
- naprawiono `getPointVelocity()`: Cannon `Vec3.vadd(v, target)` mutuje target, ale nie zwraca go.

Headless:

- zmiana masy synchronizuje typ body;
- statyczne body czyści akumulatory force/torque;
- moment świata jest transformowany do lokalnej ramy bezwładności, a wynik z powrotem do świata;
- obrócona asymetryczna bryła reaguje zgodnie z real Cannon.

### 5. Automatyczny real-Cannon harness

Dodano test-only vendoring Cannon.js 0.6.2 z zachowaną licencją MIT. `tests/test_real_cannon_harness.js` wchodzi do `tests/run_all.py` i obejmuje:

- free fall;
- jawne inertia parity;
- odpowiedź na moment;
- rotated inertia;
- offset thrust;
- payload detach i recenter podczas obrotu;
- prawdziwy kontakt z plane oraz znormalizowane eventy;
- 12 000 kroków soak;
- benchmark 100/500/1000/2500 colliderów;
- 50 cykli build/dispose i kontrolę heap delta.

Browser harness korzysta z lokalnego testowego Cannon, więc nie jest blokowany przez brak sieci.

### 6. CraftCompiler work cap

Po wykryciu `block-limit` kompilator przetwarza dokładnie `GRID.maxBlocks`, a nie `maxBlocks + 1`. Błąd pozostaje diagnostyką gotowości, ale dodatkowy rekord nie zwiększa kosztu ani nie przecieka do wyniku.

## Wyniki real-Cannon

Środowisko dostawy, Cannon 0.6.2, Node z `--expose-gc`:

| Collidery | Mediana build | Max build | Mediana step | P99 step |
|---:|---:|---:|---:|---:|
| 100 | 3.101 ms | 6.165 ms | 0.0131 ms | 0.0217 ms |
| 500 | 26.888 ms | 26.966 ms | 0.0622 ms | 0.0791 ms |
| 1000 | 85.201 ms | 91.459 ms | 0.1260 ms | 0.1524 ms |
| 2500 | 482.791 ms | 495.693 ms | 0.3292 ms | 0.3744 ms |

Lifecycle: 50 cykli, zero pozostawionych body, heap delta po GC: 424 816 B.

Pomiary dotyczą pustego świata bez wielkoskalowych aktywnych kontaktów. Nie stanowią podstawy do automatycznego podniesienia limitu części.

## Wyniki headless architecture baseline

| Collidery | Mediana build | Max build |
|---:|---:|---:|
| 100 | 0.740 ms | 3.647 ms |
| 500 | 4.022 ms | 4.452 ms |
| 1000 | 5.874 ms | 9.063 ms |
| 2500 | 15.446 ms | 18.645 ms |

Tych wyników nie wolno porównywać jako wydajności solverów. Headless nie rozwiązuje kontaktów ani constraints.

## Długi zamknięte

- automatyczny real-Cannon harness bez CDN;
- payload/recenter podczas obrotu;
- real contact event boundary;
- build/step/lifecycle/memory metrics;
- headless rotated inertia;
- STATIC/DYNAMIC type transition;
- atomic collider removal;
- rollback masking;
- preallocation plan validation;
- strict mass/runtime snapshot input;
- compiler over-limit work leak.

## Długi pozostające

- finalne Physics Port API constraintów;
- joint capability spike;
- rigid-island compiler;
- production runtime part state poza `game.js`;
- Collider Compiler i scenariusze wydajności z kontaktami;
- graczowy `PayloadMount`;
- produkcyjne biblioteki bez CDN;
- automatyczny WebGL/GPU browser test.

## Decyzja

Phase 1D.3B jest zakończona. Następny właściwy krok to wąski Phase 1D.3C joint capability spike. Nie należy wracać do szerokiej refaktoryzacji `game.js` ani projektować uniwersalnego API constraintów bez wyników spike.
