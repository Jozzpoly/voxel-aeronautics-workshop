# Roadmap po Foundation Phase 1D.2E

## Ukończone — Phase 1D.2E

- input profile v3 z akcjami obu regulatorów mocy;
- rebindable `−/+` dla Passive vertical thrust oraz `,/.` dla Balloon power;
- automatyczna migracja profili v1–v2 bez przejmowania zajętych klawiszy;
- centralny `setThrusterPower()` obok `setBalloonPower()`;
- wspólny sample pionowego wsparcia dla UI;
- czyste `requiredSupplementalPowerForHover()`;
- marker progu zawisu i climb zone dla pasywnego ciągu;
- dynamiczne etykiety skrótów pobierane z aktualnego profilu;
- testy suwaka, hotkeyów, migracji i jednoczesnego sterowania z Left Ctrl;
- stały `DELIVERY_WORKFLOW.md` i obowiązkowe instrukcje aktualizacji repozytorium.

## Następny etap — Foundation Phase 1D.3: Runtime Body Builder & Headless Harness

### 1. Runtime body builder

- przenieść `CompiledCraft.parts -> colliders/runtime parts` poza `game.js`;
- zachować stabilne `blockKey -> collider/part`;
- zabezpieczyć payload, detach i recenter COM.

### 2. Headless physics harness

- free fall;
- hover i aerostatic equilibrium;
- settling oraz reakcja na oba regulatory pionowej siły;
- offset thrust i moment;
- zmiana COM;
- detach i długi soak.

### 3. Benchmark

- 100/500/1000/2500 colliderów;
- czas budowy body;
- średni i 99. percentyl kroku;
- pamięć i stabilność.

### 4. Decyzja backendowa

Cannon.js, cannon-es i Rapier porównywać dopiero na tej samej baterii scenariuszy.

## Sterowanie — dalsze prace równoległe, nieblokujące 1D.3

- import/export profilu;
- presety `Default Ctrl`, `Browser-safe`, `Left-handed`;
- gamepad i analogowe deadzony;
- widok konfliktów i filtr nieprzypisanych akcji;
- opcjonalny Pointer Lock połączony z Flight Focus;
- później szybsza regulacja mocy z konfigurowalnym krokiem lub osią analogową.

## Foundation Phase 2 — Collider Compiler

- greedy merge pełnych voxelowych boxów;
- osobne collidery części specjalnych;
- mapowanie trafienia scalonego collidera na voxel;
- lokalna rekompilacja po uszkodzeniu;
- podniesienie limitu lotu wyłącznie po pomiarach.

## Dalsze filary gameplayu

- sensory, aktuatory i graf sygnałów;
- mikrokontrolery, PID i oscyloskop;
- jointy, wirniki i wały;
- aerodynamika odsłoniętych powierzchni;
- komory gazowe, zawory i balast;
- świat, pogoda i długie loty;
- później multiplayer.
