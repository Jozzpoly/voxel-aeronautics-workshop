# Roadmap po Foundation Phase 1D.3A

## Kierunek produktu

VAW jest przede wszystkim sandboxem konstrukcyjno-programistycznym:

```text
buduj -> steruj ręcznie lub programuj -> obserwuj fizykę -> przebuduj
```

Kontrakty uczą i inspirują. Nie mogą zastąpić swobodnego budowania, sterowania każdym urządzeniem i tworzenia mechanizmów wielobryłowych.

## Ukończone — Phase 1D.3A

- produkcyjny `runtime.assembly-builder` zintegrowany z lotem;
- wielobody API buildera bez zakodowanego założenia pojedynczej bryły;
- transakcyjna budowa i rollback;
- stabilne mapy `bodyId`, `colliderId`, `blockId -> part/body/collider`;
- usuwanie colliderów przez trwałe `blockId`;
- wspólny `foundation.mass-properties` dla kompilatora, payloadu i detach;
- jawne mass properties stosowane przez Physics Port;
- recenter zachowujący światową pozycję i prędkość nowego COM;
- `getPointVelocity()` za granicą Physics Port;
- deterministyczny backend headless bez DOM/WebGL;
- headless free fall, hover, torque, offset thrust, inertia parity i 12 000 kroków soak;
- test multi-body buildera oraz seam `constraintBuilder`;
- benchmark budowy 100/500/1000/2500 colliderów na backendzie headless;
- manualny browser harness dla prawdziwego adaptera Cannon;
- test regresyjny zabraniający ponownego składania głównego body w `game.js`.

## Phase 1D.3B — Real-Cannon Harness & Runtime Parity

Cel: sprawdzić produkcyjny adapter na tej samej baterii, bez mieszania wyników z uproszczonym backendem headless.

Scenariusze:

- free fall i inertia parity na rzeczywistym Cannon.js;
- moment 1 N·m i oczekiwana prędkość kątowa;
- offset thrust;
- payload, zmiana COM i recenter podczas obrotu;
- detach podczas translacji i rotacji;
- długi soak;
- stabilność po wielokrotnym remove/recenter;
- lifecycle bez pozostawionych body i listenerów.

Pomiary:

- build time dla 100/500/1000/2500 colliderów;
- średni, medianowy i 99. percentyl `world.step`;
- koszt detach/recenter;
- wzrost pamięci podczas powtarzanego start/return;
- wyniki osobno dla headless architecture baseline i real Cannon.

Kryterium: żadnej decyzji o collider compilerze ani zmianie backendu bez wyników tej samej baterii.

## Phase 1D.3C — Joint Capability Spike

Twardy eksperyment techniczny, jeszcze bez finalnego UI:

- dwa niezależne rigid body;
- free hinge;
- limit kąta i tarcie;
- powered hinge: target speed + max torque;
- tryb servo: target angle;
- stabilność długiego soak;
- wyłączone lub kontrolowane kolizje połączonych podzespołów;
- bezpieczne usunięcie constraintu i jednego body;
- sygnał sterujący odseparowany od mechanical graph.

Spike ma odpowiedzieć, czy obecny backend i Physics Port wystarczą dla Free Bearing, Rotary Motor i Servo Bearing. Nie może rozrosnąć się w pełny system mechaniczny przed wynikiem testów.

## Phase 1E — Per-Block Control Bus

Pierwsza wersja grywalna:

- każdy aktywny blok deklaruje porty;
- konkretny thruster jest adresowany przez `blockId`;
- tryby `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min i max;
- grupy urządzeń;
- pilot axes i custom actions jako źródła sygnału;
- konfiguracja zapisywana i migrowana w blueprintcie;
- odłączony lub uszkodzony blok zachowuje tożsamość konfiguracji;
- diagnostyka brakujących endpointów po usunięciu bloku.

Obecny mikser pozostaje domyślny, aby prosty statek działał natychmiast.

## Phase 1E.1 — Sensors, Logic & Scope

Minimalne sensory:

- altitude;
- vertical speed;
- local/world angular velocity;
- orientation i attitude error;
- fuel, health i effective actuator output.

Minimalne węzły:

- Constant;
- Add/Subtract;
- Multiply;
- Clamp;
- Compare/Switch;
- Integrator;
- PID.

Live Scope obserwuje prawdziwe sygnały control busu. Pierwszy demonstrator to regulacja wysokości grupy wybranych thrusterów, nie hardkodowany globalny autopilot.

## Phase 1F — Articulated Assemblies

Pierwsze bloki gracza:

- Free Bearing;
- Rotary Motor;
- Servo Bearing.

Kompilator:

1. rozpoznaje sztywne krawędzie i joint edges;
2. dzieli projekt na rigid islands;
3. liczy osobne mass properties;
4. tworzy `ConstraintPlan[]`;
5. wykrywa rigid bypass wokół jointa;
6. mapuje porty sterujące do konkretnego constraintu;
7. zachowuje stabilne `blockId`, `bodyId` i joint identity.

Następnie: wały, przekładnie, pistony, wirniki, obrotowe gondole, składane skrzydła i docking.

## Collider Compiler

Greedy merge pozostaje ważny, ale działa osobno dla każdej rigid island. Termin zależy od real-Cannon benchmarku. Nie podnosimy limitu lotu na podstawie benchmarku samego buildera headless.

## Rzeczy świadomie odłożone

- pełny tensor 3×3 przy obecnym Cannon;
- zaawansowany crossflow drag i środek oporu kadłuba;
- tuning scale height;
- pozornie precyzyjne predykcje czasu lotu;
- duży system kampanii;
- multiplayer.

Żadna z tych rzeczy nie wyprzedza Per-Block Control Bus bez konkretnego problemu blokującego.
