# Delivery Workflow — aktualizacja repozytorium po dostawie plików

Ten dokument jest stałym kontraktem dla kolejnych agentów i wydań projektu.

## 1. Obowiązkowa zawartość każdej dostawy

Każda odpowiedź przekazująca zmieniony projekt musi zawierać:

1. link do pełnego ZIP-a źródłowego;
2. link do odpowiadającego mu jednoplikowego HTML;
3. link do patcha, gdy został wygenerowany;
4. link do raportu etapu, walidacji i `SHA256.txt`;
5. wskazanie, który artefakt jest źródłem prawdy;
6. dokładne komendy aktualizacji repozytorium;
7. proponowaną wiadomość commita;
8. informację, czy repozytorium zostało zmienione przez agenta.

## 2. Źródło prawdy

Pełny ZIP źródeł jest przeznaczony do aktualizacji repozytorium. Single HTML służy do szybkiego uruchomienia, testu i prezentacji. Patch jest pomocą audytową, nie zastępuje pełnej paczki.

ZIP i single HTML muszą pochodzić z jednego deterministycznego buildu i przechodzić `sourceParity: ok`.

## 3. Bezpieczna procedura publikacji

Przed skopiowaniem nowego wydania:

```powershell
git checkout main
git status
git fetch origin
git pull --rebase origin main
```

Rozpakuj ZIP poza repo. Skopiuj jego zawartość do katalogu repozytorium, zachowując `.git`. Następnie:

```powershell
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git status
git diff --stat
git add -A
git commit -m "<wiadomość podana dla wydania>"
git fetch origin
git rebase origin/main
python tests/run_all.py
git push origin HEAD:main
```

Drugi test po rebase jest wymagany, gdy rebase rzeczywiście dołączył zdalne zmiany.

## 4. Konflikty

Przy konflikcie:

```powershell
git status
# popraw pliki
git add -A
git rebase --continue
```

Aby przerwać:

```powershell
git rebase --abort
```

Nie używać `git push --force` jako standardowego rozwiązania non-fast-forward. Nie kopiować wydania na working tree z niezapisanymi zmianami bez świadomego commita lub `git stash`.

## 5. Weryfikacja bazowej wersji

Przed rozpoczęciem kolejnego etapu agent powinien sprawdzić aktualny `main` repozytorium i oprzeć pracę na jego najnowszym commicie albo na jawnie wskazanej przez użytkownika nowszej paczce. Nie wolno zakładać, że luźny katalog z wcześniejszej sesji jest aktualniejszy od zweryfikowanego ZIP-a lub repozytorium.
