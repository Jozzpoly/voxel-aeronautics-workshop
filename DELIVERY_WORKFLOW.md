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


## 3. Domyślny model publikacji

Agent przygotowuje kompletny, zweryfikowany ZIP projektu oraz artefakty wydania. Użytkownik rozpakowuje paczkę, uruchamia testy i wykonuje commit/push lokalnie według `PUSH_INSTRUCTIONS.md`.

Bezpośrednie zapisywanie projektu do GitHub przez agenta nie jest domyślnym workflow. Może być użyte wyłącznie po wyraźnej prośbie użytkownika i tylko wtedy, gdy narzędzia pozwalają przesłać całe drzewo projektu atomowo, bez plików pośrednich, fragmentów ani tymczasowych workflow.

## 4. Bezpieczna procedura publikacji

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

## 5. Konflikty

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

## 6. Weryfikacja bazowej wersji

Przed rozpoczęciem kolejnego etapu agent powinien sprawdzić aktualny `main` repozytorium i oprzeć pracę na jego najnowszym commicie albo na jawnie wskazanej przez użytkownika nowszej paczce. Nie wolno zakładać, że luźny katalog z wcześniejszej sesji jest aktualniejszy od zweryfikowanego ZIP-a lub repozytorium.

## 7. Wydania z wieloma modułami aplikacji

`tools/build_release.py::APP_SOURCES` jest kanonicznym manifestem kolejności źródeł. Dodając lub usuwając moduł należy jednocześnie:

1. zaktualizować `APP_SOURCES`;
2. zaktualizować loader w `index.html` w tej samej kolejności;
3. uruchomić `tests/test_game_architecture.py` i pełne `tests/run_all.py`;
4. zbudować single HTML i ZIP;
5. potwierdzić `sourceParity: ok`.

Nie utrzymywać ręcznej kopii listy źródeł w testach. Testy powinny korzystać z `tests/source_inventory.py`.

## 8. Spójność tożsamości wydania

Każde wydanie utrzymuje jedną wartość wersji i release id w:

- `package.json`;
- `tools/build_release.py`;
- `SOURCE_MANIFEST.json`;
- `foundation.config`;
- brandingu `index.html`.

`tests/test_release_identity.py` jest obowiązkową częścią głównej baterii. Sam zielony `sourceParity` nie wystarcza, gdy runtime zgłasza starą wersję.

## 9. Foundation gate przed dużym nowym systemem

Przed sublevelami, systemem programowania, multiplayerem lub zmianą backendu dostawa musi zawierać:

1. review wpływu na istniejące source-of-truth i lifecycle;
2. jawne ADR lub direction document;
3. aktualizację `AI_PROJECT_MEMORY.md`, `ARCHITECTURE.md` i `ROADMAP_NEXT.md`;
4. testy granic, migracji i cleanupu;
5. listę rzeczy świadomie niezaimplementowanych.

Research innych gier jest materiałem decyzyjnym. Nie wolno kopiować ich API bez dopasowania do browserowego runtime i reguł VAW.
