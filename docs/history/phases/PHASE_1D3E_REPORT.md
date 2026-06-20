# Phase 1D.3E Report — Gate A Foundation Convergence

## Cel

Domknąć częściową migrację Phase 1D.3D tak, aby assembly-centric lifecycle był rzeczywistym kodem produkcyjnym, a nie tylko seamem i deklaracją raportu.

## Baseline

- ZIP: Phase 1D.3D, wersja `0.6.3-foundation.1d3d`.
- Repo `main`: commit `5cf38926623a17290ff2c6caad24d1c36fe77ad3`.
- Bazowe `python tests/run_all.py`, build i verify: zaliczone.
- Audyt wykazał, że Gate A pozostawał otwarty: `game.js` posiadał lifecycle/damage/recenter i jeden root wizualny, a dokumenty kanoniczne nadal przedstawiały 1D.3C jako bieżącą fazę.

## Implementacja

### FlightSession

- pełny build/start/stop/retry lifecycle;
- RuntimeAssembly jako source of truth;
- deterministic primary-body policy;
- neutral body API;
- exact ownership lookup;
- transient resources;
- per-body visual roots;
- atomic visual initialization rollback;
- pagehide-safe shutdown.

### Runtime / Physics Port

- neutral transform i velocity sampling;
- pointToLocalFrame;
- deterministic body iteration;
- part/collider ownership wrappers;
- cleanup constraint → listener/collider → body;
- retry-safe maps.

### FlightIntegrity

- health/damage/detach/payload;
- no destructive primary fallback;
- per-body mass/recenter;
- backend-first mutations;
- primary-island-only public limitation;
- presentation hook isolation;
- debris lifecycle ownership.

### Visuals, mission, HUD, camera

- visual root per body;
- part visual assigned by `bodyId`;
- mission/HUD/camera use primary sample from FlightSession;
- articulated craft semantics are explicit.

### DebrisRuntime

- extracted physical/visual adapter;
- neutral transform sync;
- staged retry-safe dispose;
- allocation rollback.

## Review fixes wykonane po pierwszej implementacji

- naprawiono błędny denominator integrity dla multi-body planu;
- usunięto cichy body fallback;
- poprawiono cleanup order;
- dodano collider cleanup przed body;
- zabezpieczono partial visual/debris failures;
- usunięto bezpośrednie native body reads z game shellu;
- usunięto martwy helper i duplikat `localAxis`;
- poprawiono kruche testy tekstowe zależne od usuniętej zmiennej.

## Zakres świadomie zatrzymany

Gate B nie został rozpoczęty. Nie powstały production mechanical links, rigid-island compiler, blueprint v11 ani gameplay two-body authoring. Rozpoczęcie tych elementów bez osobnego schema ADR pozostawiłoby niedokończoną kolejną bramkę i złamało kolejność zależności.

## Rezultat

Gate A jest zakończony i testowalny. Następny agent może projektować Gate B bez ponownej przebudowy flight lifecycle.
