# Architektura — Foundation Phase 1B

## Cel

Celem etapu było stworzenie rzeczywistej granicy między:

- danymi konstrukcji;
- historią edycji;
- wizualizacją warsztatu;
- runtime lotu.

Nie chodziło o przeniesienie funkcji do nowych plików, lecz o ustanowienie jednego autorytatywnego modelu, który może później zasilać kompilator konstrukcji, renderer, fizykę, narzędzia i multiplayer.

## Obecny przepływ zależności

```text
foundation.kernel
   ├─ foundation.config
   ├─ foundation.catalog
   ├─ foundation.orientation
   ├─ foundation.blueprint
   ├─ foundation.craft-model
   ├─ foundation.craft-history
   └─ foundation.state
            │
            ▼
   foundation.bootstrap
            │
            ▼
          game.js
```

`game.js` nadal zarządza sceną, lotem, misjami i UI, ale nie jest już właścicielem danych konstrukcji ani stosów historii.

## Moduły

### `foundation.config`

Właściciel limitów, kluczy zapisów, parametrów fizyki, grup kolizji, enumów i polityki pamięci. Wynik jest głęboko zamrożony.

### `foundation.catalog`

Właściciel danych bloków i kontraktów. Waliduje identyfikatory oraz zależności kontraktów.

### `foundation.orientation`

Generuje dokładnie 24 ortogonalne orientacje, obsługuje legacy oraz mapowanie `forward/up`.

### `foundation.blueprint`

Granica dokumentu zapisu. Odpowiada za:

- kanoniczny format;
- sortowanie;
- migracje v3–v7;
- odrzucanie przyszłych wersji;
- granice siatki;
- pojedynczy Core w `0,0,0`;
- brak duplikatów;
- całkowite współrzędne;
- spójność konstrukcji;
- normalizację orientacji i sterowania;
- klonowanie oraz sygnatury.

Nie zna DOM, renderera ani fizyki.

### `foundation.craft-model`

Autorytatywny stan edytowanej konstrukcji.

Przechowuje zamrożone rekordy:

```text
{
  key,
  x, y, z,
  type,
  orientation,
  controlAxis,
  controlSign
}
```

Nie przechowuje:

- meshy;
- materiałów;
- wektorów Three.js;
- ciał Cannon.js;
- elementów DOM.

Zapewnia:

- lookup po kluczu pozycji;
- niezmienne listy i snapshoty;
- sprawdzanie sąsiedztwa i spójności;
- atomowe `addMany`;
- bezpieczne `remove` chroniące przed rozcięciem konstrukcji;
- atomowe `replace`;
- import dokumentu;
- eksport dokumentu;
- zdarzenia `added/removed/updated`;
- licznik rewizji.

Nieudana operacja nie zmienia modelu ani rewizji.

### `foundation.craft-history`

Czysty właściciel undo/redo.

- klonuje snapshoty przed zapisaniem;
- deduplikuje identyczne stany;
- ogranicza liczbę snapshotów;
- ogranicza sumę przechowywanych części;
- izoluje zwracane dokumenty od wewnętrznych stosów;
- pozwala wycofać operację historii, gdy odtworzenie dokumentu zawiedzie.

### `foundation.state`

Tworzy niezależne instancje aplikacji. Każda instancja otrzymuje osobny:

- `CraftModel`;
- `CraftHistory`;
- widok warsztatu;
- stan lotu;
- mapy i sety wejścia;
- stan misji, kariery i kamery.

Część runtime nadal używa typów Three.js. To jawny dług przeznaczony do dalszego wycinania, nie część modelu konstrukcji.

## Model i widok warsztatu

```text
CraftModel
   │ zdarzenie zmiany
   ▼
Workshop View Adapter w game.js
   ├─ meshesByKey
   └─ rootMeshes dla raycastingu
```

Model jest źródłem prawdy. Widok jest projekcją.

Przy zwykłej zmianie widok aktualizuje tylko dodane, usunięte lub zmienione bloki. Po aktualizacji sprawdzana jest zgodność liczby i kluczy. Jeżeli aktualizacja przyrostowa zawiedzie, wszystkie meshe warsztatu są odbudowywane z `CraftModel`.

Nie istnieje już `STATE.voxels` łączące rekord bloku z meshem.

## Transakcje edycji

Symetryczne rozmieszczenie kilku bloków jest pojedynczą operacją:

```text
plan rozmieszczenia
   │
   ▼
CraftModel.validateAddMany()
   │
   ├─ błąd → brak zmian
   │
   ▼
CraftModel.addMany()
   │
   ▼
jedno zdarzenie + jedna historia
```

To usuwa wcześniejsze ryzyko częściowo zastosowanego planu.

Usuwanie działa analogicznie: model najpierw sprawdza wynikową spójność, a dopiero potem zatwierdza zmianę.

## Cykl dokumentu

```text
CraftModel
   │ toDocument(settings)
   ▼
Blueprint document
   │ JSON / localStorage / plik
   ▼
Blueprint.normalize()
   │
   ▼
CraftModel.replace()
```

Każde wejście zewnętrzne przechodzi przez `Blueprint.normalize()`.

## Build

`tools/build_release.py` posiada jedyną uporządkowaną listę `APP_SOURCES`.

Buduje z tych samych źródeł:

- jednoplikowy HTML;
- ZIP projektu;
- sumy SHA-256.

Dwa następujące po sobie buildy zostały porównane bajt po bajcie i dały identyczny HTML oraz ZIP.

## Dozwolony kierunek zależności

```text
config <- catalog
config <- orientation
config + catalog + orientation <- blueprint
config + catalog + orientation + blueprint <- craft-model
config + blueprint <- craft-history
orientation + craft-model + craft-history <- state
foundation <- game.js
```

Fundament nie może importować `game.js`.

## Następna granica

`CraftCompiler` powinien przyjmować snapshot `CraftModel` lub dokument blueprintu i produkować niezmienny `CompiledCraft` zawierający masę, COM, bezwładność, graf sąsiedztwa, urządzenia funkcjonalne, punkty sił oraz plan colliderów.

Dopiero po tej granicy należy oddzielać backend fizyki i implementować scalanie colliderów.
