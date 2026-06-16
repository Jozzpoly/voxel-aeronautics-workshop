# Validation Report — Phase 1D.3B

## Automatyczna walidacja

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane:

- `All core tests passed.`;
- real-Cannon harness zakończony JSON-em bez wyjątku;
- startup smoke `modules: 20`, `sources: 23`;
- `sourceParity: ok`;
- deterministyczny build.

## Hermetyczny real-Cannon harness

Cannon.js 0.6.2 dla testów znajduje się w `tests/vendor/cannon-0.6.2/`. Jego licencja jest zachowana w sąsiednim `LICENSE`, a opis użycia w `THIRD_PARTY_NOTICES.md`.

Uruchomienie samego testu:

```bash
node --expose-gc tests/test_real_cannon_harness.js
```

Sprawdza free fall, torque, rotated inertia, offset thrust, payload/recenter, prawdziwy kontakt, 12 000 kroków soak, benchmark i lifecycle.

## Manualny browser harness

Uruchom lokalny serwer:

```bash
python tools/serve.py
```

Otwórz:

```text
http://127.0.0.1:8765/tests/browser_runtime_harness.html
```

Strona powinna ustawić `data-status="pass"` i pokazać:

- real Cannon free fall;
- inertia parity;
- recenter position/velocity;
- lifecycle disposal.

Cannon w tym harnessie jest lokalny i nie wymaga CDN.

## Manualny playtest przed mergem

### 1. Podstawowy sandbox

1. Otwórz pusty warsztat.
2. Zbuduj pionowy statek o szerokości jednego bloku oraz konstrukcję asymetryczną.
3. Umieść Core w różnych pozycjach.
4. Uruchom lot, użyj wszystkich osi i obu regulatorów mocy.
5. Wróć do warsztatu kilka razy.
6. Konsola nie może pokazywać pozostawionych body, powielonych listenerów ani błędów cleanup.

### 2. Mass properties i recenter

1. Zbuduj długi statek z ciężarem po jednej stronie.
2. Porównaj reakcję pitch/yaw/roll z panelem engineering analysis.
3. Uruchom kontrakt z payloadem.
4. Oderwij boczną część podczas translacji.
5. Powtórz podczas wyraźnego obrotu.
6. Statek nie może teleportować się, dostać sztucznego kopa, NaN ani zachować starej bezwładności.

### 3. Damage i collider removal

1. Doprowadź do utraty pojedynczego zewnętrznego bloku.
2. Sprawdź, czy debris odłącza się tylko raz.
3. Uderz ponownie w miejsce po utraconym bloku.
4. Niewidzialny collider nie może pozostać w głównym body.
5. Utrata gałęzi nie może pozostawić mapy `blockId` wskazującej nieaktywny collider.

### 4. Payload

1. Uruchom Courier i Heavy-Lift.
2. Potwierdź zmianę sterowności po dołączeniu payloadu.
3. Uszkodź i odłącz payload.
4. Recenter po utracie payloadu nie może zmienić pozycji ani prędkości skokowo.
5. Misja i HUD muszą zareagować na cargo integrity.

### 5. Regresje UI i sterowania

- symmetry i undo/redo;
- Flight Focus;
- Sandbox Test;
- Hover License na obu padach;
- gate course;
- panel close/reopen/resize;
- guidance obu pionowych regulatorów;
- `W/S`, `Z/C`, Space/Ctrl, pitch, yaw i roll.

## Kryterium merge

Merge dopiero po:

1. zielonej baterii automatycznej;
2. `verify_release.py` z source parity;
3. manualnym sandbox lifecycle;
4. detach podczas rotacji bez skoku;
5. braku ghost colliderów;
6. PASS browser harnessu;
7. sprawdzeniu `git diff --stat` i braku przypadkowych plików tymczasowych.
