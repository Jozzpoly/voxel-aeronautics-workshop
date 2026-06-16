# Phase 1D.3A Report — Runtime Assembly Builder & Deterministic Headless Harness Core

## Cel

Zmienić `RuntimeAssemblyPlan` z obietnicy architektonicznej w rzeczywistą granicę produkcyjnego runtime oraz stworzyć testowalny bez WebGL rdzeń dynamiki potrzebny przed jointami i Per-Block Control Bus.

## Najważniejsze zmiany

### 1. `runtime.assembly-builder`

Builder przyjmuje neutralny plan oraz backend zgodny z Physics Port. Tworzy body i collidery, stosuje mass properties, buduje mapy tożsamości oraz zwraca kontrolowany lifecycle.

Właściwości:

- wiele `rigidBodies[]`;
- `bodyById`;
- `colliderById`;
- `colliderByBlockId`;
- `partByBlockId`;
- `constraintById`;
- transakcyjny rollback;
- idempotentne `dispose()`;
- seam `constraintBuilder`;
- recenter konkretnego body;
- atomowa aktualizacja mass properties.

### 2. Integracja z produkcyjnym lotem

`buildFlightBody()` korzysta z `AssemblyBuilder.build()`. `game.js` nadal tworzy Three.js visuals i gameplayowe rekordy uszkodzeń, ale nie składa ponownie fizycznej bryły głównego statku.

Detach usuwa collider przez `blockId`. Payload ma stabilny `colliderId`. Cleanup deleguje usuwanie body i listenerów do runtime assembly.

### 3. `foundation.mass-properties`

Jeden czysty algorytm liczy:

- całkowitą masę;
- COM;
- lokalną bezwładność pudeł;
- diagonalną bezwładność względem COM;
- offsety elementów.

Korzystają z niego kompilator, loaded snapshot i runtime po uszkodzeniu.

### 4. Recenter bez sztucznego impulsu

Nowy środek masy ma zachować prędkość punktu starej bryły, który staje się nowym COM:

```text
v_newCOM = v_oldCOM + omega × r
```

`getPointVelocity()` należy do Physics Port. Builder przesuwa collider offsets, ustawia światową pozycję nowego COM i jego liniową prędkość. Potem runtime aktualizuje lokalne pozycje części i wizualizacji.

### 5. Deterministyczny backend headless

Backend implementuje kontrakt Physics Port bez DOM i rendererów. Integruje swobodny ruch, siły, momenty, tłumienie i kwaternion. Celowo nie posiada solvera kontaktów.

Służy do:

- szybkich testów architektury;
- sprawdzania mass properties;
- weryfikacji buildera;
- wykrywania NaN i błędów lifecycle;
- uruchamiania soak w CI bez WebGL.

Nie wolno używać jego wyników jako benchmarku Cannon ani argumentu za zmianą backendu.

## Testy

Dodano:

- `test_mass_properties.js`;
- `test_assembly_builder.js`;
- `test_headless_harness.js`;
- `test_runtime_assembly_benchmark.js`;
- `browser_runtime_harness.html/js`;
- regresyjne asercje granicy Assembly Buildera.

Headless soak wykonuje 12 000 kroków i sprawdza skończoność całego stanu oraz normalizację kwaternionu.

## Benchmark architektoniczny

Backend: `headless-deterministic`.

Ostatni pomiar w środowisku dostawy:

| Collidery | Mediana budowy | Maksimum |
|---:|---:|---:|
| 100 | 1.009 ms | 2.630 ms |
| 500 | 2.796 ms | 3.348 ms |
| 1000 | 5.660 ms | 6.479 ms |
| 2500 | 9.002 ms | 18.623 ms |

To test kosztu planu, map i obiektów backendu testowego. Nie mierzy broadphase, narrowphase ani kontaktów Cannon.

## Krytyczne ograniczenia

1. Produkcyjny planner nadal emituje jedną rigid island.
2. `constraintBuilder` istnieje, ale Physics Port nie ma jeszcze neutralnego API jointów.
3. Browser harness wymaga prawdziwych bibliotek z CDN i dlatego musi być wykonany lokalnie w środowisku z siecią lub po przyszłym vendoringu zależności.
4. Headless backend nie testuje kolizji, uszkodzeń kontaktowych ani stabilności jointów.
5. Benchmark buildera nie uzasadnia podniesienia limitu 480 części.
6. Payload pozostaje colliderem misyjnym w body, nie osobnym systemem mocowania.

## Decyzja

Phase 1D.3A jest zamkniętym krokiem fundamentów. Następnym krokiem nie jest kolejna ogólna refaktoryzacja `game.js`, lecz:

1. real-Cannon parity i pomiary;
2. joint capability spike;
3. pierwszy grywalny Per-Block Control Bus.
