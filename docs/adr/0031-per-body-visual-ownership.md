# ADR 0031 — Per-body visual ownership

Status: Accepted in Foundation Phase 1D.3E.

## Context

Jeden globalny root obraca wszystkie części razem i nie działa dla articulated assembly.

## Decision

- Sesja posiada `visualRootByBodyId`.
- Runtime part posiada stabilne `bodyId`.
- Lokalna pozycja części jest względna do właściwego body.
- Każdy root synchronizuje się osobno z neutralnym body transformem.
- Root jest rejestrowany przed scene allocation i usuwany dokładnie raz.

## Consequences

Obecny single-body craft wygląda tak samo. Gate B oraz Gate C mogą użyć tego ownershipu bez nowego globalnego transformu.
