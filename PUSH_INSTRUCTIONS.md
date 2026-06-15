# Voxel Aeronautics Workshop — publikacja Phase 1C.2

Ta paczka zawiera pełne źródła projektu bez katalogu `.git` i bez wygenerowanych katalogów `dist/` / `release/`.

## Zalecana, bezpieczna metoda

1. Otwórz PowerShell w katalogu, w którym chcesz trzymać projekt.
2. Sklonuj repozytorium i utwórz osobną gałąź:

```powershell
git clone https://github.com/Jozzpoly/voxel-aeronautics-workshop.git
cd voxel-aeronautics-workshop
git switch -c phase-1c2-control-workspace
```

3. Skopiuj całą zawartość tej paczki do katalogu repozytorium i zatwierdź zastąpienie plików. Nie usuwaj katalogu `.git`.
4. Uruchom testy:

```powershell
python tests/run_all.py
```

5. Sprawdź i zapisz zmiany:

```powershell
git status
git add -A
git commit -m "Foundation Phase 1C.2: control frame and UI workspace"
git push -u origin phase-1c2-control-workspace
```

6. Na GitHubie utwórz Pull Request z `phase-1c2-control-workspace` do `main` i scal go po sprawdzeniu.

## Publikacja bezpośrednio na main

Zamiast tworzyć osobną gałąź możesz po skopiowaniu plików wykonać:

```powershell
git switch main
git pull --ff-only origin main
python tests/run_all.py
git add -A
git commit -m "Foundation Phase 1C.2: control frame and UI workspace"
git push origin main
```

Osobna gałąź jest bezpieczniejsza, ponieważ zachowuje łatwy punkt powrotu i czytelny przegląd zmian.
