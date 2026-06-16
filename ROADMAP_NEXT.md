# Roadmap po Foundation Phase 1D.3C

## Kierunek produktu

```text
buduj -> steruj ręcznie lub programuj -> obserwuj fizykę -> przebuduj
```

VAW jest sandboxem konstrukcyjno-programistycznym. Kontrakty uczą i inspirują, lecz ręczne latanie i swobodne eksperymenty pozostają pełnoprawnym rdzeniem.

## Ukończone — Phase 1D.3C

- minimalny hinge-only kontrakt Physics Portu;
- prawdziwe dwa body z osobnymi mass properties;
- capability negotiation backendu;
- free hinge, motor, servo, pasywne tarcie i miękkie limity;
- jawne `collideConnected`;
- stabilne `constraintById` i oddzielny mutable control command;
- preflight osi, pivotów i world membership;
- constraint-before-body lifecycle;
- retry-safe `removeConstraint()` i pełne `RuntimeAssembly.dispose()`;
- 12 000 kroków joint soak;
- automatyczna zgodność wersji package/build/manifest/runtime;
- pełny foundation readiness review i research kierunku programowalnych maszyn.

## Phase 1D.3D — Assembly-Centric Flight Lifecycle

Cel: usunąć ostatnie istotne założenie `craft = STATE.flight.body`.

1. `game.flight-session` przejmuje launch/stop, `RuntimeAssembly`, rejestrację w świecie, listenery i cleanup.
2. Root body jest zapytaniem do assembly, nie równoległym źródłem prawdy.
3. `game.flight-integrity` przejmuje damage, detach, payload, recenter i debris z jawnym body ownership.
4. Testy obejmują powtarzane workshop -> multi-body flight -> workshop oraz transient cleanup failure.
5. Composition root pozostaje routingiem i kompozycją.

## Phase 1D.4A — Rigid Islands & Mechanical Graph Compiler

1. Joint przecina rigid connectivity.
2. Każda wyspa dostaje deterministyczne `bodyId`.
3. Mechanical links dostają stabilne `constraintId`.
4. Kompilator wykrywa rigid bypass, brakujące endpointy, niewłaściwe osie/pivoty i niedozwolone połączenia.
5. Normalny gameplay path uruchamia pierwszy dwubryłowy craft.

## Phase 1D.4B — Assembly Space / Sublevel Foundation

1. Jawna przestrzeń lokalna assembly i transform world/local.
2. Stabilne mapowanie block/device -> rigid island/body.
3. Reguły split, detach, dock i ownership.
4. Interakcja i sygnały zachowują tożsamość niezależnie od world pose.
5. Blueprint pozostaje jedynym źródłem prawdy; sublevel nie jest drugim dokumentem konstrukcji.

## Phase 1D.4C — Device Catalog & Typed Ports

- endpoint `{ blockId, portId }`;
- pure-data deklaracje input/output;
- początkowo scalar oraz boolean/event;
- jawne jednostki, zakresy i wartości domyślne;
- diagnostyka missing/damaged/detached endpoint;
- przetestowane move/copy/delete/migration.

## Phase 1D.4D — Deterministic Control Runtime

- fixed control tick niezależny od FPS;
- bounded graph budget;
- deterministyczna kolejność;
- jawne Delay/Memory dla feedbacku;
- headless evaluation;
- actuator commands przez publiczne RuntimeAssembly API;
- brak arbitralnego JavaScriptu w zapisach.

## Phase 1E — Per-Block Control Bus

Pierwszy gameplayowy UX:

- wybór konkretnego urządzenia i jego portów;
- `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min, max;
- named craft actions oddzielone od fizycznych klawiszy użytkownika;
- zapis i migracja konfiguracji;
- live values, diagnostyka i scope;
- najpierw direct/internal links, później fizyczne kable, bus i wireless jako transport tej samej semantyki.

## Phase 1E.1 — Sensors, Logic & Scope

Sensory: altitude, vertical speed, orientation, angular velocity, fuel, health, joint state i actuator output.

Węzły: Constant, Add/Subtract, Multiply, Clamp, Compare/Switch, Delay/Memory, Integrator i PID.

## Phase 1F — Player-Facing Articulated Machines

- Free Bearing;
- Rotary Motor;
- Servo Bearing;
- joint pass-through dla sygnałów;
- damage/detach mechanizmów;
- mechaniczne limity i tuning pod realne konstrukcje.

## Collider Compiler

Limit lotu 480 części pozostaje. Benchmark 2500 colliderów i joint soak nie obejmują ciężkich scen wielokontaktowych. Przed podniesieniem limitu potrzebny jest greedy merge prototype oraz articulated/contact benchmark.

## Świadomie później

- kolejne joint types;
- natywne hard stops lub zmiana backendu;
- pełny tensor 3x3;
- zaawansowana aerodynamika;
- skrypty użytkownika;
- multiplayer i authority model;
- duża kampania.


## Phase 1D.3D — Assembly-Centric Flight Lifecycle
Runtime flight state now treats RuntimeAssembly as the authoritative launched vehicle. `primaryBody` is explicit; `STATE.flight.body` remains only a compatibility alias for the current single-rigid-island craft. New `game.flight-session` and `game.flight-integrity` seams document and test the lifecycle/integrity boundary for the future Rigid Island Compiler.
