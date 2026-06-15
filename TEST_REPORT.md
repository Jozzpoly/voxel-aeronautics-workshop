# Test Report — Phase 1D.2F

## Wynik

`python tests/run_all.py` — **PASS**.

Ostatni startup smoke:

```text
STARTUP_OK { ids: 160, elements: 544, modules: 17, sources: 20, interaction: 'ok' }
```

## Nowe pokrycie

- blueprint v10 i migracja trwałych `blockId`;
- odrzucanie zduplikowanych identyfikatorów;
- `CraftModel.move()` zachowujące tożsamość;
- `getById()` i `keyForId()`;
- `CompiledCraft.blockIdToIndex`;
- gravity z konfiguracji;
- `RuntimeAssemblyPlan` i mapowanie bloków do body;
- miejsce na constraints i signal links;
- `setBodyMassProperties()`;
- jawna masa, inertia i inverse inertia backendu;
- startup i source parity z nowym modułem.

## Pełna bateria

Nadal przechodzą testy misji, lądowania stanowego, aerostatyki, input profile, workspace, historii, uszkodzeń, detach, fuel leaks, release build, deterministycznych archiwów i embedded source parity.

## Ograniczenie

Stub backend potwierdza kontrakt mass properties, ale nie zastępuje prawdziwego headless testu dynamiki Cannon. Manualnie należy sprawdzić zachowanie długiej, asymetrycznej konstrukcji oraz detach podczas obrotu.
