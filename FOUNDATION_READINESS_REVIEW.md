# Przekrojowy review gotowości fundamentu — po Phase 1D.3C

## Decyzja wykonawcza

VAW **nie potrzebuje kolejnego restartu**. Projekt posiada już wiarygodny fundament pod długowieczny browserowy sandbox inżynieryjny:

- autorytatywny model edytora;
- wersjonowane migracje blueprintów;
- trwałą tożsamość bloków;
- deterministyczną granicę kompilatora;
- neutralny `RuntimeAssemblyPlan`;
- Physics Port i dwa uczciwie opisane backendy;
- jawne mass properties;
- automatyczną walidację prawdziwego Cannona;
- modularny game shell;
- deterministyczny ZIP/single HTML z source parity;
- pierwszy rzeczywisty kontrakt wielobryłowego hinge.

Fundament **nie jest jeszcze gotowy na finalny UI kabli i programowania**. Rozpoczęcie go teraz związałoby signal system z single-body flight state oraz nieukończoną definicją urządzenia, endpointu i sublevelu. Następna praca musi domknąć ownership assembly, kompilację rigid islands, typed ports i deterministyczny Control Runtime.

## Zakres audytu

Review objęło:

- cały aktualny tree źródłowy i kanoniczny manifest kolejności;
- `AI_PROJECT_MEMORY.md`, architekturę, roadmapę, ADR-y, raporty faz, testy, walidację i workflow dostawy;
- `game.js` i wszystkie wydzielone moduły `game.*`;
- blueprint, CraftModel, compiler, runtime assembly, mass properties, Physics Port, oba backendy i AssemblyBuilder;
- pełny diff 1D.3C oraz wszystkie nowe testy;
- historię repo od Foundation 1B do 1D.3B.1;
- wcześniejszy feedback użytkownika dotyczący dowolnego pierwszego bloku, ruchomego Core, sześciu osi, passive/pilot thrust, elastycznego UI i pełnych ZIP-ów;
- kierunek „buduj, programuj, testuj i lataj” zapisany w `PROJECT_VISION.md`;
- rozwiązania Sable/Create Aeronautics, VS2/Clockwork i Factorio jako materiał porównawczy, nie wzorzec do bezpośredniego kopiowania.

## Najważniejszy wniosek produktowy

VAW powinno być **zabawką inżynieryjną przed grą checklistową**. Dobry system programowania nie może pogorszyć prostego ręcznego budowania i latania. Jednocześnie domyślny mikser nie może pozostać na zawsze specjalnym wyjątkiem zaszytym w fizyce.

Docelowa ścieżka gracza:

```text
domyślne sterowanie
-> bezpośrednie przypisanie akcji
-> grupy i parametry
-> widoczny graf logiczny
-> sensory / pamięć / PID
-> dopiero później bezpieczne skrypty
```

## Scorecard architektury

### Domena i edytor — mocne

**Mocne strony**

- `CraftModel` jest autorytatywny i niezależny od renderera;
- stan roboczy może być pusty, bez Core albo odłączony;
- gotowość do lotu jest odpowiedzialnością kompilatora;
- operacje wieloblokowe i historia są atomowe oraz ograniczone;
- `blockId` przeżywa ruch i nie zależy od współrzędnych;
- zapisy v3–v10 migrują do kanonicznego dokumentu.

**Ryzyko przed v11**

- konfiguracja urządzeń nie ma jeszcze ogólnego, wersjonowanego modelu;
- mechanical/signal links nie mają zapisywanej tożsamości, migracji ani semantyki copy/move/delete.

### Kompilator — mocny dla jednej wyspy, nieukończony dla mechanizmów

**Mocne strony**

- deterministyczny `CompiledCraft`, cache i diagnostyka;
- twardy limit pracy `GRID.maxBlocks`;
- wspólna implementacja mass properties dla analizy i runtime;
- compiled snapshot jest ścisłą granicą.

**Blokująca luka**

- gameplay compiler nadal wymaga jednej połączonej wyspy i emituje jedno body;
- nie istnieją joint-cut semantics, rigid-island partition, mechanical graph compiler ani rigid-bypass diagnostic;
- hand-authored hinge działa, lecz blueprint nie potrafi jeszcze go wygenerować.

### Runtime assembly i fizyka — solidny fundament

**Mocne strony**

- rozdzielone odpowiedzialności planner/builder/Physics Port/backend;
- walidacja przed alokacją i transactional rollback;
- stabilne mapy body/collider/part/constraint;
- mass properties i recenter kinematics przechodzą jawnie przez port;
- real Cannon i headless harness nie udają tych samych capability;
- lifecycle constraintów jest backend-first, retry-safe i constraint-before-body;
- motor, servo, friction, collision policy oraz długi soak zostały zmierzone.

**Ryzyka**

