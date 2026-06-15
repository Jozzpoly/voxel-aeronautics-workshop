# Test Report — Phase 1D.2D

## Wynik

`python tests/run_all.py` — PASS.

## Zakres nowej regresji

- input profile v2;
- migracja starszego profilu bez bindingów;
- domyślny `ControlLeft -> lift-`;
- brak defaultowego `Shift -> lift-`;
- dwa sloty bindingów;
- przenoszenie zajętego klawisza między akcjami;
- ostrzeżenie dla Ctrl/Flight Focus;
- generowanie listy kodów Keyboard Lock;
- runtime capture i reset profilu w startup smoke;
- UI preferences v5 oraz legacy keys v1–v4;
- obecność Flight Focus i rebind UI.

## Pełna bateria

Zachowane testy blueprintu, CraftModel, CraftCompiler, historii, misji, state-based landing, aerostatyki, uszkodzeń, physics boundary, desktop workspace, deterministic build i source parity.

## Ograniczenie

Automaty nie potwierdzają zachowania promptu Keyboard Lock ani przejęcia `Ctrl+W` w realnym Chrome/Brave. To wymaga manualnej checklisty.
