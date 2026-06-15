# Changelog

## Foundation Phase 1C.2 — Control Frame, Input Profile & UI Workspace

### Sterowanie i układ odniesienia

- Blueprint podniesiono do v9.
- Command Core ma pełną orientację i definiuje `forward`, `up` oraz `right` całej konstrukcji.
- `CraftCompiler` emituje zamrożony `controlFrame`.
- Intencje pilota są transformowane z układu stanowiska sterowania do lokalnych osi bryły.
- Dodano szóstą oś translacji `sway` na Z/C.
- Dodano osobny `foundation.input-profile` z odwracaniem i czułością każdej osi.
- Domyślny pitch naprawia historycznie odwrócony znak.
- Starsze blueprinty v3–v8 migrują Core do dawnej orientacji +X/+Y.
- Model Core dostał widoczny znacznik nosa i góry.

### Interfejs

- Dodano `foundation.ui-workspace`.
- Build, Contracts, Telemetry i Controls są wspólnymi oknami workspace.
- Okna można otwierać, zamykać, minimalizować, przeciągać i zmieniać ich rozmiar.
- Layout jest zapisywany i migruje starą preferencję panelu kontraktów.
- Dodano kompaktowy pasek zakładek i reset layoutu.
- Okno Controls pokazuje orientację statku oraz ustawienia wszystkich sześciu osi.
- Na urządzeniach mobilnych okna wracają do układu arkuszy bez swobodnego przeciągania.

### Narzędzia i jakość

- Usunięto zależność parametrów fizyki w `foundation.config` od `THREE.MathUtils`.
- Naprawiono generator ZIP, który wcześniej dopisywał drugi raz pliki z katalogu `release/`.
- Rozszerzono testy migracji, control frame, input profile, workspace i sześciu osi.

## Foundation Phase 1C.1 — Source Parity & Thruster Semantics Hotfix

### Wydanie i zgodność źródeł

- Nadano nową, unikalną nazwę artefaktom, aby przeglądarka lub pobieranie nie myliło ich z wcześniejszym Phase 1C.
- Dodano `SOURCE_MANIFEST.json` z hashami wejść buildu.
- Jednoplikowy HTML zawiera identyfikator wydania i hash manifestu.
- ZIP zawiera pełne źródła oraz dokładnie ten sam jednoplikowy HTML w katalogu `release/`.
- Test buildu porównuje każdy osadzony moduł bajt po bajcie ze źródłem i porównuje pliki ZIP-u z katalogiem roboczym.
- Dodano `npm run verify-release` do samodzielnej walidacji po rozpakowaniu.

### Sterowanie thrusterami

- Suwak nie jest już limitem wejść pilota.
- Ustawia wyłącznie pasywny ciąg silników skierowanych ku lokalnemu `+Y`.
- Silniki poziome i skierowane w dół pozostają wyłączone bez komendy.
- W/S, Space/Left Ctrl oraz miks obrotowy mogą dojść do 100% niezależnie od pasywnego ciągu.
- Left Ctrl uruchamia silniki skierowane w dół i wygasza pasywny ciąg silników skierowanych w górę.
- Dodano testy znaku pionowego i niezależności sterowania od suwaka.


## Foundation Phase 1C — CraftCompiler, Freeform Core & Flight Input

### Walidacja

- Ponownie uruchomiono pełny zestaw testów Phase 1B przed zmianami.
- Potwierdzono spójność modelu, historii, startupu i buildu.
- Rozszerzony audyt wykrył błąd `snapshot` poza zakresem w ścieżce Launch; naprawiono go i dodano test kliknięcia Launch.

### Blueprint i warsztat

- Podniesiono format blueprintu do v8.
- Nowy projekt zaczyna się pusty.
- Pierwszym blokiem może być dowolny moduł.
- Core może znajdować się w dowolnej pozycji i można go usunąć.
- Edytor dopuszcza pusty, bez-Core i rozłączony stan roboczy.
- Start nadal wymaga dokładnie jednego Core i spójnej konstrukcji.
- Zachowano migracje v3–v7 z historycznym Core w `0,0,0`.

### CraftCompiler

- Dodano `foundation.craft-compiler`.
- Wynik jest deterministyczny, głęboko zamrożony i cache’owany per rewizja.
- Kompilowane są masa, COM, bezwładność, graf, Core, części funkcjonalne, siły i bazowy plan colliderów.
- Runtime lotu pobiera konstrukcję przez kompilator.
- Payload jest kotwiczony względem rzeczywistej pozycji Core.

### Sterowanie

