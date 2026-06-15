# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Ten plik jest obowiązkowym punktem wejścia dla kolejnych agentów i sesji pracujących nad projektem.

## 1. Wizja produktu

Voxel Aeronautics Workshop ma być przede wszystkim sandboxem inżynieryjnym, w którym gracz:

1. buduje statek powietrzny blok po bloku;
2. łączy sensory, kontrolery i urządzenia wykonawcze;
3. programuje sposób sterowania;
4. testuje maszynę i analizuje telemetrię;
5. poprawia projekt;
6. lata dla samej przyjemności latania.

Kontrakty, ekonomia i progresja są systemami pomocniczymi. Nie mogą zagłuszyć głównej fantazji: **buduję, programuję, testuję i latam własnym airshipem**.

## 2. Kierunek techniczny

Docelowo projekt potrzebuje:

- kompilatora konstrukcji `Blueprint -> CompiledCraft`;
- scalonych colliderów i wydajnego renderowania dużych konstrukcji;
- oddzielnych wysp sztywnych brył dla mechanizmów ruchomych;
- grafu sygnałów, sensorów, aktuatorów i mikrokontrolerów;
- aerodynamiki opartej na odsłoniętych powierzchniach;
- komór gazowych, balastu, napędu i telemetrii;
- prostego świata stworzonego do długich lotów.

## 3. Aktualny milestone

**Foundation Phase 1B — CraftModel Boundary**

Po walidacji Phase 1 usunięto najważniejsze fałszywe sprzężenie architektoniczne: rekordy bloków konstrukcji nie przechowują już obiektów Three.js.

Aktualne moduły fundamentu:

- `foundation.config` — stałe, limity i polityki;
- `foundation.catalog` — definicje bloków i kontraktów;
- `foundation.orientation` — 24 orientacje przestrzenne;
- `foundation.blueprint` — czysty dokument, normalizacja, migracje i walidacja;
- `foundation.craft-model` — autorytatywny, czysty model konstrukcji;
- `foundation.craft-history` — ograniczona historia undo/redo oparta na snapshotach dokumentu;
- `foundation.state` — fabryka niezależnego stanu aplikacji;
- `foundation.kernel` — jawny loader zależności;
- `foundation.bootstrap` — kontrolowany punkt startowy.

Warstwa renderowania warsztatu przechowuje meshe osobno w `STATE.workshop.meshesByKey`. Jest projekcją modelu, nie źródłem prawdy.

## 4. Nienaruszalne reguły architektury

1. `CraftModel` jest jedynym właścicielem aktualnej konstrukcji warsztatowej.
2. Rekord domenowy bloku nie może zawierać mesha, materiału, geometrii, body, shape ani referencji DOM.
3. Renderowanie może odtwarzać widok z modelu; model nie może być odtwarzany z renderera.
4. Zmiany wieloblokowe muszą być atomowe: pełny plan zostaje przyjęty albo model pozostaje bez zmian.
5. Odrzucona operacja nie może zmieniać rewizji modelu ani historii.
6. Operacje usuwania muszą chronić Core i spójność konstrukcji, chyba że przyszły jawny tryb narzędzia stanowi inaczej.
7. Historia edycji należy do `CraftHistory`; runtime nie może ponownie utrzymywać luźnych tablic undo/redo.
8. `game.js` nie może ponownie stać się właścicielem katalogów, formatu zapisu, orientacji ani generatora stanu.
9. Dane domenowe nie mogą zależeć od DOM, renderera ani konkretnego ekranu UI.
10. Blueprint musi dać się walidować i migrować bez uruchamiania sceny 3D.
11. Każdy zapis musi mieć jedną wersję schematu i jawne reguły migracji.
12. Build jednoplikowy i projekt źródłowy muszą powstawać z tych samych plików.
13. Po każdym etapie musi istnieć działająca, testowalna i możliwa do uruchomienia wersja.
14. Refaktoryzacja zachowania i rozwój gameplayu powinny być osobnymi zmianami, chyba że test dokładnie zabezpiecza oba aspekty.
15. Nie podnosić limitu części lotnych bez benchmarku i scalenia colliderów.
16. Nie dodawać programowania statku bez debuggera sygnałów i budżetu wykonania.

## 5. Obecne źródło prawdy

Kolejność plików startowych znajduje się w `tools/build_release.py` jako `APP_SOURCES` i jest testowana względem loadera w `index.html`.

Polecenia:

```bash
python tests/run_all.py
python tools/build_release.py
python tools/serve.py
```

Na Windows można użyć:

```text
run_tests.bat
run_game.bat
```

## 6. Stan testów

Aktualnie przechodzą:

- sprawdzenie składni 10 źródeł aplikacji;
- statyczna kontrola 197 funkcji runtime i 142 identyfikatorów HTML;
- test kernela i siedmiu rozwiązywanych modułów domenowych;
- izolacja instancji stanu;
- 24 orientacje i migracje orientacji legacy;
- walidacja i migracja blueprintów v3–v7;
- atomowe dodawanie, usuwanie i zastępowanie konstrukcji;
- ochrona Core i spójności grafu konstrukcji;
- niezmienność snapshotów oraz zdarzeń `CraftModel`;
- 600 deterministycznych losowych operacji edytora;
- pełny model 2500 bloków oraz atomowe odrzucanie przekroczenia limitu;
- ograniczona, izolowana historia undo/redo z rollbackiem;
- regresje fizyki, misji, uszkodzeń i UI;
- smoke test uruchomienia całej aplikacji na stubach przeglądarki;
- jednoplikowy build, ZIP, SHA-256 i powtarzalność dwóch niezależnych buildów.

Nie ma jeszcze automatycznego testu prawdziwego WebGL. Środowisko wykonawcze blokowało nawigację Chromium do plików lokalnych i localhosta, dlatego nie wolno twierdzić, że wykonano pełny playtest renderera.

## 7. Najbliższy etap

**Foundation Phase 1C — CraftCompiler**

Priorytety:

1. zdefiniować niezmienny kontrakt `CompiledCraft`;
2. przenieść analizę masy, środka masy, bezwładności i funkcjonalnych modułów poza globalny `STATE`;
3. kompilować czysty `CraftModel` do reprezentacji runtime bez meshów;
4. zachować stabilne mapowanie `blockKey -> compiled indices` dla obrażeń i diagnostyki;
5. dodać deterministyczne testy kompilacji oraz benchmarki 100/500/1000/2500 bloków;
6. dopiero później wprowadzić interfejs backendu fizycznego i scalanie colliderów.

## 8. Świadomie pozostawione ograniczenia

- Three.js, Cannon.js i Tailwind nadal są pobierane z przypiętych CDN-ów.
- `game.js` nadal jest duży i zarządza sceną, UI, lotem, aerodynamiką i misjami.
- `foundation.state` nadal tworzy część wektorów Three.js dla kompatybilności runtime; czysty model konstrukcji jest już od tej zależności wolny, lecz pełna granica stanu jeszcze nie.
- Fizyka nadal używa jednego collidera na voxel.
- Runtime lotu nadal jest budowany bezpośrednio przez funkcje w `game.js`.
- Nie ma jeszcze `CraftCompiler`, abstrakcji backendu fizycznego, TypeScriptu ani Vite.

Te ograniczenia są jawne. Nie wolno ich przykrywać szybkim dodawaniem gameplayu.
