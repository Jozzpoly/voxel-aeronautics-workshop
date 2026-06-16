# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia. Najpierw przeczytaj ten plik, następnie `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, najnowszy raport fazy, `VALIDATION_REPORT.md`, `TEST_REPORT.md`, `DELIVERY_WORKFLOW.md` i odpowiadające testy.

## 1. Wizja

Główna fantazja:

> **buduję, programuję, testuję i latam własnym voxelowym statkiem lub maszyną powietrzną.**

Sandbox i ręczne latanie są pełnoprawnym rdzeniem. Kontrakty, gwiazdki i progresja są pomocnicze.

Docelowo gracz może:

- adresować i programować każdy funkcjonalny blok osobno;
- łączyć sensory, logikę i aktuatory grafem sygnałów;
- zachować domyślny mikser albo przejąć bezpośrednią kontrolę;
- budować wiele sztywnych podzespołów połączonych free bearing, rotary motor, servo i innymi jointami;
- tworzyć wirniki, obrotowe gondole, składane konstrukcje i mechanizmy.

## 2. Aktualny milestone

**Foundation Phase 1D.3C — Joint Capability & Minimal Hinge Contract**

Ukończone fundamenty:

- blueprint v10 z trwałym `blockId` niezależnym od `gridKey`;
- `CompiledCraft` i `RuntimeAssemblyPlan` jako neutralne kontrakty;
- produkcyjny `runtime.assembly-builder` używany przez lot;
- real-Cannon i deterministic-headless harnessy;
- rygorystyczne mass properties, recenter i Physics Port;
- modularny game shell z `src/game.js` jako composition rootem;
- minimalny, świadomie hinge-only kontrakt constraintów w Physics Porcie;
- backend capabilities jawnie deklarują wsparcie `constraints.hinge`;
- Assembly Builder tworzy, mapuje, steruje i usuwa prawdziwe jointy bez zewnętrznego `constraintBuilder`;
- free hinge, motor prędkościowy, servo pozycyjne, pasywne tarcie i miękkie limity kąta działają na Cannon.js 0.6.2;
- `collideConnected` jest ustawiane jawnie, ponieważ konstruktor Cannona 0.6.2 nie respektuje tej opcji;
- body nie może zostać usunięte przed constraintem, który je referencjonuje;
- nieudane tworzenie lub usuwanie jointa zachowuje transakcyjność map i rollback;
- 12 000 kroków joint soak przechodzi bez NaN i bez eksplozji solvera;
- deterministyczny ZIP + single HTML zachowują source parity.

## 3. Nienaruszalne reguły domenowe i runtime

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest jedynym zweryfikowanym wejściem runtime.
3. Meshe, body, shapes i DOM nie trafiają do blueprintu.
4. Core ma specjalną rolę, nie specjalną pozycję.
5. Edytor dopuszcza pusty, bez-Core i rozłączony WIP.
6. Start obecnego gameplay runtime nadal wymaga dokładnie jednego Core i jednej połączonej wyspy.
7. Zmiany wieloblokowe są atomowe.
8. Każda wersja zapisu ma migrację.
9. `blockId` jest trwałą tożsamością; współrzędne nie mogą jej zastąpić.
10. Przeniesienie urządzenia zachowuje `blockId`; kopiowanie tworzy nowe `blockId`.
11. Pojedyncze body jest pierwszym przypadkiem `RuntimeAssembly`, nie docelowym ograniczeniem.
12. Structural graph, mechanical graph i signal graph są osobnymi modelami.
13. Joint przecina sztywne połączenie; rigid bypass musi być diagnozowany.
14. Globalne regulatory i mikser są domyślnymi źródłami sygnału, nie końcowym modelem sterowania.
15. PID jest zwykłym węzłem logiki, nie wyjątkiem zaszytym w fizyce.
16. Kod gry nie może omijać Physics Portu.
17. Główne body, collidery i constraints konstrukcji tworzy `runtime.assembly-builder`, nie composition root ani moduły prezentacji.
18. Plan assembly musi zostać w pełni zweryfikowany przed pierwszą alokacją backendu.
19. Nieudana mutacja backendu nie może wcześniej uszkodzić map runtime.
20. Rollback musi zachować pierwotny błąd; błędy cleanup są informacją dodatkową.
21. Panel analizy i solver muszą korzystać ze zgodnych właściwości masowych.
22. Recenter musi zachować prędkość nowego COM i przechodzić przez Physics Port.
23. Headless deterministic backend jest harness-em architektury, nie substytutem solvera kontaktów ani jointów.
24. Wyniki real Cannon i headless muszą być raportowane osobno.
25. Nie podnosić limitu części bez scenariuszy kontaktowych i świadomej strategii colliderów.

