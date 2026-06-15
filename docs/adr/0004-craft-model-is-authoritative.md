# ADR 0004 — CraftModel jest autorytatywnym modelem konstrukcji

- Status: Accepted
- Milestone: Foundation Phase 1B

## Kontekst

Poprzedni runtime przechowywał dane domenowe bloku razem z meshem Three.js w `STATE.voxels`. Renderer i model konstrukcji miały wspólnego właściciela, przez co testowanie i przyszła kompilacja statku wymagały uruchamiania warstwy wizualnej.

## Decyzja

`foundation.craft-model` jest jedynym źródłem prawdy dla aktualnej konstrukcji warsztatowej.

Model przechowuje wyłącznie kanoniczne rekordy domenowe. Meshe są projekcją modelu przechowywaną osobno przez adapter widoku warsztatu.

Runtime może odbudować wszystkie meshe z `CraftModel`. Nie może rekonstruować modelu przez odczytywanie sceny Three.js.

## Konsekwencje

### Pozytywne

- Walidacja konstrukcji nie wymaga renderera.
- CraftCompiler może przyjmować czyste dane.
- Można zmienić strategię renderowania bez migracji blueprintów.
- Rozjazd widoku można naprawić pełną odbudową z modelu.
- Łatwiejsze stają się narzędzia zewnętrzne, deterministyczne testy i przyszła synchronizacja sieciowa.

### Negatywne

- Potrzebny jest jawny adapter model–widok.
- Do czasu dalszego refaktoru `game.js` nadal koordynuje część aktualizacji widoku.
- Każda nowa funkcja edytora musi używać API modelu, a nie mutować mapy bezpośrednio.
