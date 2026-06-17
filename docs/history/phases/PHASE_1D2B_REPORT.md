# Phase 1D.2B Report — Mission Recovery & Balloon Control Fix

## Identyfikacja wydania

- App version: `0.5.4-foundation.1d2b`
- Release id: `foundation-1d2b-mission-balloon-control-fix`
- Zakres: naprawa ukończenia pierwszej misji, jawne cele lądowania, aerostatyka zależna od wysokości oraz synchronizacja sterowania balonami.

## Przyczyna problemu widocznego na screenie

Statek stał na zielonym remote padzie, ale `Hover License` miał ukryte założenie, że recovery kończy się wyłącznie na launch padzie. HUD poprawnie liczył około 81 m do launch pada, lecz wizualnie oba pady wyglądały jak prawidłowe cele. Był to błąd kontraktu i komunikacji, nie wyłącznie detekcji gruntu.

Pierwsza licencja jest ćwiczeniem bezpiecznego wzniesienia i odzyskania statku, dlatego od tego wydania akceptuje oba oznaczone pady. Pozostałe kontrakty zachowują konkretne miejsca docelowe.

## Zmiany misji

- `landingZones` jest częścią danych kontraktu.
- `foundation.mission-evaluator.evaluateLandingZones()` ocenia wszystkie dozwolone strefy.
- Gdy żadna strefa nie jest zaliczona, evaluator zwraca najbliższą do komunikatu HUD.
- Wszystkie dozwolone pady są oznaczane, a aktywna faza lądowania wyróżnia je na żółto.
- Nadal obowiązuje stanowa detekcja gruntu, limity prędkości, przechyłu i dwell 1,6 s.

## Zmiany balonów

- Nowy czysty moduł `foundation.aerostatics`.
- Siła balonów maleje wykładniczo z wysokością i ma dolny limit skuteczności.
- Fizyka i UI używają tej samej polityki.
- Suwak natychmiast aktualizuje procent, thumb i zapis.
- Marker pokazuje neutralną moc statycznego zawisu przy bieżącej wysokości.
- Tekst pokazuje przybliżoną wysokość równowagi dla wybranej mocy lub informuje o braku wystarczającej siły.
- Page Up/Page Down: ±2%; z Shift: ±10%.

## Dodatkowe poprawki fundamentu UI

- Naprawiono brak modułów w loaderze źródłowego `index.html`.
- Usunięto stare, zdublowane przyciski Contracts.
- Przywrócono mobilny przełącznik Contracts.
- Ujednolicono `aria-controls` i `aria-expanded` zakładek workspace.
- Zachowano workspace v3, z-order, debounce zapisu, clamp i wspólne zachowanie Escape.

## Testy

Automatyczne testy obejmują przypadek ze screena, lądowanie bez nowych eventów `collide`, wybór najbliższego dozwolonego pada, aerostatykę, natychmiastowy refresh suwaka i hotkeye Page Up/Page Down. Szczegóły: `../../../TEST_REPORT.md` i `../../../VALIDATION_REPORT.md`.

## Ograniczenie walidacji

Nie wykonano pełnego ręcznego lotu WebGL w środowisku roboczym, ponieważ Chromium blokuje lokalne URL-e. Przed pushem wymagany jest krótki playtest w Chrome/Brave według checklisty.
