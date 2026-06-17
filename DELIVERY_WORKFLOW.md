# Delivery Workflow — Workflow V3

Ten dokument określa sposób przekazywania i publikowania pełnych milestone'ów VAW.

## 1. Zasada podstawowa

Jedna dokładna baza, jeden spójny milestone, jeden zamrożony kandydat, jedna końcowa sekwencja walidacji, jeden normalny commit i ponowny odczyt remote SHA.

Użytkownik nie jest ręcznym CI. Domyślnie agent wykonuje publikację samodzielnie, gdy ma bezpieczny dostęp do Git.

## 2. Kolejność transportu

```text
bezpośredni Git > jeden końcowy ZIP milestone'u > pełny pojedynczy plik > patch
```

Patch jest wyłącznie mechanizmem recovery/audytu. Nie jest domyślnym workflow i nie może wymuszać mikro-dostaw po każdej poprawce.

## 3. Mode R — bezpośredni Git

1. Odczytaj ponownie remote SHA brancha.
2. Potwierdź czysty worktree i dokładną bazę.
3. Pracuj na jednym dedykowanym branchu.
4. Stage'uj wyłącznie zatwierdzony zestaw ścieżek.
5. Uruchom targetowane testy, komponent, FAST i — gdy zakres tego wymaga — jeden FULL na zamrożonym kandydacie.
6. Utwórz jeden normalny commit milestone'u.
7. Sprawdź, czy remote nie przesunął się przed publikacją.
8. Wykonaj zwykły push bez `--force`.
9. Odczytaj remote SHA i porównaj go z lokalnym commitem.
10. Zamknij dokumentację w tym samym milestone'ie.

Przykładowy bezpieczny finał w PowerShell:

```powershell
$Branch = '<dedicated-branch>'
$Base = (git rev-parse HEAD).Trim()
$RemoteBefore = ((git ls-remote origin "refs/heads/$Branch") -split '\s+')[0].Trim()
if ($Base -ne $RemoteBefore) { throw 'Remote moved before publication.' }

git add -A -- <approved-paths>
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
git commit -m '<bounded milestone message>'

$LocalSha = (git rev-parse HEAD).Trim()
git push origin "HEAD:refs/heads/$Branch"
$RemoteSha = ((git ls-remote origin "refs/heads/$Branch") -split '\s+')[0].Trim()
if ($LocalSha -ne $RemoteSha) { throw 'Remote SHA confirmation failed.' }
```

Nie używaj niekontrolowanego `git add -A -- .`, force-pusha, cichego rewrite historii ani historycznego brancha jako transportu.

## 4. Mode Z — jeden końcowy ZIP

Gdy bezpośrednia publikacja jest zablokowana, po ustabilizowaniu kandydata przygotuj dokładnie jedną paczkę:

```text
VAW_<MILESTONE>_DELIVERY/
├── README_FIRST.md
├── project/
├── evidence/
│   └── FINAL_STATUS.md
└── SHA256SUMS.txt
```

- `project/` zawiera wyłącznie pliki przeznaczone do repozytorium, w dokładnych ścieżkach względnych;
- patchy, logów, helperów i zagnieżdżonych ZIP-ów nie umieszczaj w `project/`;
- użytkownik kopiuje `project/` jeden raz;
- instrukcja zawiera maksymalnie jeden krótki blok walidacji i publikacji;
- helper musi być przetestowany z dokładnego rozpakowanego układu paczki.

## 5. Artefakty produktu i kontrakt bajtów

Tekstowe źródła wydania są hashowane i pakowane jako canonical UTF-8/LF, a pliki binarne pozostają byte-exact. `SOURCE_MANIFEST.json`, single HTML, source ZIP i verifier korzystają z tego samego widoku kanonicznego. ZIP ma deterministyczne nazwy, sortowanie, timestampy, tryby plików oraz jawny format `deterministic-stored-zip-v1`. `.gitattributes` poprawia checkout consistency, ale poprawność nie może zależeć wyłącznie od lokalnego `core.autocrlf`.

Single HTML, source ZIP i checksumy muszą pochodzić z jednego deterministycznego buildu i przechodzić source parity. Artefakty produktu są wymagane tylko wtedy, gdy milestone dotyka produktu lub release engineering; czysto dokumentacyjny milestone nie generuje nowego wydania dla samej kosmetyki.

`tools/build_release.py::APP_SOURCES` pozostaje kanoniczną kolejnością źródeł aplikacji. Zmiana modułu wymaga równoczesnej aktualizacji loadera, testów architektury, release build i identity checks.

## 6. Walidacja

```text
T0 static
T1 targeted
T2 component
T3 FAST
T4 FULL
T5 target platform
```

FAST uruchamia się zwykle 1–2 razy. FULL uruchamia się raz na zamrożonym kandydacie tylko wtedy, gdy zakres jest release-sensitive. Wyniki Linux, Windows, browser i cross-platform raportuj osobno. Cross-platform PASS wymaga Linux FULL i Windows FULL na tym samym finalnym SHA; syntetyczna lub pełnodrzewowa macierz LF/CRLF nie zastępuje dowodu target-platform.

## 7. Konflikty i blokery

Przy konflikcie zatrzymaj publikację i popraw wyłącznie jawnie zidentyfikowane pliki. Nie rozwiązuj non-fast-forward force-pushem.

Przy prawdziwym blockerze wypróbuj maksymalnie trzy różne bezpieczne mechanizmy. Nie obfuskowuj payloadu, nie dziel blokowanych zapisów w celu obejścia safeguardów i nie wykorzystuj `maintenance/workflow-bootstrap`.

## 8. Dokumentacja i obecny kierunek

Aktywny indeks dokumentacji: `docs/README.md`.

Po Documentation Convergence Stage 2 dalsza kosmetyczna reorganizacja repozytorium jest zamrożona. Po Stage 1.1 następuje formalny closeout, stop-review i Gate C — Assembly Spaces / Sublevels. Device/Port Schema, ControlRuntime, walking, docking i szerokie interiors pozostają poza zakresem do zamknięcia Gate C.
