# Voxel Aeronautics Workshop — Foundation Phase 1D.3A

**Runtime Assembly Builder & Deterministic Headless Harness Core**

Voxel Aeronautics Workshop to desktopowy voxelowy sandbox inżynieryjny. Główna fantazja projektu:

> **buduję, programuję, testuję i latam własną fizyczną maszyną.**

Sandbox i ręczne latanie są pełnoprawnym rdzeniem. Kontrakty pomagają testować projekty, ale nie definiują całej gry.

## Co wnosi Phase 1D.3A

### Produkcyjny Runtime Assembly Builder

`game.js` nie składa już sam fizycznej konstrukcji blok po bloku. Nowy `runtime.assembly-builder` przejmuje:

- tworzenie wszystkich body z `RuntimeAssemblyPlan`;
- tworzenie colliderów;
- atomowe stosowanie mass properties;
- stabilne mapy `bodyId`, `colliderId` i `blockId`;
- rejestrację backend-neutralnych callbacków kolizji;
- transakcyjny rollback po błędzie;
- lifecycle i bezpieczne `dispose()`;
- usuwanie colliderów po utracie bloku;
- recenter body z zachowaniem prędkości nowego środka masy;
- rozszerzalny punkt tworzenia przyszłych constraintów.

Obecna gra nadal uruchamia jeden rigid body, ale sam builder i jego testy obsługują wiele body. Założenie „statek = jedno body” nie jest już zakodowane w tej warstwie.

### Jedno źródło prawdy dla masy, COM i bezwładności

`foundation.mass-properties` liczy właściwości masowe dla kompilatora, payloadu i uszkodzonego runtime. Dzięki temu:

- analiza i solver używają tej samej diagonalnej bezwładności;
- payload zmienia masę, COM i inertia tym samym algorytmem;
- detach przelicza właściwości pozostałej konstrukcji;
- recenter przesuwa collidery i lokalną ramę bez sztucznego skoku prędkości.

### Deterministyczny backend headless

`runtime.headless-physics-backend` działa bez DOM, Three.js i WebGL. Nie zastępuje docelowego solvera kolizji. Służy do szybkiego testowania kontraktów dynamiki:

- free fall;
- jawna inertia parity;
- równowaga siły i ciężaru;
- odpowiedź na moment;
- offset thrust;
- zachowanie przy długim soak;
- multi-body lifecycle buildera.

### Twarde zabezpieczenia architektury

Automaty sprawdzają między innymi, że:

- `buildFlightBody()` korzysta z `AssemblyBuilder.build()`;
- `game.js` nie tworzy ponownie body i colliderów głównej konstrukcji;
- recenter i prędkość punktu przechodzą przez Physics Port;
- błędna budowa assembly usuwa częściowo utworzone body;
- 12 000 kroków soak nie produkuje NaN ani rozjechanego kwaternionu.

## Czego ten etap jeszcze nie kończy

- Nie ma jeszcze graczowych jointów ani podziału blueprintu na rigid islands.
- Headless backend nie rozwiązuje kontaktów i nie służy do wyboru backendu produkcyjnego.
- Prawdziwy benchmark Cannon wymaga uruchomienia w środowisku z dostępnymi bibliotekami przeglądarkowymi.
- `game.js` nadal zarządza wizualizacją, uszkodzeniami i gameplayowymi rekordami części.
- Payload nadal korzysta z tymczasowego mocowania misyjnego, nie bloku `PayloadMount`.

## Obecne sterowanie

- `W / S` — przód / tył;
- `Z / C` — translacja w lewo / prawo;
- `Space / Left Ctrl` — góra / dół;
- `↑ / ↓` — pitch;
- `A / D` lub `← / →` — yaw;
- `Q / E` — roll;
- `− / +` — Passive vertical thrust;
- `, / .` — Balloon power;
- `G` — stabilizacja;
- `F` — powrót do warsztatu.

Obecny mikser pozostanie domyślnym sposobem sterowania. Docelowy Per-Block Control Bus pozwoli przejąć kontrolę nad konkretnym urządzeniem bez odbierania początkującemu natychmiast grywalnego statku.

## Uruchomienie

Windows:

```text
run_game.bat
```

Linux/macOS:

```bash
./run_game.sh
```

lub:

```bash
python tools/serve.py
```

Po podmianie wydania użyj `Ctrl+Shift+R`.

## Testy i build

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Manualny harness prawdziwego adaptera Cannon znajduje się w `tests/browser_runtime_harness.html`. Uruchamiaj go przez lokalny serwer, nie przez `file://`.

## Następny zdecydowany kierunek

1. Phase 1D.3B: real-Cannon scenarios i pomiary kroku solvera;
2. Phase 1D.3C: joint capability spike — dwa body, free hinge i powered hinge;
3. Phase 1E: pierwszy grywalny Per-Block Control Bus;
4. sensory, podstawowa logika, live scope i PID;
5. pełnoprawne bloki Free Bearing, Rotary Motor i Servo Bearing.

Szczegóły znajdują się w `ROADMAP_NEXT.md`, `ARCHITECTURE.md` i `PHASE_1D3A_REPORT.md`.
