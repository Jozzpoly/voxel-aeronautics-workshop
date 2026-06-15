# Roadmap po Foundation Phase 1D.2D

## Ukończone — Phase 1D.2D

- input profile v2 z trwałymi, migrowanymi bindingami;
- dwa sloty na każdą komendę lotu;
- runtime rebind UI w panelu Controls;
- domyślny Left Ctrl jako zejście bez używania Shift;
- ostrzeżenia o ryzyku modifierów;
- opcjonalny Flight Focus: JavaScript fullscreen + Keyboard Lock;
- dynamiczne odświeżanie zablokowanych kodów po rebindingu;
- UI preferences v5 z migracją v1–v4;
- testy migracji, konfliktów, capture i startup smoke.

## Następny etap — Foundation Phase 1D.3: Runtime Body Builder & Headless Harness

### 1. Runtime body builder

- przenieść `CompiledCraft.parts -> colliders/runtime parts` poza `game.js`;
- zachować stabilne `blockKey -> collider/part`;
- zabezpieczyć payload, detach i recenter COM.

### 2. Headless physics harness

- free fall;
- hover i aerostatic equilibrium;
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

## Wejście — dalsze prace równoległe, nieblokujące 1D.3

- import/export profilu;
- preset `Default Ctrl`, `Browser-safe`, `Left-handed`;
- gamepad i deadzony analogowe;
- widok konfliktów i filtr nieprzypisanych akcji;
- połączenie Flight Focus z opcjonalnym Pointer Lock;
- badanie osobnego desktop wrappera, jeśli webowe ograniczenia skrótów okażą się zbyt uciążliwe.

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
