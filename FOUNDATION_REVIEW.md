# Foundation Review — Phase 1B

## Decyzja jakościowa

Milestone jest dobrym, stabilnym punktem do dalszego rozwoju. Poprzedni etap został zweryfikowany przed rozpoczęciem prac, a następnie usunięto największą pozostałą fałszywą granicę: połączenie danych voxelowych z obiektami renderera.

Nie oznacza to końca przebudowy fundamentów. `CraftCompiler`, adapter fizyki i scalanie colliderów nadal nie istnieją.

## Co zostało zweryfikowane przed zmianami

- wszystkie testy Foundation Phase 1 przechodziły;
- kolejność modułów w `index.html` i buildzie była zgodna;
- migracje blueprintów v3–v7 działały;
- startup na stubach przechodził;
- jednoplikowy build i ZIP były poprawne;
- misje, uszkodzenia i limit solvera nie miały regresji.

Walidacja potwierdziła również, że poprzedni etap nie był atrapą. `game.js` rzeczywiście korzystał z modułów konfiguracji, katalogu, orientacji, blueprintu i stanu.

## Najważniejszy problem znaleziony podczas review

`STATE.voxels` przechowywało jednocześnie:

- typ i konfigurację bloku;
- pozycję;
- orientację;
- mesh Three.js.

W rezultacie operacja domenowa, taka jak usuwanie bloku, musiała tymczasowo usuwać mesh ze sceny, zmieniać mapę, sprawdzać spójność, a następnie ewentualnie odtwarzać wszystko przy błędzie.

To uniemożliwiało bezpieczne użycie konstrukcji przez kompilator, serwer, narzędzia lub testy bez renderera.

## Co naprawdę poprawiono

### Model jest autorytatywny

`CraftModel` zawiera wyłącznie czyste rekordy bloków. Nie ma w nim `THREE`, `CANNON`, DOM ani meshy.

### Operacje są atomowe

Symetryczny plan kilku bloków jest walidowany i zatwierdzany jako całość. Nie istnieje już ścieżka, w której część planu zostaje dodana, a kolejna część zawodzi.

Usuwanie bloku najpierw sprawdza wynikową konstrukcję. Odrzucona operacja nie modyfikuje modelu, widoku ani rewizji.

### Widok jest projekcją

Meshe warsztatu są utrzymywane osobno. Zdarzenia modelu opisują `added`, `removed` i `updated`.

Po każdej aktualizacji sprawdzana jest zgodność kluczy. W razie błędu widok jest odbudowywany z modelu.

### Historia ma właściciela

Undo/redo nie jest już zestawem publicznych tablic manipulowanych w wielu funkcjach. `CraftHistory` odpowiada za klonowanie, limity, deduplikację i rollback.

### Skala modelu została sprawdzona

Test pełnych 2500 bloków przechodzi. W tym środowisku atomowa wymiana modelu trwała około 9–11 ms. To nie jest benchmark renderera ani fizyki, ale potwierdza, że warstwa danych nie jest obecnym wąskim gardłem.

## Co nadal jest słabe

### Brak CraftCompiler

`buildCraftSnapshot()` nadal znajduje się w `game.js` i tworzy dane analizy z użyciem Three.js. Analiza i lot nadal nie korzystają z jednego niezmiennego artefaktu kompilacji.

### Brak granicy backendu fizycznego

Kod bezpośrednio tworzy `CANNON.Body`, `CANNON.Box` i wywołuje `world.step`.

### Jeden collider na voxel

Model danych obsługuje 2500 bloków, ale aktywny lot pozostaje ograniczony do 480 części. Limit jest nadal konieczny.

### Duży runtime

`game.js` nadal zawiera scenę, UI, misje, analizę, fizykę i runtime uszkodzeń. Zmniejszyła się jego własność danych, ale nie został jeszcze rozbity wykonawczo.

### Zależności CDN

Three.js, Cannon.js i Tailwind nadal wymagają internetu. Nie wykonano pełnego playtestu WebGL w tym środowisku z powodu blokady nawigacji i zewnętrznych zależności.

## Czy można teraz dodawać gameplay?

Tylko drobne poprawki regresji. Duże systemy gameplayowe powinny poczekać na:

1. `CraftCompiler`;
2. interfejs backendu fizycznego;
3. kompilator colliderów;
4. pomiary runtime dużych konstrukcji.

## Następna decyzja

Kolejny etap powinien utworzyć `CompiledCraft`, ale nie powinien jeszcze zmieniać zachowania lotu. Najpierw trzeba uzyskać pełną zgodność wyników obecnego `buildCraftSnapshot()` z nowym kompilatorem, a dopiero potem przełączyć runtime.
