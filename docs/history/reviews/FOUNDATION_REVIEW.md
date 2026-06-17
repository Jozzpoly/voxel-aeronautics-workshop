# Foundation Review — Phase 1C.1 Hotfix

## Decyzja jakościowa

Phase 1C jest dobrym punktem bazowym do rozpoczęcia granicy backendu fizycznego. Nie jest jeszcze zakończeniem fundamentów i nie uzasadnia podniesienia limitu części lotnych.

Najważniejsze osiągnięcie nie polega tylko na dodaniu nowego pliku. Projekt posiada teraz trzy jawne poziomy danych:

```text
CraftModel → CompiledCraft → Flight Runtime
```

Dzięki temu dalsze zmiany fizyki nie muszą ponownie mieszać blueprintu, sceny i solvera.

## Co zostało zweryfikowane

- cały zestaw Phase 1B przechodził przed zmianami;
- model i widok były rzeczywiście rozdzielone;
- historia była atomowa i ograniczona;
- build był powtarzalny;
- migracje starszych zapisów działały;
- po zmianach wszystkie wcześniejsze regresje nadal przechodzą.

## Co poprawiono właściwie

### Core ma rolę, a nie zarezerwowaną pozycję

Można rozpocząć od dowolnego bloku. Test zawiera dokładnie przypadek jednoblokowej rakiety: thruster na `0,0,0`, kadłub/paliwo wyżej i Core na `0,2,0`.

### Stan roboczy i statek lotny są rozdzielone

Pusty, bez-Core lub rozłączony projekt można zachować. Nie oznacza to jednak zgody na start. `CraftCompiler` dostarcza jawne błędy `empty-craft`, `missing-core` i `disconnected`.

To lepszy model UX niż wymuszanie kompletności po każdej operacji.

### Kompilator jest czysty i deterministyczny

`CompiledCraft` jest zamrożony, kanonicznie sortowany i ma stabilną sygnaturę. Kompilacja tej samej rewizji jest cache’owana. Model 2500 bloków kompiluje się w dziesiątkach milisekund w Node, więc warstwa danych nadal nie jest głównym wąskim gardłem.

### Sterowanie ma semantykę urządzeń

Input nie jest już luźnym zbiorem warunków w `keydown`. Osie `surge` i `lift` są oddzielone od `pitch/yaw/roll`.

Suwak jest teraz wyłącznie pasywnym ciągiem silników skierowanych ku lokalnemu +Y. Nie ogranicza mocy dostępnej dla wejść pilota.

Poziome i skierowane w dół thrustry nie pracują neutralnie. W/S, Space/Ctrl i sterowanie obrotowe mogą jednak uruchomić zgodne silniki do pełnej mocy nawet przy suwaku 0%. Komenda przeciwna wygasza pasywny ciąg zamiast odwracać znak silnika.

## Błędy wykryte dzięki dokładniejszej walidacji

### Zmienna poza zakresem przy Launch

`setMode()` używał `snapshot.parts.length` bez lokalnego `snapshot`. Problem nie był widoczny w dawnym startup smoke, ponieważ test nie klikał Launch. Został naprawiony, a smoke test wykonuje teraz realną ścieżkę startu.

### Konflikt Left Ctrl + S

Skrót Ctrl+S przechwytywał kombinację dół + tył. Wejścia lotu otrzymały priorytet przed skrótami edytora.

### Błędne utożsamienie pasywnego ciągu z limitem

Phase 1C potraktował suwak jako `powerLimit`, choć użytkownik oczekiwał wyłącznie mocy pasywnej. To ograniczało W/S/Space/Ctrl i maskowało błąd kierunku silników pionowych. Hotfix usuwa limit z miksera: baza pasywna pozostaje zależna od suwaka, ale bezpośrednia komenda ma własny pełny zakres mocy.

### Neutralnie aktywne silniki kierunkowe

Stary model uruchamiał globalną moc na każdym thrusterze niezależnie od orientacji. Poziome i skierowane w dół silniki mogły spalać paliwo i wzajemnie się znosić bez komendy. Neutralny command zależy teraz od osi silnika.

## Co nadal jest słabe

### Backend fizyki nadal przecieka do runtime

`game.js` nadal tworzy `CANNON.Body`, `CANNON.Box`, obsługuje kontakty i wywołuje `world.step()`.

### Jeden collider na voxel

`CompiledCraft.colliderPlan` dokumentuje stan referencyjny, ale nie optymalizuje go. Limit 480 części pozostaje konieczny.

### Niepełny test integracyjny

Startup smoke dobrze testuje logikę UI i wejścia, ale nie renderuje prawdziwego WebGL ani nie mierzy rzeczywistego lotu. Kierunek A/D należy jeszcze potwierdzić lokalnie z docelową kamerą.

### Globalny układ osi jest nadal sztywny

`surge` odpowiada lokalnemu X konstrukcji, a `lift` lokalnemu Y. To dobra baza, lecz przyszły Command Core lub kontroler powinien jawnie definiować ramę odniesienia pojazdu, szczególnie dla nietypowych rakiet i pionowych airshipów.

### Analiza napędu pozostaje uproszczona

Nie istnieją jeszcze autobusy silników, grupy urządzeń, krzywe śmigieł ani pełny mikser użytkownika. Obecny model jest poprawniejszy, ale nadal przejściowy.

## Czy można dodawać gameplay?

Nadal tylko małe, izolowane poprawki. Następny poważny etap powinien dotyczyć Physics Boundary. Programowanie, jointy i rozbudowany świat powinny poczekać na stabilny adapter solvera i collider compiler.

## Rekomendacja

Przejść do Phase 1D bez zmiany balansu:

1. opisać minimalny port fizyki na podstawie realnych użyć;
2. zaimplementować adapter Cannon.js;
3. przenieść budowę body poza `game.js`;
4. uzyskać headless physics harness;
5. dopiero wtedy benchmarkować i scalać collidery.
