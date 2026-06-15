# Changelog

## Foundation Phase 1B — CraftModel Boundary

### Walidacja poprzedniego etapu

- Ponownie uruchomiono cały zestaw testów Foundation Phase 1 przed rozpoczęciem zmian.
- Potwierdzono poprawność składni, migracji, misji, uszkodzeń, startupu i buildu.
- Zidentyfikowano najważniejsze pozostałe sprzężenie: `STATE.voxels` łączyło dane bloku z meshem Three.js.
- Potwierdzono, że poprzednie moduły były używane przez grę, ale granica danych konstrukcji nadal była niepełna.

### CraftModel

- Dodano `foundation.craft-model` jako autorytatywny, niezależny od renderera model konstrukcji.
- Rekordy bloków są kanoniczne i zamrożone.
- Usunięto `STATE.voxels`.
- Dodano lookup pozycji, sąsiedztwo, snapshoty i licznik rewizji.
- Dodano atomowe `addMany`, `remove` i `replace`.
- Nieudane operacje nie pozostawiają częściowych zmian.
- Usunięcie bloku rozcinającego statek jest odrzucane przed zmianą modelu.
- Import i eksport modelu używają istniejącego formatu blueprintu.

### Widok warsztatu

- Meshe są przechowywane osobno w `workshop.meshesByKey`.
- Rendering obserwuje zdarzenia `CraftModel` zamiast być częścią danych domenowych.
- Dodano kontrolę zgodności modelu i widoku.
- Dodano pełną odbudowę widoku z modelu po błędzie aktualizacji przyrostowej.
- Lot ukrywa i przywraca meshe przez mapę widoku, nie przez rekordy bloków.

### Historia

- Dodano `foundation.craft-history`.
- Stosy undo/redo nie są już publicznymi tablicami w globalnym stanie.
- Zachowano limity liczby snapshotów i sumy przechowywanych części.
- Dodano deduplikację, izolację klonów i rollback nieudanego undo/redo.

### Testy

- Dodano 600 deterministycznych losowych operacji modelu.
- Dodano testy atomowości wieloblokowych zmian.
- Dodano test ochrony przed rozcięciem konstrukcji.
- Dodano test maksymalnej konstrukcji 2500 bloków.
- Dodano testy `CraftHistory`, rollbacku i limitów pamięci.
- Dodano statyczny zakaz powrotu `STATE.voxels`.
- Dodano statyczny zakaz zależności CraftModel/CraftHistory od DOM, Three.js, Cannon.js i meshy.
- Potwierdzono identyczność dwóch kolejnych buildów bajt po bajcie.

### Zachowane zachowanie

- Nie zmieniono aerodynamiki, balansu, misji ani fizyki lotu.
- Nie podniesiono limitu 480 części lotnych.
- Zachowano zapis v7 i migracje v3–v7.

## Foundation Phase 1 — Boundary Extraction

### Architektura

- Dodano mały kernel modułów z jawnymi zależnościami, wykrywaniem cykli, duplikatów i brakujących modułów.
- Wyodrębniono konfigurację silnika i polityki pamięci z `game.js`.
- Wyodrębniono katalog bloków i kontraktów wraz z walidacją identyfikatorów i wymagań.
- Wyodrębniono generator 24 orientacji oraz migracje orientacji starszych blueprintów.
- Wyodrębniono czysty dokument blueprintu.
- Wyodrębniono fabrykę stanu aplikacji.
- Dodano jawny bootstrap `window.VAW_RUNTIME`.

### Blueprinty

- Utworzono jedno miejsce odpowiedzialne za tworzenie, sortowanie, klonowanie, sygnaturę, normalizację i migrację dokumentu.
- Walidator odrzuca przyszłe wersje, duplikaty pozycji, współrzędne ułamkowe, nieznane części i odłączone konstrukcje.
- Zachowano migracje v3–v7.

### Narzędzia

- Build jednoplikowy osadza wszystkie moduły w kontrolowanej kolejności.
- Dodano centralny runner testów, lokalny serwer, polecenia npm, `jsconfig.json` i `.gitignore`.
