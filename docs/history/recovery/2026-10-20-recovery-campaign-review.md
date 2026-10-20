# VAW — zamknięcie kampanii odzyskiwania, 19–20 X 2026

**Status:** utrwalona retrospektywa i evidence, **nie aktywna roadmapa ani instrukcja wykonania**. Aktualny punkt wejścia: [AI_PROJECT_MEMORY](../../../AI_PROJECT_MEMORY.md). Materiał ma ułatwiać przyszłym agentom weryfikację i nie tworzyć kolejnego strumienia pracy.

## Co odzyskiwaliśmy

Owner w sierpniu polecił archeologię starego VAW po wieloagentowym chaosie: wrócić do pewnej wersji, nie ufać `main`, nie mieszać historii i żywego produktu. Później zażądał szerokiego porównania donorów (szczególnie Jaskinia, ale także JES, JURE, JV, Splot, Feniks Studio, Medium). Celem nie jest technicznie interesujący katalog podsystemów; celem jest warsztat o krótkiej i przyjemnej pętli **buduj → uruchom → zrozum wynik → przebuduj**, dla własnych nietypowych maszyn i mechanizmów.

Właściwym punktem odzyskiwania był pre-mesh `80c0ae4aced1dd695af217cdeadea9025c6305c8`. P0 uporządkowało repo; P1 ujawniło, że foundation/physics/compilery wyprzedziły gameplayowe wykorzystanie. P2-A naprawiło analizę i zaznaczyło ograniczenia szacowania sterowności; P2-B zatrzymało utratę minimum dowodów awarii na powrocie z sandboxa.

Gałęzie starych agentów i mobile zostały skompresowane do tagów archiwalnych (zachowane tipy). Na zakończenie pozostały trzy refy: historyczny `main`, źródłowy `recovery/playable-truth` i generowany `gh-pages`. PR #16 pozostał Draft.

## Kampanie produktu 19–20 X — wyniki i zakres dowodu

| Etap / opublikowane źródło | Co rzeczywiście zmieniono | Jakiego dowodu nie uzyskano |
| --- | --- | --- |
| Pierwsze wejście / wolna budowa, `3307e3f` i `2681c383` | Czytelniejszy pierwszy start, własnoręczne tworzenie od zera, narzędzie Select/Inspect i prawdziwy browser build/test/return smoke | Brak Owner-accepted czytelności i feelu |
| Ochrona zapisu, `218ee5a3` | Cross-tab conflict detection i eksport kopii ratunkowej | Brak atomowej transakcji dwóch kart, stare runtime niechronione |
| Kamera, `e5ad5640` | FRAME zaznaczonej części w poprawnej world transform; FOCUS przemianowany na PILOT (fullscreen/keyboard focus) | Brak pełnego Owner testu kamery |
| Gesty, `8dfbdd0f` | Left/right drag poza slop nie może przypadkiem place/delete, prawdziwy Chromium sprawdził kliknięcia i Undo | Brak szczegółowego testu ergonomic feel |
| Planar Select drag, `52ec6988` | Local-XZ drag części, pojedynczy Undo, Cancel/Escape/blur, bez joint-connected parts | Brak multi-part gizmo |
| Adversarial drag, `d79938ab` | Odrzucenie release bez ważnego finalnego ray; ochrona przed zmianą wybranego blockId podczas gestu | Użyto deterministycznych falsyfikatorów Three, nie nagranego incydentu Ownera |
| Kanoniczny preview, `d6d62c31` | Pure CraftModel.validateMove współdzieli reguły commit; niepoprawny cel czerwony, valid amber, bez mutacji preview | Brak testu kolorów z perspektywy Ownera i pełnego profilu przeglądarkowego |
| Wizualny part-follow, **`8f292259`** | W trakcie poprawnego drag realny visual root podąża za kursem, a rollback/commit zachowują domain truth | Brak potwierdzenia odczuwalności, GLTF-heavy frame-time i mobile |

