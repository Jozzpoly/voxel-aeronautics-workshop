# Phase 1D.2E Report — Guided Vertical Power Controls

## Zakres

Etap rozszerza istniejący model Balloon power na Passive vertical thrust bez zmiany fundamentalnej semantyki thrusterów: suwak nadal ustala wyłącznie pasywny ciąg silników skierowanych ku lokalnemu `+Y`, a wejście pilota zachowuje pełną autorytetę.

## Implementacja

- input profile podniesiony do v3;
- nowe akcje `thrusterPower-` i `thrusterPower+`;
- domyślne bindingi `Minus` i `Equal` z pełnym rebindingiem;
- migracja profili v1–v2;
- `setThrusterPower()` centralizuje suwak, hotkey, stan i UI;
- wspólny `verticalSupportSample()` analizuje ciężar, wysokość, aktywny lift balonów i maksymalny pasywny lift thrusterów;
- `requiredSupplementalPowerForHover()` oblicza wymagany udział dodatkowego źródła siły;
- Passive vertical thrust otrzymał marker zawisu, climb zone i komunikaty stanu;
- oba regulatory pokazują skróty wynikające z aktualnego profilu, nie ze stałego tekstu;
- dokumentacja wydania otrzymała stały workflow aktualizacji repozytorium.

## Zachowane inwarianty

- pasywny ciąg nie ogranicza bezpośrednich wejść;
- horizontal i downward thrusters nie dostają pasywnej komendy;
- fizyczne klawisze nie są interpretowane w mikserze;
- jeden kod nie steruje niejawnie dwiema akcjami;
- UI i obliczenia guidance używają tych samych stanów mocy co fizyka.

## Walidacja

Automaty obejmują:

- input profile v3 i migrację v2;
- bindingi `Minus/Equal` oraz Keyboard Lock;
- czyste obliczenia supplemental hover power;
- natychmiastowy odczyt suwaka;
- hotkeye obu regulatorów;
- jednoczesne `Left Ctrl + Minus/Equal`;
- pełną wcześniejszą baterię misji, fizyki, aerostatyki, workspace i release parity.

Pozostaje manualne sprawdzenie czytelności markerów oraz odczucia zmiany mocy w prawdziwym Chrome/Brave z WebGL.
