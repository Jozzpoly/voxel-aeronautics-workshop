# VAW — roadmapa odzyskiwania (stan 2026-10-20)

**Cel nie zmienił się:** swobodnie zbudować maszynę, polecieć/przetestować, zrozumieć wynik i szybko ją przebudować. Drogę ustala realne doświadczenie Ownera, nie kolejność dawnych Gate'ów. [Wizja](PROJECT_VISION.md) i [aktualny stan](AI_PROJECT_MEMORY.md) są krótkimi punktami wejścia.

## Zrobione technicznie na `recovery/playable-truth`

- **P0: recovery repo** — odzyskano bezpieczny punkt pre-mesh `80c0ae4`, uproszczono gałęzie (trzy aktywne refy, tagi archiwalne), pozostawiono `main` nietknięty.
- **P1: code-reality audit** — klasyfikacja warstw; [źródłowy audyt](docs/CODE_REALITY_AUDIT.md) to baseline z 16 VIII, nie opis aktualnego produktu bez późniejszych poprawek.
- **P2-A: Engineering Analysis Truth** — wyeliminowano błędne world-space sąsiedztwo w multi-space, uściślono `primary-body-local` control estimates i ograniczenia prognoz artykulowanych maszyn.
- **P2-B: Test Evidence Continuity** — ograniczony `lastTestResult` przeżywa cleanup sandbox/contract; identyfikuje pierwszą awarię i utracone bloki, gdy znane.
- **Część P2-C: Workshop Editing Fundamentals** — zaznaczanie i test-failure inspect, przesuwanie pojedynczej niezlinkowanej części po lokalnym XZ, live render-preview, kanoniczna walidacja pozycji, Undo, kamera `FRAME`, weryfikowalny browser/build/release. To **technical slice**, nie ukończony warsztat.

## Otwarte w kolejności wartości, nie sztywnych faz

**1. Sprawdzić doświadczenie pracy z konstrukcją.** Najpierw ocena realnej pętli `buduję → testuję → rozumiem → poprawiam` na aktualnym wydaniu. Sprawdzać affordance, ciężar paneli, gesty, widoczność zmian, niepowodzenia, zachowanie kamery i feel lotu. Zebrać różnicę między rzeczywistym blokadorem a preferencją stylistyczną.

**2. Dokończyć istotne luki P2-C i przejść świadomie do P2-D.** Inspekcja awarii i editing powinny być zrozumiałe i przyjemne, nie tylko wykonywalne. Priorytet kolejnej poprawki musi wynikać z obserwacji. Upakowany workspace i niedoszlifowane feedback/sterowanie są kandydatami, nie automatycznie zaakceptowanym redesignem.

**3. Mechaniczne i programowalne urządzenia — później, eksperymentalnie.** Hinge jest realny, ale edycja geometrycznych relacji, grup sztywnych, poruszania mechanizmami i bezpośrednich device bindings nie ma kompletnych ścieżek gracza. Zbadać `rigid island` vs `assemblySpace` vs komponent grafu mechanicznego zanim wybierze się semantykę gestów. Wspierać ręczny pilotaż niezależnie od przyszłego programowania.

**4. Nierozwiązane bezpieczeństwo danych i skala.** Conflict detection nie zapewnia atomowego zapisu w dwóch kartach ani ochrony starych runtime. Browser profiling dla dużych/importowanych wizualizacji jest niewykonany. Naprawiać według konkretnego ryzyka i kosztu, nie z rozpędu.

## Czego nie robimy tylko dla pozornego postępu

Nie promujemy `main` z powodu zielonego CI. Nie przywracamy agent-mesha, nie mergujemy `VAW_GRoK` / mobile w ciemno, nie przepisujemy fundamentów pod matter-first building z JV/ANVIL, nie tworzymy ogólnego gizmo czy Device/Signal API bez dowodu wartości. `docs/history/**` to przeszłość, a nie obowiązujący backlog.

**Kryterium kolejnej decyzji:** konkretna obserwacja, która istotnie poprawi sprawność, zrozumiałość lub przyjemność iteracji maszyny; testy muszą falsyfikować założenia, a nie jedynie potwierdzać implementację.
