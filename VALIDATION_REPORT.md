# Validation Report — Foundation Phase 1 → Phase 1B

## Cel

Zweryfikować poprzedni etap jak zewnętrzny pull request, zanim projekt otrzyma kolejne fundamenty. Walidacja obejmowała testy, build, zawartość wydania, granice modułów i ręczny przegląd właścicieli stanu.

## Stan wejściowy

Przed zmianami:

- cały odziedziczony zestaw testów przechodził;
- startup smoke test przechodził;
- jednoplikowy build oraz ZIP powstawały poprawnie;
- moduły Config, Catalog, Orientation, Blueprint, State, Kernel i Bootstrap były realnie używane przez grę.

Phase 1 nie był atrapą. Dostarczał działające granice dla konfiguracji, katalogów, orientacji, dokumentu zapisu i bootstrapa.

## Znalezione problemy

### 1. Model konstrukcji nadal nie był czysty

`STATE.voxels` przechowywało jednocześnie:

- pozycję i typ bloku;
- orientację oraz ustawienia sterowania;
- mesh Three.js.

W efekcie renderer pozostawał częścią modelu domenowego. Utrudniało to testowanie, przyszły CraftCompiler, narzędzia zewnętrzne, multiplayer oraz zmianę sposobu renderowania.

### 2. Operacje edytora nie miały jednego właściciela transakcji

Dodawanie symetryczne, usuwanie i odtwarzanie blueprintu składały się z wielu ręcznych kroków wykonywanych przez runtime. Błąd w połowie operacji mógł w przyszłości rozjechać model, widok i historię.

### 3. Historia była strukturą runtime

Undo/redo opierało się na luźnych tablicach stanu aplikacji. Nie miało samodzielnego kontraktu, izolacji snapshotów ani jawnego rollbacku po nieudanym odtworzeniu.

### 4. Granica stanu jest nadal niepełna

`foundation.state` wciąż tworzy wybrane obiekty Three.js potrzebne istniejącemu runtime. Nie blokuje to czystego modelu konstrukcji, ale pozostaje świadomym długiem do dalszego wydzielenia.

## Wprowadzone korekty

- Dodano autorytatywny `foundation.craft-model` bez zależności od renderera, fizyki i DOM.
- Dodano `foundation.craft-history` z ograniczonym undo/redo i rollbackiem.
- Usunięto `STATE.voxels`.
- Meshe warsztatu przeniesiono do `STATE.workshop.meshesByKey`.
- Widok warsztatu jest aktualizowany ze zdarzeń modelu i może zostać w całości odbudowany z modelu.
- Dodawanie wieloblokowe oraz zastępowanie konstrukcji są atomowymi transakcjami.
- Usuwanie Core lub bloku rozcinającego konstrukcję jest odrzucane przed zmianą modelu.
- Blueprint jest generowany bezpośrednio z czystego modelu.
- Dodano statyczne i dynamiczne testy zabraniające powrotu starego sprzężenia.

## Wynik po zmianach

- Wszystkie dotychczasowe regresje przechodzą.
- Wszystkie nowe testy CraftModel i CraftHistory przechodzą.
- 600 deterministycznych operacji edytora nie naruszyło spójności modelu.
- Model 2500 bloków jest przyjmowany atomowo.
- Próba 2501 bloków jest odrzucana bez częściowej mutacji.
- Startup przechodzi z 10 źródłami aplikacji.
- Dwa niezależne buildy dały bajtowo identyczny HTML i ZIP.

## Ocena

**Phase 1B jest wystarczająco stabilnym fundamentem do rozpoczęcia CraftCompiler, ale nie do scalania colliderów ani zmiany fizyki.**

Najważniejsza granica została naprawiona: dane konstrukcji są teraz niezależne od jej wizualizacji. Następna zmiana powinna skompilować ten model do niezmiennej reprezentacji lotu, zanim runtime fizyczny zostanie przebudowany.

## Niewykonana walidacja

Nie wykonano pełnego testu prawdziwego WebGL ani ręcznego długiego lotu, ponieważ środowisko zablokowało Chromium dla `localhost` i `file://`. Ta luka jest jawna i pozostaje obowiązkowym testem po uruchomieniu projektu na komputerze użytkownika.
