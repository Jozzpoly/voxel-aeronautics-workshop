# Push Instructions — Phase 1D.3B

## Źródło prawdy

Użyj pełnego ZIP-a:

`Voxel_Aeronautics_Workshop_Foundation_Phase_1D3B_Real_Cannon_Parity.zip`

Single HTML służy do szybkiego testu i prezentacji. Patch służy do audytu różnic.

## Aktualizacja lokalnego repo

W PowerShell:

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Rozpakuj ZIP poza repozytorium. Skopiuj zawartość głównego katalogu paczki do katalogu repo, zachowując istniejący `.git`.

Następnie:

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git status
git diff --stat
git add -A
git commit -m "Foundation 1D.3B: automate real Cannon parity and harden runtime assembly contracts"
git fetch origin
git rebase origin/main
python tests/run_all.py
git push origin HEAD:main
```

Drugi test po rebase jest obowiązkowy, gdy rebase dołączył nowe zdalne zmiany.

## Konflikty

```powershell
git status
# popraw konflikty
git add -A
git rebase --continue
```

Przerwanie:

```powershell
git rebase --abort
```

Nie używaj zwykłego `git push --force` jako rozwiązania rozbieżności.
