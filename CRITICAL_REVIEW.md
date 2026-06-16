# Critical Review — Foundation Phase 1D.3A

## Pytanie kontrolne

Czy projekt rzeczywiście przesunął odpowiedzialność za fizyczne assembly poza `game.js`, czy tylko dodał nowy plan i kolejną warstwę nazw?

Po tej iteracji odpowiedź brzmi: **builder jest realnie używany przez produkcyjny lot**, ale separacja nie jest jeszcze kompletna.

## Co zostało poprawione właściwie

### Builder jest granicą wykonawczą

`buildFlightBody()` nie tworzy już compound body konstrukcji ręcznie. Przekazuje `RuntimeAssemblyPlan` do `runtime.assembly-builder`, a następnie buduje wyłącznie warstwę wizualną i gameplayowe rekordy części.

To jest istotna różnica. W 1D.2F plan opisywał przyszłość, ale główny runtime nadal powielał budowę fizyki. W 1D.3A jedna warstwa naprawdę odpowiada za body, collidery, mapy, rollback i dispose.

### Mass properties mają wspólne źródło

Kompilator, payload i runtime po detach korzystają z `foundation.mass-properties`. Usunięto ryzyko trzech podobnych, lecz rozchodzących się implementacji COM i bezwładności.

### Recenter zachowuje kinematykę

Zmiana lokalnego środka masy podczas obrotu nie może zachować starej prędkości liniowej body. Nowy COM musi otrzymać prędkość punktu `v + omega × r`. Ta operacja została przeniesiona do Physics Port/Assembly Buildera i ma test regresyjny.

### Headless harness jest użyteczny, ale nazwany uczciwie

Backend deterministyczny pozwala testować free flight i lifecycle bez przeglądarki. Nie udaje solvera kontaktów. Benchmark jego buildera jest jawnie oddzielony od benchmarku Cannon.

## Najważniejsze ryzyka nadal otwarte

### 1. Produkcyjna gra nadal zakłada jeden aktywny root body

Builder obsługuje wiele body, lecz `game.js` nadal steruje `STATE.flight.body` jako główną bryłą, a damage/connectivity używa jednej voxelowej mapy. To świadome ograniczenie do czasu rigid-island compiler i joint spike.

Nie wolno teraz udawać, że articulated assemblies są prawie gotowe. Gotowa jest granica, nie feature.

### 2. Brak neutralnego Physics Port dla constraintów

`constraintBuilder` pozwala testować lifecycle wielu body, ale nie definiuje jeszcze semantyki hinge, motoru, limitów, tarcia i servo. Wprowadzenie zbyt ogólnego API przed spike grozi zaprojektowaniem niewłaściwego kontraktu.

Właściwy następny krok to mały capability spike na prawdziwym backendzie.

### 3. Headless backend nie wykryje problemów kontaktowych

Nie sprawdzi:

- stabilności na ziemi;
- constraint drift;
- kolizji między podzespołami;
- broadphase kosztu tysięcy colliderów;
- kontaktów po recenter;
- damage eventów prawdziwego solvera.

Dlatego limit 480 części pozostaje bez zmian.

### 4. Runtime gameplay records nadal powstają w `game.js`

To nie jest natychmiastowy błąd. Próba wydzielenia visuals, damage, fuel i aerodynamics w jednym etapie zwiększyłaby ryzyko regresji. Jednak przed pełnymi articulated assemblies potrzebny będzie model runtime part state niezależny od pojedynczej grupy Three.js.

### 5. Zależność od CDN blokuje hermetyczne testy przeglądarkowe

Manualny harness real Cannon istnieje, ale środowisko bez sieci nie uruchomi go. Docelowo trzeba rozważyć kontrolowany vendoring wersji bibliotek lub osobny workflow CI z cache, bez przypadkowego kopiowania zależności o niejasnej licencji.

## Decyzje odrzucone

- Nie dodano od razu jointów do UI.
- Nie podniesiono limitu części na podstawie szybkiego headless benchmarku.
- Nie rozpoczęto Collider Compilera przed pomiarem prawdziwego solvera.
- Nie dodano kolejnej rundy aerodynamiki.
- Nie potraktowano PID jako specjalnego systemu poza przyszłym control busem.

## Wniosek

Phase 1D.3A jest solidnym krokiem, ponieważ usuwa fałszywą granicę i daje testowalny lifecycle assembly. Nie kończy 1D.3. Kolejny etap musi skonfrontować te kontrakty z real Cannon, a następnie sprawdzić najmniejszy prawdziwy mechanizm dwóch brył. Dopiero po tym można bezpiecznie rozpocząć Per-Block Control Bus i graczowe jointy.
