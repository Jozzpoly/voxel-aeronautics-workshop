# Research kierunku — sublevele, mechanizmy i programowalne maszyny

Stan researchu: 16 czerwca 2026. Dokument opisuje decyzje kierunkowe, nie zaakceptowane publiczne API.

## Cel

Przed rozpoczęciem graczowych subleveli, kabli, wireless i edytora zachowań trzeba ustalić, **co jest tożsamością**, **co jest grafem**, **co jest transportem**, a **co wykonaniem runtime**.

Fantazja VAW:

```text
buduj blok po bloku
-> adresuj urządzenia blok po bloku
-> przypisz lub zaprogramuj zachowanie
-> lataj ręcznie albo automatycznie
-> obserwuj prawdziwą awarię
-> przebuduj bez utraty tożsamości maszyny
```

## Sable i Create Aeronautics / Simulated

Oficjalny opis Sable definiuje sublevele jako poruszające się regiony zawierające zwykłe bloki, block entities i entities, które pozostają interaktywne. Warstwa ma własny pipeline fizyki oparty na Rapierze i świadomie nie dostarcza survivalowego contentu ani sposobu składania subleveli.

Create Aeronautics korzysta z Sable i dzieli projekt na:

- **Simulated** — assembly, redstone i tooling dla physics contraptions;
- **Aeronautics** — content lotniczy;
- **Offroad** — content pojazdów lądowych.

### Lekcja dla VAW

Przyjąć rozdzielenie odpowiedzialności, nie technikę implementacji Minecrafta:

- moving assembly potrzebuje stabilnego local coordinate space;
- identity urządzenia ma przeżyć ruch;
- sublevel infrastructure nie może znać reguł samolotów;
- content lotniczy konsumuje assembly API;
- fizyka, tooling i content pozostają wymiennymi warstwami.

VAW nie potrzebuje intruzyjnych mixinów. W browserowym projekcie sublevel powinien być jawnym obiektem domenowym/runtime z transformem i ownership.

## Valkyrien Skies 2 / Clockwork

Clockwork oddziela dane bearingu, physics controller i ComputerCraft peripheral. Peripheral wystawia typowane operacje: assemble/disassemble, tryb, target angle, actual angle, angular speed i stan. Skrypt nie dostaje natywnego solver handle.

`BearingController` utrzymuje osobne kolejki create/update/remove, liczy inertia-aware torque, przykłada równą i przeciwną reakcję do połączonych statków oraz ogranicza torque i jego zmianę.

Duży `PhysBearingBlockEntity` pokazuje koszt lifecycle zaprojektowanego zbyt późno: restore, settling, matching jointów, deferred creation, disassembly i cleanup wymagają wielu stanów przejściowych.

### Lekcja dla VAW

- publiczne API urządzenia to typed commands/telemetry, nigdy Cannon object;
- mechanical identity jest oddzielna od target speed/angle;
- controller powinien znać bezwładność i ograniczać torque/rate;
- save/restore i missing endpoint behavior projektujemy przed mnożeniem contentu;
- jeden blok nie może posiadać jednocześnie assembly, persistence, UI, solver control i recovery.

## Factorio circuit network

Factorio rozdziela fizyczne czerwone/zielone sieci, nadawców, odbiorców, kanały sygnałowe i combinatory. Wartości tego samego kanału są agregowane, topology jest widoczna, feedback ma konsekwencje tickowe, a hover pokazuje network values. Radarowe przesyłanie sygnałów jest dodatkowym transportem, nie nową semantyką sygnału.

### Lekcja dla VAW

- urządzenia publikują i konsumują zadeklarowane porty;
- topology i znaczenie sygnału są osobne;
- logic nodes muszą być deterministyczne i inspectable;
- feedback wymaga jawnej semantyki ticku;
- live values, highlight path i diagnostyka są fundamentem UX.

VAW powinno zacząć znacznie prościej: scalar, boolean/event, jawne porty i widoczne wartości.

## Stormworks

Stormworks pokazuje ogromną kreatywność wynikającą z logic nodes, microcontrollers, sensorów, actuatorów i ekranów. Jednocześnie duże ukryte grafy oraz nienazwane composite channels stają się trudne do debugowania.

### Lekcja dla VAW

- reusable behavior modules mają sens, lecz publiczne porty muszą być nazwane i typowane;
- continuous scalar i event/boolean nie powinny być jednym niejasnym typem;
- scope, endpoint search i diagnostyka są obowiązkowe;
- gracz nie może szukać przyczyny aktywnego thrusteru w niewidzialnym globalnym grafie.

## Space Engineers

Space Engineers pokazuje dwie skale sterowania: proste toolbar/group actions oraz pełne programmable blocks dla zaawansowanej automatyki.

