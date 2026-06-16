# Foundation Readiness Review — po Phase 1D.3E

## Executive verdict

**Gate A jest zamknięty. Gate B–E nie są rozpoczęte.**

Projekt nie wymaga restartu lifecycle. Można bezpiecznie przejść do schema-first Rigid Islands & Mechanical Compilation, pod warunkiem zachowania istniejących granic.

## P1 — Single-body flight ownership

**Status: RESOLVED w Phase 1D.3E.**

Poprzedni stan 1D.3D posiadał małe seamy, lecz `game.js` nadal budował assembly, posiadał damage/recenter i globalny visual root. Obecny stan:

- `FlightSession` jako jedyny callsite produkcyjny `AssemblyBuilder.build`;
- jeden kanoniczny `state.flight.assembly`;
- deterministic primary-body policy;
- neutralne body queries;
- visual root per body;
- mission/HUD/camera bez `STATE.flight.body`;
- full cleanup/retry ownership;
- build rollback po błędzie prezentacji;
- pagehide i repeated lifecycle testowane.

`STATE.flight.body` pozostał deprecated aliasem, ale nie jest aktywnie czytany.

## P2 — Integrity and destructive ownership

**Status: RESOLVED dla Gate A; świadome ograniczenie dla przyszłego splitu.**

- collider/part/body ownership jest exact;
- brak fallbacku do primary body;
- backend-first state-second;
- wrong-body damage nie przechodzi;
- payload ma body/collider ownership;
- recenter i mass properties są per body;
- debris lifecycle jest w `FlightIntegrity`, backend adapter w `DebrisRuntime`;
- presentation hook failure nie przerywa zatwierdzonej transakcji.

Ograniczenie `primary-rigid-island-only` blokuje destrukcyjny detach innej wyspy. Jest jawne i testowane. Usunięcie wymaga assembly split semantics, nie kosmetycznego fallbacku.

## P3 — Cleanup and retry

**Status: RESOLVED.**

Porządek:

```text
constraint -> listener/collider -> body -> visual -> published state clear
```

`disposed` nie jest ustawiane przed pełnym cleanupem. Failed resources pozostają w mapach/listach do retry. Pierwotny build error jest zachowany, cleanup errors są osobnym polem. Multi-body start/stop/start i staged debris cleanup są testowane.

## Gate status

### Gate A — Single-body flight ownership

**CLOSED.**

Exit conditions:

- [x] FlightSession owns lifecycle.
- [x] RuntimeAssembly is source of truth.
- [x] Primary body is query/policy.
- [x] Integrity gets exact ownership.
- [x] Visual ownership per body.
- [x] Public game modules avoid native body state.
- [x] Repeated multi-body lifecycle does not leak in tested harnesses.
- [x] Documentation matches code.

### Gate B / Phase 1D.4A — Rigid Islands & Mechanical Compilation

**OPEN — next.**

Missing:

- mechanical authoring schema/ADR;
- StructuralGraphCompiler;
- RigidIslandCompiler;
- MechanicalGraphCompiler;
- stable production bodyId/constraintId;
- normal gameplay two-body compilation;
- schema migration decision.

### Gate C — Assembly Space / Sublevel Foundation

**BLOCKED by Gate B.**

### Gate D — Device & Port Schema

**BLOCKED by Gate C.**

Required future identity: `{blockId, portId}`.

### Gate E — Deterministic Control Kernel

**BLOCKED by Gate D.**

Required future runtime: headless fixed-tick `ControlRuntime`.

## Layer readiness before Phase 1E

| Layer | Status | Notes |
|---|---|---|
| CraftModel / block identity | ready | v10, stable blockId |
| CraftCompiler single island | ready | deterministic, one body |
| RuntimeAssembly multi-body contract | ready | plan/builder/lifecycle tested |
| Game lifecycle | ready | Gate A closed |
| Real-Cannon hinge capability | ready as narrow contract | no player authoring |
| Rigid island compiler | missing | Gate B |
| Assembly space | missing | Gate C |
| Device ports | missing | Gate D |
| ControlRuntime | missing | Gate E |
| Phase 1E UI | forbidden now | depends on A–E |

## Risks remaining

1. Produkcyjny compiler nadal koduje jedną wyspę.
2. Deprecated native aliases istnieją i powinny zostać usunięte po migracji remaining compatibility consumers/build tooling.
3. Real Cannon soft limits mają mierzalny overshoot.
4. One-collider-per-voxel i contact cost ograniczają podnoszenie flight cap.
5. Brak browser/WebGL CI; startup smoke jest headless DOM stubem.
6. Debris randomness nie jest częścią deterministic control semantics, ale nie może wejść do przyszłego ControlRuntime.

## Decyzja

Następna praca ma rozpocząć się od ADR/schema review Gate B. Nie wolno zaczynać typed ports, signal graphu ani node editora, dopóki normalny `CraftCompiler` nie potrafi deterministycznie wygenerować wielu rigid islands i mechanical graphu.
