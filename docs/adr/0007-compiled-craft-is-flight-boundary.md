# ADR 0007 — CompiledCraft jest granicą wejściową runtime lotu

- Status: Accepted
- Milestone: Foundation Phase 1C

## Kontekst

Po wyodrębnieniu CraftModel obliczenia masy, COM, bezwładności, grafu i urządzeń nadal były wykonywane w monolitycznym runtime. Utrudniało to testy, zmianę backendu fizyki i przyszłe scalanie colliderów.

## Decyzja

`foundation.craft-compiler` produkuje deterministyczny, niezmienny `CompiledCraft`. Artefakt zawiera neutralne dane liczbowe i nie zależy od DOM, Three.js ani Cannon.js.

Runtime tworzy obiekty bibliotek dopiero z tego artefaktu.

## Konsekwencje

- Kompilację można testować bez renderera.
- Backend fizyki otrzyma stabilny kontrakt wejściowy.
- Indeksy części i sygnatura są powtarzalne.
- Obecny plan colliderów jest referencyjny i nie oznacza jeszcze optymalizacji.
