# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia. Najpierw przeczytaj ten plik, następnie `ARCHITECTURE.md`, `VALIDATION_REPORT.md` i testy.

## 1. Wizja

Główna fantazja: **buduję, programuję, testuję i latam własnym voxelowym statkiem powietrznym**. Kontrakty i progresja są warstwą pomocniczą.

## 2. Aktualny milestone

**Foundation Phase 1D.2D — Rebindable Input & Flight Focus**

Ukończone fundamenty:

- pusty warsztat i dowolny pierwszy blok;
- ruchomy, usuwalny i orientowany Command Core;
- blueprint v9 oraz `CompiledCraft.controlFrame`;
- sześć semantycznych osi;
- input profile v2 z trwałymi bindingami;
- desktop workspace v3;
- physics lifecycle/contact boundary;
- state-based, multi-zone landing;
- wspólna aerostatyka UI/fizyka;
- ograniczone tłumienie pionowe balonów;
- deterministyczny ZIP + single HTML z source parity.

## 3. Nienaruszalne reguły

1. `CraftModel` jest źródłem prawdy edytora.
2. `CompiledCraft` jest jedynym zweryfikowanym wejściem lotu.
3. Meshe, body, shapes i DOM nie trafiają do blueprintu.
4. Core ma specjalną rolę, nie specjalną pozycję.
5. Edytor dopuszcza pusty, bez-Core i rozłączony WIP.
6. Start wymaga dokładnie jednego Core i jednej połączonej wyspy.
7. Zmiany wieloblokowe są atomowe.
8. Każda wersja zapisu ma migrację.
9. Nie podnosić limitu 480 części bez benchmarku i Collider Compilera.
10. `game.js` nie może omijać physics portu ani interpretować natywnego kontaktu Cannon.
11. Misja lądowania jest stanowa; event kolizji jest sygnałem pomocniczym.
12. UI i fizyka balonów korzystają z tej samej polityki.
13. Tłumienie balonów nie może używać docelowej wysokości.
14. Bindingi są preferencją użytkownika, nie częścią blueprintu.
15. Mapowanie klawiszy nie może ponownie zostać rozproszone po `game.js`; źródłem jest `foundation.input-profile`.
16. Po etapie dostarczać ZIP źródeł, single HTML, raport i testy.

## 4. Platforma

Runtime docelowy to **desktop keyboard + mouse**.

- telefon i touch-only są poza zakresem;
- nie przywracać mobilnego topbara ani ekranowych przycisków sześciu osi;
- touchpad laptopa działa jako pointer/scroll;
- gamepad/handheld wymaga osobnej warstwy profilu i UX.

## 5. Sterowanie i bindingi

Domyślny profil:

- W/S — surge +/−;
- Z/C — sway −/+;
- Space/Left Ctrl — lift +/−;
- ↑/↓ — pitch;
- A/D lub ←/→ — yaw;
- Q/E — roll;
- ,/. — Balloon power −/+2%.

Profil wejścia v2 przechowuje do dwóch kodów fizycznych na akcję. Starsze profile bez sekcji `bindings` migrują do bieżących defaultów. Przypisanie zajętego klawisza przenosi go do nowej akcji, zamiast tworzyć niejednoznaczność.

`Left Ctrl` pozostaje świadomym defaultem użytkownika. W zwykłym trybie przeglądarki nie można zagwarantować kombinacji typu `Ctrl+W`. **Flight Focus** używa JavaScript fullscreen + Keyboard Lock, aby Chromium przekazało aktualne kody gry przed obsługą skrótów przeglądarki. Funkcja jest opcjonalna, zależna od wsparcia, bezpiecznego kontekstu i zgody użytkownika. Zawsze pozostaje możliwość rebindingu.

## 6. Aerostatyka

- lift maleje z wysokością;
- UI pokazuje próg zawisu i wysokość równowagi;
- `setBalloonPower()` jest jedyną ścieżką zmiany mocy;
- `verticalDampingForce()` przeciwdziała prędkości pionowej;
- efekt skaluje się z aktywnym liftem i jest ograniczony;
- przy wyłączonych balonach efekt znika.

## 7. Najbliższy etap

**Foundation Phase 1D.3 — Runtime Body Builder & Headless Physics Harness**

1. builder `CompiledCraft -> runtime body`;
2. stabilne `blockKey -> collider/runtime part`;
3. headless free fall, hover, equilibrium, settling, offset thrust, COM, detach i soak;
4. benchmark 100/500/1000/2500 colliderów;
5. Collider Compiler dopiero po pomiarach.

## 8. Dalszy plan wejścia

Po 1D.3, bez blokowania fizyki:

- import/export profilu sterowania;
- preset browser-safe oraz gamepad;
- lepszy ekran konfliktów i wyszukiwanie nieprzypisanych akcji;
- ewentualny Pointer Lock/Flight Focus jako spójny tryb immersyjny.

## 9. Świadomy dług

- duży `game.js`;
- jeden collider na voxel;
- limit 480 części;
- część natywnych wektorów Cannon w runtime;
- biblioteki z CDN;
- brak pełnego automatycznego testu WebGL/GPU;
- Keyboard Lock wymaga manualnej walidacji w docelowym Chrome/Brave.
