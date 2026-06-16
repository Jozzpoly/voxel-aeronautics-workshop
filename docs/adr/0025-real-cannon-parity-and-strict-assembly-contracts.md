# ADR 0025 — Real-Cannon Parity and Strict Assembly Contracts

Status: Accepted in Foundation Phase 1D.3B.

## Context

Phase 1D.3A moved production body/collider creation into `runtime.assembly-builder` and added a deterministic headless backend. The real Cannon harness was manual and network-dependent. Stub semantics hid a real adapter bug, while some builder mutations and rollback paths could leave inconsistent runtime state or mask the original failure.

## Decision

1. Cannon.js 0.6.2 is vendored under `tests/vendor/` strictly for deterministic validation, with its MIT license preserved.
2. The real-Cannon harness is part of `tests/run_all.py` and covers free dynamics, rotated inertia, payload/recenter, contacts, soak, performance and lifecycle.
3. Assembly plans are fully validated before backend allocation.
4. Backend mutations complete before runtime maps are changed.
5. Rollback preserves the original construction error and attaches cleanup failures separately.
6. Runtime snapshots and mass-property elements fail on malformed numeric data instead of silently applying fallbacks.
7. Both backends synchronize body type after mass changes.
8. Headless diagonal inertia is applied in the body-local frame.
9. Real-Cannon and headless benchmark results remain separate and cannot by themselves raise the flight part limit.

## Consequences

### Positive

- Adapter semantics are exercised against the actual library version.
- Recenter during rotation is regression-tested.
- Invalid plans fail without allocating physics resources.
- Collider mutation and cleanup failures remain diagnosable and retryable.
- Headless free-flight parity is more physically correct.

### Negative

- The repository contains an additional test-only third-party artifact.
- The main test suite is slower because it includes real-Cannon benchmarks.
- Strict boundaries may expose previously hidden malformed custom inputs.
- Contact-heavy performance and constraints are still unmeasured.

## Follow-up

Phase 1D.3C must perform a real-backend joint capability spike before adding a stable constraints API. Collider Compiler work may be prototyped, but the flight limit must remain unchanged until contact-heavy scenarios are measured.
