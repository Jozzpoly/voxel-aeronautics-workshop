# Test Report — Foundation Phase 1B

## Wynik

**Wszystkie automatyczne testy przechodzą po walidacji i refaktorze CraftModel.**

Polecenie referencyjne:

```bash
python tests/run_all.py
```

## Testowane źródła aplikacji

1. `src/foundation/kernel.js`
2. `src/foundation/config.js`
3. `src/foundation/catalog.js`
4. `src/foundation/orientation.js`
5. `src/foundation/blueprint.js`
6. `src/foundation/craft_model.js`
7. `src/foundation/craft_history.js`
8. `src/foundation/state.js`
9. `src/foundation/bootstrap.js`
10. `src/game.js`

## Walidacja poprzedniego etapu

Przed rozpoczęciem Phase 1B uruchomiono pełny zestaw testów odziedziczony z Phase 1. Wszystkie testy przechodziły. Potwierdzono również poprawny build jednoplikowy i ZIP.

Przegląd architektury ujawnił jednak, że poprzednia granica modelu była niepełna: `STATE.voxels` łączyło dane bloku z meshem Three.js. Phase 1B usuwa to sprzężenie i dodaje testy, które zabraniają jego powrotu.

## Wyniki statyczne i startowe

- 197 unikalnych funkcji runtime bez duplikatów.
- 142 unikalne identyfikatory HTML.
- 10 źródeł aplikacji w jednej testowanej kolejności.
- Wszystkie bezpośrednie odwołania `getElementById` mają odpowiadające elementy.
- Startup całej aplikacji przechodzi na stubach przeglądarki.
- Bootstrap rozwiązuje siedem modułów domenowych: config, catalog, orientation, blueprint, craft-model, craft-history i state.
- `game.js` nie zawiera już `STATE.voxels`.
- `CraftModel` i `CraftHistory` nie odwołują się do Three.js, Cannon.js, DOM ani runtime lotu.

## Testy CraftModel

- Atomowe dodawanie pojedynczych i wieloblokowych planów.
- Atomowe zastępowanie całej konstrukcji.
- Brak częściowego zapisu przy błędzie walidacji.
- Odrzucanie duplikatów, kolizji pozycji, nieznanych typów i błędnych orientacji.
- Ochrona bloku Core.
- Odrzucanie usunięcia rozcinającego konstrukcję.
- Niezmienność rekordów, snapshotów i payloadów zdarzeń.
- Rosnąca rewizja wyłącznie po przyjętych transakcjach.
- Round-trip `CraftModel -> Blueprint document -> CraftModel`.
- Migracja starszego dokumentu przez istniejący moduł Blueprint.
- 600 deterministycznych losowych operacji dodawania i usuwania.
- Pełna konstrukcja 2500 bloków.
- Atomowe odrzucenie próby przekroczenia limitu.
- Czas pełnego `replace` dla 2500 bloków w środowisku testowym wynosił około 9–11 ms; jest to wynik orientacyjny, nie gwarancja dla przeglądarki użytkownika.

## Testy CraftHistory

- Deduplicacja identycznych snapshotów.
- Poprawne undo i redo.
- Rollback undo/redo po nieudanym odtworzeniu modelu.
- Czyszczenie redo po nowym commicie.
- Izolacja snapshotów od późniejszych mutacji danych wejściowych.
- Ograniczanie historii zgodnie z budżetem pamięci i limitem wpisów.

## Zachowane regresje gry

- 24 unikalne orientacje przestrzenne.
- Poprawny czterokrotny cykl roll i symetria lustrzana.
- Poprawna migracja dokumentów v3–v7.
- Odrzucanie nieznanych przyszłych wersji oraz błędnych blueprintów.
- Poprawny starter VTOL: 17 części, 28 kg, TWR około 1,223.
- Zachowane odroczone obrażenia po `world.step()`.
- Zachowane transakcyjne odrywanie gałęzi.
- Zachowane liniowe lookupy sąsiadów i strukturalny sampling 30 Hz.
- Zachowany limit 48 fizycznych odłamków i 480 części lotnych.
- Zachowane warunki kontraktów, bramek, zawisu i integralności ładunku.

## Build i wydanie

- Jednoplikowy HTML przechodzi `node --check` po wyodrębnieniu osadzonego skryptu.
- ZIP zawiera źródła, testy, dokumentację oraz moduły Phase 1B i nie zawiera katalogu `dist/`.
- Generowanie SHA-256 działa.
- Dwa niezależne buildy tych samych źródeł dały identyczny HTML i identyczny ZIP.

## Ograniczenie testów

Podjęto próbę prawdziwego testu Chromium, lecz środowisko wykonawcze zablokowało nawigację zarówno do `localhost`, jak i `file://` błędem administracyjnym. Raport nie deklaruje więc pełnego playtestu WebGL, działania GPU ani jakości sterowania w rzeczywistym locie.

Do projektu pozostaje do dodania test Playwright uruchamiany lokalnie lub w CI bez tej blokady oraz długotrwały soak test fizyki.
