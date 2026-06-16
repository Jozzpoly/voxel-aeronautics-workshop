# ADR 0029 — RuntimeAssembly source of truth and primary body policy

Status: Accepted in Foundation Phase 1D.3E.

## Context

Phase 1D.3D publikowała assembly oraz native primary body równolegle, a game shell nadal posiadał lifecycle. Dla articulated craftu jeden body nie może reprezentować całej maszyny.

## Decision

- Aktywna sesja ma jedno kanoniczne `RuntimeAssembly`.
- `FlightSession` jako jedyny production owner buduje i publikuje assembly.
- Primary body jest deterministyczną polityką: explicit, rootBodyId, root role, stable ID sort.
- Mission/HUD/camera korzystają z neutralnych próbek primary body.
- Native aliases pozostają chwilowo deprecated i nie są aktywnie czytane.

## Consequences

Gate B może dodać wiele wysp bez ponownej migracji lifecycle. Assembly-level UI musi jawnie odróżnić dane całej maszyny od primary-body pose.
