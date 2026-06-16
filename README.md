# Voxel Aeronautics Workshop — Foundation Phase 1D.3E

**Gate A Convergence — assembly-centric flight lifecycle**

Voxel Aeronautics Workshop jest desktopowym voxelowym sandboxem inżynieryjnym. Gracz buduje maszynę blok po bloku, testuje ją w fizyce, analizuje zachowanie i stopniowo dodaje automatykę. Główna fantazja pozostaje niezmienna:

> **Buduję, programuję, testuję i pilotuję własną voxelową maszynę.**

## Stan wydania

Phase 1D.3E domyka Gate A z `FOUNDATION_READINESS_REVIEW.md`. Nie jest to jeszcze Rigid Island Compiler ani graczowy system jointów. To zakończenie migracji, która w 1D.3D była tylko seamem:

- `RuntimeAssembly` jest jedynym źródłem prawdy aktywnego lotu;
- `game.flight-session` posiada build, rejestrację, primary-body policy, neutralne query, visual roots i retry-safe cleanup;
- `game.flight-integrity` posiada health, damage, exact collider/body ownership, detach, payload, recenter, mass properties i lifecycle debris;
- `game.debris-runtime` izoluje fizyczny i wizualny adapter odłamków;
- `game.js` pozostaje composition rootem i nie buduje assembly ani debris bezpośrednio;
- kamera, HUD i misje korzystają z neutralnych próbek primary body;
- visual ownership jest per body;
- cleanup zachowuje uchwyty do retry i wykonuje kolejność constraint → listener/collider → body → visual;
- single-body gameplay zachowuje dotychczasową semantykę.

## Świadome ograniczenia

- `CraftCompiler` nadal emituje jedną rigid island.
- Gameplay detach jest jawnie ograniczony do `primary-rigid-island-only`.
- Hinge istnieje jako neutralny kontrakt runtime i real-Cannon capability proof, ale nie ma jeszcze produkcyjnego authoringu w blueprintach.
- Nie ma assembly spaces, typed device ports ani deterministic ControlRuntime.
- Nie ma finalnego node editora, kabli, busu, wireless ani multiplayera.

To są granice Gate B–E, a nie ukryte braki Gate A.

## Uruchomienie

Najprościej otworzyć jednoplikowy build z katalogu `dist/` po wykonaniu:

```bash
python tools/build_release.py
```

Wersja źródłowa wymaga serwera HTTP:

```bash
python tools/serve.py
```

Następnie otwórz adres wypisany przez skrypt.

## Testy

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Bateria obejmuje między innymi:

- domenę blueprintu i trwałe `blockId`;
- compiler i runtime assembly;
- Physics Port, headless backend oraz real Cannon 0.6.2;
- mass properties, recenter i point velocity;
- hinge free/motor/servo, soft limits i `collideConnected`;
- wielobryłowy lifecycle, per-body visuals i exact ownership;
- cleanup retry, allocation rollback i start → stop → start;
- debris adapter;
- startup smoke, `fullscreenchange` oraz aktywny `pagehide`;
- source parity, deterministic build i release identity.

## Kanoniczne dokumenty

- `PROJECT_VISION.md` — produktowa obietnica i anti-goals.
- `AI_PROJECT_MEMORY.md` — aktualny punkt wejścia kolejnego agenta.
- `ARCHITECTURE.md` — granice warstw i rzeczywisty przepływ danych.
- `ROADMAP_NEXT.md` — Gate B–E w kolejności zależności.
- `FOUNDATION_READINESS_REVIEW.md` — formalny status bramek.
- `PROGRAMMABLE_MACHINE_RESEARCH.md` — kontrakty przyszłej programowalnej maszyny.
- `FOUNDATION_CONVERGENCE_REVIEW.md` — mapa ryzyka i drugi review 1D.3E.
- `PHASE_1D3E_REPORT.md` — raport wykonawczy wydania.
- `TEST_REPORT.md` i `VALIDATION_REPORT.md` — rzeczywiście uruchomiona walidacja.
- `DELIVERY_WORKFLOW.md` i `PUSH_INSTRUCTIONS.md` — bezpieczna dostawa bez force-pushu.

## Następna bramka

**Phase 1D.4A — Rigid Islands & Mechanical Graph Compiler.**

Przed implementacją potrzebny jest ADR authoringu mechanical links, stabilnych `bodyId`/`constraintId`, przecięcia structural connectivity, rigid bypass diagnostics oraz decyzji o blueprint v11. Gate B nie może powstać jako ręcznie złożony drugi body w `game.js`.
