# ADR 0047 - Mechanical V2 Design Spike

Status: Draft

## Context

Gate C delivered a **minimal hinge proof**, not a general mechanism model. ADR 0033 persists `mechanicalLinks[]` with `kind: "hinge"` endpoints on adjacent block faces and a signed face-axis. ADR 0040 exposes a narrow workshop authoring path. ADR 0027 limits the Physics Port to hinge-only constraints with separate runtime `free` / `motor` / `servo` control. ADR 0036 defines coordinate-space vocabulary; ADR 0039 forbids non-zero `recenterBody` on constrained bodies until atomic pivot rebuild exists.

Owner feedback captured in `docs/ROADMAP_REBASE_2026-07-01.md` and roadmap planning on 2026-07-07 (`m6-000`) confirms the minimal path is exhausted. The next mechanical work must not be "add a few more hinge fields." It needs an explicit **Mechanical V2** joint model, solver capability evidence and failure-mode review **before** Blueprint, save schema or UI expansion.

Roadmap consensus (SAGE quorum, meeting 2026-07-07) rejects parallel M5 product work with M6 schema growth. M6 is **read-only design** until this spike and `m6-001` joint-frame failure-mode review complete.

## Decision

Treat Mechanical V2 as a **layered joint model** that separates durable machine geometry from mutable actuator commands. This ADR is a design spike only: it defines concepts, spike scope and validation gates. It does **not** authorize schema or product implementation.

### 1. Joint frame identity

Every mechanical link owns a persistent **`jointFrameId`** (initially aliased to `mechanicalLinkId` for hinge migration). The joint frame is the authoritative coordinate basis for:

- pivot center in assembly space;
- one or more rotation axes (and later translation axes);
- limit intervals expressed in joint-local coordinates;
- diagnostic and runtime-command targeting by stable ID.

Authoring endpoints remain `{blockId, face}` for workshop ergonomics, but compiled output must carry explicit **body-local pivots and axes** (already present in `RuntimeAssemblyPlan.constraints[]` per ADR 0036). Mechanical V2 makes that frame **first-class in the design vocabulary**, not an implementation detail inferred only at compile time.

| Layer | Identity | Mutable at flight? |
|-------|----------|-------------------|
| Joint frame | `jointFrameId` / `mechanicalLinkId` | No |
| Topology endpoints | `{blockId, face}` | No (authoring) |
| Compiled bodies | `bodyAId`, `bodyBId` | No |
| Actuator command | `control.mode`, targets, gains | Yes (runtime) |

### 2. Pivot, orientation basis and axes

**Pivot** — explicit center point in assembly space, derived from endpoint faces and optional author offset. Default for adjacent face hinges: face-center intersection on the shared edge plane. Advanced authoring may expose a bounded offset along the joint normal and in the tangent plane without requiring a node editor.

**Orientation basis** — orthonormal triple `(axisPrimary, axisSecondary, axisNormal)` where:

- `axisPrimary` is the enabled rotation (or translation) degree of freedom;
- `axisNormal` is the joint plane normal (hinge plane for revolute joints);
- `axisSecondary` completes the right-handed frame for limit math and future multi-DOF joints.

Gate C hinge authoring collapses secondary basis vectors to implicit face geometry. Mechanical V2 requires the compiler to emit explicit unit vectors `axisA` / `axisB` per body (already normalized in `PhysicsPort.normalizeConstraintPlan`).

**Axis policy** — axes are stored in **body-local** space on the compiled plan (`pivotA`, `pivotB`, `axisA`, `axisB`). Assembly-space authoring values are converted once at compile; runtime never re-derives axes from block orientation alone after constraint creation.

### 3. Limits in joint-local coordinates

Limits are expressed in **joint-local angle** (revolute) or **joint-local displacement** (prismatic, future) relative to the bind pose at constraint creation.

| Field | Revolute (hinge) | Notes |
|-------|------------------|-------|
| `min` / `max` | Radians in joint frame | Gate C `limits.minAngle` / `maxAngle` map here |
| `tolerance` | Position band | Soft stop band; not a native Cannon hard limit |
| `maxTorque` | Limit enforcement torque | Separate from `control.maxTorque` motor budget |
| `maxSpeed` | Limit approach speed cap | Servo/limit controller shared ceiling |
| `positionGain` / `velocityDamping` | PD-style soft limit | Already in `normalizeConstraintLimits` |

**Immutable vs mutable split** (ADR 0027, `PROGRAMMABLE_MACHINE_RESEARCH.md`):

