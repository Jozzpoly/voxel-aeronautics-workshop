# Voxel Aeronautics Workshop — Foundation Phase 1D.3B.1

**Modular Game Shell & Explicit Composition Boundaries**

Voxel Aeronautics Workshop to desktopowy voxelowy sandbox inżynieryjny:

> **buduję, programuję, testuję i latam własną fizyczną maszyną.**

## Co wnosi Phase 1D.3B.1

### Poważna restrukturyzacja `game.js`

`src/game.js` został zmniejszony z 4697 do 2358 linii. Pozostaje composition rootem, natomiast niezależne odpowiedzialności trafiły do `src/game/`:

- `scene_environment.js` — scena, renderer, świat i statyczne środowisko;
- `career_service.js` — kariera i persistence;
- `workspace_controller.js` — panele, z-order i preferencje UI;
- `input_settings_controller.js` — rebindy i Flight Focus;
- `orientation_service.js` — helpery orientacji;
- `module_visual_factory.js` — wizualne modele bloków;
- `engineering_analysis.js` — analiza konstrukcji i telemetry UI;
- `blueprint_controller.js` — save/load/import/export/history;
- `mission_controller.js` — kontrakty, markery, HUD i debrief.

Moduły deklarują zależności przez kernel albo otrzymują je jawnie w `create(...)`. Nie importują composition root i nie czytają `window.VAW_RUNTIME`.

### Zachowane granice runtime

- główne body i collidery nadal tworzy wyłącznie `runtime.assembly-builder`;
- fizyka nadal przechodzi przez Physics Port;
- `CraftModel` pozostaje źródłem prawdy warsztatu;
- format blueprintu i zachowanie gameplayu nie zostały zmienione;
- flight/damage/integrity pozostają razem do czasu joint spike, aby nie utrwalić błędnego API single-body.

### Lepsze testy i delivery

- jeden `APP_SOURCES` określa kolejność loadera, manifestu, single HTML, ZIP-a i testów;
- test architektury pilnuje właścicieli funkcji, kolejności źródeł, rozmiaru `game.js` i granicy Assembly Buildera;
- test usług sprawdza karierę i migrację workspace;
- startup smoke obejmuje interakcję oraz `fullscreenchange` i `pagehide`;
- build pozostaje deterministyczny i przechodzi `sourceParity: ok`.

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

## Testy i build

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

## Następny kierunek

1. Phase 1D.3C: joint capability spike — dwa body, free hinge, motor i servo;
2. neutralne Physics Port constraints na podstawie wyników spike;
3. wydzielenie `flight-session` i `flight-integrity` pod model multi-body;
4. Phase 1E: Per-Block Control Bus;
5. sensory, logika, live scope i PID.

Przeczytaj kolejno `AI_PROJECT_MEMORY.md`, `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `PHASE_1D3B1_REPORT.md`, `VALIDATION_REPORT.md`, `TEST_REPORT.md` i `DELIVERY_WORKFLOW.md`.
