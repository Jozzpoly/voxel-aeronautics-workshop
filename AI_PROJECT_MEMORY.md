# VAW — aktualny checkpoint agentowy

**Przegląd:** 2026-10-20, po kampanii nocnej. **Najważniejsze:** recovery osiągnęło wąską, uruchamialną pętlę buduj → sprawdź → popraw; produkt nadal wymaga oceny i dopracowania. Ten dokument jest jedynym krótkim snapshotem, nie dziennikiem agentów.

## Prawda o repozytorium / wydaniu

- Aktywne źródło: `recovery/playable-truth`. `main` historyczny, nietknięty; `gh-pages` generowane wydanie. PR #16 **Draft**; nie scalać bez nowej, świadomej decyzji i oceny Ownera.
- **Ostatni zweryfikowany build gry** = `8f2922594de746a28a3b716c84b1b2c3bf7ccace`; publiczne [VAW](https://jozzpoly.github.io/voxel-aeronautics-workshop/) i [BUILD_INFO](https://github.com/Jozzpoly/voxel-aeronautics-workshop/blob/gh-pages/BUILD_INFO.json). [Validation PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043772), [repro PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351043658), [Pages PASS](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39351142474). Późniejszy HEAD może zawierać dokumentację bez nowego wydania — sprawdź oba SHA, nie utożsamiaj ich automatycznie.
- Dawne gałęzie zredukowano do trzech, ważne tipy zachowano tagami [archive](docs/BRANCH_ARCHIVE_2026-10-19.md). Nie reaktywować multiagentowego mesha / branchowego chaosu.

## Co ma realne dowody

- P0 repo-recovery, P1 audyt, P2-A poprawność Engineering Analysis i P2-B zachowywanie `lastTestResult` po locie: technicznie domknięte na recovery.
- P2-C dostało pierwsze użyteczne narzędzia: selekcja po trwałym `blockId`, inspekcja pierwszej awarii, nudge, `FRAME`, tryb `Select (V)`, bezpośrednie przesuwanie niezlinkowanej części po lokalnym XZ, Undo/Redo; podczas gestu ruch realnego visual root, walidacja kandydata i odrzucanie kolizji, exact cancel. **P2-C jako jakość warsztatu nadal niezaakceptowane.**
- Chromium wykonał ścieżkę od pustej konstrukcji przez ręczne części i edycję po lot/powrót. Testy komponentowe obejmują transformacje zagnieżdżonych AssemblySpace, realne Three.js, brak zmiany Blueprintu podczas preview, zły finalny ray, zmianę zaznaczenia, konflikt pola, rollback i pojedynczy Undo.
- Zweryfikowany jest build wydawany z konkretnego źródła; publiczny URL i Jaskinia są wejściem, **nie** certyfikatem jakości.

## Granice / zagrożenia, których nie rozmywać

1. **Największa luka: Owner UX/feel.** Panelowy interfejs jest nadal ciężki, mechaniczne budowanie trudne, a czytelności ruchu w realnych konstrukcjach nie sprawdzono z użytkownikiem. Testy i screenshot nie zastępują ręcznej oceny.
2. **Dane:** cross-tab autosave ma wykrywanie konfliktów + ratunkowy eksport, ale bez pełnej atomowości. Stare otwarte karty mogą działać według poprzednich reguł. Nie obiecywać pełnej odporności.
3. **Mechanizmy:** `AssemblySpace` to własność przestrzeni, `rigid island` to wyprowadzona grupa sztywna, a graf jointów to osobny problem. Jedno nie jest synonimem drugiego. Na razie linkowane części pozostają zablokowane dla prostego dragu; nie przemycać „move all linked” jako naprawy.
4. **Granica gry:** bez pełnego gizmo/sterowania urządzeniami i programowania; mobile, długie sesje, glTF-heavy performance i prawdziwe czucie lotu niezaakceptowane. Benchmark czystej walidacji przy 2500 blokach w Node (~3,3 ms mediana) **nie** dowodzi 60 FPS.
5. **Źródła/evidence:** poprzednie czerwone CI obejmują zarówno uzasadnione testy falsyfikacyjne, jak i przejściowe problemy z generowanym CSS. Patrz exact SHA i pełny przebieg, nie ilość PASS. W szczególności pierwszy test race w drag był fałszywie zielony, dopóki fixture nie wykazał niezerowego kandydata.

## Jutro — najlepszy pierwszy ruch

Najpierw odczytaj aktualny `HEAD` recovery i `gh-pages/BUILD_INFO.json`, a potem rzeczywisty ekran/gest. **Nie rozpoczynaj od kolejnego systemu ani checklisty.** Najbardziej opłacalny jest krótki, obserwowalny test Ownera: konstrukcja od zera, wybór/przesuwanie (prawidłowa i zajęta pozycja), `FRAME`, Undo, lot, powrót, poprawka. Rozdzielaj błędy techniczne od nieprzyjemnego feelu i braku affordance. Gdy brak Ownera, odczyt i przygotowanie ograniczonego scenariusza lub analiza konkretnego live friction; nie udawaj Owner acceptance.

Dopiero wynik pozwala rozstrzygnąć, czy priorytetem jest kamera / workspace / sterowanie / autorstwo mechanizmów. Można zakwestionować tę hipotezę na podstawie lepszej obserwacji.

**Głębsze dowody i falsyfikatory:** [zamknięcie kampanii](docs/history/recovery/2026-10-20-recovery-campaign-review.md), [baseline code audit](docs/CODE_REALITY_AUDIT.md), [cross-project donors](docs/research/2026-10-19-cross-project-builder-ux-donors.md), [PR #16](https://github.com/Jozzpoly/voxel-aeronautics-workshop/pull/16). Poprzednia 31k-znakowa pamięć jest zachowana w historii Gita na `8f292259`; nie traktować jej starych nagłówków „candidate” jako stanu obecnego.
