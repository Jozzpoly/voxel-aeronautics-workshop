# Test Report — Phase 1D.3B.1

## Wynik końcowy

```bash
python tests/run_all.py
```

**PASS — wszystkie testy rdzenia przeszły po restrukturyzacji.**

Startup smoke:

```text
STARTUP_OK {
  ids: 160,
  elements: 544,
  modules: 29,
  sources: 32,
  interaction: 'ok',
  lifecycle: 'ok'
}
```

## Bazowy test przed zmianami

Pełna bateria z dostarczonego ZIP-a Phase 1D.3B została uruchomiona przed modyfikacją i zakończyła się `All core tests passed.`. Log bazowy został zachowany podczas pracy.

## Nowe pokrycie 1D.3B.1

### `tests/test_game_architecture.py`

- dokładna lista dziewięciu modułów `game.*`;
- każdy moduł definiuje właściwą nazwę dokładnie raz;
- brak `window.VAW_RUNTIME` i zależności od `src/game.js` w modułach;
- wszystkie moduły są ładowane przed bootstrapem;
- `src/game.js` jest ostatnim źródłem i composition rootem;
- `game.js <= 2500` linii i `<= 120000` bajtów;
- kluczowe funkcje mają jednego właściciela;
- entrypoint jawnie komponuje wszystkie moduły;
- `buildFlightBody()` deleguje do `AssemblyBuilder` i nie tworzy głównego body/colliderów bezpośrednio;
- moduły prezentacji nie tworzą body/colliderów;
- composition root nie sięga do `autosaveTimer`, `workspaceSaveTimer` ani `keyboardLockActive`;
- lifecycle używa publicznych metod modułów.

### `tests/test_game_services.js`

- normalizacja i upper clamp danych kariery;
- fallback z zablokowanego kontraktu;
- odrzucenie nieznanych kontraktów;
- persistence kariery;
- migracja legacy contract-panel preference;
- persistence workspace i profilu input.

### Startup smoke lifecycle

Smoke uruchamia teraz nie tylko interakcję build/flight/input, ale również:

- `fullscreenchange`;
- `pagehide`;
- flush blueprint autosave;
- flush workspace preferences;
- cleanup Flight Focus bez wycieku prywatnego stanu.

### Source inventory

`tests/source_inventory.py` importuje `APP_SOURCES` z buildu. Static checks, mission checks i audit regressions agregują wszystkie moduły game shell, nie tylko `src/game.js`.

## Zachowane pokrycie 1D.3B

Nadal przechodzą:

- real Cannon.js 0.6.2: free fall, torque, rotated inertia, offset thrust, real contact, payload/recenter, 12000 kroków soak, lifecycle i benchmark;
- deterministic headless harness;
- RuntimeAssemblyPlan i Assembly Builder contracts;
- mass properties;
- CraftModel, historia i CraftCompiler;
- input profile, Flight Focus i guided vertical controls;
- misje, lądowanie, payload, damage, detach i fuel leaks;
- workspace, save migrations i blueprint parity;
- deterministyczny build, embedded source parity i ZIP parity.

## Ostatni automatyczny benchmark kontrolny

Wartości są zależne od maszyny i służą wyłącznie jako regresyjny punkt kontrolny. W ostatnim pełnym przebiegu real Cannon ukończył benchmark 100/500/1000/2500 colliderów, 12000 kroków soak i 50 cykli lifecycle bez pozostawionych body.

## Ograniczenia testów

- startup smoke używa stubów DOM/WebGL i nie zastępuje prawdziwego renderera;
- real-Cannon benchmark pustego świata nie reprezentuje tysiąca aktywnych kontaktów;
- brak jointów, więc nie ma jeszcze testów constraint drift, motor ani servo;
- manualny playtest przeglądarkowy nadal jest wymagany przed mergem szerokiej zmiany UI/flight;
- produkcyjne biblioteki aplikacji są ładowane zgodnie z `index.html`.
