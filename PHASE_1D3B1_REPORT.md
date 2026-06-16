# Foundation Phase 1D.3B.1 — Modular Game Shell & Explicit Composition Boundaries

## Cel

Zmniejszyć koszt i ryzyko dalszej pracy nad projektem bez przepisywania gameplayu, fizyki ani formatu zapisów. Etap miał rozbić `game.js` według prawdziwych odpowiedzialności, zachować wszystkie granice 1D.3B i przygotować kod pod joint spike oraz Per-Block Control Bus.

## Punkt wyjścia

- źródło prawdy: pełny ZIP Phase 1D.3B;
- bazowe `python tests/run_all.py`: PASS;
- `src/game.js`: 4697 linii, 219587 bajtów;
- fizyczne assembly było już delegowane do `runtime.assembly-builder`;
- dokumentacja zalecała joint spike przed szerokim refaktorem, ale właściciel projektu świadomie zmienił kolejność i zlecił etap przygotowawczy.

## Wykonane zmiany

### Moduły aplikacyjne

Dodano dziewięć modułów w `src/game/`:

1. `scene_environment.js`;
2. `career_service.js`;
3. `workspace_controller.js`;
4. `input_settings_controller.js`;
5. `orientation_service.js`;
6. `module_visual_factory.js`;
7. `engineering_analysis.js`;
8. `blueprint_controller.js`;
9. `mission_controller.js`.

`src/game.js` jest finalnym composition rootem. Tworzy wspólny stan, instancjuje moduły i spina callbacki, event routing, warsztat, flight/integrity oraz główną pętlę.

### Source inventory

`APP_SOURCES` w `tools/build_release.py` zawiera wszystkie źródła w deterministycznej kolejności. `tests/source_inventory.py` importuje tę listę, dzięki czemu static checks i testy nie utrzymują równoległego manifestu.

### Testy architektury

Dodano:

- `tests/test_game_architecture.py`;
- `tests/test_game_services.js`;
- lifecycle smoke dla `fullscreenchange` i `pagehide`.

Testy sprawdzają moduły, ownership funkcji, kolejność loadera, brak `window.VAW_RUNTIME`, limit rozmiaru `game.js`, granicę Assembly Buildera, persistence kariery/workspace i brak wycieków prywatnego stanu.

## Krytyczne znalezisko podczas drugiego review

Po pierwszej ekstrakcji composition root nadal odwoływał się do:

- `autosaveTimer` z blueprint controller;
- `workspaceSaveTimer` z workspace controller;
- `keyboardLockActive` z input settings controller.

Zmienne były już prywatne, więc `pagehide` i `fullscreenchange` mogły rzucać `ReferenceError`. Startup smoke nie wykonywał wcześniej tych zdarzeń.

Naprawa:

- `flushPendingAutosave()`;
- `flushPendingSave()`;
- `handleFullscreenChange()`;
- rozszerzony smoke lifecycle;
- statyczny zakaz tych nazw w composition root.

## Wynik

- `src/game.js`: 2358 linii, 108210 bajtów;
- redukcja linii: około 49.8%;
- redukcja bajtów: około 50.7%;
- 29 zainicjalizowanych modułów;
- 32 uporządkowane źródła aplikacji;
- wszystkie testy rdzenia: PASS;
- source parity i deterministyczny build: PASS;
- `game.js` nadal nie tworzy głównego physical assembly;
- format blueprintu i gameplay pozostają zgodne z 1D.3B.

## Świadome ograniczenie zakresu

Nie wydzielono jeszcze `flight-session` ani `flight-integrity`. Ich API zaprojektowane teraz prawdopodobnie kodowałoby założenie jednego `STATE.flight.body`. Phase 1D.3C ma najpierw ustalić model dwóch body, constraints i lifecycle. Dopiero potem flight/damage powinny zostać wydzielone wokół `RuntimeAssembly`.

## Następny etap

Phase 1D.3C — Joint Capability Spike.
