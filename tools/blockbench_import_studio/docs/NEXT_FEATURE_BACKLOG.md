# Next feature backlog

## P0 — potwierdzenie recovery

- Manualny test Jozza na prawdziwym eksporcie Blockbench.
- Screenshot lub opis: czy model jest widoczny, czy MMB działa, czy texture diagnostic mówi prawdę.
- Jeżeli nadal jest czarny viewer: zebrać status `renderer`, `render loop`, `mesh count`, `bounds`, `last loader error` z panelu.

## P1 — ZIP/folder workflow

- Import `.zip` zawierającego `.gltf + .bin + textures`.
- Zachowanie pełnych ścieżek folderów po unzip.
- Test duplicate basename wewnątrz zipa.

## P2 — material/mesh inspector

- Kliknięcie mesha w drzewie node’ów.
- Highlight selected mesh.
- Per-mesh material slots, UV sets, bounding box.

## P3 — animation inspector

- Timeline.
- Loop/speed.
- Bone/skeleton helper.
- Event markers do późniejszego VAW.

## P4 — VAW semantic editor

- Przypisywanie `visualRoot`, `gimbal`, `flameCore`, `flameGlow`, sockets.
- Walidator nie może nigdy chować modelu.
- Export paczki blokowany tylko przez krytyczne błędy readiness.

## P5 — mini game preview

- Ghost/build/flight preview.
- Slidery gimbal/flame intensity.
- Event log z animacji.
- Bez kruchej zależności od głównego runtime VAW.
