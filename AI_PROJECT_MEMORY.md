# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia. Najpierw przeczytaj ten plik, następnie `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `VALIDATION_REPORT.md`, `DELIVERY_WORKFLOW.md` i testy.

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

**Foundation Phase 1D.3A — Runtime Assembly Builder & Deterministic Headless Harness Core**

Ukończone fundamenty:

- blueprint v10 z trwałym `blockId` niezależnym od `gridKey`;
- `CompiledCraft` i `RuntimeAssemblyPlan` jako neutralne kontrakty;
- `RuntimeAssemblyPlan.rigidBodies[]`, `constraints[]`, `signalLinks[]`;
- produkcyjny `runtime.assembly-builder` używany przez lot;
- builder obsługujący wiele body, stabilne mapy i transakcyjny rollback;
- wspólne `foundation.mass-properties`;
- jawne mass properties przekazywane do backendu;
- recenter i prędkość punktu za Physics Portem;
- deterministyczny backend headless;
- free fall, hover, torque, offset thrust, inertia parity i soak;
- architektoniczny benchmark tworzenia do 2500 colliderów;
- manualny browser harness prawdziwego adaptera Cannon;
- sześć semantycznych osi, rebindable input i guided vertical controls;
- deterministyczny ZIP + single HTML z source parity.

## 3. Nienaruszalne reguły

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest jedynym zweryfikowanym wejściem runtime.
3. Meshe, body, shapes i DOM nie trafiają do blueprintu.
4. Core ma specjalną rolę, nie specjalną pozycję.
5. Edytor dopuszcza pusty, bez-Core i rozłączony WIP.
6. Start obecnego jedno-body runtime wymaga dokładnie jednego Core i jednej połączonej wyspy.
7. Zmiany wieloblokowe są atomowe.
8. Każda wersja zapisu ma migrację.
9. `blockId` jest trwałą tożsamością; współrzędne nie mogą jej zastąpić.
10. Przeniesienie urządzenia zachowuje `blockId`; kopiowanie tworzy nowe `blockId`.
11. Pojedyncze body jest pierwszym przypadkiem `RuntimeAssembly`, nie docelowym ograniczeniem.
12. Structural graph, mechanical graph i signal graph są osobnymi modelami.
13. Joint przecina sztywne połączenie; rigid bypass musi być diagnozowany.
14. Globalne regulatory i mikser są domyślnymi źródłami sygnału, nie końcowym modelem sterowania.
15. PID jest zwykłym węzłem logiki, nie wyjątkiem zaszytym w fizyce.
16. `game.js` nie może omijać Physics Portu.
17. Główne body i collidery konstrukcji tworzy `runtime.assembly-builder`, nie `game.js`.
18. Panel analizy i solver muszą korzystać ze zgodnych właściwości masowych.
19. Recenter musi zachować prędkość nowego COM i przechodzić przez Physics Port.
20. Headless deterministic backend jest harness-em architektury, nie substytutem solvera kontaktów ani podstawą decyzji backendowej.
21. Nie podnosić limitu części bez realnego benchmarku produkcyjnego solvera i świadomej decyzji o colliderach.
22. Każda dostawa zawiera pełne źródła, single HTML, raport, walidację, sumy i instrukcję aktualizacji.
23. Nigdy nie zalecać zwykłego `git push --force`.
24. Domyślna dostawa to pełny ZIP projektu; użytkownik wykonuje lokalny commit i push. Nie publikować projektu na GitHub w kawałkach.

## 4. Trzy grafy przyszłej maszyny

- **Structural graph** — voxele należące do jednej sztywnej bryły.
- **Mechanical graph** — constraints między bryłami.
- **Signal graph** — połączenia portów urządzeń, niezależne od fizycznych jointów.

Tych grafów nie wolno scalać w jeden model.

## 5. Najbliższy etap

**Phase 1D.3B — Real-Cannon Harness & Runtime Parity**

1. uruchomić tę samą baterię na prawdziwym Cannon.js;
2. zweryfikować payload, detach i recenter podczas obrotu;
3. zmierzyć build, `world.step`, pamięć i lifecycle;
4. nie mieszać wyników headless architecture benchmark z wynikami solvera;
5. następnie wykonać 1D.3C joint capability spike.

## 6. Następny gameplay

**Phase 1E — Per-Block Control Bus**

- konkretny aktywny blok i jego porty;
- `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min, max;
- grupy urządzeń;
- trwały zapis konfiguracji w blueprintcie;
- diagnostyka po usunięciu lub odłączeniu endpointu.

Następnie sensory, podstawowa logika, live scope i PID.

## 7. Świadomy dług

- `game.js` nadal zarządza wizualizacją, uszkodzeniami i gameplayowymi rekordami części;
- planner projektu emituje obecnie jedno body i zero constraintów;
- real-Cannon harness nie jest jeszcze częścią automatycznej baterii w środowisku bez CDN;
- backend headless nie rozwiązuje kolizji;
- jeden collider na voxel i limit 480 części w locie;
- payload nie ma jeszcze graczowego `PayloadMount`;
- nie ma jeszcze Physics Port API dla constraintów;
- biblioteki runtime pochodzą z CDN;
- brak pełnego automatycznego testu WebGL/GPU.