## 4. Nienaruszalne reguły constraintów

26. Publiczny kontrakt 1D.3C obsługuje tylko `kind: "hinge"`; nie rozszerzać go przez zgadywanie przyszłych jointów.
27. `ConstraintPlan` opisuje mechanical graph. Runtime control (`free`, `motor`, `servo`) jest osobnym, mutowalnym poleceniem i nie może modyfikować planu ani signal graphu.
28. Kąt hinge jest mierzony względem orientacji z chwili utworzenia constraintu.
29. `axisA` i `axisB` muszą wskazywać ten sam kierunek w world space, a pivoty muszą się pokrywać przed dodaniem do solvera.
30. Cannon 0.6.2 nie posiada natywnego asymetrycznego hard-stop hinge. `limits` w 1D.3C są miękkim limitem silnikowym; overshoot musi być testowany i raportowany.
31. `collideConnected` musi być ustawione jawnie na natywnym constrainte Cannona.
32. Constraint musi zostać usunięty przed body, które referencjonuje.
33. Backend nieobsługujący hinge musi odmówić przed alokacją body; headless nie może udawać solvera constraintów.
34. Każda mutacja constraintu stosuje backend-first, state-second; retry po `false` musi pozostać możliwy.
35. `constraintBuilder` pozostaje wyłącznie seam-em testowym/eksperymentalnym. Produkcyjna ścieżka używa Physics Portu.

## 5. Nienaruszalne reguły composition root

36. `src/game.js` jest ostatnim źródłem aplikacji i jedynym miejscem komponującym moduły `game.*`.
37. Moduły `src/game/` nie mogą importować `src/game.js` ani czytać `window.VAW_RUNTIME`.
38. Zależności modułów są deklarowane przez `window.VAW.define(...)` albo przekazywane jawnie do `create(...)`.
39. Prywatny timer, listener lub stan modułu nie może być mutowany z composition root; moduł wystawia jawne `flush`, `dispose` lub handler lifecycle.
40. Przeniesienie kodu do nowego pliku nie może tworzyć równoległego źródła prawdy ani omijać istniejącego modelu domenowego.
41. `APP_SOURCES` w `tools/build_release.py` jest kanoniczną kolejnością źródeł dla buildu i testów.
42. `game.js` ma pozostać poniżej 2500 linii i 120 kB do czasu kolejnej świadomej decyzji architektonicznej.
43. Kolejne wydzielenie flight/integrity musi być assembly-centric; nie tworzyć publicznego API opartego wyłącznie na `STATE.flight.body`.
44. Każda dostawa zawiera pełne źródła, single HTML, raport, walidację, sumy i instrukcję aktualizacji.
45. Nigdy nie zalecać zwykłego `git push --force`.
46. Domyślna dostawa to pełny ZIP projektu; użytkownik wykonuje lokalny commit i push.

## 6. Minimalny kontrakt hinge 1D.3C

Plan mechaniczny:

```text
constraintId, kind="hinge", bodyAId, bodyBId
pivotA, pivotB                    local body coordinates
axisA, axisB                      normalized local axes
collideConnected
maxForce                          structural solver force
frictionTorque
limits?                           soft min/max angle controller
control?                          initial runtime command
```

Runtime Assembly udostępnia:

```text
constraintById
setConstraintControl(id, command)
getConstraintState(id)
removeConstraint(id)
dispose()
```

Polecenia runtime:

- `free` — swobodny hinge, opcjonalnie z pasywnym tarciem;
- `motor` — `targetSpeed`, `maxSpeed`, `maxTorque`;
- `servo` — `targetAngle`, `maxSpeed`, `maxTorque`, gain i damping.

## 7. Aktualny podział game shell

```text
src/game.js                           composition root + flight/integrity/workshop glue
src/game/scene_environment.js         Three.js, world, static range and shared render assets
src/game/career_service.js            career normalization and persistence
src/game/workspace_controller.js      panel layout, z-order and UI preference persistence
src/game/input_settings_controller.js input profile UI and Flight Focus lifecycle
src/game/orientation_service.js       game-facing orientation helpers
src/game/module_visual_factory.js     block visual construction
src/game/engineering_analysis.js      analysis, warnings and telemetry presentation
src/game/blueprint_controller.js      save/load/import/export/history integration
src/game/mission_controller.js        contracts, markers, mission state and debrief
```

## 8. Reguły przyszłego systemu programowania