- limity hinge w Cannonie 0.6.2 są miękkim kontrolerem, nie hard stopem;
- angle unwrapping zakłada zmianę mniejszą niż π między próbkami;
- diagonal inertia nie jest docelowym pełnym tensorem;
- jeden collider na voxel pozostaje kosztowny;
- benchmark nie obejmuje jeszcze ciężkiej articulated/contact scene.

### Game shell — duży postęp, nadal główne źródło coupling

**Mocne strony**

- `game.js` zmniejszył się z 4697 do 2358 linii;
- dziewięć modułów ma jawne composition i lifecycle APIs;
- prywatne timery nie wyciekają do entrypointu;
- testy pilnują kolejności, ownership, rozmiaru i granic fizyki.

**Zmierzony coupling**

- `STATE.flight.*` występuje setki razy;
- `STATE.flight.body` nadal jest faktycznym globalnym rootem;
- ponad trzydzieści pól flight state współdzielą fizyka, damage, misje, HUD i rendering;
- `mission_controller.js` i `engineering_analysis.js` nadal są duże oraz silnie DOM-dependent.

**Decyzja**

- kolejna ekstrakcja musi używać całego `RuntimeAssembly` jako publicznej jednostki;
- nie wolno projektować `FlightSession` wokół pojedynczego Cannon body;
- porządki HUD/misji są drugorzędne wobec prawidłowego ownership lotu.

### Input i manual control — mocna warstwa preferencji, brak warstwy maszyny

**Mocne strony**

- semantyczne sześć osi;
- wersjonowane, rebindable physical keys;
- Flight Focus dla ograniczeń platformy;
- poprawne oddzielenie passive thrust od pilot authority;
- orientowany Core wyznacza control frame.

**Nienaruszalne rozróżnienie**

- `InputProfile` to preferencja użytkownika: klawiatura/gamepad → semantyczna akcja;
- `controlBindings` to dane maszyny: akcja/źródło → port urządzenia.

Tych formatów nie wolno scalać. Ten sam craft może być używany przez różne profile gracza, a jego nazwane akcje nie powinny zależeć od kodów klawiszy.

### Persistence — dobra baza, duża decyzja schema przed nami

Przed blueprint v11 należy zdefiniować:

- stabilne `nodeId`, `linkId`, `constraintId` i endpoint `{blockId, portId}`;
- copy/move/delete semantics;
- diagnostykę dangling links;
- limity wielkości i budżetu grafu;
- migracje oraz fuzz dla uszkodzonych/oversized dokumentów;
- zakaz wykonywalnego JavaScriptu w save.

### Testy i wydanie — wyjątkowo mocne jak na skalę projektu

**Mocne strony**

- jedna komenda uruchamia syntax, domenę, real solver, soak, benchmark, lifecycle, UI/static architecture i release tests;
- vendored Cannon usuwa zależność walidacji od CDN;
- deterministic single HTML i ZIP mają source parity;
- workflow patch/ZIP był weryfikowany na czystej bazie;
- startup smoke obejmuje również `pagehide` i `fullscreenchange`.

**Błąd znaleziony i zamknięty w finalnym review**

- package/build/manifest wskazywały 1D.3C, a runtime config i branding HTML nadal 1D.3B.1;
- dodano test jednej wersji i release ID dla całego projektu.

**Pozostałe luki**

- brak prawdziwego browser/WebGL CI;
- startup smoke korzysta ze stubów bibliotek;
- brak property/fuzz tests dla przyszłych grafów;
- performance values są diagnostyczne, nie twardym progiem cross-machine.

## Znaleziska według priorytetu

### P0 — release blocker

Po poprawkach lifecycle i release identity nie znaleziono nierozwiązanego P0.

### P1 — obowiązkowe przed graczowymi sublevelami/control busem

1. **Single-body flight ownership** — `STATE.flight.body` pozostaje globalnym rootem.
2. **Brak rigid-island compiler** — blueprint nie może wygenerować gameplayowego constraintu.
3. **Brak kanonicznego endpoint schema** — signal links miałyby niestabilną semantykę.
4. **Brak deterministycznego evaluator** — ordering, feedback i stateful nodes są niezdefiniowane.
5. **Brak assembly-aware integrity** — detach/damage/recenter rozumują głównie o root body.
6. **Brak persistence contract linków** — kable/wireless groziłyby byciem wyłącznie stanem UI.

### P2 — ważne podczas domykania fundamentu

1. duże i DOM-heavy `mission_controller` oraz `engineering_analysis`;
2. `foundation.state` nadal tworzy wartości Three.js;
3. produkcyjne biblioteki z CDN;
4. brak automated browser/GPU CI;
5. one-collider-per-voxel;
6. brak contact/constraint solvera w headless;
7. payload jest mission-injected zamiast urządzenia gracza;
8. eksperymentalny `constraintBuilder` jest tylko best-effort, bo zewnętrzny builder może alokować przed wyjątkiem.