- **Immutable plan:** collision policy, `maxForce`, passive `frictionTorque`, limit interval and limit controller gains.
- **Mutable runtime command:** `control.mode`, `targetAngle`, `targetSpeed`, motor `maxTorque` / `maxSpeed` / PD gains.

Mechanical V2 does not merge limit geometry with device tuning; M7 owns per-block parameter surfaces.

### 4. Motor, servo and passive modes

| Mode | Physics intent | Required backend behavior |
|------|----------------|---------------------------|
| **Passive / free** | Constraint enforces kinematic coupling; no active drive | Native hinge + optional friction torque |
| **Motor** | Velocity drive toward `targetSpeed` with `maxTorque` cap | Cannon motor equation or port-emulated equivalent |
| **Servo** | Position drive toward `targetAngle` with PD gains | Soft target; must respect limit interval when present |

**Friction** is passive-only (`frictionTorque`), not a control mode. A "brake" in product UX is a runtime command that raises effective friction or clamps motor `maxTorque`, not a new constraint kind.

**Mode transitions** must be backend-first: `setConstraintControl` updates native state, then mirrored runtime state. Removing a body while constrained remains rejected (ADR 0027).

### 5. Multi-axis and future joint kinds (feasibility)

Mechanical V2 classifies future joints by **solver capability tier**, not by workshop UI ambition:

| Tier | Joint kind | Spike decision |
|------|------------|----------------|
| T0 (proven) | Single-axis revolute (`hinge`) | Keep; migrate vocabulary to joint frame |
| T1 (spike required) | Single-axis prismatic (`slider`) | Requires Cannon `PointToPoint` / custom constraint spike |
| T2 (spike required) | Powered rotor / bearing (continuous spin) | Motor mode + optional soft centering; verify drift under load |
| T3 (deferred) | Universal, spherical, 6-DOF | Not claimed until backend capability ADR |
| T4 (deferred) | Compound serial chains in one link | Reject; use multiple `jointFrameId` entries |

**Multi-axis in one link:** default **reject** for schema vNext. Prefer **serial single-DOF joints** with distinct `jointFrameId` values. Exception path requires a dedicated capability spike proving stable pivot rebuild (ADR 0039 follow-up).

## Explicitly out of scope (M6 spike)

The following remain **outside** Mechanical V2 joint design and must not appear in a vNext `mechanicalLinks[]` schema draft driven by this spike:

| Topic | Rationale | Correct lane |
|-------|-----------|--------------|
| **Device / Port schema** | Endpoints are `{blockId, portId}` per Gate D | M7 |
| **Signal graph** | Programming transport, not joint geometry | M8 |
| **ControlRuntime** | Deterministic evaluator; separate from constraint construction | M8 |
| **Save schema changes** | Persistent schema follows joint model, not precedes it | Post-spike ADR only |
| **Blueprint version bump** | No v12 fields until solver spike + failure review pass | After `m6-001` |
| **Cable / bus / wireless** | Transport semantics | M8+ |
| **Persisted `bodyId`** | Runtime-compiled identity only | Architecture invariant |

Actuator **targeting** a joint by `jointFrameId` at runtime is in scope for the mechanical plan; **binding** that target to user input is M7.

## Failure modes

Mechanical V2 authoring, compile and runtime must surface **structured diagnostics** (ADR 0037 pattern) rather than silent misalignment.

| Code (proposed) | Condition | Desired behavior |
|-----------------|-----------|------------------|
| `joint-non-adjacent-endpoints` | Authoring faces not on shared edge | Reject at compile; workshop hint |
| `joint-axis-degenerate` | Axis parallel to joint normal or zero length | Reject at normalize |
| `joint-limit-inverted` | `min >= max` | Reject at normalize |
| `joint-body-missing` | Endpoint block not in compiled island | Reject at compile |
| `joint-cycle-unsupported` | Closed kinematic loop without solver proof | Reject until loop solver spike |
| `joint-backend-unsupported` | Backend `capabilities.constraints.hinge !== true` | Fail before body allocation |
| `connected-body-recenter-blocked` | `recenterBody` on constrained body | ADR 0039 guard; no silent pivot drift |
| `joint-break-order-violation` | Body removed before constraint | Backend-first removal; state rollback |
| `joint-motor-saturation` | Torque clamp sustained | Telemetry / diagnostic; no schema change |
| `joint-limit-violation-soft` | Servo target outside interval | Clamp target; optional warning |
| `joint-pivot-drift-soak` | Pivot error after rebase/spawn soak | Spike test failure; blocks promotion |

**Body-frame rebase risk:** any future offset authoring on pivots requires **atomic constraint teardown → pivot update → rebuild → rollback** (ADR 0039 follow-up). Until proven, pivot offsets are compile-time constants only.

