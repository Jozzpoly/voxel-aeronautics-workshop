# Voxel Aeronautics Workshop — Foundation Phase 1D.2D

**Rebindable Input & Flight Focus**

Voxel Aeronautics Workshop jest desktopowym voxelowym sandboxem inżynieryjnym. Gracz buduje statek blok po bloku, testuje fizykę, sterowanie, uszkodzenia i misje, analizuje telemetrię, a następnie poprawia projekt.

Phase 1D.2D zamyka problem konfliktów klawiatury bez rezygnowania z preferowanego przez użytkownika `Left Ctrl` jako zejścia.

## Najważniejsze zmiany

### Konfigurowalne sterowanie już teraz

Nie odkładamy rebindingu na późniejszy etap. `foundation.input-profile` ma teraz wersję 2 i przechowuje:

- ustawienia sześciu osi;
- do dwóch fizycznych klawiszy na każdą komendę lotu;
- bindingi regulacji Balloon power;
- automatyczną migrację starszego profilu bez bindingów;
- jednoznaczne przenoszenie klawisza, gdy zostanie przypisany do innej akcji.

W panelu Controls kliknij slot, a następnie naciśnij klawisz. `Backspace/Delete` czyści slot, `Escape` anuluje przechwytywanie.

### Left Ctrl zostaje domyślnym zejściem

Domyślne sterowanie:

- `W / S` — przód / tył;
- `Z / C` — translacja w lewo / prawo;
- `Space / Left Ctrl` — góra / dół;
- `↑ / ↓` — pitch;
- `A / D` lub `← / →` — yaw;
- `Q / E` — roll;
- `, / .` — Balloon power −/+2%;
- `- / +` — pasywny ciąg thrusterów skierowanych ku lokalnemu `+Y`;
- `G` — stabilizacja;
- `F` — powrót do warsztatu.

`Shift` nie jest domyślnym bindingiem lotu, więc częste naciskanie zejścia nie uruchamia Klawiszy trwałych Windows.

### Flight Focus dla kombinacji Ctrl

Zwykła strona nie może niezawodnie przejąć wszystkich skrótów przeglądarki. `Ctrl+W`, `Ctrl+T` i podobne kombinacje mogą wygrać z grą.

Przycisk **Flight Focus** w panelu Controls:

1. uruchamia JavaScript fullscreen;
2. prosi Chromium o Keyboard Lock dla aktualnych bindingów;
3. przechwytuje m.in. `Ctrl+W` jako wejście gry, o ile przeglądarka i system udzielą zgody;
4. automatycznie aktualizuje listę przechwytywanych klawiszy po rebindingu.

Tryb jest opcjonalny. Gdy API nie jest dostępne lub zgoda zostanie odrzucona, panel pokazuje ostrzeżenie i gracz może przepiąć zejście na dowolny bezpieczny klawisz.

### Desktop jako jawna granica produktu

- telefon i touch-only pozostają poza zakresem;
- nie ma mobilnego topbara ani ekranowych przycisków sześciu osi;
- touchpad laptopa działa jako pointer i scroll;
- przyszłe sterowanie kontrolerem/Steam Deckiem wymaga osobnego profilu wejścia i UX.

### Zachowane poprawki 1D.2A–1D.2C

- state-based, multi-zone mission landing;
- Hover License akceptuje launch pad lub remote pad;
- natychmiastowa synchronizacja Balloon power;
- marker progu zawisu i wysokość równowagi;
- siła balonów malejąca z wysokością;
- łagodne, ograniczone tłumienie pionowe bez ukrytego autopilota;
- desktopowy workspace z trwałym z-orderem, pozycją i rozmiarem.

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

Po podmianie wersji użyj `Ctrl+Shift+R`. Flight Focus najlepiej testować przez `https://` albo `localhost`; przeglądarka może poprosić o zgodę na Keyboard Lock.

## Testy

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Automaty obejmują m.in. profil wejścia v2, migrację, przejmowanie konfliktu bindingów, domyślny Left Ctrl, zestaw kodów Keyboard Lock, runtime rebinding, startup smoke, misje, aerostatykę, physics boundary i source parity.

Pełna checklista manualna znajduje się w `VALIDATION_REPORT.md`.

## Build wydania

```bash
python tools/build_release.py
```

Artefakty w `dist/`:

- `Voxel_Aeronautics_Workshop_Foundation_Phase_1D2D_Rebindable_Flight_Focus.html`;
- `Voxel_Aeronautics_Workshop_Foundation_Phase_1D2D_Rebindable_Flight_Focus.zip`;
- `SHA256.txt`.

## Następny etap

**Foundation Phase 1D.3 — Runtime Body Builder & Headless Physics Harness**. Rebinding nie jest już blokadą kolejnego etapu; następne prace nad wejściem to gamepad, import/export profilu i UX konfliktów, a nie kolejna przebudowa fundamentu klawiatury.
