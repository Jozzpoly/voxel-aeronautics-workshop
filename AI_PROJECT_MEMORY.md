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

**Foundation Phase 1D.3B.1 — Modular Game Shell & Explicit Composition Boundaries**

Ten etap jest kontrolowanym refaktorem przygotowawczym pomiędzy 1D.3B i planowanym joint spike 1D.3C. Nie zmienia formatu blueprintu, modelu fizycznego ani gameplayu.

Ukończone fundamenty:

- blueprint v10 z trwałym `blockId` niezależnym od `gridKey`;
- `CompiledCraft` i `RuntimeAssemblyPlan` jako neutralne kontrakty;
- produkcyjny `runtime.assembly-builder` używany przez lot;
- real-Cannon i deterministic-headless harnessy;
- rygorystyczne mass properties, recenter i Physics Port;
- `src/game.js` jest teraz jawnym composition rootem zamiast właścicielem wszystkich podsystemów;
- dziewięć modułów `src/game/` przejęło scenę, karierę, workspace, ustawienia sterowania, orientację, modele bloków, analizę inżynieryjną, blueprinty i misje;
- wszystkie moduły są ładowane deterministycznie przez wspólny `APP_SOURCES`;
- testy aplikacji, single HTML i ZIP korzystają z jednego source inventory;
- architektoniczne testy pilnują właścicieli funkcji, kolejności ładowania, limitu rozrostu `game.js` i granicy Assembly Buildera;
- lifecycle `fullscreenchange` i `pagehide` przechodzi przez jawne API modułów zamiast sięgać do ich prywatnego stanu;
- deterministyczny ZIP + single HTML zachowują source parity.

## 3. Nienaruszalne reguły domenowe i runtime

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
16. Kod gry nie może omijać Physics Portu.
17. Główne body i collidery konstrukcji tworzy `runtime.assembly-builder`, nie composition root ani moduły prezentacji.
18. Plan assembly musi zostać w pełni zweryfikowany przed pierwszą alokacją backendu.
19. Nieudana mutacja backendu nie może wcześniej uszkodzić map runtime.
20. Rollback musi zachować pierwotny błąd; błędy cleanup są informacją dodatkową.
21. Panel analizy i solver muszą korzystać ze zgodnych właściwości masowych.
22. Recenter musi zachować prędkość nowego COM i przechodzić przez Physics Port.
23. Headless deterministic backend jest harness-em architektury, nie substytutem solvera kontaktów.
24. Wyniki real Cannon i headless muszą być raportowane osobno.
25. Nie podnosić limitu części bez scenariuszy kontaktowych i świadomej strategii colliderów.

## 4. Nienaruszalne reguły composition root

26. `src/game.js` jest ostatnim źródłem aplikacji i jedynym miejscem komponującym moduły `game.*`.
27. Moduły `src/game/` nie mogą importować `src/game.js` ani czytać `window.VAW_RUNTIME`.
28. Zależności modułów są deklarowane przez `window.VAW.define(...)` albo przekazywane jawnie do `create(...)`.
29. Prywatny timer, listener lub stan modułu nie może być mutowany z composition root; moduł wystawia jawne `flush`, `dispose` lub handler lifecycle.
30. Przeniesienie kodu do nowego pliku nie może tworzyć równoległego źródła prawdy ani omijać istniejącego modelu domenowego.
31. `APP_SOURCES` w `tools/build_release.py` jest kanoniczną kolejnością źródeł dla buildu i testów.
32. `game.js` ma pozostać poniżej 2500 linii i 120 kB do czasu kolejnej świadomej decyzji architektonicznej.
33. Lot, damage i integrity pozostają razem do czasu joint spike, aby nie utrwalić założenia „craft = jedno body” w nowym publicznym API.
34. Każda dostawa zawiera pełne źródła, single HTML, raport, walidację, sumy i instrukcję aktualizacji.
35. Nigdy nie zalecać zwykłego `git push --force`.
36. Domyślna dostawa to pełny ZIP projektu; użytkownik wykonuje lokalny commit i push.

## 5. Aktualny podział game shell

```text
src/game.js                         composition root + flight/integrity/workshop glue
src/game/scene_environment.js       Three.js, world, static range and shared render assets
src/game/career_service.js          career normalization and persistence
src/game/workspace_controller.js    panel layout, z-order and UI preference persistence
src/game/input_settings_controller.js input profile UI and Flight Focus lifecycle
src/game/orientation_service.js     game-facing orientation helpers
src/game/module_visual_factory.js   block visual construction
src/game/engineering_analysis.js    analysis, warnings and telemetry presentation
src/game/blueprint_controller.js    save/load/import/export/history integration
src/game/mission_controller.js      contracts, markers, mission state and debrief
```

## 6. Trzy grafy przyszłej maszyny

- **Structural graph** — voxele należące do jednej sztywnej bryły.
- **Mechanical graph** — constraints między bryłami.
- **Signal graph** — połączenia portów urządzeń, niezależne od fizycznych jointów.

Tych grafów nie wolno scalać w jeden model.

## 7. Najbliższy etap

**Phase 1D.3C — Joint Capability Spike**

1. dwa body na prawdziwym backendzie;
2. free hinge;
3. limit kąta i tarcie;
4. powered hinge: target speed + max torque;
5. servo: target angle;
6. kontrolowane kolizje połączonych body;
7. długi soak, usuwanie constraintu/body i jawny lifecycle;
8. dopiero na podstawie spike zaprojektować neutralne Physics Port API constraintów.

Po ustabilizowaniu multi-body należy wydzielić z `game.js` moduły `flight-session` i `flight-integrity` już pod prawidłowy model assembly. Nie projektować ich wcześniej wokół jednego body.

## 8. Następny gameplay

**Phase 1E — Per-Block Control Bus**

- konkretny aktywny blok i jego porty;
- `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min, max;
- grupy urządzeń;
- trwały zapis konfiguracji w blueprintcie;
- diagnostyka po usunięciu lub odłączeniu endpointu.

Następnie sensory, podstawowa logika, live scope i PID.

## 9. Świadomy dług

- composition root nadal zawiera warsztatowe glue, input routing, camera loop oraz flight/damage/integrity;
- `mission-controller` i `engineering-analysis` są duże, lecz mają już pojedynczych właścicieli i testowalne granice;
- moduły DOM nie posiadają jeszcze wspólnego view adaptera;
- planner projektu emituje obecnie jedno body i zero constraintów;
- `constraintBuilder` jest seam-em testowym, nie finalnym Physics Port API;
- backend headless nie rozwiązuje kolizji ani constraintów;
- jeden collider na voxel i limit 480 części w locie;
- payload nie ma jeszcze graczowego `PayloadMount`;
- biblioteki produkcyjnego runtime pochodzą z CDN;
- brak pełnego automatycznego testu WebGL/GPU i prawdziwego browser CI.
