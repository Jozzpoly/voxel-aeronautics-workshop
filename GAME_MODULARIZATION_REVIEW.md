# Game Modularization — Critical Code Review

## Werdykt

Restrukturyzacja jest uzasadniona i poprawia możliwość dalszego rozwoju. Nie jest jedynie podziałem pliku: nowe moduły posiadają jawne zależności, pojedynczych właścicieli i testowane granice. Wszystkie wcześniejsze testy fizyki, assembly, misji, damage i delivery nadal przechodzą.

## Najważniejsze pozytywne decyzje

- `game.js` pozostał composition rootem zamiast zostać zastąpiony drugim frameworkiem;
- moduły używają istniejącego kernela `window.VAW.define/require`;
- `CraftModel`, `CompiledCraft`, RuntimeAssembly i Physics Port nie zostały naruszone;
- fizyczne body statku nadal buduje `AssemblyBuilder`;
- source loader, manifest, single HTML, ZIP i testy mają wspólną listę źródeł;
- lot i damage nie zostały przedwcześnie zamknięte w API single-body.

## Znalezione i naprawione problemy

### P0/P1 — ukryte odwołania do prywatnego stanu po ekstrakcji

`pagehide` i `fullscreenchange` korzystały z nazw przeniesionych do closure modułów. Naprawiono przez publiczne API lifecycle i dodano wykonywalny smoke.

### P1 — test Physics boundary był początkowo zbyt szeroki

Pierwsza wersja testu zabraniała `Physics.createBody` w całym `game.js`, co błędnie obejmowało legalne debris. Granica została doprecyzowana: `buildFlightBody()` nie może tworzyć głównego body/colliderów bezpośrednio, ale gameplayowe debris może korzystać z Physics Portu.

### P2 — rozproszone listy źródeł

Testy wcześniej agregowały głównie `game.js`. Dodano `tests/source_inventory.py`, aby każda kontrola widziała wszystkie pliki z `APP_SOURCES`.

## Pozostające ryzyka

- `mission_controller.js` i `engineering_analysis.js` są duże oraz mocno związane z DOM;
- composition root nadal spina dużą liczbę callbacków;
- workshop glue, camera/input routing i render loop pozostają razem;
- brak pełnego automatycznego WebGL browser testu;
- przyszły multi-body runtime wymusi przebudowę `STATE.flight.body` na assembly-centric access.

## Zalecenia

1. Wykonać joint spike bez ponownego wtłaczania constraint logiki do `game.js`.
2. Po spike wydzielić `flight-session` i `flight-integrity` wokół `RuntimeAssembly`.
3. Następnie wydzielić camera controller i workshop controller.
4. Nie tworzyć wspólnego „god object context”; utrzymać małe jawne kontrakty `create(...)`.
5. Dodawać test lifecycle przy każdym module posiadającym timer, listener lub zasób backendu.
