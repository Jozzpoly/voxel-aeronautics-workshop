# Validation Report — Phase 1D.3B.1

## Automatyczna walidacja

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane:

- `All core tests passed.`;
- startup smoke: `modules: 29`, `sources: 32`, `interaction: ok`, `lifecycle: ok`;
- real-Cannon harness bez wyjątku;
- `sourceParity: ok`;
- deterministyczny single HTML i ZIP;
- test architektury z `game_js_lines <= 2500` i `game_js_bytes <= 120000`.

## Kontrola game shell

Sprawdź, że:

1. `src/game.js` jest ostatni w `APP_SOURCES` i loaderze `index.html`;
2. wszystkie `src/game/*.js` są przed `foundation/bootstrap.js`;
3. moduły nie zawierają `window.VAW_RUNTIME`;
4. `game.js` jawnie wymaga wszystkich modułów `game.*`;
5. `buildFlightBody()` używa `AssemblyBuilder.build(...)`;
6. `pagehide` wywołuje `flushPendingAutosave()` oraz `flushPendingSave()`;
7. `fullscreenchange` jest delegowany do `handleFullscreenChange()`;
8. nie istnieją ręczne, rozbieżne listy źródeł w testach.

## Manualny browser playtest

Uruchom:

```bash
python tools/serve.py
```

Następnie sprawdź:

### Workshop

- start od pustego warsztatu;
- wybór wszystkich narzędzi;
- placement, symmetry, orientation i roll;
- undo/redo;
- save/load/import/export;
- przeciąganie, zamykanie, minimalizowanie i reset paneli;
- reload zachowuje workspace i input profile.

### Input lifecycle

- rebind klawisza i reset profilu;
- Flight Focus enter/exit;
- wyjście z fullscreen nie pozostawia aktywnego sterowania;
- utrata focusu i zmiana karty zerują akcje;
- zamknięcie/odświeżenie strony nie zgłasza `ReferenceError` z timerów.

### Flight

- starter craft wchodzi do lotu;
- wszystkie osie, passive thrust i Balloon power działają;
- powrót do warsztatu i ponowny lot nie pozostawiają body/listenerów;
- damage, debris, detach i payload działają jak w 1D.3B;
- misje, markery, HUD i debrief działają bez regresji.

### Engineering analysis

- COM, thrust/lift markers i warnings aktualizują się po zmianie konstrukcji;
- launch readiness odpowiada kompilatorowi;
- analiza loaded payload pozostaje zgodna z runtime.

## Hermetyczny real-Cannon harness

```bash
node --expose-gc tests/test_real_cannon_harness.js
```

Cannon.js 0.6.2 dla testów znajduje się w `tests/vendor/cannon-0.6.2/` wraz z licencją.

## Manualny physics browser harness

```text
http://127.0.0.1:8765/tests/browser_runtime_harness.html
```

Strona powinna ustawić `data-status="pass"`.

## Kryterium merge

Merge dopiero po:

1. zielonej baterii automatycznej;
2. `verify_release.py` z source parity;
3. manualnym smoke warsztatu, lotu, workspace i Flight Focus;
4. braku błędów lifecycle w konsoli;
5. potwierdzeniu, że główny craft body nadal tworzy Assembly Builder;
6. sprawdzeniu `git diff --stat` i braku plików tymczasowych.