Publiczne Pages [BUILD_INFO](https://github.com/Jozzpoly/voxel-aeronautics-workshop/blob/gh-pages/BUILD_INFO.json) wskazuje `8f2922594de746a28a3b716c84b1b2c3bf7ccace`. Dokładne [Validation PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043772), [reproducibility PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043658), [publish PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351039359), [Pages PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351142474). Rzeczywistą odpowiedź publicznego URL sprawdzono w Operze.

## Najcenniejsza negatywna wiedza

1. **Fałszywie zielony test:** oryginalna atrapa CraftModel zmieniała współrzędne danych, lecz nie synchronizowała Three visual. Adversarial drag mógł mieć zerowy displacement i „przechodzić” bez testowania błędu. Dopiero wymaganie rzeczywistego niezerowego kandydata dało czerwony wynik.
2. **Dwa reprodukowane błędy integralności:** po utracie przecięcia ray/plane zatwierdzano ostatni poprawny cel ([red CI](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39344333823)); zmiana zaznaczenia mid-drag mogła przekierować zapis na inny blok ([red CI](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39344557031)). Naprawy mają unit i browser lifecycle proof; nie dowodzą wystąpienia takiego scenariusza u Ownera.
3. **Architecture gate ma sens, ale był także tarciem:** `game.js` przekroczył limit linii podczas dopisywania przycisku FRAME; przeniesiono ownership do kontrolera zamiast powiększać limit. Przy kolejnych gestach nie dopisywać wielkich inline handlerów bez potrzeby.
4. **CI to warstwa evidence, nie obraz gry:** część przejściowych czerwonych buildów wynikała z generatora CSS albo świadomie czerwonych testów. Dokładne commit+run mają znaczenie; końcowy SHA ma zielone full validation i release parity. Node benchmark walidacji przy 2500 blokach: mediana 3,319 ms, max z 24 prób 5,248 ms — to nie pomiar FPS.
5. **Donor nie jest rozkazem:** Jaskinia jest dobrym laboratoryjnym przykładem UX, ale jej gesty konfliktują z klikaniem VAW; JES/NextGen JV mogą dostarczyć wzorców reversible preview, nie uzasadniają copy-paste. Splot przypomina, że zielona geometria nie zastępuje utraconego gameplayu. Historyczne gałęzie VAW są donorami, nie aktywnym planem.

## Nowe rozróżnienie mechaniczne — nie wcielać bez eksperymentu

`AssemblySpace` to kanoniczna własność przestrzenna. `RigidIslandCompiler` wyprowadza body przez usunięcie z grafu struktury krawędzi ciętych zawiasami. Jeden AssemblySpace może zawierać więcej niż jedną sztywną wyspę. Mechaniczny link opisuje punkty i normalne dwóch endpoint faces, ma geometrię oraz ownera (często LCA przestrzeni). Zatem przesuwanie „całego assembly space”, „rigid island” i „mechanically connected component” to trzy różne operacje. Bez jawnego kontraktu można oderwać joint lub niechcący ruszyć całą maszynę.

Nie wdrożono grupowego dragu ani nowej architektury mechanizmów. Przed nim potrzeba porównania zadaniowego: przesunięcie samodzielnej grupy sztywnej kontra manipulacja wokół pivotu zawiasu, z zachowaniem topologii, Undo i czytelnością na ekranie. [Notatka źródłowa w PR #16](https://github.com/Jozzpoly/voxel-aeronautics-workshop/pull/16).

## Czego nie uznajemy za zakończone

- **Największa luka produktu:** ocena użytkowa. Owner jeszcze nie zaakceptował złożoności paneli, edycji, wejścia do mechanizmów, feelu lotu ani mobile. Screenshot/CI/uruchomienie przez Jaskinię to inne klasy dowodu.
- **Zapis:** guard cross-tab i ratunkowy JSON są częściowe; brak atomic compare-and-swap i możliwość starszych runtime; nie mówić „bezpieczne na 100%”.
- **Future horizon:** device bindings, graf sygnałów, sterowanie jointami i większe możliwości świata są nadal dalekie. Nie wolno przedstawiać wizji jako implementacji.
- **Brak Owner session:** bez niego nie wiemy, czy przesuwanie realnych części faktycznie jest wygodniejsze od obrysu; kolejne 10 feature commitów tego nie wyjaśni.

## Dzień następny — niewymuszający handoff

Sprawdź live branch, build SHA i aktualną krótką pamięć. Jeśli Owner testuje, nie przerywaj mu wielkim planem. Najbardziej informacyjny eksperyment to **jedna rzeczywista sesja**: własna konstrukcja z kilku bloków, przesunięcie poprawne i odrzucone, Undo, kadrowanie, test lotu, powrót i przebudowa. Odbieraj konkretny friction, nie tylko odpowiedź „PASS”.

Bez Ownera warto obserwować rendering/panel ergonomics i falsyfikować semantykę gestów, ale nie publikować automatycznie kolejnej funkcji. Scope ewentualnej pracy wynika z wykrytego wąskiego problemu. Nie należy oczekiwać godzinnego „status-report generatora”.

## Porządek dokumentacji po kampanii

Na `8f292259` poprzedni `AI_PROJECT_MEMORY.md` miał 31 706 znaków i wiele narastających statusów „candidate”; `README.md` mieszało bieżący publiczny build z nieaktualnym twierdzeniem o wyłączonym Pages, PR #16 miał dawny SHA i P2-B jako przyszłość. Ich wcześniejsze wersje można odtworzyć z tego commita Gita. Zamiast utrwalać kolejną konkurującą „current” notatkę, **skrócono aktualne root docs, a tę rozbudowaną retrospektywę umieszczono w `history/`**. Komentarze PR pozostają szczegółowym, datowanym śladem decyzji, nie źródłem aktualnego stanu.

To świadome zakończenie. Nie usuwano repo branchy, source plików ani danych użytkownika w imię porządku.
