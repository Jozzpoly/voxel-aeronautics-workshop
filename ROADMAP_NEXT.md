# Roadmap po Foundation Phase 1D.3B

## Kierunek produktu

VAW jest przede wszystkim sandboxem konstrukcyjno-programistycznym:

```text
buduj -> steruj ręcznie lub programuj -> obserwuj fizykę -> przebuduj
```

Kontrakty uczą i inspirują. Nie mogą zastąpić swobodnego budowania, sterowania każdym urządzeniem i tworzenia mechanizmów wielobryłowych.

## Ukończone — Phase 1D.3B

- prawdziwy Cannon.js 0.6.2 jest vendored wyłącznie do testów i uruchamiany automatycznie z Node;
- browser runtime harness nie wymaga już CDN dla Cannon;
- real-Cannon free fall, inertia parity, rotated inertia i torque response;
- offset thrust tworzący translację i obrót;
- payload removal oraz recenter podczas translacji i rotacji;
- prawdziwe zdarzenia kontaktowe normalizowane przez Physics Port;
- 12 000 kroków real-Cannon soak;
- pomiary build i `world.step` dla 100/500/1000/2500 colliderów;
- 50 cykli build/dispose z kontrolą pozostawionych body i pamięci;
- synchronizacja typu STATIC/DYNAMIC po zmianie masy w obu backendach;
- poprawiona bezwładność obróconej bryły w headless;
- pełna walidacja planu przed alokacją body/colliderów;
- atomowe usuwanie colliderów i rollback zachowujący pierwotny błąd;
- rygorystyczne wejście mass properties i RuntimeAssemblyPlan;
- twardy limit pracy CraftCompiler do `GRID.maxBlocks`;
- zachowana granica: `game.js` nie składa fizycznego assembly.

## Phase 1D.3C — Joint Capability Spike

Cel: sprawdzić najmniejszy prawdziwy mechanizm dwóch brył przed zaprojektowaniem publicznego API jointów i UI gracza.

Scenariusze:

- dwa niezależne rigid body z osobnymi mass properties;
- free hinge;
- limit kąta;
- pasywne tarcie / damping;
- powered hinge z `targetSpeed` i `maxTorque`;
- servo z `targetAngle`, limitem prędkości i momentu;
- włączanie/wyłączanie kolizji między połączonymi podzespołami;
- długi soak bez driftu prowadzącego do eksplozji solvera;
- bezpieczne usunięcie constraintu;
- bezpieczne usunięcie jednego body;
- rollback, gdy konstrukcja constraintu nie powiedzie się;
- sygnał sterujący odseparowany od mechanical graph.

Wynik spike ma określić minimalny neutralny kontrakt Physics Port dla hinge/motor/servo. Nie wolno przed wynikiem tworzyć ogólnego „API do wszystkich jointów”.

## Decyzja o Collider Compilerze

Real-Cannon benchmark pustego świata pokazał, że koszt samej budowy compound body rośnie mocno:

| Collidery | Mediana build | Mediana step | P99 step |
|---:|---:|---:|---:|
| 100 | 3.101 ms | 0.0131 ms | 0.0217 ms |
| 500 | 26.888 ms | 0.0622 ms | 0.0791 ms |
| 1000 | 85.201 ms | 0.1260 ms | 0.1524 ms |
| 2500 | 482.791 ms | 0.3292 ms | 0.3744 ms |

To uzasadnia dalszy pomiar i prototyp greedy merge, ale **nie** uzasadnia jeszcze podniesienia limitu 480 części. `world.step` był mierzony bez aktywnych kontaktów między tysiącami shape’ów. Przed zmianą limitu potrzebne są scenariusze z podłożem, przeszkodami, uszkodzeniami i jointami.

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

## Rzeczy świadomie odłożone

- pełny tensor 3×3 przy obecnym Cannon;
- zaawansowany crossflow drag i środek oporu kadłuba;
- tuning scale height;
- pozornie precyzyjne predykcje czasu lotu;
- duży system kampanii;
- multiplayer.

Żadna z tych rzeczy nie wyprzedza joint spike i Per-Block Control Bus bez konkretnego problemu blokującego.
