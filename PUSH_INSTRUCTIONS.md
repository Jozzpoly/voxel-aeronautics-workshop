# Push Instructions — Phase 1D.3C

## Źródło prawdy

Użyj pełnego ZIP-a:

`Voxel_Aeronautics_Workshop_Foundation_Phase_1D3C_Joint_Capability.zip`

Single HTML służy do szybkiego testu i prezentacji. Patch służy do audytu różnic.

## Aktualizacja lokalnego repo

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Rozpakuj ZIP poza repozytorium. Skopiuj zawartość głównego katalogu paczki do katalogu repo, zachowując `.git`.

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git status
git diff --stat
git add -A
git commit -m "Foundation 1D.3C: add hinge contract and foundation readiness review"
git fetch origin
git rebase origin/main
python tests/run_all.py
git push origin HEAD:main
```

Drugi test po rebase jest obowiązkowy, gdy rebase dołączył nowe zdalne zmiany.

Nie używaj zwykłego `git push --force` jako rozwiązania rozbieżności.
