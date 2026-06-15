# Architektura — Foundation Phase 1D.2D

## Cel etapu

Phase 1C ustanawia stabilną granicę między trzema różnymi stanami:

1. **Blueprint / CraftModel** — to, co gracz może swobodnie edytować i zapisać;
2. **CompiledCraft** — zweryfikowany, deterministyczny opis maszyny;
3. **Flight Runtime** — obiekty Three.js i Cannon.js używane podczas lotu.

Najważniejsza korekta projektowa: poprawność stanu roboczego nie jest tym samym co gotowość do lotu.

## Przepływ danych

```text
Blueprint JSON
    │ normalize / migrate
    ▼
CraftModel
    │ snapshot + revision
    ▼
CraftCompiler
    │ immutable CompiledCraft
    ▼
Runtime adapter w game.js
    ├─ Three.js visuals
    ├─ runtime.physics-port
    │      └─ runtime.cannon-physics-backend
    ├─ damage runtime
    └─ flight telemetry
```

Renderer i fizyka nigdy nie są źródłem prawdy dla blueprintu.

## Kierunek zależności

```text
foundation.kernel
   ├─ foundation.config
   ├─ foundation.catalog
   ├─ foundation.orientation
   ├─ foundation.blueprint
   ├─ foundation.craft-model
   ├─ foundation.craft-history
   ├─ foundation.control-frame
   ├─ foundation.craft-compiler
   ├─ foundation.input-profile
   ├─ foundation.ui-workspace
   ├─ foundation.flight-control
   └─ foundation.state

runtime.physics-port
   └─ runtime.cannon-physics-backend
            │
            ▼
   foundation.bootstrap
            │
            ▼
          game.js
```

Fundament nie może importować `game.js` ani zależeć od sceny.

## `foundation.blueprint`

Blueprint v9 jest czystym dokumentem i może reprezentować:

- pusty warsztat;
- konstrukcję bez Core;
- Core w dowolnej poprawnej pozycji;
- chwilowo rozłączone wyspy konstrukcji;
- maksymalnie jeden Core.

Takie dokumenty są poprawnymi **stanami edytora**, lecz nie muszą być gotowe do lotu.

Dla v3–v7 zachowane są historyczne reguły pozycji i spójności. Dla v3–v8 zachowana jest historyczna orientacja Core:

- Core w `0,0,0` dla v3–v7;
- automatyczne dodanie Core, gdy stary zapis go nie zawierał;
- wymagana spójność konstrukcji dla v3–v7;
- Core `forward +X / up +Y` dla v3–v8.

Normalizacja zawsze zwraca dokument v9.

## `foundation.craft-model`

`CraftModel` jest jedynym właścicielem aktualnej konstrukcji warsztatowej. Przechowuje wyłącznie zamrożone rekordy domenowe:

```text
{
  key,
  x, y, z,
  type,
  orientation,
  controlAxis,
  controlSign
}
```

Model:

- pozwala zacząć od dowolnego bloku;
- pozwala na zero lub jeden Core;
- pozwala przesuwać Core przez usunięcie i ponowne ustawienie;
- pozwala zachować rozłączony stan roboczy;
- pilnuje granic, typów, duplikatów i limitu bloków;
- wykonuje operacje wieloblokowe atomowo;
- emituje jedno zdarzenie na przyjętą transakcję;
- posiada rewizję rosnącą wyłącznie po realnej zmianie.

Spójność pozostaje dostępna jako diagnostyka `isContiguous()`, ale jej wymaganie należy do kompilacji lotnej.

## `foundation.craft-history`

Historia przechowuje izolowane snapshoty dokumentów i odpowiada za:

- undo / redo;
- deduplikację;
- limit liczby wpisów;
- limit sumy części;
- rollback, gdy odtworzenie nie powiedzie się.

Runtime nie utrzymuje równoległych, luźnych stosów historii.

## `foundation.craft-compiler`

### Kontrakt wejścia

Kompilator przyjmuje:

- `CraftModel`;
- snapshot `{ revision, blocks }`;
- dokument lub listę bloków.

Dla modelu cache jest kluczowany obiektem i rewizją.

### Walidacja gotowości do lotu

