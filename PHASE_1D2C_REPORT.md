# Phase 1D.2C Report — Desktop Input & Aerostatic Settling

## Zakres

Finalny hotfix przed pushem Foundation 1D.2 usuwa konflikty klawiatury z przeglądarką, formalizuje desktop-only scope i zmniejsza nadmierne pionowe bujanie balonów.

## Zmiany wejścia

- `lift-`: `ControlLeft/ControlRight` → `ShiftLeft/ShiftRight`;
- Balloon power: `PageUp/PageDown` → `Comma/Period`;
- regulacja pozostaje na wspólnej ścieżce `setBalloonPower()`;
- auto-repeat pozwala płynnie zmieniać moc o 2% na krok;
- Ctrl/Meta pozostają wyłącznie dla przeglądarki i skrótów edytora.

## Desktop scope

Usunięto:

- mobile topbar;
- ekranowe przyciski lotu i budowania;
- tap/pinch touch state;
- mobilną projekcję workspace;
- touch-only event flow w canvasie.

Zachowano:

- mysz;
- touchpad laptopa jako pointer/scroll;
- przeciąganie i resize okien;
- responsywny clamp desktopowego workspace.

## Aerostatic settling

`foundation.aerostatics.verticalDampingForce()`:

- przeciwdziała wyłącznie prędkości pionowej;
- skaluje się z masą i aktywną siłą balonów;
- ma limit `10%` ciężaru przy pełnej aktywacji;
- nie działa, gdy balony praktycznie nie generują siły;
- nie zależy od błędu wysokości, więc nie jest autopilotem.

Polityka domyślna:

- `verticalDampingRate: 0.52`;
- `maxDampingWeightRatio: 0.10`;
- `minimumDampingActivation: 0.08`.

## Ryzyka świadomie pozostawione

- tuning wymaga jeszcze ręcznego lotu na lekkim, ciężkim i asymetrycznym statku;
- aerostatyka pozostaje modelem gameplayowym, nie pełną atmosferą;
- `game.js` nadal jest duży;
- brak automatycznego pełnego testu WebGL/GPU.

## Decyzja wydaniowa

Wersja jest kandydatem do pushu po przejściu manualnej checklisty `VALIDATION_REPORT.md`. Repozytorium nie zostało zmodyfikowane automatycznie.
