# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia dla kolejnych sesji i agentów. Najpierw przeczytaj ten plik, potem `ARCHITECTURE.md`, `VALIDATION_REPORT.md` i testy.

## 1. Wizja produktu

Voxel Aeronautics Workshop ma być przede wszystkim sandboxem inżynieryjnym, w którym gracz:

1. buduje statek powietrzny blok po bloku;
2. rozmieszcza napęd, powierzchnie, sensory i urządzenia;
3. programuje sposób sterowania;
4. testuje maszynę i analizuje telemetrię;
5. poprawia projekt;
6. lata dla samej przyjemności latania.

Kontrakty, ekonomia i progresja są pomocnicze. Nie mogą zagłuszyć głównej fantazji: **buduję, programuję, testuję i latam własnym airshipem**.

## 2. Ważny feedback użytkownika

Użytkownik chce pełnej swobody rozpoczęcia konstrukcji. Nie wolno ponownie wymuszać Core w `0,0,0` ani automatycznie zajmować pierwszego/najniższego bloku.

Przykład wymagania: rakieta grubości jednego bloku i wysokości kilku bloków musi móc mieć thruster jako najniższy blok, a Core wyżej.

Sterowanie oczekiwane przez użytkownika:

- A = obrót w lewo, D = obrót w prawo;
- W/S = osobna oś przód/tył;
- Space = góra;
- Left Ctrl = dół;
- osie muszą działać jednocześnie, np. Left Ctrl + S.

## 3. Aktualny milestone

**Foundation Phase 1C.2 — Control Frame, Input Profile & UI Workspace**

Ukończone moduły:

- `foundation.config`;
- `foundation.catalog`;
- `foundation.orientation`;
- `foundation.blueprint` v9 z migracjami v3–v8;
- `foundation.craft-model`;
- `foundation.craft-history`;
- `foundation.control-frame`;
- `foundation.craft-compiler`;
- `foundation.input-profile`;
- `foundation.ui-workspace`;
- `foundation.flight-control`;
- `foundation.state`;
- `foundation.kernel`;
- `foundation.bootstrap`.

## 4. Nienaruszalne reguły

1. `CraftModel` jest jedynym właścicielem konstrukcji warsztatowej.
2. Rekord bloku nie może zawierać mesha, materiału, geometrii, body, shape ani DOM.
3. Renderer jest projekcją modelu i można go odbudować z modelu.
4. `CompiledCraft` jest jedyną zweryfikowaną reprezentacją wejściową dla startu lotu.
5. Core nie jest związany z początkiem układu współrzędnych.
6. Edytor pozwala na pusty, bez-Core i rozłączony stan roboczy.
7. Lot wymaga dokładnie jednego Core i jednej połączonej wyspy.
8. Maksymalnie jeden Core może istnieć w modelu.
9. Zmiany wieloblokowe są atomowe.
10. Odrzucona operacja nie zmienia rewizji ani historii.
11. Historia należy do `CraftHistory`.
12. Blueprint musi działać bez DOM, renderera i fizyki.
13. Każda wersja zapisu ma jawne migracje.
14. Sterowanie używa semantycznych osi `pitch/yaw/roll/surge/sway/lift`.
15. Wejścia lotu mają pierwszeństwo nad skrótami edytora.
16. Nie podnosić limitu 480 części lotnych bez collider compilera i benchmarku.
17. Nie dodawać programowania statku bez debuggera sygnałów i budżetu wykonania.
18. Po każdym etapie dostarczać działający ZIP źródeł, jednoplikowy HTML i raport testów.
19. ZIP i jednoplikowy HTML muszą pochodzić z jednego buildu, mieć unikalną nazwę wydania i przechodzić test zgodności osadzonych źródeł.
20. ZIP powinien zawierać kopię odpowiadającego mu jednoplikowego HTML oraz `SOURCE_MANIFEST.json`.
21. Orientacja Command Core definiuje układ sterowania statku: forward, up i right. Pozycja Core nie definiuje kształtu statku.
22. Profil wejścia gracza i layout UI są preferencjami użytkownika, nie częścią blueprintu statku.
23. UI nie może ponownie dostawać wyjątków per panel; wszystkie główne okna korzystają z `foundation.ui-workspace`.

