# Validation Report — Foundation Phase 1D.3E

## Źródło prawdy i baseline

- Dostarczony ZIP został rozpakowany do nowego katalogu roboczego.
- Zweryfikowana wersja baseline: `0.6.3-foundation.1d3d`.
- Zweryfikowany release ID: `foundation-1d3d-assembly-flight-lifecycle`.
- Repozytorium `Jozzpoly/voxel-aeronautics-workshop`, branch `main`: commit `5cf38926623a17290ff2c6caad24d1c36fe77ad3` — `Phase 1D.3D assembly-centric flight lifecycle`.
- ZIP pozostał źródłem prawdy; pliki repozytorium nie zastąpiły jego zawartości.
- Agent nie wykonał commita ani pushu do repozytorium użytkownika.

## Baseline validation

Przed zmianami wykonano:

```text
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wynik:

- wszystkie kroki runnera: PASS, 19,83 s;
- baseline build: PASS;
- baseline verify/source parity: PASS;
- baseline release identity: `0.6.3-foundation.1d3d` / `foundation-1d3d-assembly-flight-lifecycle`.

## Walidacja zmienionego drzewa roboczego

```text
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

Wynik:

- pełny runner: PASS, 19,72 s;
- build: PASS;
- verify: PASS;
- manifest: 40 wejść;
- embedded sources: 35;
- single-file source parity: PASS;
- deterministic release build: PASS;
- `git diff --check`: PASS.

## Walidacja rozpakowanego ZIP-a

Pełny ZIP źródeł został rozpakowany do nowego katalogu. Na rozpakowanej zawartości wykonano ponownie:

```text
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wynik:

- pełny runner: PASS, 20,52 s;
- build: PASS;
- verify/source parity: PASS;
- startup smoke: PASS;
- deterministic build i manifest hashes: PASS.

## Walidacja patcha względem dokładnego baseline'u

1. Czysty Phase 1D.3D zapisano jako lokalny commit walidacyjny.
2. Wygenerowano binary-capable patch bez generated `dist/` i `release/`.
3. Patch sprawdzono przez `git apply --check`.
4. Patch zastosowano do świeżej kopii baseline'u.
5. Wygenerowane katalogi usunięto i odbudowano ze źródeł.
6. Uruchomiono pełny runner, build i verify.
7. Porównano source tree z projektem roboczym, wyłączając generated/cache/git.

Wynik:

- `git apply --check`: PASS;
- pełny runner po patchu: PASS, 20,24 s;
- build po patchu: PASS;
- verify/source parity po patchu: PASS;
- source-tree parity: PASS;
- patch diff: 46 plików, 3017 insertions, 1896 deletions przed finalnym dokumentacyjnym zapisem tego raportu.

## Krytyczne scenariusze potwierdzone

- single-body sterowanie i misje bez regresji;
- 0/1/2/wiele body na poziomie lifecycle plan/builder/session;
- deterministyczny primary body;
- visual root per body;
- exact collider/part/body ownership;
- brak wrong-body damage fallback;
- backend-first collider mutation;
- per-body recenter i mass properties;
- constraint → listener/collider → body → visual cleanup;
- wielokrotny dispose;
- częściowa awaria cleanupu i skuteczny retry;
- atomic multi-body build rollback;
- start → stop → start;
- active `fullscreenchange` i `pagehide`;
- real Cannon free flight, contacts, point velocity i payload podczas obrotu;
- hinge free, motor, servo, friction, soft limits i `collideConnected`;
- 12 000-step headless soak i 12 000-step real-Cannon/joint soak;
- 50 lifecycle cycles;
- startup smoke;
- source inventory, release identity, deterministic build i source parity.

## Drugi review

Po pierwszej implementacji cały diff został przejrzany ponownie. Wykryto i naprawiono między innymi:

- integrity denominator obejmujący niewłaściwą wyspę;
- niedokładną kolejność cleanupu;
- native body reads w debris sync;
- zbyt duży debris adapter w composition root;
- presentation hook mogący przerwać zatwierdzoną mutację;
- nieatomową rejestrację visual roots;
- brak aktywnego-flight pagehide smoke;
- kruche markery tekstowe testów;
- historyczne dokumenty udające stan bieżący.

Szczegóły: `CODE_REVIEW_REPORT.md` i `FOUNDATION_CONVERGENCE_REVIEW.md`.

## Release verdict

- Gate A: **CLOSED**.
- Najdalsza w pełni ukończona bramka: **Phase 1D.3E / Gate A**.
- Gate B–E: **nie rozpoczęte**.
- Nie ma nieuruchomionych testów z `tests/run_all.py`.
- Nie znaleziono release blockera dla dostawy Gate A.

Po zapisaniu tego raportu finalne artefakty są ponownie budowane z kanonicznego drzewa, a dostawa zawiera zewnętrzny plik checksum i końcowy wynik walidacji artefaktów.
