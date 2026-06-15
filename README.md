# Voxel Aeronautics Workshop — Foundation Phase 1D.2E

**Guided Vertical Power Controls**

Voxel Aeronautics Workshop jest desktopowym voxelowym sandboxem inżynieryjnym. Gracz buduje statek blok po bloku, testuje fizykę, sterowanie, uszkodzenia i misje, analizuje telemetrię, a następnie poprawia projekt.

Phase 1D.2E ujednolica dwa pionowe regulatory: **Balloon power** oraz **Passive vertical thrust**. Oba mają teraz natychmiastowy odczyt, wizualny próg zawisu i rebindable hotkeye.

## Najważniejsze zmiany

### Passive vertical thrust z pełnym guidance

Kontrolka pasywnego ciągu pokazuje:

- aktualny procent;
- marker mocy wymaganej do statycznego zawisu;
- wyróżniony zakres, w którym aktualna konfiguracja powinna się wznosić;
- stan `descend`, `near hover`, `climb` albo informację, że konstrukcja nie ma aktywnych thrusterów skierowanych ku lokalnemu `+Y`.

Próg uwzględnia masę, aktualny lift balonów, wysokość oraz uszkodzone lub odłączone części. Jest analizą statyczną i nie obejmuje chwilowej siły skrzydeł ani bezpośredniego wejścia pilota.

### Wspólna ścieżka stanu

- `setThrusterPower()` jest jedyną ścieżką zmiany pasywnego ciągu;
- `setBalloonPower()` pozostaje jedyną ścieżką zmiany mocy balonów;
- suwaki i hotkeye odświeżają procent, thumb, marker, guidance, zapis i fizykę na tych samych wartościach;
- `foundation.aerostatics.requiredSupplementalPowerForHover()` oblicza wymagany udział dodatkowego źródła liftu po uwzględnieniu źródła bazowego.

### Input profile v3

Profil przechowuje teraz także bindingi obu regulatorów:

- `− / +` — Passive vertical thrust −/+2%;
- `, / .` — Balloon power −/+2%.

Każda akcja ma do dwóch slotów i może zostać zmieniona w panelu Controls. Profile v1–v2 migrują automatycznie; nowe defaulty nie odbierają klawisza już używanego przez użytkownika.

### Zachowany Left Ctrl i Flight Focus

Domyślne sterowanie:

- `W / S` — przód / tył;
- `Z / C` — translacja w lewo / prawo;
- `Space / Left Ctrl` — góra / dół;
- `↑ / ↓` — pitch;
- `A / D` lub `← / →` — yaw;
- `Q / E` — roll;
- `G` — stabilizacja;
- `F` — powrót do warsztatu.

Flight Focus używa fullscreen i Keyboard Lock jako best-effort ochrony kombinacji z Ctrl. Poza tym trybem przeglądarka nadal może przejąć niektóre skróty, dlatego rebinding pozostaje właściwym fallbackiem.

### Desktop jako jawna granica produktu

- telefon i touch-only są poza zakresem;
- touchpad laptopa działa jako pointer i scroll;
- przyszłe sterowanie kontrolerem wymaga osobnego profilu oraz UX.

## Uruchomienie

Windows:

```text
run_game.bat
```

Linux/macOS:

```bash
./run_game.sh
```

lub:

```bash
python tools/serve.py
```

Po podmianie wersji użyj `Ctrl+Shift+R`.

## Testy

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Automaty obejmują profil wejścia v3 i migracje, oba regulatory mocy, markery zawisu, jednoczesne `Left Ctrl` z hotkeyami mocy, misje, aerostatykę, physics boundary, startup smoke oraz source parity.

Pełna checklista manualna znajduje się w `VALIDATION_REPORT.md`.

## Build wydania

```bash
python tools/build_release.py
```

Artefakty w `dist/`:

- `Voxel_Aeronautics_Workshop_Foundation_Phase_1D2E_Guided_Vertical_Power_Controls.html`;
- `Voxel_Aeronautics_Workshop_Foundation_Phase_1D2E_Guided_Vertical_Power_Controls.zip`;
- `SHA256.txt`.

## Aktualizacja repozytorium

Pełna i bezpieczna procedura znajduje się w `PUSH_INSTRUCTIONS.md`. Skrót:

```powershell
git checkout main
git fetch origin
git pull --rebase origin main
# skopiuj zawartość rozpakowanego ZIP-a źródłowego do katalogu repo, nie usuwając .git
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git add -A
git commit -m "Foundation 1D.2E: add guided vertical power controls"
git fetch origin
git rebase origin/main
git push origin HEAD:main
```

Nie używaj `git push --force`. Stała zasada dostaw znajduje się w `DELIVERY_WORKFLOW.md`.

## Następny etap

**Foundation Phase 1D.3 — Runtime Body Builder & Headless Physics Harness**. Oba pionowe regulatory mają już wspólny model guidance i nie powinny blokować wydzielania buildera fizyki.