### P3 — późniejsza jakość i skala

- pełny tensor bezwładności;
- zaawansowana aerodynamika/crossflow;
- duża kampania;
- multiplayer i authority model;
- bezpieczne skrypty użytkownika;
- kolejne typy jointów.

## Warstwy wymagane przed Phase 1E

```text
Authoring
  Blueprint + stable identities

Compilation
  structural graph
  -> rigid islands / assembly spaces
  -> mechanical graph
  -> device endpoints
  -> signal graph
  -> diagnostics

Runtime
  RuntimeAssembly
  ControlRuntime fixed tick
  actuator command adapters
  Physics Port

Presentation
  workshop editors
  cables / wireless visuals
  scopes / diagnostics
  HUD
```

Nie wolno scalać pytań:

- structural graph: które voxele są jedną sztywną bryłą;
- mechanical graph: jak body poruszają się względem siebie;
- signal graph: który endpoint zasila który endpoint;
- control bindings: która akcja lub controller source wchodzi do grafu;
- cable/wireless: czy i jak transport jest dostępny.

## Bramki roadmapy

### Gate A — 1D.3D Assembly-Centric Flight Lifecycle

Warunki wyjścia:

- `FlightSession` posiada launch, assembly, world registration i cleanup;
- root body jest query, nie współdzielonym mutable storage;
- powtarzany multi-body start/stop nie zostawia constraintów, body ani listenerów;
- integrity operations otrzymują jawny assembly/body ownership;
- composition root tylko routuje i komponuje.

### Gate B — 1D.4A Rigid Islands & Mechanical Compilation

- joint przecina rigid connectivity;
- każda wyspa ma deterministyczne `bodyId`;
- każdy mechanical link ma stabilne `constraintId`;
- rigid bypass jest diagnozowany;
- invalid loops/anchors/axes zwracają użyteczne błędy;
- normalny gameplay uruchamia craft z dwoma body.

### Gate C — 1D.4B Assembly Space / Sublevel Foundation

- jawny local/world transform;
- urządzenia rozwiązują się do właściwej wyspy/body;
- split, detach i dock mają zdefiniowany ownership;
- identity interakcji nie zależy od world pose;
- nie powstaje drugi blueprint source of truth.

### Gate D — 1D.4C Device & Port Schema

- catalog deklaruje pure-data typed ports;
- endpoint to `{blockId, portId}`;
- missing/damaged/detached behavior jest zdefiniowany;
- Core/default mixer, thruster, gyro i hinge actuator nie wymagają specjalnej logiki fizyki;
- copy/move/delete/migration są przetestowane.

### Gate E — 1D.4D Deterministic Control Kernel

- fixed tick niezależny od renderingu;
- bounded nodes/links/work;
- deterministyczna kolejność;
- jawne Delay/Memory dla cykli;
- scalar i boolean/event policies;
- brak arbitralnego JS w saves;
- headless tests grafów i actuator commands.

Dopiero po tych bramkach Phase 1E powinno wystawić finalny per-block editor, direct bindings, groups, kable lub wireless.

## Wnioski z projektów porównawczych

### Sable / Create Aeronautics

Najważniejsza lekcja: moving-space infrastructure jest osobna od contentu pojazdów. VAW powinno mieć stabilną przestrzeń assembly i identity interakcji, ale nie naśladować intruzywnych technik integracji Minecrafta.

### VS2 / Clockwork

Najważniejsza lekcja: urządzenie udostępnia typowane komendy i telemetry, a controller rozumie bezwładność. Ostrzeżenie: restore/joint lifecycle staje się bardzo skomplikowany, gdy jeden obiekt posiada persistence, solver, UI, assembly i recovery.

### Factorio

Najważniejsza lekcja: topologia, kanały, logika i debugging są jawne. Wireless jest innym transportem, nie innym znaczeniem sygnału.

### Stormworks i Space Engineers

Najważniejsza lekcja: gracz potrzebuje kilku poziomów złożoności. Proste akcje i grupy muszą działać bez skryptowania; wizualny graf i programowalne bloki są kolejnymi poziomami, nie pierwszym ekranem.

## Ostateczny werdykt

Projekt jest gotowy do dalszego rozwoju bez restartu, a hinge boundary 1D.3C jest wystarczająco solidny, aby go zachować. Następnym milestone'em nie powinno być wizualne układanie kabli ani szeroki content pass. Poprawna kolejność to:

```text
assembly-centric flight ownership
-> rigid/mechanical compilation
-> assembly-space identity
-> typed ports
-> deterministic control kernel
-> dopiero finalny control UX i transport sygnałów
```

Taka kolejność chroni właściwą duszę VAW: **buduj, programuj, lataj, rozumiej i przebudowuj**, zamiast doklejać node editor do prototypu o jednym body.
