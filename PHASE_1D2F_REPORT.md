# Phase 1D.2F Report — Runtime Assembly Foundation

## Cel

Przygotować projekt pod dwa następne filary bez zamykania architektury w obecnym modelu jednego sztywnego body:

1. programowanie każdego funkcjonalnego bloku osobno;
2. wiele sztywnych podzespołów połączonych jointami.

## Zrealizowane

### Blueprint v10

Każdy blok posiada trwałe `blockId`. Starsze dokumenty są migrowane automatycznie. Pozycja nadal tworzy `gridKey`, lecz nie jest już tożsamością urządzenia.

### CraftModel

Dodano:

- `getById(blockId)`;
- `keyForId(blockId)`;
- `move(blockIdOrKey, x, y, z)` zachowujące tożsamość;
- walidację unikalności identyfikatorów.

### CraftCompiler

Kompilat publikuje:

- `blockId` w każdej części;
- `blockIdToIndex`;
- grawitację używaną do referencyjnego ciężaru;
- format `VAW_COMPILED_CRAFT_V3`.

### Runtime Assembly Plan

Nowy czysty moduł emituje jeden root body wraz z colliderami i mapami. Kontrakty `constraints[]` oraz `signalLinks[]` są gotowe do rozszerzenia bez przebudowania obecnych map tożsamości.

### Mass properties

Naprawiono rozbieżność między bezwładnością panelu i solvera. Cannon otrzymuje diagonalną bezwładność ze snapshotu. Po detach i zmianie COM bezwładność jest ponownie liczona.

### Korekty

- brak hardkodowanego `9.81` w kompilowanym ciężarze;
- `TEST_RANGE.maxAltitude` zamiast liczby `160` w runtime;
- czytelna informacja o launch-level guidance;
- wspólny odczyt vertical support.

## Świadomie niezrealizowane

- wielobody runtime i jointy dla gracza;
- pełny headless solver harness;
- Per-Block Control Bus;
- PayloadMount;
- Collider Compiler;
- pełny tensor bezwładności 3x3.

Nie są one ukrywane jako „prawie gotowe”. Obecny assembly plan ma dokładnie jeden body i puste grafy mechaniczny/sygnałowy.

## Wynik

Projekt nie jest jeszcze programowalnym odpowiednikiem Clockwork/Aeronautics, ale najważniejsze identyfikatory i granice danych nie muszą już zostać wyrzucone przy dodawaniu takiego systemu.
