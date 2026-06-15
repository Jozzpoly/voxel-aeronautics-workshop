# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia. Najpierw przeczytaj ten plik, następnie `ARCHITECTURE.md`, `ROADMAP_NEXT.md`, `VALIDATION_REPORT.md`, `DELIVERY_WORKFLOW.md` i testy.

## 1. Wizja

Główna fantazja:

> **buduję, programuję, testuję i latam własnym voxelowym statkiem lub maszyną powietrzną.**

Sandbox i ręczne latanie są pełnoprawnym rdzeniem gry. Kontrakty, gwiazdki i progresja są warstwą pomocniczą, nigdy warunkiem sensowności sandboxu.

Docelowo gracz może:

- adresować i programować każdy funkcjonalny blok osobno;
- łączyć sensory, logikę i aktuatory grafem sygnałów;
- zachować domyślny automatyczny mikser albo przejąć bezpośrednią kontrolę;
- budować wiele sztywnych podzespołów połączonych free bearing, rotary motor, servo i późniejszymi jointami;
- tworzyć wirniki, obrotowe gondole, składane konstrukcje i mechanizmy.

## 2. Aktualny milestone

**Foundation Phase 1D.2F — Runtime Assembly Foundation**

Ukończone fundamenty:

- pusty warsztat i dowolny pierwszy blok;
- ruchomy, usuwalny i orientowany Command Core;
- blueprint v10 z trwałym `blockId`;
- `gridKey` oddzielony od tożsamości bloku;
- `CompiledCraft.blockIdToIndex`;
- `RuntimeAssemblyPlan` z `rigidBodies[]`, `constraints[]` i `signalLinks[]`;
- runtime `bodyById` i `runtimePartById`;
- jawne diagonalne mass properties przekazywane do Cannon;
- ponowne liczenie bezwładności po payloadzie i detach;
- sześć semantycznych osi i rebindable input profile v3;
- physics lifecycle/contact boundary;
- guided Balloon power i Passive vertical thrust;
- deterministyczny ZIP + single HTML z source parity.

## 3. Nienaruszalne reguły

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest jedynym zweryfikowanym wejściem runtime.
3. Meshe, body, shapes i DOM nie trafiają do blueprintu.
4. Core ma specjalną rolę, nie specjalną pozycję.
5. Edytor dopuszcza pusty, bez-Core i rozłączony WIP.
6. Start obecnego jedno-body runtime wymaga dokładnie jednego Core i jednej połączonej wyspy.
7. Zmiany wieloblokowe są atomowe.
8. Każda wersja zapisu ma migrację.
9. `blockId` jest trwałą tożsamością; współrzędne i `gridKey` nie mogą jej zastępować.
10. Przeniesienie urządzenia musi zachowywać `blockId`; kopiowanie tworzy nowe `blockId`.
11. Pojedyncze body jest pierwszym przypadkiem `RuntimeAssembly`, nie docelowym ograniczeniem.
12. Struktura sztywna, graf mechaniczny i graf sygnałowy są osobnymi modelami.
13. Joint przecina sztywne połączenie; obejście jointa zwykłą strukturą musi być diagnozowane.
14. Globalne regulatory i obecny mikser są domyślnymi źródłami sygnału, nie końcowym modelem sterowania.
15. PID jest zwykłym węzłem logiki, nie specjalnym wyjątkiem zaszytym w fizyce.
16. `game.js` nie może omijać Physics Portu.
17. Panel analizy i solver muszą korzystać ze zgodnych właściwości masowych.
18. Nie podnosić limitu części bez benchmarku i świadomej decyzji o colliderach.
19. Każda dostawa zawiera źródła, single HTML, raport, walidację, sumy i bezpieczną instrukcję aktualizacji.
20. Nigdy nie zalecać zwykłego `git push --force`.
21. Domyślna dostawa to pełny, gotowy ZIP projektu; użytkownik wykonuje lokalny commit i push według instrukcji. Nie publikować projektu na GitHub w kawałkach ani przez tymczasowe pliki pośrednie.

## 4. Trzy grafy przyszłej maszyny

### Structural graph

Określa, które voxele należą do jednej sztywnej bryły.

### Mechanical graph

Łączy sztywne bryły przez jointy: free bearing, motor, servo, piston, docking i późniejsze typy.

### Signal graph

Łączy porty urządzeń. Może przechodzić przez jointy niezależnie od połączeń fizycznych.

Tych grafów nie wolno scalać w jeden model.

## 5. Najbliższy etap

**Foundation Phase 1D.3 — Runtime Assembly Builder & Headless Harness**

1. wydzielić całe tworzenie body/runtime parts z `game.js`;
2. zachować `blockId -> body/part/collider`;
3. testować mass properties, free fall, hover, torque, COM, payload, detach i soak;
4. benchmarkować 100/500/1000/2500 colliderów;
5. wykonać joint capability spike: dwa body + free hinge + powered hinge;
6. nie rozpoczynać kolejnej szerokiej rundy polerowania aerodynamiki przed Per-Block Control Bus.

## 6. Pierwszy gameplay po 1D.3

**Phase 1E — Per-Block Control Bus**

- wybór konkretnego aktywnego bloku;
- tryb `Default mixer`, `Direct signal`, `Control group`, `Disabled`;
- gain, invert, trim, min i max;
- grupy urządzeń;
- trwały zapis konfiguracji w blueprintcie;
- uszkodzony lub odłączony blok zachowuje tożsamość konfiguracji.

Następnie sensory, podstawowe węzły matematyczne, live scope i PID.

## 7. Świadomy dług

- duży `game.js` nadal buduje wizualizację i część runtime;
- `RuntimeAssemblyPlan` ma obecnie dokładnie jedno body i zero constraintów;
- jeden collider na voxel;
- limit 480 części w locie;
- payload nie ma jeszcze graczowego `PayloadMount`;
- część natywnych wektorów Cannon pozostaje w runtime;
- brak prawdziwego headless solver harnessu i testu jointów;
- biblioteki z CDN;
- brak pełnego automatycznego testu WebGL/GPU.
