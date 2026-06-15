# Roadmap po Foundation Phase 1B

## Ukończone: Foundation Phase 1B — CraftModel

Zrealizowano:

- czysty `CraftModel` bez meshy i fizyki;
- osobny widok warsztatu;
- atomowe dodawanie, usuwanie i wymianę konstrukcji;
- zdarzenia zmian i rewizje;
- ochronę spójności konstrukcji;
- czysty `CraftHistory`;
- testy losowych operacji;
- test pełnych 2500 bloków;
- statyczne zabezpieczenia przed powrotem starego sprzężenia.

Świadomie nie dodano jeszcze pełnego obracania lub lustrzanego przekształcania całej konstrukcji. Obecna symetria placementu działa, ale przyszłe transformacje całego blueprintu powinny zostać dodane do modelu razem z testami kolizji pozycji i orientacji.

## Następny etap: Foundation Phase 1C — CraftCompiler

Cel: utworzyć niezmienny artefakt pomiędzy konstrukcją i runtime.

`CompiledCraft` powinien zawierać:

- identyfikator rewizji źródłowej;
- kanoniczną listę części;
- mapę `key -> partIndex`;
- graf sąsiedztwa;
- masę i środek masy;
- tensor lub jawne przybliżenie bezwładności;
- pozycje względem COM;
- bazy orientacji w neutralnym formacie liczbowym;
- punkty przyłożenia ciągu, wyporu i aerodynamiki;
- urządzenia funkcjonalne pogrupowane według typu;
- mapowanie voxel ID do przyszłych colliderów i runtime parts;
- plan colliderów w wersji `one voxel = one box` jako punkt odniesienia;
- raport błędów i ostrzeżeń;
- deterministyczną sygnaturę kompilacji.

### Zasady wdrożenia

1. Najpierw test zgodności z obecnym `buildCraftSnapshot()`.
2. Brak zmiany balansu i zachowania lotu w tym samym commicie.
3. Kompilator nie może zależeć od DOM, sceny ani Cannon.js.
4. Wynik powinien być niezmienny.
5. Kompilacja tej samej rewizji może być cache’owana.
6. Runtime ma przyjmować wyłącznie `CompiledCraft`, nie czytać modelu warsztatu bezpośrednio.

## Foundation Phase 1D — Physics Boundary

- zdefiniować minimalny interfejs świata, ciała, collidera, siły i kroku;
- zachować Cannon.js jako pierwszy adapter referencyjny;
- przenieść tworzenie compound body poza `game.js`;
- dodać deterministyczny harness bez renderera;
- zmierzyć aktualny backend przed decyzją o cannon-es lub Rapier.

## Foundation Phase 2 — Collider Compiler

- greedy merge pełnych bloków konstrukcyjnych;
- osobne collidery dla części funkcjonalnych i przyszłych mechanizmów;
- mapowanie trafienia na pojedynczy voxel;
- lokalna rekompilacja po oderwaniu fragmentu;
- benchmarki 100, 500, 1000 i 2500 bloków;
- podniesienie limitu lotu wyłącznie na podstawie wyników.

## Foundation Phase 3 — Rendering Boundary

- instancing powtarzalnych modułów;
- picking instancji;
- dirty regions;
- wspólne geometrie i kontrola materiałów;
- budżet draw calli i pamięci GPU.

## Późniejsze systemy

Dopiero po powyższych granicach:

- graf sygnałów i mikrokontrolery;
- sensory i aktuatory;
- mechanizmy ruchome;
- aerodynamika odsłoniętych powierzchni;
- komory gazowe i balast;
- świat, pogoda i długie trasy;
- multiplayer.
