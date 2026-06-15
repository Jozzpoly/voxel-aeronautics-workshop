# Phase 1D.2D Report — Rebindable Input & Flight Focus

## Decyzja

Pełnego rebindingu nie odłożono. Powtarzające się konflikty Ctrl, Page Up/Down i Shift pokazały, że kolejne hardkodowane zamiany klawiszy tylko przesuwają problem. Fundament wejścia został więc wersjonowany i rozszerzony przed pushem.

## Implementacja

- `foundation.input-profile` v2;
- trwałe `bindings` obok ustawień osi;
- maksymalnie dwa fizyczne `KeyboardEvent.code` na akcję;
- migracja profili v1 bez bindingów;
- automatyczne usuwanie konfliktu przy ponownym przypisaniu kodu;
- UI capture w panelu Controls;
- domyślny `ControlLeft` dla `lift-`;
- `Shift` usunięty z defaultów;
- `FlightControl` nie posiada już własnej hardkodowanej mapy klawiszy;
- `Flight Focus` wykorzystuje fullscreen i Keyboard Lock dla aktualnego profilu;
- UI preferences v5.

## Ograniczenie, którego nie ukrywamy

Bez Keyboard Lock strona nie może niezawodnie wygrać ze wszystkimi skrótami Chrome. Left Ctrl jest bezpieczny jako pojedynczy klawisz zejścia, ale kombinacje z klawiszami zarezerwowanymi przez przeglądarkę wymagają Flight Focus albo rebindingu.

## Walidacja automatyczna

Przechodzą:

- składnia 19 źródeł;
- 16 modułów foundation/runtime;
- input profile v2 i migracja;
- przenoszenie zajętego bindingu;
- domyślny Ctrl i brak defaultowego Shift;
- zestaw Keyboard Lock;
- UI capture w startup smoke;
- cała wcześniejsza bateria misji, aerostatyki, fizyki, workspace i release parity.

Pełna manualna walidacja Keyboard Lock w Chrome/Brave pozostaje wymagana.