**Compound mechanism risk:** long serial chains amplify numerical drift. Spike must include a 3+ joint soak fixture before UI promises "robot arm" class behavior.

## Solver capability spike notes

Spike work is **headless-first** against the Cannon 0.6.2 backend (`src/runtime/cannon_physics_backend.js`). Headless backend intentionally reports `hinge: false`; spike tests use real Cannon or a dedicated probe harness, not production headless parity.

### Spike checklist (`m6-001` input)

| Probe | Purpose | Pass criterion |
|-------|---------|----------------|
| **H0 — Hinge bind pose** | Create hinge from compiled pivots/axes | Rest angle stable over 300 fixed steps |
| **H1 — Motor velocity** | `mode: motor`, step `targetSpeed` | Mean velocity within tolerance; no sign flip |
| **H2 — Servo position** | `mode: servo`, step `targetAngle` | Settles within limit band; no limit windup explosion |
| **H3 — Soft limits** | Servo commanded past `maxAngle` | Clamped motion; diagnostic optional |
| **H4 — Friction passivity** | `free` mode, initial velocity | Energy decay monotonic (within float noise) |
| **H5 — Break ordering** | `breakConstraintsForEndpointBlock` | Constraint removed before body detach; no orphan constraint |
| **H6 — Pivot drift soak** | Spawn rotation + 1000 steps | Pivot world error < ε (reuse ADR 0039 soak pattern) |
| **H7 — Prismatic feasibility** | Optional T1 probe | Document pass/fail; no schema if fail |

**Cannon 0.6.2 limits (documented):**

- Native hinge has **no hard angular stops**; limits are port-level soft controllers (ADR 0027).
- `maxForce` is solver breaking impulse threshold, not a continuous torque rating.
- Continuous rotation bearings may accumulate quaternion drift; spike must measure wrap error.
- Multi-constraint loops may need higher `solverIterations`; spike records iteration sensitivity.

**Capability declaration:** no new `kind` is accepted in Blueprint until the backend publishes `capabilities.constraints.<kind> === true` and H-probes pass.

## Authoring UX sketch (non-binding)

Minimal path must remain as fast as Gate C face-face hinge:

1. Select endpoint A face → endpoint B face.
2. Choose primary axis (signed, face-relative).
3. Optional expand: pivot offset, limit interval, default passive friction.
4. Visualize joint frame gizmo in workshop (renderer-only preview; no physics in BUILD).

Advanced pivot editing is **progressive disclosure**; defaults come from face geometry. No node editor in M6.

## Consequences

- Gate C hinge schema remains authoritative until a follow-up ADR promotes Mechanical V2 fields.
- Compiler may continue deriving pivots from faces; spike proves derived pivots match explicit frame spec.
- Device tuning and programming ladders (M7/M8) attach to `jointFrameId` and runtime control APIs, not to extended `mechanicalLinks[]` device fields.
- Dynamic articulated fracture and arbitrary constrained rebase remain deferred (ADR 0039, `ROADMAP_NEXT.md`).

## Validation gates

| Gate | Task | Requirement |
|------|------|-------------|
| G0 — Design spike | m6-000 | ADR 0047 draft complete; out-of-scope explicit |
| G1 — Failure review | m6-001 | SAGE joint-frame failure-mode review recorded |
| G2 — Solver spike | TBD | H0–H6 probes green on Cannon backend |
| G3 — Feasibility decision | TBD | T1 prismatic: accept, defer or reject with evidence |
| G4 — Schema ADR | TBD | Separate ADR for Blueprint vNext fields; only after G2 |
| Milestone close | M6 | G0–G3 complete; ADR 0047 promoted to **Accepted** or superseded |

Each wave ends with `validate:fast` 6/6 and evidence JSON under `.codex/agent_mesh/assignments/` per PROOF policy. **No `src/**` edits** in M6 spike waves except dedicated solver probe harnesses explicitly assigned after G0.

## References

- ADR 0027 — hinge-only constraint contract
- ADR 0033 — Blueprint v11 mechanical link schema
- ADR 0036 — coordinate spaces and body assembly pose
- ADR 0039 — body-frame rebase with active constraints
- ADR 0040 — minimal workshop hinge authoring
- `ROADMAP_NEXT.md` — M6 Mechanical V2 Design Spike
- `docs/ROADMAP_REBASE_2026-07-01.md` — section M6
- `.codex/agent_mesh/meetings/ROADMAP_PLANNING_2026-07-07.md` — wave 4 assignment