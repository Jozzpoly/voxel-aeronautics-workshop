# Architektura — Foundation Phase 1D.3B

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
foundation.runtime-assembly
    │ immutable RuntimeAssemblyPlan
    ▼
runtime.assembly-builder
    ├─ runtime.physics-port
    │      ├─ runtime.cannon-physics-backend
    │      └─ runtime.headless-physics-backend (test harness)
    ├─ stable body/collider/part maps
    └─ transactional lifecycle

game.js
    ├─ delegates physical assembly to the builder
    ├─ Three.js visuals
    ├─ damage/gameplay runtime
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

foundation.runtime-assembly
            │
            ▼
runtime.assembly-builder
            │
            ▼
   runtime.physics-port
      ├─ runtime.cannon-physics-backend
      └─ runtime.headless-physics-backend
            │
            ▼
   foundation.bootstrap
            │
            ▼
          game.js
```

Fundament nie może importować `game.js` ani zależeć od sceny.

## `foundation.blueprint`

Blueprint v10 jest czystym dokumentem i może reprezentować:

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

Normalizacja zawsze zwraca dokument v10 i przydziela trwałe `blockId` dokumentom v3–v9.

## `foundation.craft-model`

`CraftModel` jest jedynym właścicielem aktualnej konstrukcji warsztatowej. Przechowuje wyłącznie zamrożone rekordy domenowe:

```text
{
  blockId,
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
- `keyToIndex`, `blockIdToIndex`, `adjacency`;
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

Mapowanie klawiszy jest oddzielone od stanu pilota. Profil wejścia v3 przechowuje do dwóch fizycznych `KeyboardEvent.code` na akcję, migruje profile v1–v2 i gwarantuje jednoznaczność kodu. Obejmuje sześć osi oraz pomocnicze akcje `thrusterPower-/+` i `balloonPower-/+`. Dzięki temu klawiatura, przyszły gamepad i mikrokontroler mogą zasilać te same semantyczne komendy bez zmian w mikserze.

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

`verticalSupportSample()` tworzy wspólny snapshot ciężaru, wysokości, maksymalnego liftu balonów i maksymalnego pasywnego liftu thrusterów. `requiredSupplementalPowerForHover()` oblicza wymagany udział źródła dodatkowego po uwzględnieniu źródła bazowego. Dla Passive vertical thrust bazą jest aktualny lift balonów; dla Balloon power źródłem pomocniczym jest aktualny pasywny ciąg.

Stan Balloon power jest zmieniany tylko przez `setBalloonPower()`, a stan pasywnego ciągu tylko przez `setThrusterPower()`. Settery synchronizują model, tekst, suwaki, guidance i zapis. `Comma/Period` oraz `Minus/Equal` są rebindable akcjami profilu i wywołują te same ścieżki co suwaki. `verticalDampingForce()` dodaje ograniczony opór przeciwny do prędkości pionowej, zależny od aktywnego lift, ale nie od błędu wysokości.

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

## Workflow wydania i aktualizacji repozytorium

`DELIVERY_WORKFLOW.md` jest częścią architektury procesu, nie dodatkiem do wiadomości. ZIP źródeł jest źródłem prawdy dla repozytorium, single HTML jest artefaktem uruchomieniowym, a patch służy do audytu. Przed kopiowaniem wydania oraz bezpośrednio przed pushem wymagane są `fetch` i rebase z `origin/main`. Standardowy push używa `git push origin HEAD:main`; force-push nie jest normalnym sposobem rozwiązywania rozbieżności.

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
22. Kontrolki Balloon power i Passive vertical thrust synchronizują się przez osobne centralne settery i wspólny model guidance.
23. Jeden fizyczny kod nie może być niejawnie przypisany do dwóch akcji.
24. Flight Focus jest opcjonalnym adapterem platformowym, nie warunkiem działania gry.
25. Każda dostawa artefaktów musi zawierać bezpieczną instrukcję aktualizacji repozytorium zgodną z `DELIVERY_WORKFLOW.md`.

## Świadomy dług

- `game.js` nadal jest duży.
- `foundation.state` nadal posiada część obiektów Three.js dla kompatybilności.
- runtime lotu nadal tworzy collider na każdy voxel.
- `CompiledCraft.colliderPlan` jest na razie referencyjny, nie zoptymalizowany.
- aerodynamika kadłuba nadal sumuje uproszczone `dragArea`.
- produkcyjne Three.js, Cannon.js i Tailwind pochodzą z CDN; testowy Cannon 0.6.2 jest vendored wyłącznie pod harness;
- brak prawdziwego automatycznego testu WebGL/GPU w obecnym środowisku;
- benchmark real Cannon nie obejmuje jeszcze masowych aktywnych kontaktów ani constraints.

## Historyczna granica zaplanowana po 1D.2F — wykonana w 1D.3A

- składanie body i colliderów zostało przeniesione do buildera runtime;
- stabilne mapowanie collider → part używa `blockId`;
- dodano headless scenariusze dynamiki i soak;
- zapisano benchmark kosztu budowy na backendzie testowym;
- automatyczny benchmark prawdziwego solvera wykonano w 1D.3B; constraint spike pozostaje zakresem 1D.3C.


## Phase 1D.2F — trwała tożsamość bloków

`blockId` i `gridKey` rozwiązują dwa różne problemy:

- `blockId` jest trwałą tożsamością urządzenia;
- `gridKey` (`x,y,z`) jest indeksem przestrzennym w lokalnej siatce bieżącej bryły.

Przeniesienie bloku zachowuje `blockId`. Nowa kopia otrzymuje nowe `blockId`. Połączenia sygnałowe i konfiguracje przyszłego control busu mogą wskazywać wyłącznie `blockId`, nigdy samą pozycję.

Blueprint v10 odrzuca brakujące, niepoprawne i zduplikowane identyfikatory. Migracje v3–v9 przydzielają deterministyczne identyfikatory pozycyjne, które po pierwszym zapisie stają się trwałe.

## `foundation.runtime-assembly`

Moduł jest neutralnym planistą pomiędzy domeną a backendem fizyki.

```text
Compiled/Loaded Snapshot
        │
        ▼
RuntimeAssemblyPlan
  ├─ rigidBodies[]
  │    ├─ massProperties
  │    ├─ blockIds[]
  │    └─ colliders[]
  ├─ constraints[]
  ├─ signalLinks[]
  ├─ parts[]
  ├─ blockIdToBodyId
  └─ blockIdToPartIndex
```

W 1D.2F planner emituje jedno `body:root`. Jest to kompatybilny przypadek bazowy, a nie nienaruszalny inwariant. `constraints[]` i `signalLinks[]` są puste, lecz jawnie rozdzielone.

### Trzy niezależne grafy

1. **Structural graph** — voxele scalone w jedną rigid island.
2. **Mechanical graph** — constraints łączące rigid bodies.
3. **Signal graph** — połączenia portów urządzeń.

Połączenie sygnałowe może przechodzić przez joint. Joint nie oznacza automatycznie przewodu. Strukturalne obejście jointa zwykłymi blokami jest błędem kompilacji mechanizmu.

## Mass properties boundary

Physics Port publikuje `setBodyMassProperties(body, descriptor)`.

Descriptor obejmuje:

```text
mass
centerOfMass
inertiaDiagonal
```

Obecny builder przesuwa collidery tak, aby lokalny COM body znajdował się w `(0,0,0)`, dlatego backend otrzymuje zerowy lokalny `centerOfMass`. Diagonalna bezwładność jest ustawiana jawnie po dodaniu colliderów. Backend Cannon aktualizuje `invMass`, `inertia`, `invInertia`, `invInertiaWorld` i właściwości solvera.

Po detach runtime:

1. znajduje przyłączone części;
2. wyznacza nowy COM;
3. przesuwa collider offsets, części i wizualizację;
4. zachowuje światową pozycję oraz prędkość nowego COM;
5. liczy diagonalną bezwładność od nowa;
6. atomowo stosuje nowe mass properties.

`setBodyMass()` pozostaje dla prostych body pomocniczych. Główna konstrukcja używa `setBodyMassProperties()`.

## Granica przyszłego Per-Block Control Bus

Obecny mikser publikuje semantyczne intencje pilota. Docelowo stanie się jednym z producentów sygnału.

Aktywny blok będzie deklarował porty, np.:

```text
Thruster.input.throttle: 0..1
Thruster.output.effectiveThrust
RotaryMotor.input.targetSpeed
RotaryMotor.input.maxTorque
RotaryMotor.output.angle
AltitudeSensor.output.altitude
```

Blueprint będzie przechowywał konfigurację i graf w odniesieniu do `blockId`. Runtime rozwiąże `blockId -> body/part/actuator` przez mapy assembly.

## Phase 1D.3A — produkcyjny Runtime Assembly Builder

`foundation.runtime-assembly` pozostaje czystym planistą. Nowy `runtime.assembly-builder` jest warstwą wykonawczą pomiędzy planem a Physics Portem:

```text
RuntimeAssemblyPlan
        │
        ▼
runtime.assembly-builder
  ├─ create body przez Physics Port
  ├─ create colliders
  ├─ apply mass properties
  ├─ register collision listeners
  ├─ bodyById / colliderById
  ├─ colliderByBlockId / partByBlockId
  ├─ optional constraintBuilder
  └─ transactional dispose / rollback
        │
        ▼
RuntimeAssembly
```

### Granica odpowiedzialności

`game.js` może:

- wybrać contract i loaded snapshot;
- zlecić budowę assembly;
- tworzyć Three.js visuals;
- przechowywać gameplayowy stan zdrowia, paliwa i efektów;
- aplikować siły przez Physics Port.

`game.js` nie może:

- ponownie tworzyć body głównej konstrukcji;
- ponownie dodawać voxelowych colliderów statku;
- bezpośrednio zarządzać natywnym lifecycle Cannon body assembly;
- obliczać prędkości punktu przez pola natywnego backendu.

Ten inwariant jest pilnowany przez `tests/test_audit_regressions.py`.

### Transactional build

Budowa wielu body może nie udać się po utworzeniu części zasobów. Builder traktuje operację jako transakcję. Błąd collidera, brak body wskazanego przez part albo nieudany constraint powoduje:

1. usunięcie listenerów;
2. dispose zbudowanych constraintów;
3. usunięcie body ze świata w odwrotnej kolejności;
4. wyczyszczenie map runtime;
5. ponowne wyrzucenie oryginalnego błędu.

Nie wolno pozostawiać częściowo aktywnego assembly.

### Recenter contract

`recenterBody(bodyId, shift)` zakłada, że `shift` jest nowym COM wyrażonym w starej lokalnej ramie body.

Builder:

1. oblicza światową pozycję tego punktu;
2. pobiera jego prędkość przez `Physics.getPointVelocity()`;
3. przesuwa wszystkie collider offsets o `-shift`;
4. ustawia body w pozycji nowego COM;
5. ustawia liniową prędkość nowego COM.

Warstwa gameplayu przesuwa następnie lokalne pozycje części i visuals o ten sam wektor oraz stosuje nowe mass properties.

### Constraint seam

`constraintBuilder` jest celowo minimalnym punktem rozszerzenia, a nie publicznym, finalnym API jointów. Pozwala sprawdzić:

- referencje między body;
- kolejność lifecycle;
- rollback;
- mapowanie `constraintId`.

Neutralne deskryptory `hinge`, `motor`, `limit`, `friction` i `servo` zostaną zdefiniowane dopiero po 1D.3C capability spike.

## `runtime.headless-physics-backend`

Backend testowy implementuje pełny wymagany kontrakt Physics Portu dla swobodnej dynamiki:

- body i collidery jako proste obiekty JS;
- gravity;
- force i torque accumulation;
- semi-implicit integration;
- liniowe i kątowe damping;
- integrację i normalizację kwaternionu;
- local/world transforms;
- point velocity;
- explicit mass properties.

Nie implementuje broadphase, narrowphase, kontaktów ani constraints. Jest deterministycznym harness-em kontraktu, nie konkurencyjnym silnikiem gry.

## Zaktualizowane inwarianty 1D.3A–1D.3B

26. Fizyczne body i collidery głównego assembly tworzy wyłącznie `runtime.assembly-builder`.
27. Nieudana budowa assembly musi być transakcyjnie wycofana.
28. Każdy collider assembly ma stabilne `colliderId`; collider bloku funkcjonalnego mapuje się przez `blockId`.
29. Recenter nie może zachować starej prędkości liniowej body; musi zachować prędkość punktu nowego COM.
30. `getPointVelocity` należy do Physics Portu.
31. Wyniki backendu headless nie są wynikiem benchmarku Cannon i nie pozwalają podnosić limitu części.
32. Finalne API constraintów nie powstaje przed joint capability spike.

## Phase 1D.3B — real-Cannon parity i strict contracts

Prawdziwy Cannon.js 0.6.2 jest vendored w `tests/vendor/` wyłącznie jako zależność walidacyjna. Produkcyjny loader nie został przełączony na tę kopię. Główna bateria uruchamia real backend w Node i sprawdza free dynamics, rotated inertia, payload/recenter, kontakty, soak, benchmark i lifecycle.

Builder stosuje kolejność:

```text
validate whole plan
    -> allocate bodies/colliders
    -> apply mass properties
    -> register listeners
    -> add bodies to world
    -> build constraints
    -> publish frozen runtime
```

Mutacje runtime stosują zasadę **backend-first, state-second**. Nieudane usunięcie collidera nie zmienia map. Rollback zachowuje pierwotny wyjątek, a awarie cleanup umieszcza w `cleanupErrors`.

Dane na granicach `MassProperties.compute()` i `RuntimeAssembly.createPlan()` są rygorystyczne: NaN, Infinity, brak trwałego `blockId`, ujemna masa i wadliwe half-extents są błędami, nie wartościami do cichego naprawienia.

Diagonalna bezwładność jest wyrażona w lokalnej ramie body. Headless transformuje torque world -> local, stosuje `I^-1`, a następnie transformuje angular acceleration local -> world. To jest pokryte wspólnym scenariuszem z real Cannon.

## Dodatkowe inwarianty 1D.3B

33. Cały plan assembly musi przejść walidację przed pierwszą alokacją backendu.
34. Backend mutation musi zakończyć się sukcesem przed zmianą map i flag runtime.
35. Rollback nie może zastąpić pierwotnej przyczyny błędem cleanup.
36. Reserved assembly metadata wygrywa z `bodyDescriptor.userData`.
37. Zmiana masy synchronizuje typ STATIC/DYNAMIC w każdym backendzie.
38. Diagonalna inertia zawsze należy do lokalnej ramy body.
39. Test stubowy nie wystarcza do potwierdzenia semantyki adaptera; kluczowe scenariusze muszą przechodzić na real Cannon.
40. Vendored Cannon pozostaje zależnością testową z zachowaną licencją i nie może niejawnie wejść do produkcyjnego buildu.

## Następna granica — Phase 1D.3C

1. zbudować dwa body połączone realnym free hinge;
2. zmierzyć limit, tarcie, drift i zachowanie kolizji;
3. dodać powered hinge i servo tylko jako capability spike;
4. sprawdzić remove constraint/body i rollback;
5. na podstawie wyników zaprojektować minimalne neutralne Physics Port constraints;
6. następnie przejść do Per-Block Control Bus.
