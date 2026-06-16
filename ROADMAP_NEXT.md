# Roadmap po Foundation Phase 1D.3B.1

## Kierunek produktu

VAW jest przede wszystkim sandboxem konstrukcyjno-programistycznym:

```text
buduj -> steruj ręcznie lub programuj -> obserwuj fizykę -> przebuduj
```

Kontrakty uczą i inspirują. Nie mogą zastąpić swobodnego budowania, sterowania każdym urządzeniem i tworzenia mechanizmów wielobryłowych.

## Ukończone — Phase 1D.3B.1

- `game.js` zmniejszony z 4697 do 2358 linii i z około 220 kB do około 108 kB;
- dziewięć jawnych modułów `game.*` z dependency injection;
- scena, kariera, workspace, input settings, orientacja, modele bloków, analiza, blueprinty i misje mają pojedynczych właścicieli;
- `game.js` jest ostatnim composition rootem, a moduły nie czytają `window.VAW_RUNTIME`;
- wspólne `APP_SOURCES` zasila loader, source manifest, single HTML, ZIP i testy;
- nowe testy usług i granic game shell;
- limit przeciw ponownemu rozrostowi `game.js`;
- lifecycle `pagehide` i `fullscreenchange` jest delegowany przez jawne API modułów;
- zachowane Assembly Builder, Physics Port, real Cannon parity i wszystkie wcześniejsze zachowania gry.

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
- długi soak bez eksplozji solvera;
- bezpieczne usunięcie constraintu i body;
- rollback przy błędzie konstrukcji constraintu;
- sygnał sterujący odseparowany od mechanical graph.

Wynik spike ma określić minimalny neutralny kontrakt Physics Port. Nie tworzyć wcześniej ogólnego „API do wszystkich jointów”.

## Refaktor po joint spike

Gdy model wielu body będzie znany:

1. wydzielić `game.flight-session` jako właściciela start/stop i RuntimeAssembly lifecycle;
2. wydzielić `game.flight-integrity` jako właściciela damage, detach, payload i debris;
3. wydzielić `game.camera-controller`;
4. rozważyć `game.workshop-controller`, ale bez przenoszenia źródła prawdy z `CraftModel`;
5. pozostawić `src/game.js` jako cienką kompozycję, event routing i główną pętlę.

Nie należy teraz wydzielać publicznego API flight/integrity opartego na pojedynczym `STATE.flight.body`.

## Decyzja o Collider Compilerze

Real-Cannon benchmark pustego świata pokazuje silny wzrost kosztu budowy compound body. Nie uzasadnia to podniesienia limitu 480 części. Przed zmianą limitu potrzebne są scenariusze z podłożem, przeszkodami, uszkodzeniami i jointami oraz prototyp greedy merge.

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
- diagnostyka brakujących endpointów.

## Phase 1E.1 — Sensors, Logic & Scope

Minimalne sensory: altitude, vertical speed, angular velocity, orientation, fuel, health i actuator output.

Minimalne węzły: Constant, Add/Subtract, Multiply, Clamp, Compare/Switch, Integrator i PID.

Live Scope obserwuje prawdziwe sygnały control busu.

## Phase 1F — Articulated Assemblies

Pierwsze bloki gracza: Free Bearing, Rotary Motor i Servo Bearing.

Kompilator dzieli projekt na rigid islands, tworzy `ConstraintPlan[]`, wykrywa rigid bypass i zachowuje stabilne `blockId`, `bodyId` oraz joint identity.

## Rzeczy świadomie odłożone

- pełny tensor 3×3 przy obecnym Cannon;
- zaawansowany crossflow drag;
- tuning scale height;
- duży system kampanii;
- multiplayer.
