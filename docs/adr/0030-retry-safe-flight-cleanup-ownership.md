# ADR 0030 — Retry-safe flight cleanup ownership

Status: Accepted in Foundation Phase 1D.3E.

## Context

Częściowo nieudany cleanup nie może wyczyścić map i utracić uchwytów potrzebnych do retry. Constraints nie mogą przeżyć body ani zostać usunięte po body.

## Decision

Cleanup order:

```text
constraint -> listener/collider -> body -> visual -> published state
```

Backend mutation jest pierwsza, state mutation druga. `disposed` jest ustawiane tylko po pełnym cleanupie. Errors są raportowane, a failed handles pozostają do ponownego `stop()/dispose()`.

## Consequences

Stop jest idempotentny. Błąd może wymagać drugiego wywołania do zakończenia/acknowledgement. Build zachowuje pierwotny error i osobno dołącza cleanup errors.