### Lekcja dla VAW

Złożoność powinna rosnąć:

1. default mixer;
2. direct action binding;
3. control group + gain/invert/trim/clamp;
4. visual logic graph;
5. advanced scripted controller dopiero po bezpiecznym API.

Skryptowanie nie może być wymagane do przypisania przycisku do silnika lub serwa.

## Zalecany model VAW

```text
BlueprintDocument
  blocks[]
  deviceConfigByBlockId
  mechanicalLinks[]
  signalLinks[]
  logicNodes[]
  controlBindings[]

Compilation
  CraftCompiler
  -> RigidIslandCompiler
  -> MechanicalGraphCompiler
  -> DeviceEndpointCompiler
  -> SignalGraphCompiler

Runtime
  RuntimeAssembly
    bodies / constraints / parts / endpoint resolution
  ControlRuntime
    input sources -> signal graph -> actuator commands
  Physics Port
    forces / torques / constraints
```

## Reguły tożsamości

- blok: `blockId`;
- mechanical link: stabilny `constraintId` niezależny od native object;
- endpoint: `{blockId, portId}`;
- logic node: `nodeId`;
- signal link: `linkId`;
- współrzędne opisują placement, nigdy identity.

## Minimalny model portów — przykład do osobnego review

```text
Thruster
  input  command       scalar [-1, 1]
  input  enabled       boolean
  output actualOutput  scalar
  output fuelLimited   boolean

ServoBearing
  input  targetAngle   scalar [rad]
  input  maxTorque     scalar [N*m]
  output actualAngle   scalar [rad]
  output angularSpeed  scalar [rad/s]
  output atLimit       boolean

AltitudeSensor
  output altitude      scalar [m]
  output verticalSpeed scalar [m/s]
```

Nazwy i zakresy wymagają osobnego API review przed blueprint v11.

## Control tick

Evaluator powinien działać w deterministycznym fixed ticku niezależnym od render FPS. Pierwsza wersja:

- ma twarde limity nodes/links/work;
- ma stabilny evaluation order;
- odrzuca algebraic cycles albo wymaga jawnego `Delay/Memory`;
- oddziela event edge od stałej wartości boolean;
- aplikuje actuator commands dopiero po zakończeniu evaluation;
- nie wykonuje arbitralnego JavaScriptu z save.

## Kable, bus i wireless

Każdy transport rozwiązuje te same endpointy do tego samego signal graph contractu:

- **direct/internal** — bez widocznego kabla, dobry dla prototypu i default mixera;
- **cable** — widoczna trasa, length/cost/damage;
- **bus** — wiele nazwanych kanałów jednym fizycznym połączeniem;
- **wireless** — address/channel, range, power, interference lub latency;
- **joint pass-through** — jawny bridge między rigid islands.

Awaria transportu usuwa lub degraduje connectivity. Nie zmienia typu portu ani kolejności ewaluacji.

## Znaczenie sublevelu w VAW

Pierwszy sublevel/assembly space powinien oznaczać:

- stabilną lokalną przestrzeń współrzędnych;
- jedną lub więcej rigid islands wynikających z blueprintu;
- jawny local-to-world transform;
- stabilne mapowanie block/device → body;
- identity interakcji i sygnałów niezależne od world pose;
- jawne ownership przy split, detach i dock.

Nie tworzymy drugiego modelu blueprintu. Blueprint jest autorytatywny, a sublevel jest compiled/runtime view.

## Bramki przed implementacją finalnego systemu

1. `FlightSession` i `FlightIntegrity` nie zakładają jednego globalnego body.
2. Istnieje rigid-island i mechanical graph compiler z rigid-bypass diagnostics.
3. Device catalog deklaruje porty bez DOM, Three i Cannon.
4. Schema/migration device settings i links jest zaprojektowana oraz fuzz-tested.
5. Deterministic evaluator ma policy cykli, ordering, budżetu i liczb.
6. Missing/damaged/detached endpoint behavior jest zdefiniowany.
7. Live diagnostics i scope mają model danych przed finalnym UI.
8. Dopiero potem wybieramy pierwszą fizyczną prezentację cable/wireless.

## Źródła przejrzane

- oficjalne strony i repozytoria Sable oraz Create Aeronautics / Simulated Project;
- oficjalne repozytoria Valkyrien Skies 2 i Clockwork, w tym `PhysBearingData`, `PhysBearingBlockEntity`, `BearingController` i `PhysBearingPeripheral`;
- oficjalna Factorio Wiki — Circuit network;
- dokumentacja i historia VAW przez Foundation 1D.3B.1 oraz cały diff 1D.3C.
