# VAW Code Reality Audit

Status: **current recovery evidence — P1 baseline with P2 resolution ledger**  
Audit date: **2026-08-16**  
Product source audited: `80c0ae4aced1dd695af217cdeadea9025c6305c8`  
Recovery lane at audit start: `recovery/playable-truth` @ `38a9fd7752b120d9146b1703a3e6e6c649dfbd6c`

The three recovery commits after `80c0ae4` changed documentation, repository/process hygiene and release tooling, but did not change `src/**` gameplay/runtime code or user visual assets. This audit therefore treats `80c0ae4` as the exact product source currently under recovery.

This document is evidence, not a new roadmap authority. `ROADMAP.md` owns work order; `PROJECT_VISION.md` owns product intent.

## Audit rule

A feature is not `PROVEN` because a file, API or test exists. The classification combines:

- domain/source implementation;
- runtime integration;
- actual user-facing path;
- executable tests;
- owner/manual evidence where available.

Labels:

- `PROVEN` — meaningful implementation is demonstrated at the relevant layer;
- `PARTIAL` — real implementation exists but an important part of the capability/loop is missing;
- `ROUGH` — functional in some form, but design/quality is not an acceptable product baseline;
- `STUB/CLAIM` — surrounding evidence can suggest more capability than the actual implementation provides;
- `ABSENT` — desired capability does not exist in the current product source.

## Executive verdict

VAW is **not an empty prototype** and it is **not a mature game hidden behind ugly UI**.

It has a substantial, often strong technical foundation: durable authoring identity, Blueprint/CraftModel compilation, multi-body runtime assembly, real Cannon physics, damage/debris, deterministic release tooling and many real executable tests. At the same time, several user-facing systems stop one or two layers before becoming a coherent engineering workshop.

The recurring historical pattern is:

> capability/domain work matured faster than the player workflow that should expose, explain and connect it.

The highest-value recovery work is therefore not broad feature expansion. It is reconnecting existing technical truth into the core loop:

`build -> understand -> test -> fail -> understand -> return -> rebuild`.

## Classification matrix

