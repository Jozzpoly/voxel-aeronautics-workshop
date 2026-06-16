# Critical Code Review — Phase 1D.3A → 1D.3B

## Zakres

Przegląd objął kolejno dokumentację projektu, następnie:

- `runtime_assembly.js`;
- `assembly_builder.js`;
- `mass_properties.js`;
- `physics_port.js`;
- `cannon_physics_backend.js`;
- `headless_physics_backend.js`;
- `craft_compiler.js`;
- odpowiadające testy i harnessy.

Bazowe `python tests/run_all.py` przeszło przed zmianami. `game.js` był czytany wyłącznie w celu potwierdzenia granicy użycia buildera i nie został zmieniony.

## Znaleziska krytyczne

### CR-01 — utrata prędkości punktu w prawdziwym Cannonie

**Problem:** `getPointVelocity()` zwracało wynik `body.velocity.vadd(rotational, result)`. W Cannon 0.6.2 metoda przy podanym target mutuje target i zwraca `undefined`.

**Skutek:** recenter payloadu/detach na realnym backendzie mógł otrzymać brak prędkości, mimo że stub testowy przechodził.

**Naprawa:** jawnie wykonać `vadd`, następnie zwrócić `result`. Dodano real-Cannon test payload/recenter podczas obrotu.

### CR-02 — nieatomowe usuwanie collidera

**Problem:** runtime oznaczał collider jako usunięty przed potwierdzeniem backendu.

**Skutek:** `false` lub wyjątek backendu pozostawiał fizyczny shape, ale blokował retry i psuł mapy.

**Naprawa:** stan runtime zmienia się dopiero po sukcesie backendu. Dodano test pierwszego odrzucenia i udanego ponowienia.

### CR-03 — cleanup maskował pierwotny błąd

**Problem:** wyjątek podczas rollbacku mógł zastąpić błąd, który przerwał budowę.

**Skutek:** diagnostyka wskazywała cleanup zamiast właściwej przyczyny i utrudniała naprawę transakcji.

**Naprawa:** rollback zachowuje pierwotny wyjątek, a błędy cleanup dołącza jako `cleanupErrors`. Jawny dispose używa AggregateError.

### CR-04 — headless używał tensora lokalnego jak światowego

**Problem:** `torque * invInertiaDiagonal` wykonywano bez transformacji ramy.

**Skutek:** asymetryczna obrócona bryła dawała inną odpowiedź kątową niż Cannon.

**Naprawa:** torque world → local, diagonal inverse inertia w local, acceleration local → world. Dodano parity test obu backendów.

## Znaleziska wysokiego priorytetu

### CR-05 — walidacja planu następowała za późno

Nieprawidłowe referencje body/parts/colliderów lub brak constraint buildera mogły być wykryte po częściowej alokacji. Dodano pełny preflight `validatePlan()` przed backendem.

### CR-06 — ciche naprawianie wadliwych danych

Planner i mass properties zamieniały część NaN, brakujących wektorów, ujemnych mas i half-extents na fallbacki. To ukrywało błąd po stronie kompilacji/snapshotu. Granice domenowe są teraz rygorystyczne.

### CR-07 — typ body nie podążał za masą

Po przejściu masa 0 ↔ dodatnia backend mógł zachować nieaktualny typ. Oba backendy synchronizują STATIC/DYNAMIC; Cannon aktualizuje solve mass properties i wybudza body.

### CR-08 — test „real Cannon” nie był automatyczny

Manualny harness zależał od CDN, więc kluczowa różnica semantyki `Vec3.vadd` nie została wykryta. Dodano vendored test-only Cannon 0.6.2, licencję i test w głównym runnerze.

## Znaleziska średnie

### CR-09 — reserved metadata spoofing

`bodyDescriptor.userData` mogło nadpisać `assemblyBodyId`. Kolejność merge została odwrócona: metadane assembly są finalne i zastrzeżone.

### CR-10 — statyczne akumulatory headless

Force i torque statycznego body nie były czyszczone. Po późniejszym przejściu do dynamic mogły stworzyć zaległy impuls. Są zerowane w każdym kroku.

### CR-11 — kompilator przetwarzał rekord ponad limitem

Pętla używała `maxBlocks + 1`. Po zgłoszeniu limitu kompilator nadal normalizował dodatkowy blok. Limit pracy i wyniku ustawiono dokładnie na `maxBlocks`.

## Ocena architektury po zmianach

Mocne strony:

- granica planner → builder → Physics Port jest rzeczywista, nie dekoracyjna;
- `game.js` nie duplikuje assembly;
- trwałe tożsamości i mapy są właściwym fundamentem jointów/control busu;
- real i headless mają wspólne scenariusze parity;
- rollback i mutacje mają teraz czytelny kontrakt błędów.

Otwarte ryzyka:

- produkcyjny runtime nadal zakłada jedno root body;
- brak semantyki constraints w Physics Port;
- benchmark nie obejmuje kosztu rozległych kontaktów;
- runtime gameplay state pozostaje częściowo skupiony w `game.js`;
- jeden collider na voxel będzie ograniczeniem zanim powstanie Collider Compiler.

## Wniosek

1D.3A miała poprawny kierunek, ale testy stubowe dawały fałszywe poczucie parity i niektóre operacje nie były naprawdę transakcyjne. Po 1D.3B granica assembly jest znacznie bardziej wiarygodna. Kolejnym ryzykiem nie jest brak kolejnego refaktoru, tylko nieznana semantyka i stabilność prawdziwych jointów — dlatego następny krok powinien pozostać wąskim capability spike.