`CompiledCraft.ready` jest prawdziwe wyłącznie, gdy:

- istnieje co najmniej jeden blok;
- istnieje dokładnie jeden Core;
- wszystkie części są poprawne i unikalne;
- wszystkie części należą do jednej połączonej wyspy;
- limit siatki i bloków nie jest przekroczony.

Edytor nie musi spełniać tych reguł w każdej klatce. Start musi.

### Zawartość artefaktu

`CompiledCraft` zawiera:

- `format`, `sourceRevision`, `signature`;
- `ready`, `errors`, `warnings`;
- `blockCount`, `connectedCount`;
- `coreIndex`, `coreKey`, `corePosition`;
- `controlFrame` z forward/up/right i źródłem orientacji;
- masę, ciężar, paliwo, opór, COM i bezwładność;
- `keyToIndex`, `adjacency`;
- kanoniczne części z liczbowymi bazami orientacji;
- lokalne offsety, pełne siły i momenty;
- `functionalByType`;
- referencyjny `colliderPlan`.

Cały wynik jest głęboko zamrożony. Kompilator nie tworzy wektorów Three.js, body Cannon.js ani elementów DOM.

### Determinizm

Kolejność części jest kanoniczna. Ta sama konstrukcja niezależnie od kolejności wejściowej produkuje tę samą sygnaturę i układ indeksów.

## Adapter `CompiledCraft -> Flight Runtime`

`buildCraftSnapshot()` jest obecnie przejściowym adapterem:

- bierze wyłącznie wynik `CraftCompiler`;
- konwertuje neutralne tablice liczbowe na `THREE.Vector3`;
- nie odczytuje meshów jako danych konstrukcji;
- przekazuje rzeczywistą pozycję Core do mocowania payloadu;
- buduje istniejący runtime bez zmiany modelu lotu.

Tworzenie świata, body oraz podstawowych colliderów przechodzi przez `runtime.physics-port` i adapter Cannon. `game.js` nadal buduje listę voxelowych colliderów oraz przechowuje runtime parts, dlatego pełny builder compound body pozostaje zakresem Phase 1D.3.


## `runtime.physics-port` i `runtime.cannon-physics-backend`

Port definiuje neutralne deskryptory świata, body, boxa, plane, wektora i kwaternionu oraz sprawdza wymagany zestaw operacji backendu. Nie zależy od DOM, Three.js ani Cannon.js.

Adapter Cannon jest jedynym miejscem, w którym wolno tworzyć `CANNON.World`, `CANNON.Body`, `CANNON.Box`, `CANNON.Plane` i wykonywać `world.step`. Odpowiada także za:

- dodawanie i usuwanie body;
- tworzenie i usuwanie colliderów;
- przesuwanie offsetów colliderów po zmianie COM;
- aktualizację masy i flag broadphase/AABB;
- siły, momenty i transformacje local/world;
- rejestrację zdarzeń kolizji.

Phase 1D.2B zachowuje natywne obiekty body i wektorów Cannon jako warstwę kompatybilności, ale kontakt jest już mapowany do neutralnego `{ otherBody, impactSpeed, relativePoint }`. `game.js` nie odczytuje pól `contact/bi/ri/rj` ani metod Cannon. Zmiana backendu nadal nie jest operacją podmiany jednego importu, ponieważ aerodynamika korzysta z natywnych metod wektorów.

## `foundation.control-frame`, `foundation.input-profile` i `foundation.flight-control`

Command Core przechowuje jedną z 24 baz orientacji. Kompilator wyprowadza z niej `forward`, `up` i `right`. Intencja gracza jest najpierw przetwarzana przez profil wejścia, a następnie transformowana z układu Core do lokalnych osi bryły.

Warstwa wejścia operuje na semantycznych akcjach:

```text
pitch+ / pitch-
yaw+ / yaw-
roll+ / roll-
surge+ / surge-
sway+ / sway-
lift+ / lift-
```

Mapowanie klawiszy jest oddzielone od stanu pilota. Profil wejścia v2 przechowuje do dwóch fizycznych `KeyboardEvent.code` na akcję, migruje profile bez bindingów i gwarantuje jednoznaczność kodu. Dzięki temu klawiatura, przyszły gamepad i mikrokontroler mogą zasilać te same osie bez zmian w mikserze.

