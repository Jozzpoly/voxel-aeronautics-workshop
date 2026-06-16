# Test Report — Foundation Phase 1D.3C

## Komenda

```text
python tests/run_all.py
```

## Wynik końcowy

```text
All core tests passed.
```

## Nowe pokrycie 1D.3C

### Hinge capability na prawdziwym Cannon.js 0.6.2

- dwa body z oddzielnymi mass properties;
- free hinge i pivot drift;
- motor target `1.5 rad/s`, measured `1.5 rad/s`;
- servo target `-0.5 rad`, measured `-0.5 rad`;
- passive friction;
- soft limits `[-0.3, 0.3]`, observed `[-0.317613, 0.316210]`;
- `collideConnected=false`: 0 kontaktów;
- `collideConnected=true`: kontakty potwierdzone;
- 12 000 kroków soak;
- max free pivot drift `0.004689`;
- max soak pivot drift `0.076684`;
- finite body state.

### Lifecycle i kontrakty

- backend capability refusal przed alokacją body;
- invalid pivot/axis preflight i rollback;
- world membership preflight;
- synthetic joint construction failure bez wycieku;
- constraint removal backend-first/state-second;
- retry po `false`;
- body removal blocked przez aktywny constraint;
- retry-safe full assembly disposal z `cleanupPending`;
- mechanical plan i signal links nie są mutowane przez runtime control;
- natywny `CANNON.HingeConstraint` pozostaje wyłącznie w backendzie.

### Dokumentacja jako testowany kontrakt

`tests/test_documentation_contract.py` wymaga obecności i wzajemnej zgodności:

- `PROJECT_VISION.md`;
- foundation readiness review i research systemu programowania;
- aktualnej fazy 1D.3C i następnej bramki 1D.3D;
- ADR 0027/0028;
- release/delivery workflow.

Test release ZIP wymaga także spakowania nowych dokumentów i testów, więc nie mogą zniknąć z dostawy mimo zielonego runtime.

### Release identity

Nowy test wymaga zgodności:

```text
package.json version
= tools/build_release.py APP_VERSION
= SOURCE_MANIFEST.json appVersion
= foundation.config APP_VERSION
```

oraz analogicznej zgodności `RELEASE_ID`. Test wykrył i zamknął niespójność znalezioną podczas końcowego review.

## Zachowane pokrycie

- blueprint v3-v10 migration i future-version rejection;
- CraftModel atomicity/history/stress;
- compiler readiness/cache/work cap;
- mass properties i rotated inertia;
- deterministic headless free flight;
- real Cannon free fall, torque, contacts, payload/detach/recenter;
- 100/500/1000/2500 collider benchmark;
- 50 lifecycle cycles;
- six-axis/rebindable input i Flight Focus;
- mission, landing, damage, debris i structural regressions;
- game shell module ownership i lifecycle;
- deterministic ZIP/single HTML/source parity;
- startup smoke z `fullscreenchange` i `pagehide`.

## Niezależna walidacja dostawy

- finalny ZIP rozpakowano do czystego katalogu i uruchomiono z niego pełne `tests/run_all.py`;
- finalny patch zastosowano do czystego baseline 1D.3B.1 i ponownie uruchomiono pełną baterię;
- oba scenariusze zakończyły się `All core tests passed.`;
- patch przechodzi `git diff --check`.

## Ograniczenia testów

- headless backend nie rozwiązuje kontaktów ani constraints;
- brak automatycznego WebGL/GPU flight testu w prawdziwej przeglądarce;
- performance values zależą od hosta i nie są twardym CI threshold;
- soft limits nie są natywnymi hard stops;
- gameplay planner nadal nie generuje jointów z blueprintu.
