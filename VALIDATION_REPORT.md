# Validation Report — Phase 1D.3A

## Automatyczna walidacja

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane:

- `All core tests passed.`;
- startup smoke `modules: 20`, `sources: 23`;
- `sourceParity: ok`;
- deterministyczny build.

## Manualny playtest przed mergem

### 1. Podstawowy sandbox

1. Otwórz pusty warsztat.
2. Zbuduj prosty pionowy statek oraz asymetryczną konstrukcję.
3. Uruchom lot, użyj wszystkich osi i obu regulatorów mocy.
4. Wróć do warsztatu kilka razy.
5. Konsola nie może pokazywać pozostawionych body, błędów listenerów ani stale colliderów.

### 2. Assembly lifecycle

1. Uruchom statek.
2. Wróć do warsztatu.
3. Powtórz co najmniej 20 razy.
4. Zwróć uwagę na spadki wydajności, powielone callbacki kolizji i wielokrotne komunikaty impact.

### 3. Mass properties i recenter

1. Zbuduj długi statek z ciężarem po jednej stronie.
2. Porównaj reakcję pitch/yaw/roll z panelem engineering analysis.
3. Uruchom kontrakt z payloadem.
4. Oderwij boczną część podczas translacji.
5. Powtórz podczas wyraźnego obrotu.
6. Statek nie może teleportować się, dostać sztucznego kopa, NaN ani zachować starej bezwładności.

### 4. Damage i collider removal

1. Doprowadź do utraty pojedynczego zewnętrznego bloku.
2. Sprawdź, czy debris odłącza się tylko raz.
3. Uderz ponownie w miejsce po utraconym bloku.
4. Niewidzialny collider nie może pozostać w głównym body.
5. Utrata gałęzi nie może pozostawić mapy `blockId` wskazującej nieaktywny collider.

### 5. Payload

1. Uruchom Courier i Heavy-Lift.
2. Potwierdź zmianę sterowności po dołączeniu payloadu.
3. Uszkodź i odłącz payload.
4. Recenter po utracie payloadu nie może zmienić świata w sposób skokowy.
5. Misja i HUD muszą zareagować na cargo integrity.

### 6. Browser Runtime Harness

Uruchom lokalny serwer:

```bash
python tools/serve.py
```

Otwórz:

```text
http://127.0.0.1:8765/tests/browser_runtime_harness.html
```

Strona powinna zakończyć się `PASS` i pokazać wyniki:

- real Cannon free fall;
- inertia parity;
- recenter position/velocity;
- lifecycle disposal.

Brak internetu może uniemożliwić pobranie Cannon.js z CDN. Taki przypadek jest ograniczeniem środowiska, nie wynikiem testu.

### 7. Regresje

- migracja blueprintu v9 → v10;
- symmetry i undo/redo;
- Flight Focus;
- Sandbox Test;
- Hover License na obu padach;
- gate course;
- cargo damage;
- panel close/reopen/resize;
- guidance obu pionowych regulatorów.

## Kryterium merge

Merge dopiero po:

1. zielonej baterii automatycznej;
2. manualnym sandbox lifecycle;
3. detach podczas rotacji bez skoku;
4. braku ghost colliderów;
5. PASS browser harnessu w środowisku z dostępnym Cannon.js.
