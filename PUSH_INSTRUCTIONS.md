# Push Instructions — Phase 1D.2F

## Który plik jest źródłem prawdy

Do aktualizacji repozytorium używaj pełnego ZIP-a źródłowego:

`VAW_Phase_1D2F_Runtime_Assembly_Foundation_Source.zip`

Jednoplikowy HTML służy do szybkiego uruchomienia i prezentacji. Nie zastępuje źródeł repozytorium.

## Bezpieczna aktualizacja krok po kroku

### 1. Zsynchronizuj lokalne `main`

W katalogu repozytorium:

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Jeżeli `git status` pokazuje niezatwierdzone własne zmiany, najpierw je commituj albo schowaj przez `git stash`. Nie kopiuj wydania na brudny working tree.

### 2. Rozpakuj paczkę poza repo

Rozpakuj ZIP do osobnego katalogu. Następnie skopiuj **zawartość katalogu projektu** do katalogu repozytorium, zastępując istniejące pliki.

Nie usuwaj ani nie nadpisuj katalogu `.git`.

### 3. Zweryfikuj projekt

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane są wszystkie zielone testy oraz `sourceParity: ok`.

### 4. Wykonaj manualną checklistę

Przejdź `VALIDATION_REPORT.md`, szczególnie:

- aktualizacja Passive vertical thrust suwakiem i klawiszami;
- marker progu zawisu obu regulatorów;
- jednoczesne `Left Ctrl` z `−/+` i `,/.` w Flight Focus;
- zapis i migracja bindingów;
- Hover License;
- zachowanie balonów.

Przed playtestem użyj `Ctrl+Shift+R`.

### 5. Sprawdź diff i utwórz commit

```powershell
git status
git diff --stat
git diff
git add -A
git commit -m "Foundation 1D.2F: establish runtime assembly foundation"
```

### 6. Zsynchronizuj się ponownie przed pushem

To chroni przed sytuacją, w której ktoś dodał commit na GitHubie podczas Twojego testowania:

```powershell
git fetch origin
git rebase origin/main
```

Jeżeli rebase zmienił pliki projektu, ponownie uruchom:

```powershell
python tests/run_all.py
```

### 7. Push aktualnej gałęzi na `main`

```powershell
git push origin HEAD:main
```

## Gdy rebase zgłosi konflikt

```powershell
git status
```

Popraw wskazane pliki, a potem:

```powershell
git add -A
git rebase --continue
```

Powtarzaj do komunikatu o pomyślnym zakończeniu rebase. Gdy trzeba wrócić do stanu sprzed operacji:

```powershell
git rebase --abort
```

Nie używaj `git push --force` do zwykłej publikacji wydania.

Repozytorium nie zostało zmienione automatycznie przez agenta. Publikację wykonuje użytkownik lokalnie z pełnej paczki źródłowej.