| Surface | Verdict | What is real | Missing / debt that matters |
|---|---|---|---|
| Blueprint / CraftModel / compiler | **PROVEN** technical foundation | durable block IDs, Assembly Spaces, structural/rigid/mechanical compilation, deterministic ownership and diagnostics | product UI exposes only a subset of domain capability |
| Runtime assembly / Cannon physics | **PROVEN** foundation | real multi-body bodies/colliders/constraints, body ownership, forces, fixed-step runtime, lifecycle cleanup | dynamic failure around constrained bodies is deliberately guarded/incomplete |
| Basic build placement/removal | **PROVEN** primitive, **ROUGH** product | arbitrary first block, face placement, removal, orientation-before-placement, symmetry, ghost validation | no normal selected-part editing model, no multi-select, no move/copy UI, no post-placement orientation/config edit |
| Undo/redo/save/load/import/export | **PROVEN** | bounded history, autosave, valid backup rotation, migration/import limits, JSON export/import | no project/library workflow; recovery/diagnostic context is not preserved with a test result |
| Assembly Spaces authoring | **PARTIAL** | create child, rename, delete, activate, move hovered block to active space; domain supports richer operations | no hierarchy tool, transform gizmo, bulk ownership edit or user-facing reparent flow |
| Mechanical authoring | **ROUGH / PARTIAL** | real hinge compilation and runtime constraints; user can link two adjacent blocks | authoring supports only hinge; face selection is inferred; created hinge hardcodes force/friction/limits; no mechanism editor, pivots/frames, motor/servo UI or tuning |
| Motor/servo constraint capability | **PARTIAL capability, absent product path** | Physics Port / Cannon / AssemblyBuilder support constraint control and capability tests exercise motor/servo/limits | gameplay never calls `setConstraintControl`; no player-facing control path |
| Manual flight controls | **PROVEN** core | six-axis action model, rebinding, sensitivity/deadzone/expo/invert, power controls, real force/torque routing | UX/browser focus remains rough; non-thruster controls on secondary bodies are intentionally limited |
| Engineering analysis | **PARTIAL / correctness debt** | mass, lift, thrust, endurance, control estimates, warnings and visual markers are real | multi-space structural-neighbor analysis is wrong; control authority ignores non-root-body thrusters while runtime routes them; aerodynamic/control formulas are duplicated from runtime |
| Damage / failure simulation | **PROVEN** runtime, **PARTIAL** engineering loop | impact/load damage, part detach, cascading disconnect, fuel loss/leak, debris, first-failure tracking | constrained-body detach has safety guards; sandbox return destroys failure evidence; no persistent structured last-test report or failed-part highlight for rebuild |
| Failure -> diagnosis -> rebuild | **PARTIAL, high-priority break** | telemetry exists during flight and contract debrief records first failure | free sandbox (`F`) returns directly to BUILD, where `cleanupFlightState()` zeroes failure/loss/impact/leak evidence; the most important experimentation mode loses the evidence needed for iteration |
| UI workspace / camera | **ROUGH** | dockable panels, layouts, camera modes/follow/pan/orbit and persistence exist | manual owner evidence shows clutter/readability problems; UI infrastructure is more mature than information architecture |
| Missions / career / terrain | **PROVEN side system** | 10 gated contracts plus sandbox, stars/credits/rank, payload/landing/gates, terrain authoring and debrief | credits/rank mostly feed the contract layer itself; substantial side-system complexity arrived before the core workshop reached equivalent maturity |
| Visual Asset Pack runtime | **PARTIAL** | renderer-only contract, registry/loader, procedural fallback, glTF mounting/material/rig handling, reload path | local imported working pack covers only 5 of 10 current block types; fidelity/readability is not product-proven |
| Blockbench Import Studio | **PROVEN tooling capability, overbuilt relative to product** | large authoring tool for import, animation preview, material/rig binding, install/update, debug/export and terrain authoring | current game visual quality remains rough; tool breadth should not dictate product priority |
| Device tuning / direct device binding | **ABSENT** | global InputProfile and placement-time ControlSurface axis/sign exist | no `portId`, device catalog, per-device binding/tuning/groups in current `src/**` |
| Signal graph / ControlRuntime / sensors / PID | **ABSENT** | design intent exists in current research docs only | no signal/device runtime implementation in current product source |
| Mobile/touch in active recovery source | **ABSENT** | desktop source explicitly declares keyboard/mouse scope | donor branches exist but are not current product authority |
| Release / source parity | **PROVEN** after P0 | deterministic manifest generation, single HTML, exact source ZIP, checksums, LF/CRLF parity | none currently identified in product release path |
| Validation/test architecture | **PARTIAL / ROUGH infrastructure** | 42 JS test files include substantial real domain/runtime execution | several large Python regression suites are token/static-shape heavy; validation-runner process/timeout harness is nondeterministic across CI environments |

## Confirmed high-value findings

### 1. Engineering weak-link analysis is wrong for transformed Assembly Spaces

`game.engineering-analysis::buildCraftSnapshot()` stores:

- `part.key = part.gridKey` — an Assembly-Space-owned grid key;
- `part.assemblyPosition` — root/assembly position.

`computeCraftAnalysis()` then checks neighbors using:

`craftKeys.has(makeKey(part.assemblyPosition + direction))`

The injected `makeKey()` defaults to the currently active Assembly Space. The calculation therefore mixes an owned local-grid key with a root/assembly-space position and omits the part's own `assemblySpaceId`.

A disposable executable reproduction using the real `CraftModel`, `CraftCompiler`, a transformed child Assembly Space and a real hinge produced a **launch-ready compiled craft** with:

- engineering `weakLinks = 4`;
- weak links derived from compiled `rigidNeighborBlockIds = 3`.

The middle block in the transformed child space had two real rigid neighbors but was still counted as weak by engineering analysis.

This is a product correctness bug, not merely test debt.

### 2. Engineering control authority does not match multi-body runtime routing

`computeSnapshotTorqueMax`, `computeThrusterTorqueForPilot` and `computeAuxiliaryControlTorque` skip parts whose `bodyId !== snapshot.rootBodyId`.

Runtime does something different for thrusters: `game.flight-thruster-router::pilotForBody()` maps the primary-body pilot vector into each target body's local frame, and secondary-body Thruster/VectorThruster parts are marked pilot-controlled.

Therefore engineering control ratings can under-report or mischaracterize a multi-body machine that runtime will actually command.

### 3. Sandbox destroys the evidence needed for the core experiment loop

`MissionController.requestReturnToWorkshop()` behaves differently for contracts and sandbox:

