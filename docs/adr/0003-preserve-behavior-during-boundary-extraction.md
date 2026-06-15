# ADR 0003: Zachowanie gry pozostaje stałe podczas wycinania granic

## Status

Przyjęte.

## Kontekst

Zmiana architektury i fizyki jednocześnie utrudnia rozpoznanie źródła regresji.

## Decyzja

Foundation Phase 1 wyodrębnia właścicieli danych i stanu, ale nie zmienia modelu aerodynamicznego, solvera, misji ani balansu.

## Konsekwencje

- łatwiejsze porównanie z wersją bazową;
- istniejące testy nadal mają sens;
- część kodu pozostaje chwilowo jako cienkie funkcje kompatybilności w `game.js`;
- scalanie colliderów będzie osobnym, benchmarkowanym etapem.
