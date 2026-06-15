# Validation Report — Phase 1D.2D

## Automatyczna walidacja

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane: wszystkie testy zielone oraz `sourceParity: ok`.

## Manualny playtest przed pushem

### Cache i wersja

1. Uruchom przez `run_game.bat` lub `python tools/serve.py`.
2. W Chrome użyj `Ctrl+Shift+R`.
3. Potwierdź napis `Phase 1D.2D`.

### Domyślne bindingi

1. `Space` daje pionową komendę +100%.
2. `Left Ctrl` daje pionową komendę −100%.
3. Częste naciskanie Left Ctrl nie może wywołać Klawiszy trwałych.
4. `,` i `.` zmieniają Balloon power o 2% i natychmiast odświeżają licznik oraz thumb.
5. `Shift` sam nie powinien sterować statkiem.

### Rebinding

1. Otwórz Controls.
2. Kliknij pierwszy slot `Descend`, naciśnij np. `X`.
3. Uruchom lot i potwierdź, że `X` schodzi, a Left Ctrl już nie.
4. Przypisz `X` do innej akcji i potwierdź, że zostaje przeniesiony, nie zdublowany.
5. `Backspace/Delete` czyści slot, `Escape` anuluje capture.
6. Odśwież stronę i potwierdź zapis profilu.
7. Reset przywraca domyślne bindingi i ustawienia osi.

### Flight Focus

Testuj na HTTPS lub localhost w Chrome/Brave.

1. Kliknij `FLIGHT FOCUS` i zaakceptuj fullscreen/Keyboard Lock, jeśli pojawi się prompt.
2. Status ma zmienić się na aktywny.
3. W locie trzymaj Left Ctrl + W oraz Left Ctrl + S — gra ma otrzymać oba kierunki i karta nie może się zamknąć ani zapisać strony.
4. Left Ctrl + `,/.` ma równocześnie schodzić i regulować balony.
5. Wyjdź z fullscreen; status ma wrócić do Browser mode, a aktywne osie zostać wyczyszczone.
6. Po odmowie uprawnienia gra ma pozostać grywalna i pokazać czytelny komunikat.

Nie deklaruj pełnego bezpieczeństwa Ctrl chordów poza Flight Focus. W zwykłym trybie rozwiązaniem jest rebinding zejścia.

### Aerostatyka

Dla startera, lekkiego i ciężkiego balloon craft:

1. moc tuż nad markerem rozpoczyna wznoszenie;
2. wznoszenie słabnie z wysokością;
3. oscylacja wokół równowagi ma maleć, ale nie znikać natychmiast;
4. przy Balloon power 0 dodatkowe tłumienie znika;
5. bezpośredni thrust zachowuje autorytet.

### Misje

1. Hover License zakończ na remote padzie.
2. Powtórz na launch padzie.
3. Sprawdź dwell i blocker HUD.
4. Gate/Courier/Heavy-Lift zachowują własne pady.

### Desktop scope

1. Panele można przeciągać, resize’ować, zamykać i otwierać.
2. Poniżej 720 px pojawia się komunikat desktop-only.
3. Nie ma mobilnego topbara ani ekranowych przycisków sterowania.

## Kryterium pushu

Push dopiero po manualnym przejściu: rebinding, Flight Focus w Chrome lub Brave, domyślny Ctrl, misja lądowania oraz odczucie balonów. Keyboard Lock jest zależny od przeglądarki i uprawnienia, dlatego sam zielony test automatyczny nie wystarcza.
