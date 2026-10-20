# Voxel Aeronautics Workshop (VAW)

**Eksperymentalny warsztat do budowania maszyn, sprawdzania ich w fizyce i poprawiania konstrukcji na podstawie obserwacji.** Swobodny sandbox, ręczny pilotaż i przyjemność eksperymentowania są ważniejsze od kontraktów czy liczby dostępnych systemów.

**[Uruchom VAW](https://jozzpoly.github.io/voxel-aeronautics-workshop/)** · [Dokładny opublikowany SHA](https://github.com/Jozzpoly/voxel-aeronautics-workshop/blob/gh-pages/BUILD_INFO.json) · [Recovery PR #16](https://github.com/Jozzpoly/voxel-aeronautics-workshop/pull/16)

## Stan po kampanii 19–20 października 2026

- `recovery/playable-truth` jest źródłową gałęzią kandydata. `main` pozostaje historyczny i nietknięty. `gh-pages` zawiera generowane wydanie, **nie** alternatywne źródło kodu. Historyczne gałęzie odzyskano pod tagami; zob. [archiwum gałęzi](docs/BRANCH_ARCHIVE_2026-10-19.md).
- Ostatnia zweryfikowana **opublikowana rewizja produktu**: [`8f292259`](https://github.com/Jozzpoly/voxel-aeronautics-workshop/commit/8f2922594de746a28a3b716c84b1b2c3bf7ccace). Jej [Validation](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043772), [reproducible build](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043658), [publish](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351039359) i [Pages](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351142474) zakończyły się PASS. Identyfikator wydania sprawdzono również z publicznego URL w Operze.
- Repozytorium może mieć nowsze **commity porządkowe (dokumentacja / jej test kontraktowy)**; przed użyciem source/build sprawdź rzeczywisty HEAD i `BUILD_INFO.json`. Aktualny skrócony stan i najbliższy sensowny ruch: [AI_PROJECT_MEMORY.md](AI_PROJECT_MEMORY.md).
- Owner potwierdził możliwość uruchomienia VAW przez Jaskinię; **nie zaakceptował** jeszcze jakości budowania, pilotowania, mechanizmów ani mobile. Maszynowe PASS oznacza sprawność określonych ścieżek, nie jakość doświadczenia.

## Co naprawdę działa na ścieżce odzyskiwania

Etapy **P2-A Engineering Analysis Truth** i **P2-B Test Evidence Continuity** są technicznie domknięte, a **P2-C Workshop Editing Fundamentals** ma działający fragment, nie pełną akceptację jakości.

- Swobodne rozpoczynanie konstrukcji, podstawowe stawianie/usuwanie, zaznaczanie części, inspektor, kamera `FRAME`, Undo/Redo i przycisk pełnoekranowego pilotażu `PILOT`.
- `Select / Inspect (V)`: przeciąganie zaznaczonej, niepołączonej mechanicznie części po jej lokalnej płaszczyźnie XZ. Podczas poprawnego ruchu przesuwa się **wizualna geometria**, nie zapis Blueprintu. Kolor obrysu informuje o akceptacji/odrzuceniu pozycji przez kanoniczny `CraftModel`. Anulowanie przywraca widok, a puszczenie myszy zatwierdza jedno cofane przesunięcie.
- Istnieje przetestowana automatycznie ścieżka: pusty warsztat → własnoręczne stawianie części → wybór/przesuwanie → uruchomienie w Chromium → powrót. Istnieją także testy wielobryłowego runtime i zawiasów.
- Sandbox zachowuje ograniczone `lastTestResult` na powrocie do edytora. Wykrywanie części konfliktów autosave i dostępny eksport ratunkowy zmniejszają ryzyko utraty pracy.

## Czego to **nie** dowodzi

Nie mamy Owner-accepted feelu, czytelnego pełnego UX dla mechanizmów, powszechnego gizmo 3D, transformowania połączonych jointami brył ani funkcjonalnego Device/Port/Signal/ControlRuntime dla gracza. Przeciąganie ogranicza się do lokalnego XZ; Y jest dostępne przez dyskretne przesunięcia. Testy renderowane nie stanowią pomiaru frame-time na złożonych modelach GLTF.

Zabezpieczenie dwóch kart nie jest atomową transakcją między procesami; starsza, długo otwarta karta może ominąć nową ochronę. Eksport ratunkowy pozostaje ważnym wyjściem awaryjnym. Nie zmieniać tego opisu na „w pełni bezpieczne zapisy”.

**Następna potrzeba produktowa:** rzeczywista ocena manipulacji i round-tripu budowa → lot → obserwacja → poprawka, zwłaszcza klarowności podglądu, kamery i obciążenia panelami. Nie rozbudowywać odruchowo systemu mechanizmów ani nowej infrastruktury agentowej.

## Dokumentacja — krótka droga

1. [AI_PROJECT_MEMORY.md](AI_PROJECT_MEMORY.md) — jeden aktualny checkpoint, bez kroniki wszystkich commitów;
2. [PROJECT_VISION.md](PROJECT_VISION.md) — Owner intent i trwała wizja;
3. [ROADMAP.md](ROADMAP.md) — faktyczne obszary zakończone / otwarte;
4. [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md) — granice i zasady pracy;
5. [docs/README.md](docs/README.md) — aktualne evidence, donory i archiwum.

[Retrospektywa kampanii 19–20 X](docs/history/recovery/2026-10-20-recovery-campaign-review.md) jest **historią z dowodami**, a nie drugim aktywnym planem. Poprzednia, rozrastająca się pamięć i README pozostają odzyskiwalne w historii Gita na `8f292259`.

## Lokalne uruchomienie i dowody

`npm run serve` — aplikacja lokalna. `npm test` — główna walidacja. Testów nie używaj jako substytutu interakcji i oceny produktu.
