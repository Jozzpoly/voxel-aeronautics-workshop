# Validation Report — Phase 1D.2F

## Automatyczna walidacja

```bash
python tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
```

Wymagane: wszystkie testy zielone oraz source parity `ok`.

## Manualny playtest przed mergem

### Migracja i zapis

1. Uruchom istniejący zapis v9.
2. Potwierdź poprawny wygląd statku.
3. Zapisz, odśwież i ponownie wczytaj.
4. W konsoli nie może być błędu blueprint v10.
5. Undo/redo oraz symmetry placement nadal działają.

### Budowanie

1. Zacznij od pustego warsztatu i dowolnego bloku.
2. Dodaj, usuń i przenieś Command Core.
3. Umieść bloki z symmetry X/Z/XZ.
4. Usuń i przywróć części przez undo/redo.
5. Zbuduj cienką rakietę szerokości jednego voxela.

### Mass properties

1. Zbuduj długi statek z ciężarem przesuniętym na bok.
2. Porównaj reakcję pitch/yaw/roll z panelem engineering analysis.
3. Dodaj payload i potwierdź zmianę sterowności.
4. Oderwij boczną część podczas obrotu.
5. Statek nie może skoczyć, dostać NaN ani zachować starej bezwładności.

### Vertical support

1. Potwierdź odczyt `Vertical support: X.XX× weight`.
2. Zmieniaj oba suwaki i sprawdź natychmiastową aktualizację.
3. Balloon guidance musi mówić, że próg dotyczy launch level.
4. W locie wzrost wysokości nadal osłabia balony.

### Granice lotu

1. Opuść range po X/Z i sprawdź poprawne zakończenie.
2. Przekrocz skonfigurowane 160 m wysokości.
3. Nie może istnieć inny, ukryty limit Y.

### Regresje

- ręczne sterowanie wszystkimi osiami;
- Flight Focus;
- sandbox;
- Hover License na obu padach;
- gate course;
- payload i cargo damage;
- panel close/reopen/resize;
- powrót do warsztatu po awarii.

## Kryterium merge

Merge dopiero po zielonej baterii automatycznej i manualnym potwierdzeniu migracji v9, asymetrycznej bezwładności, payloadu, detach oraz podstawowego sandboxu.
