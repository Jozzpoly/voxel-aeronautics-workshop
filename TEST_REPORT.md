# Test Report — Foundation Phase 1C.2 Control & Workspace

## Wynik

**Wszystkie automatyczne testy przechodzą.**

Polecenie:

```bash
python tests/run_all.py
```

## Zakres i wynik końcowy

- składnia wszystkich 15 źródeł aplikacji przechodzi `node --check`;
- 213 unikalnych funkcji runtime i 183 unikalne identyfikatory HTML;
- loader, build i manifest używają tej samej kolejności źródeł;
- bootstrap rozwiązuje 12 modułów domenowych;
- startup smoke wykonuje pełny przepływ pusty warsztat → starter → lot → wejścia wieloosiowe → powrót;
- build źródłowy, jednoplikowy HTML, manifest i SHA-256 są deterministyczne i zgodne bajtowo.

## Blueprint v9 i Control Frame

Testowane są:

- pusty dokument i dowolny pierwszy blok;
- Core w dowolnym miejscu, jego usunięcie i ponowne dodanie;
- maksymalnie jeden Core;
- rozłączony stan roboczy oraz blokowanie startu niegotowej konstrukcji;
- zachowanie orientacji Core w v9;
- migracje v3–v8 do v9 z historycznym `forward +X / up +Y`;
- `CompiledCraft.controlFrame` zawierający forward, up, right, origin i źródło orientacji;
- transformacja intencji pilota przez obrócony układ Core.

## CraftModel, CraftHistory i CraftCompiler

- atomowe transakcje oraz brak mutacji po odrzuceniu;
- niezmienność rekordów i snapshotów;
- 600 deterministycznych operacji edytora;
- pełny model 2500 bloków;
- undo/redo, deduplikacja, rollback i budżet pamięci;
- deterministyczna sygnatura, cache rewizji i diagnostyka spójności;
- pełne `replace` 2500 bloków: około 8.4 ms w ostatnim przebiegu Node;
- kompilacja 2500 części: około 52.7 ms w ostatnim przebiegu Node.

Czasy są pomiarem logiki w środowisku Node, nie gwarancją renderowania ani fizyki w przeglądarce.

## Sterowanie

- sześć osi: `pitch`, `yaw`, `roll`, `surge`, `sway`, `lift`;
- W/S — przód/tył, Z/C — lewo/prawo, Space/Ctrl — góra/dół;
- A/D i strzałki — poprawny yaw, Q/E — roll;
- osobny profil użytkownika z odwracaniem i czułością każdej osi;
- domyślna korekta historycznie odwróconego pitchu;
- agregacja wielu jednoczesnych akcji;
- Left Ctrl + S jako równoczesne dół + tył;
- pasywny ciąg +Y nie ogranicza autorytetu wejść pilota;
- neutralnie wyłączone thrustry poziome i skierowane w dół bez komendy.

## UI Workspace

Testy i audyt statyczny zabezpieczają:

- wspólny stan Build, Contracts, Telemetry i Controls;
- zamykanie i ponowne otwieranie paneli;
- minimalizację, przeciąganie i zmianę rozmiaru;
- trwały zapis pozycji i rozmiaru;
- migrację ustawień UI v1 do workspace v2;
- automatyczne ukrycie panelu kontraktów w trybie lotu bez niszczenia preferencji użytkownika;
- mobilny fallback bez pływających okien.

## Zachowane regresje

Przechodzą dotychczasowe testy orientacji, mirror, misji, kariery, payloadu, powierzchni sterowych, gimbali, obrażeń, wycieków, odrywania części, collision damage, stabilnego zawisu, limitów historii, debris i części lotnych.

## Build i wydanie

- jednoplikowy HTML przechodzi kontrolę składni osadzonego kodu;
- osadzone moduły są porównywane ze źródłami bajt po bajcie;
- ZIP-owe źródła są porównywane z katalogiem roboczym;
- ZIP zawiera odpowiadający mu jednoplikowy HTML i `SOURCE_MANIFEST.json`;
- dwa niezależne buildy są deterministyczne;
- generator nie dodaje już podwójnych wpisów z katalogu `release/`.

## Ograniczenie walidacji

Nie wykonano wiarygodnego pełnego playtestu prawdziwego WebGL/GPU. Startup i interakcje są testowane na stubach, ale rzeczywisty lot, fokus wejścia, przeciąganie okien i rendering należy dodatkowo sprawdzić lokalnie w przeglądarce.
