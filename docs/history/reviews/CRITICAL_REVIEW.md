# Critical Review — Foundation Phase 1D.3B

## Pytanie kontrolne

Czy granica assembly działa poprawnie wyłącznie ze stubem i headless, czy jej kontrakty są zgodne z rzeczywistą semantyką Cannon.js oraz odporne na błędy backendu?

Po tej iteracji odpowiedź brzmi: **główne scenariusze parity są automatycznie sprawdzone na real Cannon, a lifecycle buildera jest znacznie bardziej transakcyjny.** Nie oznacza to jeszcze gotowych articulated assemblies.

## Co zostało poprawione właściwie

### Real backend jest częścią głównej baterii

Test nie zależy od sieci i nie używa uproszczonego stuba. To właśnie realny harness wykrył różnicę semantyki `Vec3.vadd`, która psuła zwrot prędkości punktu.

### Plan jest odrzucany przed alokacją

Builder nie próbuje już „sprawdzać w locie”, czy part wskazuje istniejące body albo czy collider ma poprawny blok. Cały graph contract jest weryfikowany przed utworzeniem zasobów.

### Mutacje są backend-first, state-second

Collider nie znika z map, dopóki backend nie potwierdzi usunięcia. Mass properties runtime aktualizują się po sukcesie backendu. Rollback nie maskuje pierwotnego wyjątku.

### Headless mierzy tę samą fizykę swobodną w poprawnej ramie

Diagonalna inertia jest lokalna dla body. Obrócona bryła wymaga transformacji torque do tej ramy. Headless i Cannon mają teraz wspólny test tego przypadku.

## Najważniejsze ryzyka nadal otwarte

### 1. Joint API nadal nie istnieje

`constraintBuilder` sprawdza lifecycle i mapowanie, ale nie określa semantyki hinge, motoru, limitu, tarcia ani servo. To właściwe ograniczenie: publiczny kontrakt musi powstać po realnym spike, nie przed nim.

### 2. Produkcyjna gra nadal ma jeden root body

Builder potrafi wiele body, ale sterowanie, damage i wizualny runtime nadal są zorientowane na główną konstrukcję. Granica jest gotowa na eksperyment, feature jeszcze nie.

### 3. Benchmark nie mierzy najgorszego przypadku kontaktów

2500 colliderów w pustym świecie ma tani step, ale budowa trwa około pół sekundy. Podłoże, przeszkody, debris i joints mogą radykalnie zmienić koszt. Limit 480 pozostaje.

### 4. Jeden collider na voxel pozostaje skalującym długiem

Realne pomiary wzmacniają argument za Collider Compilerem, lecz greedy merge musi respektować rigid islands, identity mapping, detach i damage. Nie może być tylko optymalizacją renderera.

### 5. WebGL i produkcyjne dependency loading nie są hermetyczne

Cannon testowy jest vendored legalnie i lokalnie. Aplikacja produkcyjna nadal używa zależności określonych w `index.html`, a pełny test GPU/browser nie jest automatyczny.

## Decyzje odrzucone

- Nie ruszono `game.js` tylko po to, by zmniejszyć liczbę linii.
- Nie dodano prowizorycznego API jointów.
- Nie podniesiono limitu części.
- Nie pomylono benchmarku pustego świata z kosztami kontaktów.
- Nie przeniesiono testowej kopii Cannon do produkcyjnego loadera.

## Wniosek

Phase 1D.3B zamyka właściwy zestaw długów po 1D.3A: real parity, strict contracts, failure atomicity i wiarygodniejsze headless dynamics. Następny etap powinien być małym joint capability spike. Dopiero jego wynik uzasadni nowe API i dalszy podział runtime.