47. Endpoint urządzenia ma stabilną tożsamość `{ blockId, portId }`; współrzędne nie mogą być adresem sygnału.
48. `InputProfile` jest preferencją użytkownika. `controlBindings` są częścią projektu maszyny. Nie scalać ich w jeden format.
49. Structural graph, mechanical graph, signal graph, control bindings i fizyczny transport kablowy/wireless pozostają osobnymi warstwami.
50. Kabel, bus, wireless i joint pass-through mogą zmieniać dostępność, koszt, zasięg lub latency, ale nie semantykę portów.
51. Default mixer jest zwykłym źródłem/controllerem control runtime, nie wyjątkiem w fizyce.
52. Control runtime działa w deterministycznym fixed ticku i ma twardy budżet pracy.
53. Pierwsze typy publiczne to scalar oraz boolean/event. Feedback wymaga jawnego Delay/Memory.
54. Blueprint nie może zawierać arbitralnego wykonywalnego JavaScriptu.
55. Usunięty, uszkodzony lub odłączony endpoint tworzy diagnostykę; system nie może po cichu przepiąć linku po współrzędnych.
56. Sublevel/assembly space jest runtime/compiled view blueprintu, nie drugim źródłem prawdy.
57. Przed blueprint v11 wymagany jest osobny review schema, migracji, limitów i copy/move/delete semantics.
58. Przed finalnym UI kabli wymagane są assembly-centric flight, rigid-island compiler, typed ports i deterministic evaluator.

## 9. Najbliższy etap

**Phase 1D.3D — Assembly-Centric Flight Lifecycle Extraction**

1. wydzielić `game.flight-session` jako właściciela start/stop, `RuntimeAssembly`, world registration i cleanup;
2. zastąpić rozproszone odwołania do `STATE.flight.body` jawnym dostępem assembly-centric;
3. wydzielić `game.flight-integrity` dla damage, detach, payload i debris z jawnym body ownership;
4. dodać powtarzane multi-body workshop → flight → workshop i transient cleanup tests;
5. następnie wykonać rigid-island/mechanical compiler, assembly-space identity, typed device ports i deterministic control kernel;
6. nie dodawać finalnego UI kabli ani graczowych joint blocks przed tymi bramkami.

## 10. Następny gameplay

**Po bramkach 1D.3D i 1D.4A–D: Phase 1E — Per-Block Control Bus**

- konkretny aktywny blok i jego porty;
- `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min, max;
- grupy urządzeń;
- trwały zapis konfiguracji w blueprintcie;
- diagnostyka po usunięciu lub odłączeniu endpointu.

Następnie sensory, podstawowa logika, live scope i PID.

## 11. Świadomy dług

- gameplayowy planner nadal emituje jedno body i zero constraintów;
- nie istnieje jeszcze rigid-island compiler ani graczowe bloki bearing/motor/servo;
- miękkie limity hinge zależą od sterownika i nie są natywnym hard stopem solvera;
- angle unwrapping zakłada, że obrót między kolejnymi krokami nie przekracza π;
- composition root nadal zawiera workshop glue, input routing, camera loop oraz flight/damage/integrity;
- `mission-controller` i `engineering-analysis` są duże oraz mocno związane z DOM;
- backend headless nie rozwiązuje kolizji ani constraintów;
- jeden collider na voxel i limit 480 części w locie;
- payload nie ma jeszcze graczowego `PayloadMount`;
- biblioteki produkcyjnego runtime pochodzą z CDN;
- brak pełnego automatycznego testu WebGL/GPU i prawdziwego browser CI.


## 12. Dokumenty kierunkowe po pełnym review

- `PROJECT_VISION.md` — kanoniczna obietnica produktu, filary doświadczenia i anti-goals dla wszystkich przyszłych agentów.
- `FOUNDATION_READINESS_REVIEW.md` — stan całego fundamentu, ryzyka P1–P3 i bramki przed sublevelami/control bus.
- `PROGRAMMABLE_MACHINE_RESEARCH.md` — wnioski z Sable/Create Aeronautics, VS2/Clockwork, Factorio, Stormworks i Space Engineers.
- `PHASE_1D3C_REPORT.md` — dokładny kontrakt i wyniki joint spike.


## Phase 1D.3D — Assembly-Centric Flight Lifecycle
Runtime flight state now treats RuntimeAssembly as the authoritative launched vehicle. `primaryBody` is explicit; `STATE.flight.body` remains only a compatibility alias for the current single-rigid-island craft. New `game.flight-session` and `game.flight-integrity` seams document and test the lifecycle/integrity boundary for the future Rigid Island Compiler.
