# Voxel Aeronautics Workshop — Foundation Phase 1D.3C

Browserowy sandbox inżynieryjno-lotniczy skupiony na budowaniu, ręcznym sterowaniu, programowaniu urządzeń i obserwowaniu prawdziwej fizyki maszyny.

## Aktualny stan

Phase 1D.3C dostarcza pierwszy zweryfikowany mechanizm wielobryłowy:

- dwa lub więcej body w `RuntimeAssembly`;
- minimalny hinge-only kontrakt Physics Portu;
- free hinge, motor, servo, pasywne tarcie i miękkie limity;
- stabilne `constraintById`;
- atomowy lifecycle i retry-safe cleanup;
- prawdziwy Cannon.js 0.6.2 w automatycznym teście jointów;
- zachowane granice `CompiledCraft -> RuntimeAssemblyPlan -> AssemblyBuilder -> Physics Port`;
- zachowany modularny game shell z `game.js` jako composition rootem.

Nie ma jeszcze graczowych bearingów ani subleveli. Gameplay planner nadal emituje jedno body i zero constraintów. 1D.3C jest dowodem możliwości backendu i kontraktu runtime.

## Uruchomienie

Najprościej:

```powershell
python tools/serve.py
```

Następnie otwórz adres wypisany w terminalu. Można też użyć `run_game.bat` albo jednoplikowego HTML z katalogu `release/` lub `dist/` po buildzie.

## Testy

```powershell
python tests/run_all.py
```

Bateria obejmuje:

- domenę, migracje, historię i kompilator;
- mass properties oraz Physics Port;
- deterministic headless harness;
- real-Cannon free dynamics, kontakty, payload/recenter i benchmark;
- real-Cannon hinge/motor/servo/limits/collision/lifecycle soak;
- modularne granice game shell;
- release identity oraz deterministyczny ZIP/single HTML z source parity.

## Build wydania

```powershell
python tools/build_release.py
python tools/verify_release.py
```

Pełny ZIP jest źródłem prawdy dla aktualizacji repozytorium. Single HTML służy do szybkiego uruchomienia i prezentacji.

## Najważniejsze dokumenty

1. `AI_PROJECT_MEMORY.md`
2. `PROJECT_VISION.md`
3. `ARCHITECTURE.md`
4. `FOUNDATION_READINESS_REVIEW.md`
5. `PROGRAMMABLE_MACHINE_RESEARCH.md`
6. `ROADMAP_NEXT.md`
7. `PHASE_1D3C_REPORT.md`
8. `VALIDATION_REPORT.md`
9. `TEST_REPORT.md`
10. `DELIVERY_WORKFLOW.md`

## Następna praca

Najpierw **Phase 1D.3D — Assembly-Centric Flight Lifecycle**. Potem rigid-island/mechanical compiler, assembly-space/sublevel identity, typed device ports i deterministic control kernel. Dopiero na tym fundamencie powstaje finalny Per-Block Control Bus, kable lub wireless oraz edytor zachowań.
