# Critical Code Review — Foundation Phase 1D.3E

## Zakres i metoda

Review wykonano względem czystego baseline Phase 1D.3D (`5cf38926623a17290ff2c6caad24d1c36fe77ad3`). Objęło ono cały przepływ:

```text
CraftModel -> CraftCompiler -> RuntimeAssemblyPlan
-> AssemblyBuilder -> Physics Port -> backend
```

oraz:

```text
FlightSession -> RuntimeAssembly ownership
-> visuals / mission / HUD / camera
-> FlightIntegrity / payload / debris
-> stop / retry / restart
```

Przejrzano również oba backendy, testy, loader, build, source manifest, wersję, dokumenty kanoniczne i wpływ zmian na Gate B–E. Diff źródłowy obejmuje ponad dwa tysiące dodanych linii i nie jest kosmetycznym przeniesieniem kodu.

## Werdykt

**Gate A można zamknąć.** Lifecycle lotu ma jedno źródło prawdy, destrukcyjne operacje wymagają dokładnego ownershipu, wizuale są własnością konkretnych body, a częściowo nieudany cleanup zachowuje uchwyty do retry.

**Gate B nie został rozpoczęty.** Produkcyjny `CraftCompiler` nadal emituje jedną rigid island; brak mechanical authoring schema, migracji i pure rigid-island/mechanical compilerów. Zatrzymanie wydania na ukończonym Gate A jest właściwsze niż pozostawienie częściowego blueprint v11.

## Znaleziska krytyczne i naprawy

### CR-1 — deklarowane seamy nie posiadały lifecycle

Baseline miał `game.flight-session`, ale `game.js` nadal wywoływał `AssemblyBuilder.build`, publikował równoległe mapy i posiadał launch/stop state.

**Naprawa:** jedyny produkcyjny callsite buildera znajduje się w `FlightSession.start()`. Sesja publikuje jeden `RuntimeAssembly`, wybiera primary body, posiada zasoby transient i zatrzymuje je w kontrolowanej kolejności.

### CR-2 — fałszywe źródła prawdy

`assembly`, `assemblyRuntime`, `bodyById`, `bodies`, `primaryBody` i `body` mogły być traktowane jako równoległe modele pojazdu.

**Naprawa:** kanoniczny jest `STATE.flight.assembly`. `primaryBodyId` jest polityką/query. Pozostałe native aliases są jedynie deprecated same-object compatibility fields i nie mają aktywnych konsumentów w game modules.

### CR-3 — utrata retry handles podczas cleanupu

Wczesne czyszczenie state po częściowej awarii uniemożliwiłoby dokończenie cleanupu.

**Naprawa:** RuntimeAssembly i FlightSession zachowują niezakończone constraints, listenery, collidery, body i visual roots. `disposed` jest ustawiane dopiero po pełnym sukcesie. Kolejne `stop()` kontynuuje pracę.

### CR-4 — niewłaściwa kolejność usuwania zasobów

Body nie może zniknąć, dopóki constraint lub collider nadal je referencjonuje.

**Naprawa:** obowiązuje kolejność:

```text
constraint -> collision listener / collider -> body -> visual -> published state
```

Backend mutation następuje przed mutation map/runtime state.

### CR-5 — globalny visual root kodował jeden rigid body

Jeden root powodowałby wspólny obrót wszystkich wysp articulated craftu.

**Naprawa:** `visualRootByBodyId`, stabilne `part.bodyId`, lokalna pozycja części względem właściwego body i niezależna synchronizacja transformów.

### CR-6 — damage mógł trafić do niewłaściwego body

Fallback „brak ownershipu → primary body” jest destrukcyjny w multi-body assembly.

**Naprawa:** exact block/part/collider/body lookup. Brak lub mismatch kończy operację błędem. Gameplay detach ma jawny kontrakt `primary-rigid-island-only` do czasu zaprojektowania split/subassembly ownership.

### CR-7 — integralność primary body używała mianownika całego assembly

Pierwsza implementacja po refaktorze liczyła health primary island względem wszystkich wysp, więc articulated craft startowałby z zaniżonym HUD integrity.

**Naprawa:** initial/current integrity są liczone dla jawnie wybranego primary body. Osobna wyspa nie zmienia jego procentu.

