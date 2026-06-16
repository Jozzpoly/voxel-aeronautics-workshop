# Foundation Phase 1D.3C — Joint Capability & Minimal Hinge Contract

## Cel

Celem fazy było sprawdzenie na prawdziwym Cannon.js, czy istniejący łańcuch:

```text
RuntimeAssemblyPlan -> AssemblyBuilder -> Physics Port -> backend
```

potrafi bez obejścia w `game.js` obsłużyć pierwszą relację mechaniczną pomiędzy dwiema sztywnymi bryłami. Faza miała dostarczyć dowód techniczny i minimalny kontrakt, a nie gotowy system graczowych bearingów.

## Zakres wykonany

- dodano jawne capability `constraints.hinge`;
- dodano neutralny, świadomie hinge-only plan constraintu;
- dodano tryby runtime `free`, `motor` i `servo`;
- oddzielono immutable mechanical plan od mutable control command;
- `AssemblyBuilder` tworzy constraints przez Physics Port i przechowuje `constraintById`;
- zachowano eksperymentalny `constraintBuilder`, lecz produkcyjna ścieżka już go nie wymaga;
- backend Cannon tworzy prawdziwy `CANNON.HingeConstraint`;
- backend headless jawnie odmawia jointów zamiast symulować nieistniejący solver;
- dodano walidację osi, pivotów, membership body w świecie i lifecycle constraint-before-body;
- dodano runtime API sterowania, odczytu i usuwania constraintu;
- pełny cleanup assembly jest retry-safe również po chwilowym odrzuceniu constraint removal;
- dodano deterministyczny test joint capability do głównego runnera;
- dodano `PROJECT_VISION.md`, pełny foundation readiness review i research programowalnych maszyn;
- dodano test kontraktu dokumentacji oraz obowiązkową obecność nowych materiałów w ZIP-ie.

## Najważniejsze znaleziska

### `collideConnected`

Cannon.js 0.6.2 nie zachowuje przekazanego `collideConnected` w konstruktorze hinge w sposób wymagany przez projekt. Adapter ustawia właściwość jawnie na obiekcie natywnym. Test potwierdza oba tryby:

- wyłączone kolizje połączonych body: 0 kontaktów;
- włączone kolizje połączonych body: kontakty występują.

### Limity kąta

Cannon.js 0.6.2 nie udostępnia natywnego asymetrycznego hard stopu hinge. Implementacja 1D.3C używa miękkiego kontrolera silnikowego. Testowana konfiguracja `[-0.3, 0.3] rad` osiągnęła obserwowany zakres:

```text
[-0.317613, 0.316210] rad
```

Nie wolno opisywać tego jako bezwzględnego limitu konstrukcyjnego. W przyszłości ciężkie mechanizmy mogą wymagać innego constraintu, własnego stopu kontaktowego albo zmiany backendu.

### Lifecycle i rollback

Drugi code review wykrył, że pojedyncze `removeConstraint()` było retry-safe, lecz pełne `runtime.dispose()` mogło wcześniej oznaczyć assembly jako usunięte mimo niepełnego cleanupu. Naprawa wprowadza jawny stan `cleanupPending`:

- po nieudanym cleanupie `disposed === false`;
- mapy i body pozostają dostępne do retry;
- normalne operacje są blokowane do czasu domknięcia cleanupu;
- drugi `dispose()` może poprawnie zakończyć operację;
- body nie jest usuwane, dopóki żywy constraint je referencjonuje.

## Wyniki real-Cannon spike

```text
motor target speed:       1.500000 rad/s
motor measured speed:     1.500000 rad/s
servo target angle:      -0.500000 rad
servo measured angle:    -0.500000 rad
passive friction angle:   0.000011 rad
joint soak:               12000 steps
max free pivot drift:     0.004689
max soak pivot drift:     0.076684
```

Testy obejmują również:

- dwa dynamiczne body z oddzielnymi mass properties;
- free hinge;
- motor i zmianę kierunku;
- servo dla dodatniego i ujemnego targetu;
- pasywne tarcie;
- miękkie limity;
- collision toggle;
- invalid geometry rollback;
- synthetic constraint construction failure;
- pojedynczy retry removal;
- retry całego assembly disposal;
- body/world membership preflight;
- brak mutacji mechanical plan i signal graph przez runtime control.

## Walidacja artefaktów

Finalny ZIP został rozpakowany poza working tree i przeszedł pełne `python tests/run_all.py`. Patch 1D.3B.1 -> 1D.3C został zastosowany do czystego baseline i również przeszedł pełną baterię. Build potwierdził determinism, source parity i spójność release identity.

## Czego faza nie dostarcza

- graczowego bloku Free Bearing, Motor ani Servo;
- rigid-island compiler;
- automatycznej kompilacji mechanical graphu z blueprintu;
- rigid bypass diagnostics;
- fizycznego systemu kabli ani signal runtime;
- natywnych hard stops;
- jointów innych niż hinge;
- wielu body w aktualnym gameplay plannerze;
- finalnego API subleveli.

## Decyzja

Minimalny hinge contract zostaje przyjęty jako fundament techniczny. Nie należy rozszerzać go przez zgadywanie pistonów, dockingów i uniwersalnych jointów. Następny kodowy etap ma wydzielić assembly-centric flight lifecycle, a następnie zbudować rigid-island/mechanical compiler. Dopiero na tej podstawie należy rozpocząć gameplayowe jointy i Per-Block Control Bus.
