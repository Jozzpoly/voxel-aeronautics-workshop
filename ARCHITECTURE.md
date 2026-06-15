# Architektura — Foundation Phase 1C.2

## Cel etapu

Phase 1C ustanawia stabilną granicę między trzema różnymi stanami:

1. **Blueprint / CraftModel** — to, co gracz może swobodnie edytować i zapisać;
2. **CompiledCraft** — zweryfikowany, deterministyczny opis maszyny;
3. **Flight Runtime** — obiekty Three.js i Cannon.js używane podczas lotu.

Najważniejsza korekta projektowa: poprawność stanu roboczego nie jest tym samym co gotowość do lotu.

## Przepływ danych

```text
Blueprint JSON
    │ normalize / migrate
    ▼
CraftModel
    │ snapshot + revision
    ▼
CraftCompiler
    │ immutable CompiledCraft
    ▼
Runtime adapter w game.js
    ├─ Three.js visuals
    ├─ Cannon.js body/shapes
    ├─ damage runtime
    └─ flight telemetry
```

Renderer i fizyka nigdy nie są źródłem prawdy dla blueprintu.

## Kierunek zależności

```text
foundation.kernel
   ├─ foundation.config
   ├─ foundation.catalog
   ├─ foundation.orientation
   ├─ foundation.blueprint
   ├─ foundation.craft-model
   ├─ foundation.craft-history
   ├─ foundation.control-frame
   ├─ foundation.craft-compiler
   ├─ foundation.input-profile
   ├─ foundation.ui-workspace
   ├─ foundation.flight-control
   └─ foundation.state
            │
            ▼
   foundation.bootstrap
            │
            ▼
          game.js
```

Fundament nie może importować `game.js` ani zależeć od sceny.

## `foundation.blueprint`

Blueprint v9 jest czystym dokumentem i może reprezentować:

- pusty warsztat;
- konstrukcję bez Core;
- Core w dowolnej poprawnej pozycji;
- chwilowo rozłączone wyspy konstrukcji;
- maksymalnie jeden Core.

Takie dokumenty są poprawnymi **stanami edytora**, lecz nie muszą być gotowe do lotu.

Dla v3–v7 zachowane są historyczne reguły pozycji i spójności. Dla v3–v8 zachowana jest historyczna orientacja Core:

- Core w `0,0,0` dla v3–v7;
- automatyczne dodanie Core, gdy stary zapis go nie zawierał;
- wymagana spójność konstrukcji dla v3–v7;
- Core `forward +X / up +Y` dla v3–v8.

Normalizacja zawsze zwraca dokument v9.

## `foundation.craft-model`

`CraftModel` jest jedynym właścicielem aktualnej konstrukcji warsztatowej. Przechowuje wyłącznie zamrożone rekordy domenowe:

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

Model:

- pozwala zacząć od dowolnego bloku;
- pozwala na zero lub jeden Core;
- pozwala przesuwać Core przez usunięcie i ponowne ustawienie;
- pozwala zachować rozłączony stan roboczy;
- pilnuje granic, typów, duplikatów i limitu bloków;
- wykonuje operacje wieloblokowe atomowo;
- emituje jedno zdarzenie na przyjętą transakcję;
- posiada rewizję rosnącą wyłącznie po realnej zmianie.

Spójność pozostaje dostępna jako diagnostyka `isContiguous()`, ale jej wymaganie należy do kompilacji lotnej.

## `foundation.craft-history`

Historia przechowuje izolowane snapshoty dokumentów i odpowiada za:

- undo / redo;
- deduplikację;
- limit liczby wpisów;
- limit sumy części;
- rollback, gdy odtworzenie nie powiedzie się.

Runtime nie utrzymuje równoległych, luźnych stosów historii.

## `foundation.craft-compiler`

### Kontrakt wejścia

Kompilator przyjmuje:

- `CraftModel`;
- snapshot `{ revision, blocks }`;
- dokument lub listę bloków.

Dla modelu cache jest kluczowany obiektem i rewizją.

### Walidacja gotowości do lotu

`CompiledCraft.ready` jest prawdziwe wyłącznie, gdy:

- istnieje co najmniej jeden blok;
- istnieje dokładnie jeden Core;
- wszystkie części są poprawne i unikalne;
- wszystkie części należą do jednej połączonej wyspy;
- limit siatki i bloków nie jest przekroczony.

Edytor nie musi spełniać tych reguł w każdej klatce. Start musi.

### Zawartość artefaktu

`CompiledCraft` zawiera:

- `format`, `sourceRevision`, `signature`;
- `ready`, `errors`, `warnings`;
- `blockCount`, `connectedCount`;
- `coreIndex`, `coreKey`, `corePosition`;
- `controlFrame` z forward/up/right i źródłem orientacji;
- masę, ciężar, paliwo, opór, COM i bezwładność;
- `keyToIndex`, `adjacency`;
- kanoniczne części z liczbowymi bazami orientacji;
- lokalne offsety, pełne siły i momenty;
- `functionalByType`;
- referencyjny `colliderPlan`.

