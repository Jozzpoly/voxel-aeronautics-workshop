# Voxel Aeronautics Workshop — Foundation Phase 1C.2 Control & Workspace

Foundation Phase 1C.2 synchronizuje pełne źródła projektu, wprowadza orientowany układ sterowania statku oraz zastępuje rosnący zestaw wyjątków UI wspólnym systemem okien. Command Core może znajdować się w dowolnym miejscu, a jego orientacja definiuje przód, górę i prawą stronę maszyny.

Główna wizja pozostaje bez zmian: **budowanie statków powietrznych blok po bloku, programowanie ich zachowania, testowanie i swobodne latanie**.

## Najważniejsze zmiany

### Pusty, swobodny warsztat

Nowy projekt zaczyna się od pustej siatki. Pierwszym elementem może być dowolny moduł, na przykład skierowany ku górze thruster będący najniższym blokiem jednoblokowej rakiety.

- Core nie jest już przyspawany do `0,0,0`.
- Core można usunąć i postawić ponownie.
- Konstrukcję bez Core, pustą lub chwilowo rozłączoną można edytować i zapisać.
- Start wymaga dokładnie jednego Core i jednej połączonej wyspy konstrukcji.
- Stare blueprinty v3–v8 zachowują kompatybilność i są migrowane do v9; starsze Core otrzymują dawną orientację +X/+Y.

### `CraftCompiler`

Dodano czysty moduł `foundation.craft-compiler`, który kompiluje `CraftModel` do niezmiennego `CompiledCraft`.

Artefakt zawiera między innymi:

- deterministyczną sygnaturę i rewizję źródła;
- kanoniczną listę części oraz `key -> index`;
- graf sąsiedztwa i diagnostykę spójności;
- pozycję rzeczywistego Core;
- masę, ciężar, środek masy i przybliżenie bezwładności;
- lokalne pozycje, orientacje, siły i momenty części;
- urządzenia pogrupowane według typu;
- referencyjny plan colliderów `jeden voxel = jeden box`;
- błędy gotowości do lotu i ostrzeżenia.

Kompilator nie zależy od DOM, Three.js ani Cannon.js. Wynik tej samej rewizji jest cache’owany i głęboko zamrożony.

### Sterowanie sześcioma osiami i orientowany Control Frame

Aktualne mapowanie:

- `W / S` — przód / tył;
- `Z / C` — translacja w lewo / prawo;
- `Space / Left Ctrl` — góra / dół;
- `↑ / ↓` — pitch;
- `A / D` lub `← / →` — yaw w lewo / prawo;
- `Q / E` — roll;
- `- / +` — pasywny ciąg pionowy silników skierowanych ku lokalnemu `+Y`;
- `G` — stabilizacja.

Command Core definiuje osie statku niezależnie od tego, jak konstrukcja jest obrócona na siatce. Każdą oś można odwrócić i ustawić jej czułość w oknie Controls. Domyślny profil naprawia historycznie odwrócony pitch. A/D ma poprawiony kierunek. Silniki poziome i skierowane w dół pozostają bezczynne bez komendy. Suwak ustala wyłącznie pasywny ciąg silników skierowanych ku górze i **nie ogranicza wejść gracza**. W/S, Space/Ctrl oraz sterowanie obrotowe zachowują pełną moc sterowania nawet przy pasywnym ciągu 0%. Left Ctrl włącza silniki skierowane w dół i jednocześnie wygasza pasywny ciąg skierowany w górę. Sterowanie lotem ma pierwszeństwo nad skrótami edytora, dlatego `Left Ctrl + S` działa jako dół + tył.

## Moduły fundamentu

- `foundation.kernel` — rejestr i rozwiązywanie zależności;
- `foundation.config` — limity, wersje zapisów i polityki;
- `foundation.catalog` — katalog bloków i kontraktów;
- `foundation.orientation` — 24 orientacje przestrzenne;
- `foundation.blueprint` — format, normalizacja i migracje v3–v9;
- `foundation.craft-model` — autorytatywny model edytowanej konstrukcji;
- `foundation.craft-history` — ograniczona historia undo/redo;
- `foundation.control-frame` — układ forward/up/right wynikający z Core;
- `foundation.craft-compiler` — model → niezmienny artefakt lotny;
- `foundation.input-profile` — odwracanie, czułość i sześć osi;
- `foundation.ui-workspace` — trwały stan okien;
- `foundation.flight-control` — semantyczne wejścia pilota i miks translacji;
- `foundation.state` — fabryka niezależnych instancji stanu;
- `foundation.bootstrap` — kontrolowany start runtime.

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

Gra nadal korzysta z przypiętych CDN-ów Three.js r128, Cannon.js 0.6.2 oraz Tailwind CSS, dlatego do uruchomienia potrzebuje internetu.

## Testy

```bash
npm test
```

lub:

```bash
python tests/run_all.py
```

Testy obejmują między innymi:

- składnię 15 źródeł aplikacji;
- statyczną zgodność 213 funkcji runtime i 183 identyfikatorów HTML;
- migracje blueprintów v3–v9;
- pusty warsztat, ruchomy i usuwalny Core;
- rozłączone stany robocze i blokowanie niegotowego startu;
- atomowe transakcje i historię;
- deterministyczny `CraftCompiler` do 2500 bloków;
- poprawne kierunki A/D;
- osobne osie przód–tył, lewo–prawo i góra–dół;
- orientowany Control Frame i profil sześciu osi;
- trwałe otwieranie, minimalizację, przeciąganie i resize okien;
- kombinację `Left Ctrl + S`;
- ścieżkę UI: pusty start → starter → lot → wejścia pilota → powrót → pusty projekt;
- zachowane regresje misji, obrażeń i fizyki;
- bajtową zgodność źródeł w ZIP-ie z kodem osadzonym w jednoplikowym HTML;
- manifest źródeł i SHA-256.

Szczegóły znajdują się w `TEST_REPORT.md` oraz `VALIDATION_REPORT.md`.

## Build wydania

```bash
npm run build
```

W `dist/` powstaną:

- `Voxel_Aeronautics_Workshop_Foundation_Phase_1C2_Control_Workspace.html`;
- `Voxel_Aeronautics_Workshop_Foundation_Phase_1C2_Control_Workspace.zip`;
- `SHA256.txt`.

ZIP zawiera pełne źródła oraz kopię dokładnie tego samego jednoplikowego HTML w katalogu `release/`. Plik `SOURCE_MANIFEST.json` zapisuje hashe wszystkich wejść buildu.

Po rozpakowaniu można niezależnie sprawdzić zgodność:

```bash
npm run verify-release
```

Wynik `sourceParity: ok` oznacza, że osadzone moduły HTML są dokładnie tymi samymi plikami, które znajdują się w paczce źródłowej.

## Najbliższy etap

**Foundation Phase 1D — Physics Boundary**:

- minimalny interfejs świata fizycznego, ciała, collidera i sił;
- adapter referencyjny dla obecnego Cannon.js;
- przeniesienie tworzenia compound body poza `game.js`;
- bezrendererowy harness fizyki i benchmark bazowy;
- dopiero potem collider compiler i scalanie voxelowych boxów.

Nie podnosimy limitu 480 aktywnych części lotnych przed pomiarami i scaleniem colliderów.
