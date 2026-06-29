# Recovery audit — V2 vs V3/V3.1/V3.2

## Zakres audytu

Przeczytano transfer i przejrzano paczki referencyjne:

- `VAW_BLOCKBENCH_IMPORT_STUDIO_V2_REAL_GLTF.zip`
- `VAW_BLOCKBENCH_IMPORT_STUDIO_V3_VIEWER_TEXTURE_DEBUG.zip`
- `VAW_BLOCKBENCH_IMPORT_STUDIO_V3_1_HOTFIX.zip`
- `VAW_BLOCKBENCH_IMPORT_STUDIO_V3_2_RESTORE.zip`
- portable kit jako kontekst architektoniczny.

## Porównanie wersji

### V2

V2 miało zły UX sterowania, bo używało OrbitControls z LPM/PPM. Miało jednak zdrowszy lifecycle viewera: pętla renderowania startowała raz i nie była zabijana podczas resetu assetu.

### V3

V3 dodało właściwsze sterowanie MMB oraz texture debugger, ale wprowadziło regresję lifecycle:

1. viewer startuje przy inicjalizacji strony;
2. import plików robi `resetAll()`;
3. `resetAll()` kasuje `requestAnimationFrame`;
4. `initThree()` nie startuje ponownie animacji, bo `state.scene` już istnieje;
5. model może zostać załadowany, ale ekran pozostaje czarny/pusty.

### V3.1

V3.1 skupiło się na walidacji: duplicate node names jako warning, no emissive jako info, próby napraw sidecara. To nie dotykało zabitej pętli renderowania.

### V3.2

V3.2 dodało obsługę WebGL failure i mocniej rozdzieliło statusy, ale nadal dziedziczyło problem reset/render-loop. Użytkownik potwierdził właściwy plik V3.2, więc cache nie jest sensownym wyjaśnieniem.

## Decyzja recovery

Nie patchować dalej V3.2 jako pełnej aplikacji. Zbudować wersję viewer-first z mniejszą liczbą warstw:

- `minimal_viewer.html` — bez VAW semantics;
- `index.html` — Import Studio z diagnostyką i osobnym VAW readiness;
- nowy `MinimalGltfViewer`, którego reset modelu nie zatrzymuje render loop;
- custom MMB controls;
- prawdziwy dependency/texture report;
- eksport paczki zablokowany tylko przez VAW readiness, nie przez sam preview.
