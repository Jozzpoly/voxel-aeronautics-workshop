# Critical Review — Foundation Phase 1D.2E

## Problem źródłowy

Balloon power miało czytelny model guidance, natomiast Passive vertical thrust pozostawało zwykłym procentowym suwakiem. Gracz nie wiedział, czy 35%, 70% lub 100% wystarczy do utrzymania konkretnego statku. Klawisze `−/+` działały poza wersjonowanym profilem, więc nowy system rebindingu nie obejmował całego sterowania.

## Korekta architektoniczna

Nie skopiowano jedynie wyglądu Balloon power. Oba regulatory korzystają teraz ze wspólnego sample masy, wysokości i dostępnych źródeł pionowej siły. Czysta funkcja `requiredSupplementalPowerForHover()` odpowiada na ogólne pytanie: jaki udział dodatkowego źródła liftu jest potrzebny po uwzględnieniu źródła bazowego.

Dla passive thrust:

- bazowym źródłem jest aktualny lift balonów na bieżącej wysokości;
- dodatkowym źródłem są sprawne thrustry skierowane ku lokalnemu `+Y`;
- próg jest przedstawiony markerem oraz strefą wznoszenia;
- suwak, hotkey i fizyka przechodzą przez `setThrusterPower()`.

## Ocena rozwiązania

### Mocne strony

- nie powstała druga, rozbieżna formuła zawisu w DOM;
- input profile v3 obejmuje wszystkie cztery akcje regulacji mocy;
- etykiety skrótów w UI są odczytywane z aktualnego profilu;
- migracja v2 dodaje nowe akcje, ale nie zabiera kodów już przypisanych przez użytkownika;
- bezpośrednie wejście pilota nadal nie jest ograniczone suwakiem;
- testy obejmują suwak, klawisze i kombinacje z Left Ctrl.

### Ograniczenia

- marker jest analizą statyczną i nie przewiduje chwilowego liftu skrzydeł, turbulencji ani bezpośredniego thrustu pilota;
- przy uszkodzeniu części próg może skokowo zmienić pozycję, co jest poprawne fizycznie, ale wymaga obserwacji UX;
- brak prawdziwego automatycznego playtestu WebGL i odczucia sterowania;
- `game.js` nadal agreguje analizę pionowych źródeł i powinien oddać ten obowiązek przyszłemu runtime modelowi.

## Workflow wydania

Wcześniejszy błąd non-fast-forward pokazał, że samo przekazanie plików nie wystarcza. `DELIVERY_WORKFLOW.md` i `PUSH_INSTRUCTIONS.md` ustanawiają od tej wersji obowiązkową, powtarzalną procedurę: synchronizacja przed kopiowaniem, testy, commit, ponowny fetch/rebase i `git push origin HEAD:main`, bez force-pusha.

## Wniosek

Phase 1D.2E zamyka niespójność obu regulatorów pionowej siły i usuwa ostatni twardo zakodowany fragment ich sterowania. Jest bezpieczną bazą do Phase 1D.3 po krótkim manualnym sprawdzeniu markerów na lekkim, ciężkim i pozbawionym pionowych thrusterów statku.
