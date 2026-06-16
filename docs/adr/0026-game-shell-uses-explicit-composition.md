# ADR 0026 — Game shell uses explicit composition

Status: Accepted in Foundation Phase 1D.3B.1.

## Context

`src/game.js` urósł do 4697 linii i 220 kB. Łączył scenę, modele wizualne, karierę, workspace, input settings, analizę, blueprint persistence, misje, warsztat, lot, damage i główną pętlę. Kod działał, ale każda zmiana wymagała analizy całego pliku i zwiększała ryzyko naruszenia granic Runtime Assembly oraz Physics Portu.

Mechaniczne pocięcie pliku nie rozwiązałoby problemu, gdyby nowe pliki nadal współdzieliły globalne mutable variables.

## Decision

`src/game.js` staje się finalnym composition rootem. Stabilne odpowiedzialności są modułami `game.*` rejestrowanymi w kernelu. Moduły otrzymują stan, DOM adaptery, usługi i callbacki jawnie przez `create(...)`.

Moduły nie mogą:

- importować entrypointu;
- czytać `window.VAW_RUNTIME`;
- tworzyć równoległego źródła prawdy dla CraftModel, RuntimeAssembly lub misji;
- mutować prywatnego stanu innego modułu;
- obchodzić Physics Portu ani Assembly Buildera.

`APP_SOURCES` jest kanonicznym source inventory. `game.js` pozostaje ostatnim źródłem.

Flight lifecycle i integrity nie są jeszcze publicznymi modułami. Zostaną zaprojektowane po joint capability spike wokół wielu body i RuntimeAssembly.

## Consequences

Positive:

- krótsze diffy i bardziej lokalne code review;
- pojedynczy właściciel stabilnych podsystemów;
- możliwość testowania usług bez uruchamiania całej gry;
- mniej ukrytych zależności;
- bezpieczniejsze delegowanie pracy kolejnym agentom;
- source parity obejmuje wszystkie moduły z jednej listy.

Negative:

- composition root nadal ma istotne glue i callback wiring;
- część modułów jest DOM-heavy;
- przejściowo istnieje więcej jawnych callbacków;
- końcowa ekstrakcja flight/integrity czeka na model multi-body.

## Guardrails

- `game.js <= 2500` linii i `<= 120000` bajtów;
- kluczowe funkcje mają testowanego pojedynczego właściciela;
- private lifecycle state nie może pojawić się w entrypoincie;
- główne craft body nadal powstaje wyłącznie przez `AssemblyBuilder`.
