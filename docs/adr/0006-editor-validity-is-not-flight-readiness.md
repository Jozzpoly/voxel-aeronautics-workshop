# ADR 0006 — Poprawny stan edytora nie oznacza gotowości do lotu

- Status: Accepted
- Milestone: Foundation Phase 1C

## Kontekst

Wymuszony Core w `0,0,0` blokował swobodne projekty, między innymi wąską rakietę z thrusterem jako najniższym blokiem. Utrzymywanie kompletnego, połączonego statku po każdej pojedynczej edycji utrudniało również przebudowę i przenoszenie Core.

## Decyzja

Blueprint v8 i `CraftModel` dopuszczają pusty, bez-Core oraz rozłączony stan roboczy. Core jest zwykłym przestrzennie modułem i może znajdować się w dowolnym wolnym polu.

`CraftCompiler` jest właścicielem walidacji startowej. Lot wymaga co najmniej jednego bloku, dokładnie jednego Core i jednej połączonej wyspy.

## Konsekwencje

- Gracz może zacząć od dowolnego elementu.
- Core można przenieść bez sztucznych obejść.
- Autosave może zachować projekt w trakcie przebudowy.
- UI musi jasno odróżniać błędy startu od błędów dokumentu.
- Systemy serwerowe nie mogą zakładać, że każdy zapis jest od razu lotny.
