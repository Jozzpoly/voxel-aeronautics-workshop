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

**Foundation Phase 1D.3B — Real-Cannon Parity & Runtime Contract Hardening**

Ukończone fundamenty:

- blueprint v10 z trwałym `blockId` niezależnym od `gridKey`;
- `CompiledCraft` i `RuntimeAssemblyPlan` jako neutralne kontrakty;
- produkcyjny `runtime.assembly-builder` używany przez lot;
- wielobody builder ze stabilnymi mapami, preflight validation, rollbackiem i kontrolowanym dispose;
- wspólne, rygorystyczne `foundation.mass-properties`;
- jawne mass properties i dynamic/static type sync w obu backendach;
- recenter i prędkość punktu za Physics Portem;
- poprawna odpowiedź diagonalnej bezwładności dla obróconej bryły w headless;
- automatyczny test prawdziwego Cannon.js 0.6.2 bez CDN;
- real-Cannon free fall, torque, rotated inertia, offset thrust, kontakt, payload/recenter podczas obrotu, soak, lifecycle i benchmark do 2500 colliderów;
- deterministyczny backend headless jako osobny architecture baseline;
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
18. Plan assembly musi zostać w pełni zweryfikowany przed pierwszą alokacją backendu.
19. Nieudana mutacja backendu nie może wcześniej uszkodzić map runtime.
20. Rollback musi zachować pierwotny błąd; błędy cleanup są informacją dodatkową.
21. Panel analizy i solver muszą korzystać ze zgodnych właściwości masowych.
22. Recenter musi zachować prędkość nowego COM i przechodzić przez Physics Port.
23. Headless deterministic backend jest harness-em architektury, nie substytutem solvera kontaktów ani podstawą decyzji backendowej.
24. Wyniki real Cannon i headless muszą być raportowane osobno.
25. Nie podnosić limitu części wyłącznie na podstawie czasu budowy pustego świata; decyzja wymaga scenariuszy kontaktowych i świadomej strategii colliderów.
26. Każda dostawa zawiera pełne źródła, single HTML, raport, walidację, sumy i instrukcję aktualizacji.
27. Nigdy nie zalecać zwykłego `git push --force`.
28. Domyślna dostawa to pełny ZIP projektu; użytkownik wykonuje lokalny commit i push. Nie publikować projektu na GitHub w kawałkach.

## 4. Trzy grafy przyszłej maszyny

- **Structural graph** — voxele należące do jednej sztywnej bryły.
- **Mechanical graph** — constraints między bryłami.
- **Signal graph** — połączenia portów urządzeń, niezależne od fizycznych jointów.

Tych grafów nie wolno scalać w jeden model.

## 5. Najbliższy etap

**Phase 1D.3C — Joint Capability Spike**

1. dwa body na prawdziwym backendzie;
2. free hinge;
3. limit kąta i tarcie;
4. powered hinge: target speed + max torque;
5. servo: target angle;
6. kontrolowane kolizje połączonych body;
7. długi soak, usuwanie constraintu/body i jawny lifecycle;
8. dopiero na podstawie spike zaprojektować neutralne Physics Port API constraintów.

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
- `constraintBuilder` jest seam-em testowym, nie finalnym Physics Port API;
- backend headless nie rozwiązuje kolizji ani constraintów;
- jeden collider na voxel i limit 480 części w locie;
- benchmark 2500 colliderów mierzy pusty świat bez kosztu kontaktów;
- payload nie ma jeszcze graczowego `PayloadMount`;
- biblioteki produkcyjnego runtime pochodzą z CDN;
- brak pełnego automatycznego testu WebGL/GPU;
- brak CI uruchamiającego manualny harness w prawdziwej przeglądarce.
