# User testing guide — Recovery Viewer First

## Start

```bash
npm test
python tools/serve.py
```

Otwórz:

```text
http://127.0.0.1:8080/index.html
```

Dla najczystszego testu:

```text
http://127.0.0.1:8080/minimal_viewer.html
```

## Test 1 — minimal viewer

1. Otwórz `minimal_viewer.html`.
2. Kliknij `UV checker sample`.
3. Model ma być widoczny.
4. Naciśnij `F` — kamera ma dopasować model.
5. Naciśnij `R` — reset ma wrócić do fit.

## Test 2 — kamera

- MMB drag: obrót kamery.
- Shift + MMB drag: przesuwanie.
- Scroll: zoom.
- LPM drag: nie rusza kamery.
- PPM drag: nie rusza kamery.

## Test 3 — zwykły eksport Blockbench

Wrzuć naraz:

- `.gltf`;
- `.bin`, jeśli istnieje;
- wszystkie tekstury.

Oczekiwane:

- model widoczny;
- panel dependencies nie pokazuje brakującego `.bin` ani tekstur;
- texture diagnostic pokazuje `image`, `material`, sloty tekstur i runtime meshe;
- brak `.vaw.json` nie usuwa modelu z viewera.

## Test 4 — model przesunięty od origin

Kliknij `Offset/fit glTF`.

Oczekiwane:

- model jest widoczny mimo przesunięcia;
- `F` dopasowuje model;
- panel bounds pokazuje sensowny rozmiar i środek.

## Test 5 — brak semantyki VAW

1. Załaduj model bez sidecara.
2. Sprawdź panel `VAW readiness`.

Oczekiwane:

- VAW readiness pokazuje ostrzeżenie lub brak gotowości;
- viewer/import status nadal mówi, że model jest załadowany;
- model nadal jest widoczny.

## Test 6 — eksport paczki

1. Załaduj model.
2. Kliknij `Wygeneruj sidecar`.
3. Kliknij `Waliduj VAW`.
4. Jeśli readiness jest OK, kliknij `Pobierz paczkę ZIP`.

Eksport VAW może być zablokowany przez readiness. To jest poprawne. Preview nie może być przez to blokowane.