### CR-8 — presentation hook mógł przerwać zatwierdzoną mutację

Po udanym backendowym usunięciu collidera wyjątek z efektu wizualnego mógł pozostawić logikę w stanie pośrednim.

**Naprawa:** zwykłe hooki prezentacji są izolowane i raportowane diagnostycznie. Cleanup hooki nadal propagują błąd, aby zachować retry semantics.

### CR-9 — debris wyciekało przez composition root i native body fields

Tworzenie, synchronizacja oraz disposal fizycznych odłamków pozostawały dużą domeną w `game.js`.

**Naprawa:** `game.debris-runtime` izoluje backend/scene adapter, używa neutralnego `getBodyTransform`, robi allocation rollback i staged retry-safe dispose. `FlightIntegrity` posiada listę i lifecycle debris.

### CR-10 — mission/HUD/camera czytały jeden natywny body

Semantyka articulated craftu była przypadkowa i zależna od aliasu lub kolejności mapy.

**Naprawa:** deterministyczna primary policy (`explicit -> rootBodyId -> root role -> stable ID sort`) oraz neutralny sample transform/linear/angular velocity.

### CR-11 — visual setup nie był atomowy

Błąd sceny po udanym buildzie mógł pozostawić aktywne assembly bez pełnego presentation state.

**Naprawa:** rejestracja ownershipu poprzedza scene allocation, a cały setup jest otoczony rollbackiem do `cleanupFlightState()`. Pierwotny błąd pozostaje główny, cleanup errors są dołączone osobno.

### CR-12 — `pagehide` nie zamykał aktywnej sesji

Stary smoke wykonywał `pagehide` dopiero po zakończeniu lotu i nie dowodził aktywnego lifecycle.

**Naprawa:** aktywny `pagehide` przechodzi normalną ścieżką do BUILD i wykonuje cleanup; `fullscreenchange` pozostaje niedestrukcyjny.

### CR-13 — dokumentacja udawała starszy stan

Kanoniczne pliki miały nagłówki 1D.3C, a raport 1D.3D mógł zostać błędnie odczytany jako pełne zamknięcie Gate A.

**Naprawa:** dokumenty bieżące opisują 1D.3E, historyczny 1D.3D ma ostrzeżenie, a test kontraktu wymaga current 1D.3E / next 1D.4A i ADR 0029–0032.

## Sprawdzone granice architektury

- `CraftModel` nadal jest workshop source of truth.
- `CraftCompiler` nadal jest jedyną drogą do `CompiledCraft`.
- `AssemblyBuilder` nie został zduplikowany w `game.js`.
- Physics Port pozostaje jedyną granicą głównych body/colliderów/constraintów.
- Nie dodano globalnego `window.*` poza istniejącym loaderem modułów.
- Structural, mechanical i przyszły signal graph nie zostały scalone.
- Runtime constraint command nie zmienia planu mechanical graphu.
- Publiczne game APIs nie wystawiają `CANNON.Body` ani `CANNON.HingeConstraint`.
- Identyfikacja nie opiera się na indeksie body w tablicy.
- Source inventory pozostaje sterowany przez `APP_SOURCES`.

## Świadome ograniczenia i ryzyka po review

1. Produkcyjny compiler nadal jest single-island; test multi-body potwierdza lifecycle/planner/builder, nie authoring gracza.
2. Pełny split assembly po detach nie istnieje; ograniczenie primary island jest zamierzone i blokuje niebezpieczne użycie.
3. Soft hinge limits pozostają soft i wykazują niewielki overshoot.
4. One-collider-per-voxel oraz koszt kontaktów nadal ograniczają flight cap 480.
5. Nie ma browser/WebGL CI; istnieje headless DOM startup smoke.
6. Deprecated aliases powinny zostać usunięte dopiero po potwierdzeniu braku external compatibility consumers.
7. Gate B wymaga osobnego ADR/schema review i prawdopodobnej decyzji o blueprint v11.

## Ostateczna decyzja

Diff nie pozostawia dwóch aktywnych źródeł prawdy i nie wprowadza częściowego Gate B. Zmiany są gotowe do wydania jako **Foundation Phase 1D.3E — Gate A Foundation Convergence** po końcowej walidacji ZIP-a i patcha.
