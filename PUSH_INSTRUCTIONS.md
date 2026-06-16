# Push Instructions — Foundation Phase 1D.3E

## Źródło prawdy

Użyj pełnego ZIP-a źródeł:

`Voxel_Aeronautics_Workshop_Foundation_Phase_1D3E_Gate_A_Convergence.zip`

Single HTML służy do szybkiego testu i prezentacji. Patch służy do audytu oraz odtworzenia zmian na dokładnym baseline Phase 1D.3D (`5cf38926623a17290ff2c6caad24d1c36fe77ad3`).

## Bezpieczna aktualizacja lokalnego repo

Najpierw upewnij się, że lokalne zmiany są zapisane albo odłożone. Agent nie wykonał pushu.

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Rozpakuj pełny ZIP poza repozytorium. Skopiuj zawartość katalogu projektu do repozytorium, zachowując `.git`, a potem uruchom:

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
git status
git diff --stat
git add -A
git commit -m "Foundation 1D.3E: close assembly-centric Gate A"
git fetch origin
git rebase origin/main
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git push origin HEAD:main
```

Po rebase pełna walidacja jest obowiązkowa, ponieważ zdalne zmiany mogły zmienić source inventory, loader lub kontrakty runtime.

Nie używaj `git push --force`. W razie rzeczywistej potrzeby korekty własnej gałęzi dopuszczalne jest tylko świadome `git push --force-with-lease`, nigdy na `main` bez osobnej decyzji właściciela repozytorium.
