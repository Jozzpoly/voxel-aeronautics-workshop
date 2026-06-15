# AI PROJECT MEMORY — Voxel Aeronautics Workshop

> Obowiązkowy punkt wejścia. Najpierw przeczytaj ten plik, następnie `ARCHITECTURE.md`, `VALIDATION_REPORT.md`, `DELIVERY_WORKFLOW.md` i testy.

## 1. Wizja

Główna fantazja: **buduję, programuję, testuję i latam własnym voxelowym statkiem powietrznym**. Kontrakty i progresja są warstwą pomocniczą.

## 2. Aktualny milestone

**Foundation Phase 1D.2E — Guided Vertical Power Controls**

Ukończone fundamenty:

- pusty warsztat i dowolny pierwszy blok;
- ruchomy, usuwalny i orientowany Command Core;
- blueprint v9 oraz `CompiledCraft.controlFrame`;
- sześć semantycznych osi;
- input profile v3 z trwałymi bindingami;
- desktop workspace v3;
- physics lifecycle/contact boundary;
- state-based, multi-zone landing;
- wspólna aerostatyka UI/fizyka;
- ograniczone tłumienie pionowe balonów;
- prowadzone kontrolki Balloon power i Passive vertical thrust;
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
16. Pasywny ciąg jest trimem, a nie limitem autorytetu pilota.
17. Balloon power oraz Passive vertical thrust mają po jednym centralnym setterze i wspólny model guidance.
18. Każda dostawa plików musi zawierać ZIP źródeł, single HTML, raport, walidację, sumy kontrolne oraz dokładną instrukcję aktualizacji repozytorium.
19. Nigdy nie zalecać `git push --force` jako zwykłego sposobu publikacji wydania.

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
- −/+ — Passive vertical thrust −/+2%;
- ,/. — Balloon power −/+2%.

Profil wejścia v3 przechowuje do dwóch fizycznych kodów na każdą akcję, w tym oba regulatory mocy. Profile v1–v2 migrują do bieżącego schematu. Nowe defaulty są dodawane tylko wtedy, gdy nie zabierają klawisza już zajętego przez użytkownika. Przypisanie zajętego klawisza przenosi go do nowej akcji zamiast tworzyć niejednoznaczność.

`Left Ctrl` pozostaje świadomym defaultem użytkownika. W zwykłym trybie przeglądarki nie można zagwarantować kombinacji typu `Ctrl+W`. **Flight Focus** używa JavaScript fullscreen + Keyboard Lock, aby Chromium przekazało aktualne kody gry przed obsługą wspieranych skrótów przeglądarki. Zawsze pozostaje rebinding.

## 6. Pionowe źródła siły

- lift balonów maleje z wysokością;
- oba suwaki pokazują aktualny próg statycznego zawisu;
- Balloon power pokazuje także przybliżoną wysokość równowagi;
- `setBalloonPower()` i `setThrusterPower()` są jedynymi ścieżkami zmiany swoich stanów;
- suwak, hotkey, procent, marker i fizyka korzystają z tych samych wartości;
- `requiredSupplementalPowerForHover()` oblicza, ile pasywnego ciągu potrzeba po uwzględnieniu aktualnego liftu balonów;
- bezpośrednie wejście pilota zachowuje pełną moc niezależnie od ustawienia pasywnego ciągu;
- `verticalDampingForce()` ogranicza oscylację balonów bez autopilota wysokości.

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
- preset browser-safe, left-handed oraz gamepad;
- lepszy ekran konfliktów i wyszukiwanie nieprzypisanych akcji;
- opcjonalny Pointer Lock jako część Flight Focus.

## 9. Workflow dostaw

Pełne zasady znajdują się w `DELIVERY_WORKFLOW.md`. Każda odpowiedź przekazująca nowe pliki ma podawać:

- który ZIP jest źródłem prawdy;
- co rozpakować i gdzie skopiować;
- jak zsynchronizować `main` przed zmianą;
- jakie testy uruchomić;
- proponowaną wiadomość commita;
- bezpieczne komendy `fetch`, `rebase` i `push origin HEAD:main`;
- procedurę konfliktu i zakaz force-pusha.

## 10. Świadomy dług

- duży `game.js`;
- jeden collider na voxel;
- limit 480 części;
- część natywnych wektorów Cannon w runtime;
- biblioteki z CDN;
- brak pełnego automatycznego testu WebGL/GPU;
- Keyboard Lock wymaga manualnej walidacji w docelowym Chrome/Brave.
