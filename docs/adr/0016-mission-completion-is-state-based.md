# ADR 0016 — Mission completion is state-based

## Status

Accepted in Foundation Phase 1D.2A.

## Context

Collision callbacks are edge notifications produced by a physics backend. A resting contact may stop producing callbacks even though the craft remains on the ground. Mission completion requires a continuous dwell and therefore cannot use callback recency as its sole grounding state.

## Decision

- A pure mission evaluator receives a normalized sample: position, velocity, tilt, ground clearance and contact age.
- Ground clearance derived from craft geometry is the primary grounding signal.
- Recent collision contact is only a bounded corroborating signal and is additionally constrained by clearance.
- Dwell uses controlled decay rather than a single-frame hard reset.
- Physics adapters may later expose a persistent contact query, but mission rules remain backend independent.

## Consequences

- Mission tests can run without renderer or solver.
- Resting craft can complete landing objectives without repeated collision events.
- Runtime must provide an accurate geometry/contact sample.
- Phase 1D.3 should move sample construction behind a runtime query boundary.