- Dodano `foundation.flight-control`.
- W/S steruje przód/tył.
- Space/Left Ctrl steruje góra/dół.
- A/D ma poprawiony kierunek yaw.
- Pitch przeniesiono na strzałki góra/dół; Q/E pozostaje rollem.
- Dodano mobilne przyciski translacji i telemetrię obu osi.
- Pierwotna implementacja Phase 1C używała suwaka jako limitu mocy; zachowanie to zostało zastąpione w Phase 1C.1 przez niezależną autorytetę wejść pilota.
- Usunięto błąd pozwalający komendom kierunkowym ominąć suwak ustawiony na 0%.
- Sterowanie lotem ma pierwszeństwo nad Ctrl+S, dzięki czemu Ctrl+S działa jako dół + tył podczas lotu.

### Testy

- Dodano testy CraftCompiler i FlightControl.
- Dodano testy pustego warsztatu, ruchomego Core i rozłączonych WIP.
- Startup smoke wykonuje teraz realną ścieżkę Launch i wejścia pilota.
- Wszystkie odziedziczone regresje pozostają zielone.

## Foundation Phase 1B — CraftModel Boundary

### Walidacja poprzedniego etapu

- Ponownie uruchomiono cały zestaw testów Foundation Phase 1 przed rozpoczęciem zmian.
- Potwierdzono poprawność składni, migracji, misji, uszkodzeń, startupu i buildu.
- Zidentyfikowano najważniejsze pozostałe sprzężenie: `STATE.voxels` łączyło dane bloku z meshem Three.js.
- Potwierdzono, że poprzednie moduły były używane przez grę, ale granica danych konstrukcji nadal była niepełna.

### CraftModel

- Dodano `foundation.craft-model` jako autorytatywny, niezależny od renderera model konstrukcji.
- Rekordy bloków są kanoniczne i zamrożone.
- Usunięto `STATE.voxels`.
- Dodano lookup pozycji, sąsiedztwo, snapshoty i licznik rewizji.
- Dodano atomowe `addMany`, `remove` i `replace`.
- Nieudane operacje nie pozostawiają częściowych zmian.
- Usunięcie bloku rozcinającego statek jest odrzucane przed zmianą modelu.
- Import i eksport modelu używają istniejącego formatu blueprintu.

### Widok warsztatu

- Meshe są przechowywane osobno w `workshop.meshesByKey`.
- Rendering obserwuje zdarzenia `CraftModel` zamiast być częścią danych domenowych.
- Dodano kontrolę zgodności modelu i widoku.
- Dodano pełną odbudowę widoku z modelu po błędzie aktualizacji przyrostowej.
- Lot ukrywa i przywraca meshe przez mapę widoku, nie przez rekordy bloków.

### Historia

- Dodano `foundation.craft-history`.
- Stosy undo/redo nie są już publicznymi tablicami w globalnym stanie.
- Zachowano limity liczby snapshotów i sumy przechowywanych części.
- Dodano deduplikację, izolację klonów i rollback nieudanego undo/redo.

### Testy

- Dodano 600 deterministycznych losowych operacji modelu.
- Dodano testy atomowości wieloblokowych zmian.
- Dodano test ochrony przed rozcięciem konstrukcji.
- Dodano test maksymalnej konstrukcji 2500 bloków.
- Dodano testy `CraftHistory`, rollbacku i limitów pamięci.
- Dodano statyczny zakaz powrotu `STATE.voxels`.
- Dodano statyczny zakaz zależności CraftModel/CraftHistory od DOM, Three.js, Cannon.js i meshy.
- Potwierdzono identyczność dwóch kolejnych buildów bajt po bajcie.

### Zachowane zachowanie

- Nie zmieniono aerodynamiki, balansu, misji ani fizyki lotu.
- Nie podniesiono limitu 480 części lotnych.
- Zachowano zapis v7 i migracje v3–v7.

## Foundation Phase 1 — Boundary Extraction

### Architektura

- Dodano mały kernel modułów z jawnymi zależnościami, wykrywaniem cykli, duplikatów i brakujących modułów.
- Wyodrębniono konfigurację silnika i polityki pamięci z `game.js`.
- Wyodrębniono katalog bloków i kontraktów wraz z walidacją identyfikatorów i wymagań.
- Wyodrębniono generator 24 orientacji oraz migracje orientacji starszych blueprintów.
- Wyodrębniono czysty dokument blueprintu.
- Wyodrębniono fabrykę stanu aplikacji.
- Dodano jawny bootstrap `window.VAW_RUNTIME`.

### Blueprinty

- Utworzono jedno miejsce odpowiedzialne za tworzenie, sortowanie, klonowanie, sygnaturę, normalizację i migrację dokumentu.
- Walidator odrzuca przyszłe wersje, duplikaty pozycji, współrzędne ułamkowe, nieznane części i odłączone konstrukcje.
- Zachowano migracje v3–v7.

### Narzędzia

- Build jednoplikowy osadza wszystkie moduły w kontrolowanej kolejności.
- Dodano centralny runner testów, lokalny serwer, polecenia npm, `jsconfig.json` i `.gitignore`.
