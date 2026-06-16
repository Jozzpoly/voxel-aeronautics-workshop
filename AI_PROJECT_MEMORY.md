# AI Project Memory — Voxel Aeronautics Workshop

## 1. Aktualny baseline

- Faza: **Foundation Phase 1D.3E — Gate A Convergence**.
- Wersja: `0.6.4-foundation.1d3e`.
- Release ID: `foundation-1d3e-gate-a-convergence`.
- Bazowy commit, od którego wykonano pracę: `5cf38926623a17290ff2c6caad24d1c36fe77ad3` — Phase 1D.3D.
- Źródłem prawdy dostawy jest pełny ZIP źródeł, nie single HTML i nie starszy katalog z nazwą 1D.3C.
- Gate A jest zamknięty. Gate B–E pozostają niezaimplementowane.

Zawsze najpierw przeczytaj:

1. `PROJECT_VISION.md`;
2. ten plik;
3. `ARCHITECTURE.md`;
4. `ROADMAP_NEXT.md`;
5. `FOUNDATION_READINESS_REVIEW.md`;
6. `PROGRAMMABLE_MACHINE_RESEARCH.md`;
7. `FOUNDATION_CONVERGENCE_REVIEW.md`;
8. najnowszy raport fazy i ADR-y.

## 2. Główna fantazja i anti-goals

> **Buduję, programuję, testuję i pilotuję własną voxelową maszynę.**

Sandbox, ręczne sterowanie, fizyka i czytelna analiza są rdzeniem. Kontrakty i progresja są pomocą. Programowanie ma rosnąć warstwowo i nie może być warunkiem prostego lotu.

Nie wolno:

- narzucać pierwszego Core w warsztacie;
- utożsamiać `blockId` z pozycją lub indeksem;
- traktować craftu jako jednego body;
- używać natywnych Cannon handles jako publicznego API game/control;
- łączyć structural, mechanical i signal graphu;
- robić node editora przed stabilnymi endpointami i ControlRuntime;
- podnosić limitów części bez real-Cannon benchmarku;
- ukrywać błędów ownership przez fallback do primary body.

## 3. Nienaruszalny kierunek zależności

```text
CraftModel
  -> CraftCompiler
  -> CompiledCraft
  -> RuntimeAssemblyPlan
  -> AssemblyBuilder
  -> Physics Port
  -> backend
```

```text
game.js composition root
  -> FlightSession
     -> RuntimeAssembly
  -> FlightIntegrity
     -> exact body/part/collider ownership
     -> DebrisRuntime adapter
  -> MissionController / HUD / camera
     -> neutral FlightSession samples
```

`CraftModel` jest źródłem prawdy warsztatu. `CraftCompiler` jest jedyną drogą do zweryfikowanego `CompiledCraft`. `RuntimeAssemblyPlan` jest neutralny. `AssemblyBuilder` jako jedyny tworzy assembly. Physics Port jest jedyną granicą backendu.

## 4. Co dokładnie zamknięto w Gate A

### FlightSession

`src/game/flight_session.js` posiada:

- przyjęcie snapshotu lub jawnego planu;
- budowę wyłącznie przez `AssemblyBuilder.build`;
- publikację jednego `RuntimeAssembly` jako źródła prawdy;
- deterministyczną primary-body policy: explicit → `rootBodyId` → root role → sort ID;
- neutralne transformy, velocities, frame conversion, point velocity, force i torque;
- lookup part/collider ownership;
- visual root per `bodyId`;
- transient cleanup;
- idempotent stop;
- zachowanie retry handles po częściowym cleanupie;
- start → stop → start bez dziedziczenia assembly.

`STATE.flight.body`, `primaryBody`, `assemblyRuntime` i `group` pozostają wyłącznie opisanymi compatibility aliases. Żaden aktywny game module nie czyta `STATE.flight.body`.

### FlightIntegrity

`src/game/flight_integrity.js` posiada:

- health i damage;
- exact part → body i collider → body lookup;
- backend-first collider removal;
- detach i disconnected-component detection;
- payload damage/detach;
- per-body mass properties oraz recenter;
- map cleanup;
- debris create/update/dispose lifecycle;
- izolację błędów prezentacyjnych hooków od transakcji integralności.

