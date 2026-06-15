# Validation Report — Foundation Phase 1C.2

## Zakres

Walidacja objęła synchronizację przesłanej Phase 1C.1 z repozytorium, przegląd granic domenowych, wdrożenie Control Frame, sześciu osi wejścia i wspólnego systemu okien oraz pełny powtórny przebieg testów i buildów.

## Problemy rozwiązane w tym etapie

### 1. Orientacja statku była ukrytym założeniem globalnym

Pozycja Core była już swobodna, ale runtime nadal zakładał jeden globalny kierunek przodu i góry. To nie wystarcza dla pionowych rakiet, obróconych kokpitów ani przyszłych wielorodzajowych pojazdów.

Rozwiązanie: orientacja Command Core definiuje jawny `CraftControlFrame` z osiami forward/up/right oraz origin. `CraftCompiler` zapisuje go w niezmiennym `CompiledCraft`.

### 2. Preferencje gracza mieszały się z fizycznym znakiem sterowania

Odwrócenie osi nie powinno zmieniać blueprintu ani konfiguracji aktuatora. Dodano osobny, wersjonowany `InputProfile` z sześcioma osiami, odwracaniem i czułością. Domyślny profil koryguje zgłoszony odwrócony pitch.

### 3. Brakowało bocznej translacji

Sterowanie posiada teraz pełne sześć stopni swobody: pitch, yaw, roll, surge, sway i lift. Z/C zasila `sway`, a monitor wejścia pokazuje wszystkie osie.

### 4. Interfejs był zbiorem wyjątków per panel

Build, Contracts, Telemetry i Controls korzystają teraz z jednego `foundation.ui-workspace`. Każde okno może zostać otwarte, zamknięte, zminimalizowane, przeciągnięte i przeskalowane, a layout jest normalizowany i zapisywany jako preferencja użytkownika.

### 5. Pipeline wydania duplikował pliki

Generator ZIP skanował istniejący katalog `release/`, a później ponownie dodawał aktualny HTML i SHA. Katalog artefaktów został wyłączony ze źródeł paczki. Test deterministyczności i zgodności źródeł przechodzi bez ostrzeżeń o duplikatach.

## Wynik automatyczny

Wszystkie testy przechodzą:

- 15 źródeł aplikacji;
- 213 funkcji runtime;
- 183 unikalne ID HTML;
- 12 modułów domenowych;
- migracje blueprintów v3–v9;
- orientowany Core i `CompiledCraft.controlFrame`;
- sześć osi, profil wejścia i transformacja przez Control Frame;
- 600 losowych operacji CraftModel;
- model i kompilacja 2500 bloków;
- regresje misji, fizyki, obrażeń i UI;
- interakcyjny startup smoke;
- deterministyczny HTML, ZIP, manifest i SHA-256.

Ostatni przebieg zmierzył około 8.4 ms dla pełnego `replace` 2500 bloków oraz około 52.7 ms dla kompilacji 2500 części w Node.

## Ocena

**Phase 1C.2 jest gotowa do pracy jako baza dla Foundation Phase 1D — Physics Boundary.**

Nie należy jeszcze podnosić limitu 480 aktywnych części ani wymieniać Cannon.js bez neutralnego interfejsu backendu, harnessu fizyki i benchmarków. Runtime nadal tworzy jeden collider na voxel i nadal skupia zbyt wiele odpowiedzialności w `game.js`.

## Niewykonana walidacja

Nie udało się przeprowadzić wiarygodnego, automatycznego playtestu prawdziwego WebGL/GPU w środowisku roboczym. Startup smoke nie zastępuje lokalnego sprawdzenia:

- kierunku pitch/yaw/roll z rzeczywistą kamerą;
- różnych orientacji Core;
- przeciągania i skalowania okien przy różnych rozdzielczościach;
- fokusu klawiatury między viewportem a kontrolkami;
- długiego lotu i stabilności fizyki.
