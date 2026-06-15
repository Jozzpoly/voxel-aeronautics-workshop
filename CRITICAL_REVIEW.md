# Critical Review — Foundation Phase 1D.2D

## Problem źródłowy

Zmiana Ctrl → Shift naprawiała skróty Chrome, ale tworzyła konflikt z Klawiszami trwałymi Windows. To ujawniło błąd architektoniczny: mapowanie klawiszy było traktowane jak stała gry, mimo że jest preferencją użytkownika i zależy od systemu, przeglądarki oraz układu klawiatury.

## Korekta

Rebinding został wdrożony teraz, nie przesunięty do późniejszej fazy. Dzięki temu kolejny konflikt nie wymaga nowego hotfixu w `game.js`.

### Mocne strony

- semantyczne akcje pozostają oddzielone od fizycznych kodów;
- profil v2 ma jawne migracje;
- jeden kod nie może niejawnie sterować dwiema akcjami;
- UI przechwytuje fizyczny `event.code`, więc binding nie zależy od znaku generowanego przez layout;
- Flight Focus używa platformowego mechanizmu do przechwytywania modifier chords;
- brak udawania, że `preventDefault()` rozwiązuje wszystkie skróty Chrome.

### Ryzyka

- Keyboard Lock ma ograniczone wsparcie i wymaga fullscreen, bezpiecznego kontekstu oraz zgody;
- nie wykonano automatycznego testu prawdziwego promptu/uprawnienia Chrome;
- dwa sloty na akcję zwiększają rozmiar panelu Controls;
- brak jeszcze presetów, importu/exportu i obsługi gamepada.

## Wniosek

Phase 1D.2D jest lepszym punktem pushu niż kolejna zamiana jednego klawisza na drugi. Default użytkownika zostaje zachowany, a projekt otrzymuje drogę wyjścia zarówno dla ograniczeń przeglądarki, jak i osobistych preferencji.
