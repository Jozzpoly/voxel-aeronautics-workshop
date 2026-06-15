# Push Instructions — Phase 1D.2D

## Przed commitem

1. Rozpakuj paczkę źródłową do katalogu repozytorium.
2. Uruchom:

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

3. Wykonaj manualną checklistę z `VALIDATION_REPORT.md`, szczególnie:
   - domyślny Left Ctrl;
   - rebinding i zapis profilu;
   - Flight Focus w Chrome/Brave;
   - ukończenie Hover License;
   - zachowanie balonów.
4. Użyj `Ctrl+Shift+R` przed playtestem.

## Kontrola zmian

```powershell
git status
git diff --stat
git diff
```

Nie commituj przypadkowych save’ów, logów ani starego `release/`.

## Commit

```powershell
git add .
git commit -m "Foundation 1D.2D: add rebindable input and flight focus"
git push origin main
```

Repozytorium nie zostało zmienione automatycznie przez agenta.
