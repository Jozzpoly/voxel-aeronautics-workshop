# Test Report — Phase 1D.2E

## Wynik

`python tests/run_all.py` — PASS.

## Nowe regresje

- input profile v3;
- nowe akcje `thrusterPower-` i `thrusterPower+`;
- domyślne `Minus/Equal` i obecność kodów w Keyboard Lock;
- migracja profilu v2 do v3 bez odbierania zajętych klawiszy;
- `requiredSupplementalPowerForHover()` dla braku zapotrzebowania, częściowego progu, braku dodatkowego liftu i wartości granicznych;
- natychmiastowa synchronizacja Passive vertical thrust przez setter;
- marker i guidance pasywnego ciągu;
- hotkeye `−/+` oraz `,/.` przechodzące przez profil;
- jednoczesne zejście przez Left Ctrl i regulacja obu źródeł mocy;
- brak starej hardkodowanej obsługi znaków `-` i `+` w `game.js`.

## Pełna bateria

Przechodzą także testy składni, statycznego audytu, blueprintu, CraftModel, CraftCompiler, historii, misji, state-based landing, Balloon power, aerostatyki, uszkodzeń, physics boundary, desktop workspace, startup smoke, deterministycznego buildu i source parity.

Ostatni zarejestrowany startup smoke:

```text
STARTUP_OK { ids: 159, elements: 543, modules: 16, sources: 19, interaction: 'ok' }
```

## Ograniczenie

Automaty nie oceniają czytelności markera podczas rzeczywistego lotu ani odczucia regulacji w WebGL. Keyboard Lock i fullscreen również wymagają manualnej walidacji w docelowym Chrome/Brave.