Destrukcyjny detach jest obecnie ograniczony kontraktem `primary-rigid-island-only`. Próba użycia go dla innego body jest błędem, nigdy fallbackiem.

### Visuals, mission, HUD, camera

- Każde body ma osobny root w `visualRootByBodyId`.
- Część zna `bodyId` i trafia do właściwego rootu.
- Synchronizacja iteruje po body niezależnie.
- Primary body jest jawnie wybierane dla HUD, camera i mission sample.
- Landing evaluator uwzględnia części i payload należące do primary body.
- `fullscreenchange` nie niszczy sesji; aktywny `pagehide` zamyka lot i wraca do spójnego BUILD state.

### Cleanup

Wymagana kolejność:

```text
constraint
-> collision listener / collider
-> body
-> visual root
-> published state clear
```

Nie czyść map i aliases przed potwierdzeniem backendowego usunięcia. Błąd cleanupu zachowuje uchwyty i `cleanupPending`; następne `stop()` ma móc dokończyć pracę.

## 5. Neutralne API dodane wyłącznie dla realnych potrzeb

Physics Port/backends:

- `getBodyTransform`;
- `getBodyLinearVelocity`;
- `getBodyAngularVelocity`;
- `pointToLocalFrame`.

RuntimeAssembly:

- deterministyczne `getBodyIds`;
- body plan/transform/velocity queries;
- set/clear motion;
- local/world vector i point conversion;
- point velocity;
- force/torque;
- exact part/collider ownership;
- per-body recenter i mass properties.

Nie rozszerzaj portu spekulacyjnie.

## 6. Stan fizyki

- Produkcyjny backend: Cannon.js 0.6.2 przez `runtime.cannon-physics-backend`.
- Deterministyczny harness: `runtime.headless-physics-backend`.
- Hinge-only contract: free, motor, servo, friction, soft limits, `collideConnected`.
- Soft limits nie są natywnym asymetrycznym hard stopem.
- Solver handles pozostają wewnątrz adaptera/runtime assembly.
- Real-Cannon soak: 12 000 kroków.
- Limit lotu pozostaje 480 części; blueprint max 2500 nie jest automatycznie bezpiecznym limitem lotu.

## 7. Stan schematu

- Blueprint/save version: v10.
- `blockId` jest trwały przy move; copy tworzy nowy ID.
- Nie ma jeszcze produkcyjnego mechanical-link authoringu.
- Nie podnoś do blueprint v11 bez schema review, migracji i ADR.

## 8. Następna bramka: Phase 1D.4A

Gate B wymaga najpierw ADR dla:

- mechanical link schema;
- przecięcia structural edges przez joint;
- stabilnego `bodyId` i `constraintId` niezależnego od input order;
- endpointów jointu;
- rigid bypass diagnostics;
- move/copy/delete semantics;
- migracji v10 → v11, jeżeli potrzebna.

Następnie pure compilers:

```text
CraftCompiler
  -> StructuralGraphCompiler
  -> RigidIslandCompiler
  -> MechanicalGraphCompiler
  -> CompiledCraft / RuntimeAssemblyPlan
```

Normalny gameplay vertical slice ma przejść całą ścieżkę. Nie wolno ręcznie składać drugiego body w `game.js`.

## 9. Dalsza kolejność

- Gate C: Assembly Space / Sublevel Foundation.
- Gate D: Device Catalog & Typed Ports `{blockId, portId}`.
- Gate E: deterministic headless `ControlRuntime` na fixed tick.
- Dopiero później minimalny Phase 1E device binding UI.

Nie implementować równolegle Gate B–E.

## 10. Walidacja i dostawa

Po zmianach uruchom:

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

Dla delivery zbuduj ZIP, single HTML, patch, raporty i SHA256. Rozpakuj ZIP do nowego katalogu, uruchom testy na nim, zastosuj patch do czystego baseline’u i sprawdź source parity oraz deterministic rebuild.

Najważniejsze dokumenty: `PROJECT_VISION.md`, `FOUNDATION_READINESS_REVIEW.md`, `PROGRAMMABLE_MACHINE_RESEARCH.md`.