## 5. Format i kompatybilność

Aktualny blueprint: **v9**.

- v9 zachowuje pusty warsztat, ruchomy Core i rozłączone WIP oraz zapisuje orientację Core;
- orientacja Core definiuje `CompiledCraft.controlFrame`;
- maksymalnie jeden Core;
- gotowość do lotu sprawdza `CraftCompiler`;
- v3–v7 zachowują historyczne założenie Core w `0,0,0` podczas migracji;
- v3–v8 migrują Core do historycznej orientacji `forward +X / up +Y`;
- przyszłe nieznane wersje są odrzucane.

## 6. Sterowanie

- W/S — `surge +/-`;
- Z/C — `sway -/+`;
- Space/Left Ctrl — `lift +/-`;
- strzałki góra/dół — pitch; domyślny profil odwraca historycznie błędny znak;
- A/D i strzałki lewo/prawo — yaw lewo/prawo;
- Q/E — roll;
- G — stabilizacja;
- -/+ — pasywny ciąg silników skierowanych ku lokalnemu +Y; nie jest limitem wejść pilota.

Każdą z sześciu osi można odwrócić i ustawić jej czułość w oknie Controls. `Left Ctrl + S` jest testowane jako równoczesne dół + tył. Nie wolno przywrócić konfliktu Ctrl+S w trybie lotu. Poziome i skierowane w dół thrustry mają być neutralnie wyłączone. Suwak ustala tylko pasywny ciąg +Y; nawet przy 0% bezpośrednie wejścia gracza muszą zachować pełną moc sterowania. Left Ctrl ma uruchamiać thrustry skierowane w dół, nie je wyłączać.

## 7. Stan testów

Przechodzą:

- składnia 15 źródeł aplikacji;
- statyczna zgodność kolejności loadera i brak duplikatów ID/funkcji;
- dwanaście rozwiązywanych modułów domenowych;
- 24 orientacje;
- blueprint v3–v9 i migracja orientacji Core;
- pusty warsztat, ruchomy/usuwalny i orientowany Core;
- `CompiledCraft.controlFrame`;
- sześć osi wejścia, odwracanie i czułość;
- transformacja intencji gracza przez orientację Core;
- trwały, normalizowany workspace okien;
- transakcje, historia i 600 losowych operacji;
- 2500 bloków;
- regresje misji, fizyki i uszkodzeń;
- startup smoke;
- bajtowa zgodność źródeł ZIP ↔ osadzone moduły HTML;
- deterministyczny build i SHA-256;
- brak duplikatów artefaktów w ZIP-ie.

Nie ma wiarygodnego automatycznego playtestu prawdziwego WebGL. Próba uruchomienia systemowego Chromium w środowisku roboczym zakończyła się ograniczeniami procesu/DBus. Nie wolno twierdzić, że pełny lot GPU został przetestowany.

## 8. Najbliższy etap

**Foundation Phase 1D — Physics Boundary**

Phase 1C.2 ustanowił granicę sterowania i UI. Nie rozbudowywać teraz paneli ani pojazdów przez dokładanie logiki do `game.js`; następny duży krok to wycięcie backendu fizyki.

Priorytety:

1. porty świata, ciała, collidera, siły i kroku;
2. adapter Cannon.js zachowujący obecne zachowanie;
3. przeniesienie tworzenia compound body poza `game.js`;
4. bezrendererowy harness fizyki;
5. pomiar stabilności, kosztu i deterministyczności;
6. decyzja cannon-es vs Rapier dopiero na danych;
7. collider compiler jako osobny kolejny etap.

## 9. Świadomy dług

- jeden collider na voxel;
- limit 480 aktywnych części;
- duży `game.js`;
- częściowe zależności Three.js w stanie runtime;
- biblioteki z CDN;
- uproszczona aerodynamika kadłuba;
- brak Vite/TypeScript/ESM;
- brak programu sygnałowego, jointów i dużego świata.

Nie przykrywać tych ograniczeń szybkim dodawaniem contentu.
