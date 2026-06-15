# Roadmap po Foundation Phase 1D.2F

## Kierunek produktu

VAW jest przede wszystkim sandboxem konstrukcyjno-programistycznym. Rdzeń doświadczenia:

```text
buduj -> steruj ręcznie lub programuj -> obserwuj fizykę -> przebuduj
```

Kontrakty uczą i inspirują, ale nie zastępują swobodnego sandboxu.

## Ukończone — Phase 1D.2F

- blueprint v10 z trwałymi `blockId`;
- migracja v3–v9 do v10;
- `CraftModel.getById()`, `keyForId()` i `move()` zachowujące tożsamość;
- `CompiledCraft.blockIdToIndex`;
- neutralny `RuntimeAssemblyPlan`;
- `rigidBodies[]`, `constraints[]` i `signalLinks[]` jako jawne kontrakty;
- `blockId -> body/part/collider` dla obecnego runtime;
- `setBodyMassProperties()` w Physics Port;
- zgodność diagonalnej bezwładności analizy i Cannon;
- ponowne liczenie mass properties po detach i utracie payloadu;
- gravity i max altitude bez rozproszonych magic constants;
- guidance przy wysokości startowej oraz wspólny vertical-support ratio.

## Następny etap — Phase 1D.3: Runtime Assembly Builder & Headless Harness

### 1D.3A — wydzielony builder

Przenieść z `game.js`:

- tworzenie body;
- tworzenie colliderów;
- mapy runtime parts;
- payload runtime;
- stosowanie mass properties;
- rejestrację podstawowych callbacków lifecycle.

Docelowe wyjście:

```text
RuntimeAssembly
  bodies[]
  bodyById
  parts[]
  partByBlockId
  colliderByBlockId
  constraints[]
```

`game.js` ma otrzymywać gotowy runtime, a nie składać go ręcznie.

### 1D.3B — prawdziwy headless harness

Scenariusze:

- free fall przy konfigurowalnej grawitacji;
- inertia parity;
- moment 1 N·m i oczekiwane przyspieszenie kątowe;
- hover, aerostatic equilibrium i settling;
- offset thrust;
- payload i zmiana COM;
- detach, recenter i zachowanie prędkości punktu COM;
- długi soak bez NaN i nieograniczonej energii.

### 1D.3C — benchmark

- 100/500/1000/2500 colliderów;
- czas budowy assembly;
- średni oraz 99. percentyl kroku;
- pamięć;
- detach/recenter cost.

### 1D.3D — joint capability spike

Nie jako pełny feature UI, lecz twardy test kierunku:

- dwa niezależne rigid body;
- free hinge z tarciem i opcjonalnym limitem;
- powered hinge z target speed oraz max torque;
- stabilność przez długi soak;
- kolizje między podzespołami;
- porównanie Cannon.js, cannon-es i Rapier wyłącznie na tej samej baterii.

## Phase 1E — Per-Block Control Bus

Pierwsza wersja grywalna:

- aktywne bloki mają deklarowane porty;
- każdy thruster można adresować przez `blockId`;
- tryby: `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min, max;
- grupy urządzeń;
- pilot axes i custom actions jako źródła sygnału;
- konfiguracja zapisywana w blueprintcie i migrowana.

Obecny mikser pozostaje domyślny, aby prosty statek nadal latał natychmiast po zbudowaniu.

## Phase 1E.1 — Sensors, Logic & Scope

Minimalne porty:

- Altitude;
- vertical speed;
- local/world angular velocity;
- orientation i attitude error;
- fuel, health i effective actuator output.

Minimalna logika:

- Constant;
- Add/Subtract;
- Multiply;
- Clamp;
- Compare/Switch;
- Integrator;
- PID.

Live Scope korzysta z tego samego systemu sygnałów, nie z osobnego hardkodowanego logu.

## Phase 1F — Articulated Assemblies

Pierwsze bloki mechaniczne:

- Free Bearing;
- Rotary Motor;
- Servo Bearing.

Kompilator:

1. rozpoznaje krawędzie sztywne i krawędzie jointów;
2. dzieli konstrukcję na rigid islands;
3. liczy osobne mass properties;
4. tworzy `ConstraintPlan[]`;
5. wykrywa rigid bypass wokół jointa;
6. mapuje sygnały sterujące do konkretnego jointa.

Następnie: wały, przekładnie, pistony, wirniki, obrotowe gondole, składane skrzydła i docking.

## Collider Compiler

Greedy merge nadal jest potrzebny, ale działa osobno dla każdej rigid island. Jego wdrożenie zależy od benchmarku 1D.3, nie od arbitralnego numeru etapu.

## Rzeczy świadomie odłożone

- pełny tensor 3x3 przy obecnym Cannon;
- zaawansowany crossflow drag i środki oporu;
- tuning scale height;
- rozbudowane predykcje czasu lotu;
- duży system kampanii;
- multiplayer.

Żadna z tych rzeczy nie może wyprzedzić pierwszego Per-Block Control Bus bez konkretnego problemu blokującego.