`applyTranslationMix()` miesza lokalny kierunek thrustera z żądaniem:

- `surge` — lokalne przód / tył;
- `sway` — lokalne lewo / prawo;
- `lift` — lokalne góra / dół.

Suwak mocy ustala wyłącznie pasywny ciąg silników skierowanych ku lokalnemu +Y. Nie jest limitem mocy dostępnej dla wejść pilota. Poziome i skierowane w dół thrustry są neutralnie wyłączone, natomiast zgodna komenda translacji lub obrotu może zwiększyć dowolny thruster aż do 100%. Komenda przeciwna redukuje istniejący pasywny ciąg do zera. Domyślny `Left Ctrl` publikuje semantyczne `lift-`, aktywuje thrustry skierowane w dół i wygasza pasywny ciąg skierowany w górę. Sam mikser nie zna fizycznego klawisza.


## `foundation.ui-workspace`

Build, Contracts, Telemetry i Controls są projekcjami jednego wersjonowanego stanu okien. Ramka panelu zarządza pozycją i resize, natomiast `.workspace-panel-scroll` jest jedynym przewijanym korpusem. `fitPanelRect()` ogranicza całą ramkę do viewportu podczas odtwarzania i przeciągania. Workspace v3 zachowuje z-order i wersjonowany stan, resetuje wadliwą geometrię starszych zapisów oraz zachowuje preferencje otwarcia. Workspace ma jeden desktopowy model okien. Telefon i touch-only są poza zakresem runtime; nie istnieje alternatywna mobilna projekcja paneli. Profil wejścia i workspace są preferencjami użytkownika, nie częścią blueprintu.

## `foundation.mission-evaluator` i jawne strefy lądowania

Kontrakt nie może polegać na ukrytym założeniu „start pad albo finish pad”. `foundation.catalog` zapisuje `landingZones`, a runtime mapuje identyfikatory na strefy `TEST_RANGE`. `evaluateLandingZones()` ocenia jeden znormalizowany sample statku względem wszystkich dozwolonych stref. Jeżeli żadna nie jest zaliczona, zwraca najbliższą strefę dla komunikatu HUD; jeżeli dowolna spełnia warunki, zwraca ją jako zaliczoną.

Sample lądowania zawiera pozycję body, prędkość, przechył, prześwit najniższej geometrii i wiek ostatniego kontaktu. Prześwit jest sygnałem podstawowym. Event kontaktu jest tylko ograniczonym czasowo potwierdzeniem i nie może samodzielnie zaliczyć statku wysoko nad ziemią. Dwell jest aktualizowany przez czystą funkcję z kontrolowanym decay.

## `foundation.aerostatics`

Aerostatyka jest czystym modułem bez DOM, Three.js i Cannon.js. Definiuje:

```text
efficiency(h) = max(minimumEfficiency, exp(-h / scaleHeight))
availableLift = maxSeaLevelLift × power × efficiency(h)
```

`requiredPowerForHover()` oblicza neutralną moc po odjęciu pasywnej siły pionowych thrusterów, a `equilibriumAltitude()` szacuje pułap równowagi wybranej komendy. Pętla fizyki oraz marker UI korzystają z tej samej polityki `AEROSTATICS`. Marker jest analizą statyczną: nie obejmuje dynamicznej siły skrzydeł ani chwilowych wejść pilota.

Stan Balloon power jest zmieniany tylko przez `setBalloonPower()`, który synchronizuje model, input, tekst, guidance i zapis. Comma/Period wywołuje tę samą ścieżkę co suwak. `verticalDampingForce()` dodaje ograniczony opór przeciwny do prędkości pionowej, zależny od aktywnego lift, ale nie od błędu wysokości.

## Granica platformy desktopowej i Flight Focus

Runtime zakłada klawiaturę i mysz. Pointer events obsługują mysz i pen, ale dotykowy canvas nie emuluje budowania ani pilotażu. Wąski viewport może wyświetlić komunikat o wymaganym desktopie. Touchpad laptopa pozostaje zwykłym pointerem i źródłem wheel/scroll.

