# Voxel Aeronautics Workshop — Foundation Phase 1B

Ten milestone pogłębia fundamenty bez zmiany docelowego charakteru gry: budowanie statków powietrznych blok po bloku, programowanie sterowania, testowanie i swobodne latanie.

## Najważniejsza zmiana

Konstrukcja nie jest już przechowywana jako mapa obiektów łączących dane bloku z meshem Three.js.

Autorytatywnym źródłem konstrukcji jest teraz czysty `CraftModel`:

- przechowuje wyłącznie dane bloków i indeksy pozycji;
- nie zna DOM, Three.js, Cannon.js ani sceny;
- pilnuje Core, granic siatki, duplikatów i spójności;
- wykonuje wieloblokowe operacje atomowo;
- publikuje zdarzenia zmian;
- tworzy niezmienne snapshoty;
- zapisuje konstrukcję przez ten sam format blueprintu.

Meshe warsztatu znajdują się w osobnej warstwie widoku. Gdy aktualizacja przyrostowa widoku zawiedzie, widok jest odbudowywany z modelu zamiast pozostawać w częściowo uszkodzonym stanie.

Historia undo/redo została również przeniesiona do czystego `CraftHistory` z limitami liczby snapshotów i pamięci części.

## Aktualne moduły fundamentu

- `foundation.kernel` — rejestr i rozwiązywanie jawnych zależności;
- `foundation.config` — limity, wersje zapisów i parametry silnika;
- `foundation.catalog` — katalog bloków oraz kontraktów;
- `foundation.orientation` — 24 orientacje przestrzenne;
- `foundation.blueprint` — dokument, walidacja i migracje v3–v7;
- `foundation.craft-model` — autorytatywny model konstrukcji;
- `foundation.craft-history` — ograniczona historia undo/redo;
- `foundation.state` — fabryka niezależnych instancji stanu;
- `foundation.bootstrap` — kontrolowany start runtime.

Istniejąca gra rzeczywiście korzysta z tych modułów.

## Uruchomienie

### Windows

```text
run_game.bat
```

### Linux / macOS

```bash
./run_game.sh
```

lub:

```bash
python tools/serve.py
```

Lokalny serwer jest zalecany.

## Zależności przeglądarkowe

Gra nadal pobiera przypięte wersje:

- Three.js r128;
- Cannon.js 0.6.2;
- Tailwind CSS CDN.

Połączenie z internetem jest nadal wymagane. Lokalizacja zależności i wybór utrzymywanego backendu fizyki pozostają osobnym, późniejszym etapem.

## Testy

```text
run_tests.bat
```

albo:

```bash
python tests/run_all.py
```

Testy obejmują między innymi:

- składnię wszystkich dziesięciu źródeł aplikacji;
- zależności i niezmienność fundamentu;
- izolację instancji stanu, modelu i historii;
- walidację oraz migracje blueprintów;
- atomowe dodawanie wielu bloków;
- ochronę przed rozcięciem konstrukcji;
- 600 deterministycznych losowych operacji modelu;
- pełną konstrukcję 2500 bloków;
- zachowanie misji, fizyki, obrażeń i UI;
- startup całego runtime na stubach przeglądarki;
- jednoplikowy build, ZIP i SHA-256;
- identyczność dwóch kolejnych buildów.

Szczegóły: `TEST_REPORT.md` i `VALIDATION_REPORT.md`.

## Build wydania

```bash
python tools/build_release.py
```

W `dist/` powstaną:

- `Voxel_Aeronautics_Workshop_Foundation_Phase_1B.html`;
- `Voxel_Aeronautics_Workshop_Foundation_Phase_1B.zip`;
- `SHA256.txt`.

## Struktura

```text
Voxel_Aeronautics_Workshop_Foundation_Phase_1B/
├── index.html
├── styles.css
├── package.json
├── AI_PROJECT_MEMORY.md
├── ARCHITECTURE.md
├── FOUNDATION_REVIEW.md
├── VALIDATION_REPORT.md
├── docs/adr/
├── src/
│   ├── foundation/
│   │   ├── kernel.js
│   │   ├── config.js
│   │   ├── catalog.js
│   │   ├── orientation.js
│   │   ├── blueprint.js
│   │   ├── craft_model.js
│   │   ├── craft_history.js
│   │   ├── state.js
│   │   └── bootstrap.js
│   └── game.js
├── tests/
├── tools/
├── run_game.bat
├── run_game.sh
├── run_tests.bat
└── run_tests.sh
```

## Zachowany gameplay

Wersja nadal zawiera:

- budowanie do 2500 bloków;
- ochronny limit 480 aktywnych części lotnych;
- skrzydła, stery, balony, silniki i gimbale;
- lokalne obrażenia, wycieki i odrywanie gałęzi;
- kontrakty, payload i raport lotu;
- import, eksport oraz undo/redo.

Ten etap celowo nie zmieniał modelu lotu ani balansu. Następną właściwą granicą jest `CraftCompiler`.
