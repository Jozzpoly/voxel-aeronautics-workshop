# ADR 0032 — Exact integrity ownership and primary-island detach limit

Status: Accepted in Foundation Phase 1D.3E.

## Context

Fallback z brakującego body do primary może uszkodzić niewłaściwą część. Pełny split assembly nie istnieje jeszcze.

## Decision

- Damage/detach wymaga exact part/collider/body ownership.
- Mismatch lub brak ownership jest błędem.
- Gameplay detach jest tymczasowo ograniczony do `primary-rigid-island-only`.
- Recenter i mass properties są liczone per body.
- Presentation hooks nie mogą przerwać zatwierdzonej integrity mutation.

## Consequences

Błędna operacja jest głośna zamiast destrukcyjnie zgadywana. Gate B/C muszą zaprojektować split/subassembly ownership przed usunięciem ograniczenia.
