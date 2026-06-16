# Test Report — Foundation Phase 1D.3E

## Baseline

Na czystym Phase 1D.3D uruchomiono:

```text
python -u tests/run_all.py
```

Wynik: `All core tests passed.` — 19,83 s. Baseline build i verify również zakończyły się kodem 0.

## Końcowa bateria źródeł roboczych

```text
python -u tests/run_all.py
```

Wynik:

```text
All core tests passed.
ELAPSED=19.72 EXIT=0
```

Runner wykonał każdy krok sekwencyjnie w jednej sesji; nie było timeoutu ani pominiętych poleceń.

## Nowe pokrycie Gate A

### FlightSession

- odrzucenie sesji 0-body;
- 1, 2 i wiele body przez neutralny plan/runtime;
- deterministyczna primary-body policy niezależna od input order;
- osobny visual root i transform każdego body;
- exact part/collider ownership;
- constraint-before-listener/collider-before-body-before-visual cleanup;
- wielokrotny `dispose()`;
- awaria cleanupu i skuteczny retry bez utraty handles;
- start → stop → start bez starego assembly.

### FlightIntegrity

- exact part/body ownership i brak destructive fallbacku;
- wrong-body damage rejection;
- backend-first collider removal;
- zachowanie gameplay maps po odrzuconej mutacji backendu;
- per-body mass properties i recenter;
- primary-body integrity denominator;
- payload ownership/damage/detach;
- debris lifecycle;
- isolation presentation-hook failure.

### DebrisRuntime

- neutralna synchronizacja transformu;
- jawna collision policy;
- staged retry-safe body/visual cleanup;
- allocation rollback po błędzie scene registration.

### Runtime/Physics Port

- neutral body transform;
- linear/angular velocity;
- local/world point round-trip;
- deterministic body iteration;
- exact ownership wrappers.

### Game shell i lifecycle

- brak produkcyjnego `AssemblyBuilder.build` poza FlightSession;
- brak aktywnego `STATE.flight.body` consumer w `game.js` i mission controllerze;
- per-body visual composition;
- active-flight `fullscreenchange` pozostawia lot;
- active-flight `pagehide` wykonuje cleanup i wraca do BUILD;
- startup smoke: 160 ID, 544 elementy, 32 moduły, 35 źródeł.

## Zachowane real-Cannon i foundation coverage

- Cannon.js 0.6.2 free fall, torque, rotated inertia, contacts;
- payload detach/recenter podczas obrotu;
- 12 000 kroków headless soak i 12 000 kroków real-Cannon soak;
- hinge free/motor/servo/passive friction;
- motor target/measured `1.5 rad/s`;
- servo target/measured `-0.5 rad`;
- soft limits `[-0.3, 0.3]`, observed `[-0.317613, 0.316210]`;
- `collideConnected=false`: 0 kontaktów; `true`: 4 kontakty;
- maximum free pivot drift `0.004689`;
- maximum soak pivot drift `0.076684`;
- 50 lifecycle cycles;
- CraftModel/CraftCompiler/history/input/missions/aerostatics regressions;
- source parity, manifest hashes, release identity i deterministic build.

## Benchmark informacyjny z bieżącego hosta

Real Cannon median step:

| Collidery | Median build | Median step | p99 step |
|---:|---:|---:|---:|
| 100 | 3,019 ms | 0,0159 ms | 0,0298 ms |
| 500 | 23,129 ms | 0,0525 ms | 0,0797 ms |
| 1000 | 69,529 ms | 0,1037 ms | 0,1332 ms |
| 2500 | 409,482 ms | 0,2600 ms | 0,4137 ms |

Wartości zależą od hosta i nie są twardym progiem CI. Flight cap pozostaje 480.

## Nieuruchomione testy

Brak. Wszystkie polecenia z `tests/run_all.py` zostały rzeczywiście uruchomione i zakończyły się kodem 0. Końcowa walidacja rozpakowanego ZIP-a i wersji odtworzonej z patcha jest opisana w `VALIDATION_REPORT.md`.
