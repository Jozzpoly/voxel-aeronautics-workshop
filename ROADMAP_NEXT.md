# Roadmap po Foundation Phase 1C.2

## Ukończone — Phase 1C.2

- blueprint v9 i orientowany Command Core;
- jawny `CompiledCraft.controlFrame`;
- sześć osi sterowania z `sway`;
- profil użytkownika z odwracaniem i czułością każdej osi;
- transformacja wejścia do lokalnych osi konstrukcji;
- wspólny, trwały system okien workspace;
- otwieranie, zamykanie, minimalizacja, przeciąganie i resize;
- osobne okno Controls i monitor układu odniesienia;
- naprawiony deterministic release ZIP bez zduplikowanych artefaktów.

## Ukończone — Phase 1C

- blueprint v8;
- pusty warsztat i dowolny pierwszy blok;
- ruchomy oraz usuwalny Core;
- rozdzielenie poprawności edytora od gotowości do lotu;
- `CraftCompiler` z deterministycznym `CompiledCraft`;
- rzeczywista pozycja Core używana przez runtime i payload;
- osobne osie translacji `surge` i `lift`;
- poprawiony kierunek A/D;
- Space / Left Ctrl dla góra / dół;
- priorytet wejść lotu nad skrótami edytora;
- nowe testy interakcyjne i regresyjne.

## Następny etap — Foundation Phase 1D: Physics Boundary

### 1. Kontrakt backendu

Zdefiniować minimalne, neutralne porty:

- `PhysicsWorld`;
- `RigidBody`;
- `Collider`;
- dodawanie/usuwanie body;
- siła i moment w punkcie;
- transformacje local/world;
- krok symulacji;
- zdarzenia kontaktu;
- aktualizacja masy.

Nie budować jeszcze uniwersalnego silnika wszystkiego. Interfejs ma pokrywać rzeczywiste potrzeby obecnego runtime.

### 2. Adapter Cannon.js

- zachować Cannon.js jako wynik referencyjny;
- przenieść budowę body i box colliderów poza `game.js`;
- zachować mapowanie `blockKey -> runtime part/collider`;
- zabezpieczyć payload, obrażenia i odrywanie części;
- porównać wyniki przed/po adapterze.

### 3. Headless physics harness

Bez Three.js i DOM testować:

- spadek swobodny;
- hover;
- ciąg w osi;
- moment od niesymetrycznego thrustera;
- zmianę COM;
- odłączenie części;
- długi soak stabilności;
- 100/500/1000/2500 części.

### 4. Benchmark bazowy

Mierzyć osobno:

- czas kompilacji;
- czas tworzenia body;
- koszt jednego kroku;
- 99. percentyl kroku;
- liczbę kształtów;
- zużycie pamięci;
- stabilność kontaktów.

### 5. Decyzja backendowa

Dopiero po adapterze i benchmarku porównać:

- obecny Cannon.js;
- cannon-es;
- Rapier.

Migracja nie może być jednocześnie migracją gameplayu.

## Foundation Phase 2 — Collider Compiler

- greedy merge pełnych voxelowych boxów;
- osobne collidery dla części specjalnych;
- mapowanie trafienia scalonego collidera na voxel;
- lokalna rekompilacja po uszkodzeniu;
- filtrowanie self-collision;
- podniesienie limitu lotu wyłącznie po pomiarach.

## Foundation Phase 3 — Rendering Boundary

- instancing modułów;
- picking instancji;
- dirty regions;
- wspólne geometrie i materiały;
- budżet draw calli i GPU.

## Następne filary gameplayu

Po stabilnych granicach fizyki i renderera:

- sensory, aktuatory i graf sygnałów;
- mikrokontrolery, PID i oscyloskop;
- jointy, wirniki i wały;
- aerodynamika odsłoniętych powierzchni;
- komory gazowe, zawory i balast;
- świat, pogoda i długie loty;
- dopiero później multiplayer.
