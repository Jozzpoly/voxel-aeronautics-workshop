# Changelog

## Foundation Phase 1D.2E — Guided Vertical Power Controls

- Upgraded `foundation.input-profile` to v3 with rebindable Passive vertical thrust adjustment.
- Added default `Minus/Equal` bindings beside existing `Comma/Period` Balloon power bindings.
- Added migration from v1–v2 that preserves user-claimed physical codes.
- Centralized passive power changes in `setThrusterPower()`.
- Added shared vertical support sampling and `requiredSupplementalPowerForHover()`.
- Added a hover marker, climb zone and live state guidance to Passive vertical thrust.
- Made both power-control shortcut labels reflect the current input profile.
- Added slider, hotkey, migration, simultaneous Ctrl chord and guidance regression tests.
- Added permanent `DELIVERY_WORKFLOW.md` and robust fetch/rebase/push instructions.
- Version `0.5.7-foundation.1d2e`.
- Release id `foundation-1d2e-guided-vertical-power-controls`.

## Foundation Phase 1D.2D — Rebindable Input & Flight Focus

- Upgraded `foundation.input-profile` to v2 with persistent physical-key bindings.
- Added two binding slots per flight command and Balloon power adjustment.
- Added runtime rebinding UI, conflict reassignment, clear/cancel behavior and profile reset.
- Restored `Left Ctrl` as the default descend key and removed Shift from default flight input.
- Added optional Flight Focus using JavaScript fullscreen plus Keyboard Lock for modifier chords.
- Added precise warnings instead of claiming that `preventDefault()` can override every browser shortcut.
- Bumped UI preferences to v5 with v1–v4 migration.
- Added binding migration, capture, conflict and Keyboard Lock regression tests.
- Version `0.5.6-foundation.1d2d`.
- Release id `foundation-1d2d-rebindable-flight-focus`.

## Foundation Phase 1D.2C — Desktop Input & Aerostatic Settling

### Input

- Replaced Ctrl descent with Shift descent.
- Replaced Page Up/Page Down balloon control with Comma/Period.
- Added semantic auxiliary bindings in `foundation.flight-control`.
- Explicitly kept Ctrl, Meta and browser navigation keys outside flight input.

### Platform scope

- Removed mobile topbar, touch flight buttons, tap build actions and pinch state.
- Declared keyboard + mouse desktop as the supported runtime platform.
- Added a narrow-screen desktop requirement notice.

### Aerostatics

- Added capped vertical damping proportional to vertical speed, mass and active balloon lift.
- Preserved altitude-dependent equilibrium and manual pilot authority.
- Added regression tests for damping direction, cap and inactive balloons.

### Release

- Version `0.5.5-foundation.1d2c`.
- Release id `foundation-1d2c-desktop-input-aerostatic-settling`.

## Foundation Phase 1D.2B — Mission Recovery & Balloon Control Fix

### Mission completion

- Added explicit `landingZones` to contract data.
- Hover License now accepts either marked test pad; route/courier remain remote-pad objectives and Heavy-Lift remains launch-pad recovery.
- Added multi-zone mission evaluation with nearest-zone guidance.
- Preserved state-based ground clearance, speed, tilt and dwell checks.
- Landing markers now distinguish route phase from active recovery.

### Balloon controls and aerostatics

- Added pure `foundation.aerostatics`.
- Balloon lift now loses efficiency with altitude using the same policy in physics and UI.
- Added neutral-hover marker and equilibrium-height guidance to Balloon power.
- Fixed delayed percentage refresh by centralizing updates in `setBalloonPower()`.
- Added Page Up/Page Down control with Shift fast-step and scroll prevention.

### UI and release integrity

- Added missing mission evaluator and aerostatics modules to the source loader.
- Removed stale duplicate Contracts controls and restored the mobile toggle.
- Extended ARIA state synchronization.
- Added regression tests for the screenshot recovery case, aerostatics, slider refresh and keyboard input.
- Release version `0.5.4-foundation.1d2b`; release id `foundation-1d2b-mission-balloon-control-fix`.

## Foundation Phase 1D.2 — Contact Boundary & UI Recovery

### UI hotfix

- Naprawiono niedostępny dół panelu budowania.
- Wszystkie cztery panele mają osobny `.workspace-panel-scroll`.
- Pasek tytułu pozostaje dostępny podczas przewijania.
- Dodano touch/trackpad scroll, widoczny scrollbar i overscroll containment.
- `fitPanelRect()` nie pozwala zapisać okna poza viewportem.
- Workspace v2 resetuje wadliwą geometrię v1; preferencje używają klucza UI v3.

### Physics boundary

- Adapter Cannon normalizuje kolizje do `otherBody`, `impactSpeed`, `relativePoint`.
- `game.js` nie zna już `event.contact`, `bi`, `ri`, `rj` ani `getImpactVelocityAlongNormal()`.
- Zachowano odroczone obrażenia po `Physics.step()`.

### Testy

- Dodano test migracji geometrii workspace i clampu viewportu.
- Dodano statyczny test czterech scroll body.
- Przewijanie sprawdzono przez Chrome DevTools Protocol w prawdziwym Chromium.
- Dodano test znormalizowanego zdarzenia kolizji i unsubscribe.

## Foundation Phase 1D.1 — Physics Lifecycle Boundary

### Architektura fizyki

- Dodano neutralny `runtime.physics-port` z deskryptorami świata, body, colliderów, wektorów i kwaternionów.
- Dodano referencyjny `runtime.cannon-physics-backend`.
- `game.js` nie tworzy już bezpośrednio `CANNON.World`, `Body`, `Box` ani `Plane`.
- Dodawanie/usuwanie body, krok solvera, siły, momenty i transformacje local/world przechodzą przez backend.
- Usuwanie colliderów i przesuwanie ich offsetów po zmianie COM zostało odizolowane w adapterze.
- Bootstrap publikuje aktywny backend i capability `phase-1d-lifecycle`.

### Testy i ograniczenia

- Dodano test deskryptorów, lifecycle body/colliderów, sił, momentów i kroku solvera.
- Dodano statyczny zakaz obchodzenia granicy fizyki w `game.js`.
- Zachowano pełny zestaw regresji misji, obrażeń, payloadu, detach i UI.
- Natywne wektory body oraz format kontaktu Cannon pozostają świadomym długiem do Phase 1D.2.

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
