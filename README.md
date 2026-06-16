# Voxel Aeronautics Workshop — Foundation Phase 1D.3B

**Real-Cannon Parity & Runtime Contract Hardening**

Voxel Aeronautics Workshop to desktopowy voxelowy sandbox inżynieryjny. Główna fantazja projektu:

> **buduję, programuję, testuję i latam własną fizyczną maszyną.**

Sandbox i ręczne latanie są pełnoprawnym rdzeniem. Kontrakty pomagają testować projekty, ale nie definiują całej gry.

## Co wnosi Phase 1D.3B

### Automatyczna walidacja na prawdziwym Cannon.js

Główna bateria uruchamia lokalnie Cannon.js 0.6.2 i sprawdza:

- free fall i jawne mass properties;
- torque oraz rotated asymmetric inertia;
- offset thrust;
- payload detach i recenter podczas obrotu;
- prawdziwe zdarzenia kontaktowe;
- 12 000 kroków soak;
- build/step benchmark do 2500 colliderów;
- 50 cykli lifecycle i brak pozostawionych body.

Testowa kopia Cannon znajduje się w `tests/vendor/` i nie zmienia produkcyjnego loadera aplikacji.

### Twardszy Runtime Assembly Builder

Builder teraz:

- weryfikuje cały plan przed pierwszą alokacją;
- odrzuca duplikaty i błędne cross-reference;
- chroni zastrzeżone metadane assembly;
- mutuje mapy dopiero po sukcesie backendu;
- zachowuje pierwotny błąd podczas rollbacku;
- raportuje błędy cleanup osobno;
- utrzymuje stabilne mapy `bodyId`, `colliderId` i `blockId`.

`game.js` nadal zleca fizyczne assembly builderowi i nie został w tej fazie przebudowany.

### Wiarygodniejsze mass properties i backend parity

- wadliwe masy, wektory i half-extents nie są już cicho naprawiane;
- runtime planner wymaga jawnych trwałych ID i skończonych danych;
- STATIC/DYNAMIC synchronizuje się po zmianie masy;
- headless stosuje diagonalną bezwładność w lokalnej ramie body;
- naprawiono zwrot point velocity w real Cannon.

### Twardy limit pracy kompilatora

Po przekroczeniu limitu CraftCompiler zgłasza `block-limit`, ale nie przetwarza rekordu ponad `GRID.maxBlocks`.

## Czego ten etap jeszcze nie kończy

- Nie ma graczowych jointów ani podziału blueprintu na rigid islands.
- Physics Port nie posiada jeszcze finalnego API constraints.
- Benchmark pustego świata nie obejmuje kosztu tysięcy aktywnych kontaktów.
- `game.js` nadal zarządza wizualizacją, uszkodzeniami i gameplayowym part state.
- Payload nadal korzysta z tymczasowego mocowania misyjnego.
- Produkcyjny runtime nadal ładuje zależności zgodnie z `index.html`.

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

Sam real-Cannon harness:

```bash
node --expose-gc tests/test_real_cannon_harness.js
```

Browser harness znajduje się w `tests/browser_runtime_harness.html` i powinien być otwierany przez lokalny serwer.

## Następny zdecydowany kierunek

1. Phase 1D.3C: joint capability spike — dwa body, free hinge, motor i servo;
2. na podstawie spike: neutralne Physics Port constraints;
3. Phase 1E: pierwszy grywalny Per-Block Control Bus;
4. sensory, podstawowa logika, live scope i PID;
5. pełnoprawne Free Bearing, Rotary Motor i Servo Bearing.

Szczegóły znajdują się w `ROADMAP_NEXT.md`, `ARCHITECTURE.md`, `PHASE_1D3B_REPORT.md` i `CODE_REVIEW_REPORT.md`.