- active paid/certification contract -> `finishMission(...)` -> debrief;
- sandbox -> direct `setMode('BUILD')`.

`setMode('BUILD')` calls `cleanupFlightState()`, which resets at least:

- `lostParts`;
- `leakingFuelRate`;
- `firstFailure`;
- `structuralFailures`;
- `maxImpact`;
- runtime parts/loads and integrity state.

No durable `lastFlightReport`/`lastTestReport` was found. Thus the mode that should best support free experiment-and-rebuild discards the strongest failure evidence at return.

### 4. Mechanical capability is substantially ahead of mechanical product

The runtime stack exposes hinge state and controls including motor/servo/limits, and capability tests exercise them. The actual workshop creates a hinge by selecting two adjacent blocks and a signed axis, then writes fixed values:

- `collideConnected: false`;
- `maxForce: 1000000`;
- `frictionTorque: 0`;
- `limits: null`.

There is no user-facing call to `setConstraintControl`, no motor/servo editor and no post-create tuning surface. Historical capability-spike success must not be read as a mechanism feature being complete.

### 5. The domain model contains useful editing capabilities that the workshop never exposes

Examples:

- `CraftModel.copySubgraph()` is implemented and fuzz-tested, but has no gameplay/UI caller;
- `CraftModel.updateMechanicalLink()` is tested, but gameplay only lists/removes links;
- `CraftModel.reparentAssemblySpace()` is hardened and tested, but the workspace has no reparent UI;
- `CraftModel.move()` exists, while normal workshop interaction has no selected-block move/edit operation.

This is not dead code in the strict sense; it is **uncompleted product plumbing**. Before adding new domain APIs, recovery should preferentially connect high-value existing capabilities to coherent workflows.

### 6. `src/game.js` remains a major behavioral hotspot

At the audited source:

- 2354 lines;
- about 355 direct `STATE.` accesses;
- 70 `getElementById` calls;
- 49 event-listener registrations;
- 54 `window.` references.

Notable exact function sizes include:

- `buildFlightBody()` — 249 lines;
- `stepFlightPhysics()` — 131 lines;
- `updateFlightFeedback()` — 72 lines;
- `setMode()` — 72 lines;
- `updateGhost()` — 61 lines.

Modules have been extracted, but `game.js` is still more than a composition root. It owns substantial behavior spanning build, mode lifecycle, failure, aerodynamics, propulsion, gyro control and render/update coordination.

Do **not** perform a cosmetic monolith split. Extract only while repairing a real responsibility boundary in P2+.

### 7. Physics/engineering formulas are duplicated across prediction and runtime

Engineering analysis has independent implementations for wing coefficients, control-surface torque and VectorThruster gimbal force. Runtime has corresponding aerodynamic/control functions in `game.js`.

Some parity tests exist, but duplicated formulas are already coupled to finding #2 and create a long-term risk that the workshop explains one machine while runtime flies another. A later repair should converge on shared pure domain calculations where practical rather than adding more string-regression tests.

### 8. Test evidence is strong but heterogeneous

The suite is not fake: there are 42 JS `test_*.js` files and broad executable coverage of compiler/runtime/physics/lifecycle behavior.

However, some large Python regression suites heavily assert source text/shape. Examples from the audited tree:

- `test_audit_regressions.py` contains roughly 140 source-token/string assertions;
- `test_missions.py` contains roughly 37 source/static-shape assertions.

These are useful architecture guards, but they cannot establish usability or semantic equivalence. Current policy should continue to distinguish:

`source-shape guard != executable behavior != rendered product proof != owner validation`.

The current `validation_runner` timeout/process-family harness also fails nondeterministically across Windows/Ubuntu CI after release reproducibility itself has already passed. Keep it classified as infrastructure debt unless evidence ties it to product execution.

## What should not happen next

Do not respond to this audit by:

- redesigning every panel at once;
- merging `VAW_GRoK` or mobile donor branches;
- adding Device/Port/Signal frameworks;
- extending missions/career;
- expanding Blockbench/terrain tooling;
- splitting `game.js` merely to lower line count;
- implementing broad new mechanics before the existing test/rebuild loop is coherent.

## P2 decision — smallest repair sequence

The audit closes with this order:

### P2-A — Engineering Analysis Truth

Fix diagnostic truth before polishing its presentation:

