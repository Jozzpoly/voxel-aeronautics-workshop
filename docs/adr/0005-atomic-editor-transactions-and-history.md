# ADR 0005 — Edycje konstrukcji są atomowe, a historia ma osobnego właściciela

- Status: Accepted
- Milestone: Foundation Phase 1B

## Kontekst

Operacje takie jak symetryczne dodawanie, wczytanie blueprintu lub usunięcie elementu mogą dotyczyć wielu rekordów. Ręczne wykonywanie ich krok po kroku grozi częściowym stanem, rozjazdem renderera i niepoprawnym wpisem historii.

## Decyzja

`CraftModel` waliduje całą operację przed mutacją i przyjmuje ją jako jedną transakcję albo odrzuca bez skutków ubocznych.

`CraftHistory` jest osobnym modułem przechowującym izolowane snapshoty dokumentu. Undo i redo mogą zostać cofnięte przez rollback, jeżeli przywrócenie snapshotu nie powiedzie się.

Odrzucona edycja:

- nie zmienia modelu;
- nie zwiększa rewizji;
- nie emituje zdarzenia zmiany;
- nie tworzy wpisu historii.

## Konsekwencje

### Pozytywne

- Symetria nie może pozostawić połowy planu.
- Import nie może częściowo nadpisać konstrukcji.
- Historia odpowiada operacjom użytkownika, a nie pojedynczym wewnętrznym mutacjom.
- Model, widok i undo/redo mają jasno określoną kolejność aktualizacji.

### Negatywne

- Duże transakcje wymagają walidacji całego planu przed zapisem.
- Snapshotowa historia zużywa więcej pamięci niż przyszły system komend/diffów.
- Przy bardzo dużych konstrukcjach może być potrzebna późniejsza reprezentacja przyrostowa, lecz dopiero po benchmarkach.
