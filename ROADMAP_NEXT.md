# Roadmap po Foundation Phase 1D.3E

Roadmap jest sekwencją bramek zależności. Nie jest listą równoległych feature’ów.

## Ukończone — Gate A / Phase 1D.3E

### Single-body flight ownership / assembly-centric lifecycle

Warunki wyjścia spełnione:

- `FlightSession` posiada build, lifecycle i cleanup;
- `RuntimeAssembly` jest jedynym źródłem prawdy lotu;
- primary body jest deterministyczną polityką;
- integrity ma exact ownership;
- visuals są per body;
- mission/HUD/camera korzystają z neutralnych próbek;
- constraints/listeners/colliders/bodies/visuals mają jawny porządek cleanupu;
- cleanup jest idempotentny i retry-safe;
- repeated lifecycle oraz aktywny `pagehide` są testowane;
- game shell nie buduje assembly i debris bezpośrednio.

Świadome ograniczenie `primary-rigid-island-only` nie blokuje Gate A, ponieważ normalny compiler emituje dziś jedną wyspę, a błędne użycie dla innego body jest jawnie odrzucane.

---

## Gate B — Phase 1D.4A: Rigid Islands & Mechanical Graph Compiler

**Status: następna bramka; nie rozpoczęta w 1D.3E.**

### B0. ADR i schema review

Przed kodem produkcyjnym ustalić:

- authoring mechanical links;
- structural edge cut semantics;
- endpoint identity;
- stabilne `bodyId` i `constraintId`;
- rigid bypass;
- move/copy/delete;
- blueprint v11 i migrację albo uzasadnienie pozostania przy v10;
- diagnostyki invalid topology.

### B1. Pure compilers

```text
CraftCompiler
  -> StructuralGraphCompiler
  -> RigidIslandCompiler
  -> MechanicalGraphCompiler
  -> CompiledCraft / RuntimeAssemblyPlan
```

Wymagania:

- deterministyczne wyspy niezależne od kolejności wejścia;
- joint przecina rigid connectivity;
- per-island mass properties/COM;
- stabilne IDs;
- walidacja axes/pivots przed allocation;
- missing/duplicate endpoints i rigid bypass diagnostics;
- mechanical cycles oceniane według kontraktu, nie automatycznie odrzucane.

### B2. Najwęższy gameplay vertical slice

Normalny blueprint przechodzi:

```text
CraftModel -> CraftCompiler -> RuntimeAssemblyPlan -> AssemblyBuilder
```

i tworzy co najmniej dwa body oraz hinge bez specjalnego kodu w `game.js`.

### B3. Exit criteria

- gameplay compilation generuje multi-body plan;
- real Cannon hinge działa;
- visual roots i mission sample pozostają poprawne;
- rollback i cleanup są atomowe;
- brak ręcznej rekonstrukcji assembly w game shellu.

---

## Gate C — Phase 1D.4B: Assembly Space / Sublevel Foundation

**Status: zablokowany przez Gate B.**

Zakres:

- stabilny `assemblySpaceId`;
- local-to-world/world-to-local;
- block/device → rigid island/body mapping;
- ownership przy split/detach i przyszłym dock;
- visual roots związane z body/space;
- blueprint pozostaje jedynym source of truth;
- sublevel jest compiled/runtime view.

Bez chodzenia po statku i bez pełnego dockingu.

---

## Gate D — Phase 1D.4C: Device Catalog & Typed Ports

**Status: zablokowany przez Gate C.**

Zakres minimalny:

- endpoint `{blockId, portId}`;
- scalar oraz boolean/event;
- direction, units, range, default, update semantics;
- Core/default mixer, thruster, telemetry i potrzebny actuator;
- missing/damaged/detached endpoint behavior;
- migracje/copy/move/delete;
- `InputProfile` oddzielony od craft `controlBindings`.

Bez cables/bus/wireless.

---

## Gate E — Phase 1D.4D: Deterministic Control Runtime

**Status: zablokowany przez Gate D.**

Zakres:

- fixed control tick niezależny od FPS;
- stabilna kolejność;
- nodes/links/work budgets;
- scalar i boolean/event;
- Delay/Memory dla feedbacku;
- algebraic cycle rejection;
- evaluate, potem apply command batch;
- actuator command przez RuntimeAssembly;
- headless-first diagnostics i snapshots;
- brak DOM/renderera/arbitralnego JS.

---

## Opcjonalny Phase 1E vertical slice

Dopiero po pełnym A–E:

- wybór urządzenia;
- Default mixer / Direct signal / Disabled;
- gain/invert/trim/min/max;
- named craft action oddzielona od klawisza;
- live value i podstawowa diagnostyka.

Nie implementować jeszcze finalnego node editora, kabli, wireless, PID UX, skryptowania ani multiplayera.
