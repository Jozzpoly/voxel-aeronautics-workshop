# Hotfix Report — Foundation Phase 1C.1

## Zgłoszenie

Użytkownik zauważył, że pobrany projekt źródłowy wyglądał na starszy niż jednoplikowy HTML. Dodatkowo suwak napędu ograniczał wejścia pilota, a skierowane w dół thrustry zachowywały się odwrotnie do oczekiwania.

## Ustalenia

Lokalna kopia poprzedniego ZIP-a była bajtowo zgodna z katalogiem roboczym, ale sposób dystrybucji nie dawał użytkownikowi wiarygodnego sposobu potwierdzenia, że dwa osobno pobrane artefakty należą do tego samego buildu. Nazwy plików nie odróżniały hotfixu, a źródłowy ZIP nie zawierał odpowiadającego mu HTML.

Niezależnie od przyczyny różnicy po stronie pobranego pliku, proces wydania był zbyt słaby i został przebudowany.

## Naprawa wydania

- nowy identyfikator `foundation-1c-hotfix-1`;
- unikalne nazwy HTML i ZIP;
- `SOURCE_MANIFEST.json` z hashami wejść buildu;
- identyfikator wydania i hash manifestu osadzone w HTML;
- dokładnie ten sam HTML umieszczony wewnątrz źródłowego ZIP-a w `release/`;
- test bajtowej zgodności każdego modułu źródłowego z kodem osadzonym w HTML;
- test bajtowej zgodności źródeł w ZIP-ie z katalogiem buildu;
- `npm run verify-release` do samodzielnej kontroli po rozpakowaniu.

## Naprawa napędu

- suwak ustala tylko pasywny ciąg thrusterów skierowanych ku lokalnemu `+Y`;
- nie ogranicza W/S, Space/Left Ctrl ani miksowania obrotu;
- poziome i skierowane w dół thrustry są wyłączone bez komendy;
- Left Ctrl uruchamia thrustry skierowane w dół;
- Left Ctrl wygasza pasywny ciąg thrusterów skierowanych w górę;
- wejście gracza może osiągnąć 100% nawet przy pasywnym ciągu ustawionym na 0%.

## Core

Usuwanie i przenoszenie Core jest obecne zarówno w źródłach, jak i w osadzonym HTML. Test `tests/test_craft_model.js` wykonuje usunięcie Core i potwierdza, że model pozostaje poprawnym stanem roboczym, natomiast `CraftCompiler` blokuje lot bez Core.

## Walidacja

- wszystkie testy przechodzą;
- 12 źródeł przechodzi kontrolę składni;
- test Core removal przechodzi;
- test znaku Left Ctrl przechodzi;
- test niezależności wejścia od suwaka przechodzi;
- test zgodności ZIP ↔ źródła ↔ single HTML przechodzi;
- weryfikator uruchomiony z rozpakowanego ZIP-a zwraca `sourceParity: ok`.

Pełny renderowany playtest WebGL nadal wymaga lokalnej przeglądarki.
