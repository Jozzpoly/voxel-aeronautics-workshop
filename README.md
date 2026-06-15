# Voxel Aeronautics Workshop — Foundation Phase 1D.2F

**Runtime Assembly Foundation**

Voxel Aeronautics Workshop to desktopowy voxelowy sandbox inżynieryjny. Główna fantazja projektu brzmi:

> **buduję, programuję, testuję i latam własną fizyczną maszyną.**

Kontrakty i progresja są dodatkiem. Pełnoprawnym trybem jest także czysty sandbox: budowa, ręczne sterowanie, eksperymenty, awarie i kolejne przebudowy.

## Co wnosi Phase 1D.2F

### Trwała tożsamość każdego bloku

Blueprint v10 zapisuje `blockId` niezależne od `gridKey`.

- `blockId` identyfikuje urządzenie przez cały cykl życia projektu;
- `gridKey` opisuje wyłącznie aktualną pozycję w lokalnej siatce;
- przeniesienie bloku przez `CraftModel.move()` zachowuje jego tożsamość;
- kompilator publikuje `blockIdToIndex`;
- runtime publikuje `runtimePartById`.

To jest fundament pod indywidualne sterowanie thrusterami, grupy urządzeń, przewody sygnałowe, sensory i jointy.

### Runtime Assembly Plan

Nowy czysty moduł `foundation.runtime-assembly` zamienia skompilowany lub załadowany snapshot w neutralny plan:

```text
RuntimeAssemblyPlan
  rigidBodies[]
  constraints[]
  signalLinks[]
  parts[]
  blockIdToBodyId
  blockIdToPartIndex
```

Obecnie plan zawiera jeden `body:root`, lecz API nie zakłada, że tak pozostanie. Następne etapy mogą podzielić konstrukcję na sztywne podzespoły połączone łożyskami, silnikami obrotowymi i serwami.

### Zgodność bezwładności analizy i solvera

Physics Port otrzymał atomową operację `setBodyMassProperties()`.

- masa i diagonalna bezwładność z kompilatora trafiają do Cannon.js;
- payload korzysta z bezwładności załadowanego snapshotu;
- po odpadnięciu części COM i bezwładność są liczone ponownie;
- panel inżynieryjny i solver nie bazują już świadomie na dwóch różnych modelach bezwładności.

### Korekty spójności

- `CompiledCraft.weight` używa skonfigurowanej grawitacji;
- limit wysokości znajduje się w `TEST_RANGE.maxAltitude`;
- Balloon guidance mówi wprost, że próg dotyczy wysokości startowej;
- Telemetry pokazuje łączny stosunek aktualnego wsparcia pionowego do ciężaru.

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

Obecny mikser pozostanie domyślnym, łatwym sposobem sterowania. Docelowo każdy aktywny blok będzie mógł przejść w tryb bezpośredniego sygnału lub przypisanej grupy.

## Uruchomienie

Windows:

```text
run_game.bat
```

Linux/macOS:

```bash
./run_game.sh
```

albo:

```bash
python tools/serve.py
```

Po podmianie wersji użyj `Ctrl+Shift+R`.

## Testy i build

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Bateria obejmuje blueprint v10, migracje, trwałe identyfikatory bloków, assembly plan, jawne mass properties, CraftModel, CraftCompiler, misje, aerostatykę, input, physics boundary, startup smoke, deterministyczny build oraz source parity.

## Następny zdecydowany kierunek

1. dokończyć `Runtime Assembly Builder` i headless harness;
2. wykonać capability spike dwóch body połączonych free hinge i rotary motor;
3. zbudować `Per-Block Control Bus`;
4. dodać sensory, podstawowe węzły logiki, scope i PID;
5. wystawić pierwsze jointy jako pełnoprawne bloki gracza.

Szczegóły znajdują się w `ROADMAP_NEXT.md` i `ARCHITECTURE.md`.
