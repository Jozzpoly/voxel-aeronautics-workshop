# Validation Report — Foundation Phase 1D.3C

## Źródło prawdy

Praca została wykonana na pełnym ZIP-ie Phase 1D.3B.1, zgodnym z najnowszym commitem `main` tej fazy. Repozytorium GitHub nie zostało zmodyfikowane przez agenta.

## Bazowa walidacja

Przed zmianami:

```text
python tests/run_all.py
All core tests passed.
```

## Walidacja po zmianach

- pełne `python tests/run_all.py`: PASS;
- syntax check wszystkich źródeł: PASS;
- static architecture checks: PASS;
- real Cannon parity: PASS;
- joint capability spike: PASS;
- 12 000 joint soak steps: PASS;
- retry-safe assembly disposal: PASS;
- release identity parity: PASS;
- documentation contract i obecność direction docs w ZIP-ie: PASS;
- deterministic release build: PASS;
- embedded/ZIP source parity: PASS;
- pełna bateria po ponownym rozpakowaniu finalnego ZIP-a: PASS;
- patch zastosowany do czystego baseline 1D.3B.1 i pełna bateria: PASS;
- `git diff --check`: PASS;
- startup smoke: PASS.

## Manualny code review

Sprawdzono:

- granicę planner/builder/Physics Port/backend;
- brak natywnych jointów w game shell;
- oddzielenie mechanical plan od runtime command;
- walidację axes/pivots/world membership;
- rollback po create/add/remove failures;
- constraint-before-body cleanup;
- zachowanie map po transient failure;
- ograniczenia soft limits i angle unwrapping;
- pozostałe założenia single-body w `STATE.flight`;
- manifest źródeł, wersje, dokumentację i roadmapę;
- cały kierunek sublevel/device/signal/control przed Phase 1E;
- kanoniczną wizję produktu, anti-goals i zgodność pamięci z roadmapą.

## Znalezisko wydaniowe

Review wykrył, że package, build i manifest miały wersję 1D.3C, podczas gdy runtime config oraz HTML nadal identyfikowały 1D.3B.1. Wersje zostały ujednolicone, a regresję blokuje `tests/test_release_identity.py`.

## Foundation readiness

Nie znaleziono nierozwiązanego release blockera. Projekt może kontynuować bez restartu. Przed finalnym systemem kabli/programowania wymagane są jednak bramki opisane w `FOUNDATION_READINESS_REVIEW.md`:

1. assembly-centric flight lifecycle;
2. rigid-island/mechanical compiler;
3. assembly-space/sublevel identity;
4. typed device ports;
5. deterministic control runtime.

## Świadome ograniczenia

- graczowy planner nadal jedno-body;
- brak player-facing joint blocks;
- limity hinge są miękkie;
- brak browser/WebGL CI;
- one-collider-per-voxel i limit 480;
- produkcyjne biblioteki z CDN.


## Phase 1D.3D — Assembly-Centric Flight Lifecycle
Runtime flight state now treats RuntimeAssembly as the authoritative launched vehicle. `primaryBody` is explicit; `STATE.flight.body` remains only a compatibility alias for the current single-rigid-island craft. New `game.flight-session` and `game.flight-integrity` seams document and test the lifecycle/integrity boundary for the future Rigid Island Compiler.
