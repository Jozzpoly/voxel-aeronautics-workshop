# Push Instructions — Phase 1D.3A

## Źródło prawdy

Do aktualizacji repozytorium używaj pełnego ZIP-a:

`VAW_Phase_1D3A_Runtime_Assembly_Builder_Source.zip`

Jednoplikowy HTML służy do uruchomienia i prezentacji. Patch służy do audytu. Repozytorium aktualizujemy z pełnej paczki źródłowej.

## 1. Zsynchronizuj lokalne `main`

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Working tree powinien być czysty. Własne zmiany najpierw commituj albo schowaj przez `git stash`.

## 2. Rozpakuj paczkę poza repo

W ZIP-ie znajduje się katalog:

```text
Voxel_Aeronautics_Workshop_Phase_1D3A_RUNTIME_ASSEMBLY_BUILDER_READY_TO_PUSH
```

Skopiuj **jego zawartość** do katalogu repozytorium, zastępując istniejące pliki. Nie usuwaj i nie nadpisuj `.git`.

## 3. Uruchom testy

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane są wszystkie zielone testy i source parity `ok`.

## 4. Wykonaj manualną checklistę

Przejdź `VALIDATION_REPORT.md`, szczególnie:

- wielokrotny start i powrót do warsztatu;
- asymetryczna bezwładność;
- detach podczas obrotu;
- brak niewidzialnych colliderów;
- payload i recenter;
- browser runtime harness z prawdziwym Cannon.js.

Przed playtestem użyj `Ctrl+Shift+R`.

## 5. Sprawdź diff i commit

```powershell
git status
git diff --stat
git diff
git add -A
git commit -m "Foundation 1D.3A: integrate runtime assembly builder and headless harness"
```

## 6. Zsynchronizuj się ponownie

```powershell
git fetch origin
git rebase origin/main
```

Po konflikcie lub zmianach z rebase ponownie uruchom co najmniej:

```powershell
python tests/run_all.py
```

## 7. Push

```powershell
git push origin HEAD:main
```

## Konflikt podczas rebase

```powershell
git status
```

Popraw pliki, następnie:

```powershell
git add -A
git rebase --continue
```

Aby anulować:

```powershell
git rebase --abort
```

Nie używaj `git push --force` do zwykłej publikacji.

Repozytorium nie zostało automatycznie zmienione przez agenta. Publikację wykonujesz lokalnie z pełnego ZIP-a.
