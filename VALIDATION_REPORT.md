# Validation Report — Phase 1D.2E

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
3. Potwierdź napis `Phase 1D.2E`.

### Passive vertical thrust

Dla statku z pionowymi thrusterami:

1. przesuwaj suwak i potwierdź natychmiastową zmianę procentu;
2. sprawdź marker progu zawisu i kolorową strefę wznoszenia;
3. `−` i `+` zmieniają moc o 2%;
4. wartości zmienione hotkeyem i suwakiem są identyczne po odświeżeniu;
5. przy statku bez upward thrusterów UI pokazuje brak dostępnego źródła zamiast fałszywego progu;
6. przy wymaganiu ponad 100% UI jawnie pokazuje brak wystarczającej mocy;
7. zmniejszenie Balloon power powinno podnieść wymagany próg Passive vertical thrust.

### Balloon power

1. `,` i `.` zmieniają moc o 2%;
2. marker zawisu reaguje na zmianę pasywnego ciągu;
3. wznoszenie słabnie z wysokością;
4. oscylacja wokół równowagi maleje, lecz nie znika natychmiast;
5. przy Balloon power 0 dodatkowe tłumienie znika.

### Rebinding i kombinacje

1. Otwórz Controls i przepnij jeden z hotkeyów Passive thrust.
2. Potwierdź natychmiastową zmianę etykiety obok suwaka.
3. Odśwież stronę i sprawdź zapis.
4. Reset przywraca `−/+` oraz `,/.`.
5. W Flight Focus trzymaj Left Ctrl i naciskaj `−/+`; statek ma schodzić i jednocześnie zmieniać pasywny ciąg.
6. Powtórz dla Left Ctrl z `,/.`.
7. Poza Flight Focus nie deklaruj gwarancji dla wszystkich chordów Ctrl; użyj rebindingu, gdy przeglądarka przejmuje kombinację.

### Autorytet pilota

1. Ustaw Passive vertical thrust na 0%.
2. Potwierdź, że Space, Left Ctrl, W/S i momenty sterujące nadal mogą używać pełnej mocy odpowiednich thrusterów.
3. Ustaw 100% i potwierdź, że Left Ctrl wygasza pasywny ciąg skierowany w górę oraz uruchamia silniki skierowane w dół.

### Misje i UI

1. Ukończ Hover License na remote padzie oraz launch padzie.
2. Sprawdź dwell i blocker HUD.
3. Panele można przeciągać, resize’ować, zamykać i otwierać.
4. Poniżej 720 px pojawia się komunikat desktop-only.

## Kryterium pushu

Push dopiero po manualnym potwierdzeniu obu markerów, hotkeyów, rebindingu, autorytetu pilota, Flight Focus, misji lądowania i zachowania balonów. Następnie użyj procedury z `PUSH_INSTRUCTIONS.md`.