1. make structural-neighbor analysis Assembly-Space-correct;
2. align multi-body control-authority prediction with actual runtime thruster routing semantics, or explicitly narrow/label the metric if exact prediction is not yet defensible;
3. add executable multi-space/multi-body analysis tests, not token assertions;
4. reduce duplicated prediction/runtime math only where the fix exposes a clean pure boundary.

Exit condition: engineering readouts do not knowingly contradict compiled topology or runtime control semantics for supported multi-body craft.

### P2-B — Test Evidence Continuity

Create one structured, bounded last-test result that survives flight cleanup and works for sandbox as well as contracts. Preserve enough identity/evidence to answer:

- what failed first;
- which block/device was involved when known;
- what parts were lost;
- maximum impact / relevant load/fuel-loss facts;
- whether simulation health degraded.

The result should support rebuilding; it must not mutate the Blueprint with transient damage.

### P2-C — Workshop Editing Fundamentals

Only after truth/feedback:

- establish selected-part identity distinct from hover/tool selection;
- allow high-value edit operations on existing parts rather than requiring delete/re-place;
- expose existing domain capabilities selectively (configuration, move/copy/mechanical tuning) according to real use cases;
- keep Blueprint/CraftModel authority intact.

### P2-D — Information architecture and visual polish

Use manual screenshots/tests to simplify the workspace around the now-trustworthy loop. Remove or subordinate panels that do not help the current task. Visual/Blockbench work follows product needs rather than driving them.

## P1 close condition

P1 is complete when this audit is committed, current docs point to it, and no product code is changed in the audit commit.

At P1 close, the next product-code milestone was **P2-A Engineering Analysis Truth**. The resolution ledger below records its current recovery status.

## P2 resolution ledger

### P2-A — Engineering Analysis Truth: resolved in recovery

P2-A addressed findings 1 and 2 without pretending to solve articulated dynamics that the estimator does not model.

- `weakLinks` and exposed-fuel neighbor counts now use compiler-owned `rigidNeighborBlockIds`; the reproduced transformed-child-space fixture reports the compiled value (`3`) rather than the old reconstructed value (`4`).
- Engineering control percentages are explicitly scoped as `primary-body-local`.
- Manual gyro authority counts only Gyro on the primary body, matching current runtime pilot-control ownership.
- Secondary-body Thruster/VectorThruster remain runtime pilot-routed, but their joint-coupled effect is not folded into a fake whole-craft percentage; articulated analysis reports this limitation.
- Mission readiness does not use the partial articulated percentage as if it were a complete craft-control score.
- A new executable multi-space/multi-body test protects topology, control scope and mission-readiness wording/semantics.

Validation: targeted engineering, missions, architecture, thruster-routing and Gate C tests passed; a broad disposable core suite passed with only the already-known nondeterministic validation-runner harness excluded. Browser smoke in the recovery container still fails before application bootstrap and therefore provides no rendered PASS.

The next unresolved high-value finding at P2-A close was #3: sandbox return destroyed failure evidence needed for `test -> understand -> rebuild`. P2-B resolves that continuity break as recorded below.

### P2-B — Test Evidence Continuity: resolved in recovery

P2-B addressed finding 3 without persisting transient damage into craft authority.

- sandbox return captures `lastTestResult` before cleanup; contract finish uses the same evidence schema;
- `firstFailureEvent` preserves stable block identity/type/body/reason when the runtime knows it;
- lost block IDs are retained in a bounded list together with lost count, max impact, final load snapshot, fuel use and integrity;
- `lastTestResult` lives outside transient `flight` state and has no Blueprint/CraftModel/BlueprintController persistence path;
- structured failure identity is cleared during later flight cleanup only after the bounded result has captured it, preventing stale failed-block identity on a later clean test;
- executable tests prove the snapshot survives destructive cleanup and that sandbox/contract capture share one model.

Target validation passed FlightIntegrity, FlightSession, MissionEvaluator, missions, architecture/runtime dependency/provenance checks and `STARTUP_OK` for single-body, articulated and multi-space UI lifecycle in the disposable candidate. Current game composition does not persist fixed-step scheduler health and does not yet expose a complete workshop diagnosis surface; P2-C owns that product bridge. Rendered/manual quality remains unaccepted.

The next unresolved product break is finding 5 / the workshop editing gap: useful domain operations exist, but normal placed-part selection/editing is missing. P2-C also consumes the preserved failed `blockId` so test evidence can point back into the workshop instead of remaining only structured state.