Cały wynik jest głęboko zamrożony. Kompilator nie tworzy wektorów Three.js, body Cannon.js ani elementów DOM.

### Determinizm

Kolejność części jest kanoniczna. Ta sama konstrukcja niezależnie od kolejności wejściowej produkuje tę samą sygnaturę i układ indeksów.

## Adapter `CompiledCraft -> Flight Runtime`

`buildCraftSnapshot()` jest obecnie przejściowym adapterem:

- bierze wyłącznie wynik `CraftCompiler`;
- konwertuje neutralne tablice liczbowe na `THREE.Vector3`;
- nie odczytuje meshów jako danych konstrukcji;
- przekazuje rzeczywistą pozycję Core do mocowania payloadu;
- buduje istniejący runtime bez zmiany modelu lotu.

Tworzenie body i colliderów nadal znajduje się w `game.js`. To główny zakres Phase 1D.

## `foundation.control-frame`, `foundation.input-profile` i `foundation.flight-control`

Command Core przechowuje jedną z 24 baz orientacji. Kompilator wyprowadza z niej `forward`, `up` i `right`. Intencja gracza jest najpierw przetwarzana przez profil wejścia, a następnie transformowana z układu Core do lokalnych osi bryły.

Warstwa wejścia operuje na semantycznych akcjach:

```text
pitch+ / pitch-
yaw+ / yaw-
roll+ / roll-
surge+ / surge-
sway+ / sway-
lift+ / lift-
```

Mapowanie klawiszy jest oddzielone od stanu pilota. Dzięki temu klawiatura, przyciski mobilne, przyszły gamepad i mikrokontroler mogą zasilać te same osie.

`applyTranslationMix()` miesza lokalny kierunek thrustera z żądaniem:

- `surge` — lokalne przód / tył;
- `sway` — lokalne lewo / prawo;
- `lift` — lokalne góra / dół.

Suwak mocy ustala wyłącznie pasywny ciąg silników skierowanych ku lokalnemu +Y. Nie jest limitem mocy dostępnej dla wejść pilota. Poziome i skierowane w dół thrustry są neutralnie wyłączone, natomiast zgodna komenda translacji lub obrotu może zwiększyć dowolny thruster aż do 100%. Komenda przeciwna redukuje istniejący pasywny ciąg do zera. Dzięki temu Left Ctrl aktywuje silniki skierowane w dół, a jednocześnie wygasza skierowane w górę. Jest to etap przejściowy przed pełnym grafem sterowania i konfigurowalnym mikserem.


## `foundation.ui-workspace`

Build, Contracts, Telemetry i Controls są projekcjami jednego wersjonowanego stanu okien. Stan przechowuje otwarcie, minimalizację, pozycję i rozmiar. Desktop renderuje pływające, przeciągane i skalowalne panele; mobile może pokazywać ten sam stan jako arkusze. Profil wejścia i workspace są preferencjami użytkownika, nie częścią blueprintu.

## Ważne inwarianty

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest źródłem prawdy dla uruchomienia lotu.
3. Meshe i collidery nie trafiają do dokumentów domenowych.
4. Core nie ma specjalnej pozycji; ma specjalną rolę.
5. Edytor dopuszcza niegotowe stany robocze.
6. Start wymaga dokładnie jednego Core i jednej wyspy.
7. Każda zmiana formatu ma wersję i migrację.
8. Sterowanie używa semantycznych osi, nie rozproszonych warunków klawiatury.
9. Sterowanie lotem ma pierwszeństwo nad skrótami edytora.
10. Nie podnosić limitu lotu przed benchmarkiem i collider compilerem.
11. Pasywny ciąg i bezpośrednia autoryteta pilota są oddzielnymi pojęciami.
12. Każdy artefakt wydania musi mieć weryfikowalną zgodność źródeł ZIP ↔ single HTML.
13. Orientacja Core definiuje Control Frame, ale profil wejścia pozostaje preferencją użytkownika.
14. Wszystkie główne okna używają wspólnego `UIWorkspace`.

## Świadomy dług

- `game.js` nadal jest duży.
- `foundation.state` nadal posiada część obiektów Three.js dla kompatybilności.
- runtime lotu nadal tworzy collider na każdy voxel.
- `CompiledCraft.colliderPlan` jest na razie referencyjny, nie zoptymalizowany.
- aerodynamika kadłuba nadal sumuje uproszczone `dragArea`.
- Three.js, Cannon.js i Tailwind pochodzą z CDN.
- brak prawdziwego automatycznego testu WebGL w obecnym środowisku.

## Następna granica — Foundation Phase 1D

Physics Boundary powinien:

1. zdefiniować minimalne porty świata, ciała, collidera i siły;
2. przenieść budowę compound body poza `game.js`;
3. zachować Cannon.js jako adapter referencyjny;
4. uruchamiać bezrendererowe kroki fizyki w testach;
5. mierzyć stabilność i koszt 100/500/1000/2500 części;
6. przygotować bezpieczny punkt porównania dla cannon-es i Rapier;
7. dopiero potem umożliwić scalanie colliderów.