Bindingi są preferencją użytkownika i mogą używać modifierów. `foundation.flight-control` rozwiązuje fizyczny kod przez profil i publikuje wyłącznie semantyczne akcje lub pomocnicze adjustmenty. `game.js` nie posiada zapasowej hardkodowanej mapy.

Zwykły `preventDefault()` nie jest kontraktem przejęcia wszystkich skrótów przeglądarki. Flight Focus jest opcjonalnym adapterem platformowym:

```text
user click
  -> JavaScript Fullscreen
  -> navigator.keyboard.lock(profile bound codes)
  -> key events before supported browser shortcuts
```

Mechanizm działa best-effort: wymaga wsparcia, bezpiecznego kontekstu, zgody użytkownika i nie może przejąć kombinacji zastrzeżonych przez system operacyjny. Po wyjściu z fullscreen lock jest zwalniany, a aktywne akcje czyszczone. Rebinding pozostaje obowiązkowym fallbackiem.

## Ważne inwarianty

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest źródłem prawdy dla uruchomienia lotu.
3. Meshe i collidery nie trafiają do dokumentów domenowych.
4. Core nie ma specjalnej pozycji; ma specjalną rolę.
5. Edytor dopuszcza niegotowe stany robocze.
6. Start wymaga dokładnie jednego Core i jednej wyspy.
7. Każda zmiana formatu ma wersję i migrację.
8. Sterowanie używa semantycznych osi, a fizyczne bindingi należą wyłącznie do wersjonowanego profilu wejścia.
9. Dostarczone zdarzenia lotu mają pierwszeństwo nad skrótami edytora; przejęcie skrótów przeglądarki wymaga Flight Focus lub rebindingu.
10. Nie podnosić limitu lotu przed benchmarkiem i collider compilerem.
11. Pasywny ciąg i bezpośrednia autoryteta pilota są oddzielnymi pojęciami.
12. Każdy artefakt wydania musi mieć weryfikowalną zgodność źródeł ZIP ↔ single HTML.
13. Orientacja Core definiuje Control Frame, ale profil wejścia pozostaje preferencją użytkownika.
14. Wszystkie główne okna używają wspólnego `UIWorkspace`.
15. `game.js` nie może bezpośrednio tworzyć świata, body ani colliderów backendu i nie może bezpośrednio wykonywać kroku solvera.
16. `game.js` nie może interpretować natywnego kontaktu Cannon.
17. Ramka panelu nie jest obszarem scrollowania; przewija się wyłącznie `.workspace-panel-scroll`.
18. Dozwolone strefy lądowania należą do danych kontraktu.
19. Fizyka i telemetria balonów korzystają z tej samej polityki aerostatycznej.
20. Tłumienie balonów może zależeć od prędkości i aktywnego lift, ale nie od docelowej wysokości.
21. Główny runtime jest desktop-only; nie dodawać prowizorycznej mobilnej projekcji sterowania.
22. Kontrolki Balloon power synchronizują się przez jeden setter.
23. Jeden fizyczny kod nie może być niejawnie przypisany do dwóch akcji.
24. Flight Focus jest opcjonalnym adapterem platformowym, nie warunkiem działania gry.

## Świadomy dług

- `game.js` nadal jest duży.
- `foundation.state` nadal posiada część obiektów Three.js dla kompatybilności.
- runtime lotu nadal tworzy collider na każdy voxel.
- `CompiledCraft.colliderPlan` jest na razie referencyjny, nie zoptymalizowany.
- aerodynamika kadłuba nadal sumuje uproszczone `dragArea`.
- Three.js, Cannon.js i Tailwind pochodzą z CDN.
- brak prawdziwego automatycznego testu WebGL w obecnym środowisku.

## Następna granica — Foundation Phase 1D.3

1. przenieść składanie całego compound body z `game.js` do buildera runtime;
2. zachować stabilne mapowanie collider → part;
3. dodać headless scenariusze dynamiki i soak;
4. zapisać benchmark kosztu tworzenia i kroku solvera;
5. ograniczyć pozostałe natywne typy Cannon poza adapterem;
6. dopiero potem rozpocząć Collider Compiler oraz porównanie backendów.
