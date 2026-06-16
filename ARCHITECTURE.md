# Architektura — Foundation Phase 1D.3E

## 1. Status

Phase 1D.3E zamyka **Gate A — Single-body flight ownership / assembly-centric lifecycle**. Runtime może już poprawnie posiadać 0, 1, 2 lub wiele body na poziomie planu/buildera/lifecycle, choć produkcyjny `CraftCompiler` nadal emituje jedną rigid island. Następną bramką jest **Phase 1D.4A — Rigid Islands & Mechanical Graph Compiler**.

Historyczne raporty 1D.3A–1D.3D pozostają historią. Nie są kanonicznym opisem bieżącego ownership.

## 2. Warstwy i kierunek zależności

```text
foundation domain
  CraftModel
  Blueprint / migration
  Catalog / Orientation / ControlFrame
  MassProperties

compilation
  CraftCompiler
  CompiledCraft
  RuntimeAssembly.createPlan

runtime construction
  AssemblyBuilder
  RuntimeAssembly instance
  Physics Port
  Cannon or headless backend

game application
  game.js (composition only)
  FlightSession
  FlightIntegrity
  DebrisRuntime
  MissionController
  presentation/services
```

Zależności płyną w dół. Foundation nie zna DOM, Three ani Cannon. Game modules nie czytają `window.VAW_RUNTIME`; zależności dostają jawnie z composition rootu albo przez modułowy registry.

## 3. Workshop source of truth

`CraftModel` posiada:

- części;
- trwałe `blockId`;
- pozycję, typ, orientację i ustawienia części;
- atomic transactions;
- readiness diagnostics;
- dokument blueprintu.

`gridKey` jest indeksem przestrzennym, nie tożsamością. Move zachowuje `blockId`; copy tworzy nowy. Renderer workshopu jest projection modelu.

## 4. Compilation boundary

`CraftCompiler.compile(CraftModel)` jest jedyną drogą do `CompiledCraft`.

Bieżący compiler:

- waliduje craft;
- daje deterministyczne parts i signature;
- oblicza control frame oraz analizy potrzebne single-body gameplay;
- nadal nie dzieli konstrukcji na rigid islands.

`RuntimeAssembly.createPlan(snapshot)` tworzy neutralny plan V1. Obecnie plan produkcyjny ma jedną rigid body, ale kontrakt buildera i test fixtures obsługują wiele body, constraints i signal-links slot.

## 5. RuntimeAssembly jako źródło prawdy lotu

Aktywna sesja ma dokładnie jedno `RuntimeAssembly`.

```text
FlightSession.start
  -> RuntimeAssemblyPlan
  -> AssemblyBuilder.build
  -> RuntimeAssembly
  -> publish state.flight.assembly
```

Nie istnieje drugi niezależny `bodyById` w game shellu. `primaryBodyId` jest polityką/query, nie drugim pojazdem.

Deprecated aliases `STATE.flight.body`, `primaryBody`, `assemblyRuntime` i `group` mogą wskazywać ten sam runtime/primary root dla kompatybilności, lecz nie są czytane przez nowe moduły i nie mogą być źródłem prawdy.

## 6. Primary body policy

Kolejność wyboru:

1. jawnie requested `primaryBodyId`;
2. `plan.rootBodyId`;
3. najmniejszy stabilnie sortowany body z `role === "root"`;
4. najmniejszy stabilnie sortowany `bodyId`.

Polityka nie zależy od indeksu tablicy. Mission, HUD i camera pobierają próbkę wyłącznie przez `FlightSession`.

## 7. Physics Port

Physics Port jest neutralną granicą backendu. Publiczny game/control layer nie otrzymuje solver handles.

Podstawowy kontrakt obejmuje:

- world/body/collider lifecycle;
- neutralne transformy i velocities;
- mass properties;
- force/torque;
- local/world vector i point conversion;
- point velocity;
- collision events;
- hinge lifecycle/control/state.

Nowe metody 1D.3E zostały dodane dla konkretnych callsites: `getBodyTransform`, `getBodyLinearVelocity`, `getBodyAngularVelocity`, `pointToLocalFrame`.

## 8. AssemblyBuilder i RuntimeAssembly

`AssemblyBuilder`:

- waliduje cały plan przed allocation;
- tworzy body i collidery;
- ustawia jawne mass properties;
- rejestruje collision listeners;
- tworzy constraints;
- zwraca immutable publiczny runtime wrapper;
- zachowuje pierwotny build error, a cleanup errors raportuje osobno.

RuntimeAssembly udostępnia neutralne:

- `getBodyIds()` w stabilnej kolejności;
- body descriptor/transform/velocity;
- frame conversion i point velocity;
- apply force/torque;
- ownership lookup part/collider;
- collider removal;
- per-body recenter/mass update;
- constraint commands/state;
- retry-safe dispose.

### Cleanup

```text
constraints
-> collision listeners
-> colliders
-> bodies
-> FlightSession transients
-> per-body visual roots
-> published state
```

Backend mutation następuje przed usunięciem mapy. `disposed=true` dopiero po pełnym cleanupie. Przy błędzie maps/handles pozostają dostępne do kolejnego `dispose()`.

## 9. FlightSession

`game.flight-session` posiada pełny lifecycle sesji:

- plan/build;
- primary selection;
- collision normalization;
- neutralne body access;
- transient resources;
- visual roots;
- sync;
- stop/cleanup/retry.

`game.js` wywołuje `flightSession.start()` i tworzy prezentację. Nie wywołuje `AssemblyBuilder.build()`.

## 10. Visual ownership per body

`visualRootByBodyId: Map<bodyId, root>` jest kanonicznym ownershipem wizuali lotu.

Każda runtime part ma `bodyId` i lokalną pozycję względem właściwego body. `FlightSession.syncVisuals()` ustawia transform każdego rootu oddzielnie. Obrót jednego body nie może poruszyć drugiego rootu.

Visual root jest rejestrowany w sesji przed dodaniem do sceny, dzięki czemu wyjątek inicjalizacji ma atomowy rollback. Cleanup usuwa każdy root dokładnie raz.

## 11. FlightIntegrity

`game.flight-integrity` jest granicą integralności:

- exact body ownership;
- part health i damage;
- backend-first collider removal;
- primary-island detach i cascade;
- payload lifecycle;
- per-body mass properties/recenter;
- debris lifecycle;
- cleanup map.

Nie ma fallbacku „brak body → primary body”. Ownership mismatch jest błędem.

Bieżące ograniczenie:

```text
bodyRestriction = primary-rigid-island-only
```

Dotyczy gameplayowego detach. Jest publiczne, testowane i ma zostać usunięte dopiero przy split assembly w późniejszej bramce.

Prezentacyjne hooki są best-effort i nie mogą przerwać już zatwierdzonej transakcji integrity. Ich błędy trafiają do diagnostyki.

## 12. DebrisRuntime

`game.debris-runtime` jest adapterem fizyczno-wizualnym odłamków. `FlightIntegrity` decyduje o create/update/dispose i przechowuje ownership listy; adapter wykonuje neutralne Physics Port calls oraz scene sync.

Adapter zapewnia:

- rollback body, gdy późniejsza rejestracja sceny zawiedzie;
- neutralny `getBodyTransform` przy synchronizacji;
- staged retry-safe dispose body/visual;
- brak natywnych body fields w composition root.

## 13. Mission, HUD i camera

Mission sample ma znaczenie **primary body sample**:

- transform;
- linear/angular velocity;
- części i payload należące do primary body;
- jawny landing clearance.

HUD może pokazywać dane assembly oraz primary body, lecz nie może udawać, że jedna transformacja opisuje cały articulated craft. Kamera zawsze śledzi jawne primary body.

## 14. Lifecycle aplikacji

- `fullscreenchange` czyści input focus bez zastępowania aktywnej sesji.
- `pagehide` zapisuje stan i, gdy trwa lot, przechodzi przez normalny `setMode('BUILD')` oraz cleanup.
- `start → stop → start` nie dziedziczy listenerów, bodies, colliders, visuals, payloadu ani debris.
- build wizuali po udanym runtime allocation jest objęty rollbackiem.

## 15. Mechanical graph i przyszłe warstwy

Planowana ścieżka:

```text
Blueprint
  -> StructuralGraphCompiler
  -> RigidIslandCompiler
  -> MechanicalGraphCompiler
  -> RuntimeAssemblyPlan
  -> AssemblyBuilder
```

Później:

```text
assembly spaces
-> device endpoints {blockId, portId}
-> signal graph
-> deterministic ControlRuntime
-> actuator commands przez RuntimeAssembly
```

Structural, mechanical i signal graph pozostają rozdzielone. Joint nie jest portem sygnałowym. Motor/servo command nie jest stałą geometrią mechanical graphu.

## 16. Świadomie niezaimplementowane

- mechanical authoring schema i blueprint v11;
- RigidIslandCompiler/MechanicalGraphCompiler;
- gameplayowy two-body craft z normalnego blueprintu;
- split na subassemblies;
- assembly spaces/sublevels;
- typed ports;
- fixed-tick ControlRuntime;
- node editor, cables, bus, wireless;
- multiplayer.
