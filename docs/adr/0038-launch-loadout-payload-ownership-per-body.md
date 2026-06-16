# ADR 0038 — Launch loadout and payload ownership per body

Status: Accepted in Foundation Phase 1D.4A.

## Decision
Payload is launch loadout, not blueprint topology. It names an anchor block and therefore one owner body. Plan compilation recomputes only that island's COM/inertia, body-local parts/collider offsets and connected local pivots. Other bodies remain unchanged.

## Rejected alternative
Recomputing a global loaded craft COM was rejected because it silently welds articulated bodies into one frame.

## Consequences and proof
Mission detach retains exact body ownership. Tests prove owner-only mass/pose change and pivot round-trip after loaded COM movement.
