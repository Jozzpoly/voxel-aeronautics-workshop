# Mobile Compatibility Validation Handoff — 2026-07-10

## 0. Cel tego handoffu

Twoim zadaniem nie jest dalsze dokładanie funkcji mobilnych. Twoim zadaniem jest **zwalidować, uporządkować i skonwergować wszystkie zmiany dotyczące kompatybilności mobilnej**, tak aby stan repozytorium odpowiadał temu, co faktycznie działa na prawdziwym telefonie.

Najważniejszy aktualny dowód użytkownika:

- jednoplikowy Offline Hotfix V2 uruchamia się na Androidzie z lokalnego URI `content://downloads/...`;
- da się budować;
- da się uruchomić pojazd i wstępnie sterować dwoma padami;
- wiele elementów nadal działa źle albo jest niedostępnych;
- wcześniejszy jednoplikowy release nie uruchamiał się, ponieważ próbował pobierać `src/game/visual-renderer-profiles.js` przez `XMLHttpRequest` z `content://...`.

Nie traktuj samego zielonego CI jako wystarczającego dowodu kompatybilności mobilnej. Dotychczasowe CI uruchamiało głównie wersję serwowaną przez HTTP, a realny błąd pojawił się dopiero przy lokalnym pliku Android `content://`.

---

## 1. Repozytorium, branche i PR-y

Repozytorium:

`https://github.com/Jozzpoly/voxel-aeronautics-workshop`

Bazowa linia projektu:

- `main` — główna gałąź repozytorium;
- `VAW_GRoK` — aktualna baza/transport dla pracy nad VAW;
- `mobile/playable-mvp` — aktywny branch produktu mobilnego;
- draft PR `#5`: `mobile/playable-mvp -> VAW_GRoK`.

Branch tego handoffu:

- `mobile/compatibility-validation` — utworzony z aktualnego `mobile/playable-mvp` wyłącznie dla audytu i walidacji kompatybilności.

Historyczny branch:

- `mobile/touch-foundation`, draft PR `#4` — eksperymentalny fundament i porzucony kierunek przemapowywania desktopowego Workbencha. Nie rozwijaj go.

Otwarty branch pomocniczy:

- `automation/mobile-flight-smoke`, PR `#7` — nadal istnieje i jest dokładnie jeden commit przed `mobile/playable-mvp`; zawiera rozszerzenie `tests/run_mobile_browser_smoke.mjs` o natywne sterowanie lotem. **Nie usuwaj przed świadomym review/merge albo jawnym odrzuceniem.**

Branchy automatyzacji z PR `#6` i `#8` zostały już usunięte z repozytorium. Historyczne branche PR `#1`, `#2` i `#3` również nie istnieją już jako refs.

---

## 2. Obowiązkowa kolejność czytania

Przed zmianą kodu przeczytaj dokładnie, w tej kolejności:

1. `AI_PROJECT_MEMORY.md`
2. `docs/MOBILE_COMPATIBILITY_VALIDATION_HANDOFF_2026-07-10.md`
3. `docs/MOBILE_PLAYABLE_MVP_CHECKPOINT_2026-07-10.md`
4. `docs/MOBILE_CAMERA_FOUNDATION_VALIDATION_2026-07-10.md`
5. `package.json`
6. `tools/build_release.py`
7. `tools/verify_release.py`
8. `tests/test_release_build.py`
9. `index.html`
10. `src/foundation/bootstrap.js`
11. wszystkie `src/game/mobile-*.js`
12. `src/game/camera_controller.js`
13. `src/game.js` — tylko jako composition root i istniejące autorytety gry
14. `tests/run_mobile_browser_smoke.mjs`
15. `tests/run_all.py`
16. `.github/workflows/mobile-playable-mvp-validation.yml`
17. `.github/workflows/mobile-touch-validation.yml`
18. otwarty PR `#7` i jego dokładny diff.

Kolejność autorytetu:

1. aktualny kod;
2. aktualne wykonywalne testy;
3. dowód z prawdziwego telefonu;
4. ten handoff i najnowszy checkpoint;
5. `AI_PROJECT_MEMORY.md`;
6. starsze plany i historyczne dokumenty.

Nie zakładaj, że starszy dokument opisuje aktualny stan.

---

## 3. Krytyczny stan repozytorium w chwili handoffu

### 3.1 Aktywny produkt mobilny

`mobile/playable-mvp` zawiera:

- adaptacyjny profil urządzenia;
- mobilny runtime shell;
- pointer ownership;
- Pointer Events adapter;
- orbit jednym palcem;
- pan/pinch dwoma palcami;
- transportowy `game.mobile-command-port`;
- `game.mobile-game-command-adapter` delegujący do istniejących autorytetów;
- dedykowany `game.mobile-playable-shell`;
- `game.mobile-flight-controls` z dwoma stickami i przyciskami LIFT/ROLL;
- focused mobile browser smoke;
- pełny release builder i verifier.

### 3.2 Rzeczywiście zwalidowany build loop

Poprzedni checkpoint potwierdził na Chromium mobile emulation:

- wybór Wing;
- PLACE;
- REMOVE;
- wybór i PLACE Core;
- LAUNCH;
- RETURN TO WORKSHOP;
- orbit;
- pinch;
- brak błędów konsoli.

To był test wersji serwowanej przez HTTP, nie lokalnego `content://`.

### 3.3 Rzeczywiście potwierdzone na telefonie

Użytkownik potwierdził na prawdziwym Androidzie:

- Offline Hotfix V2 otwiera się;
- budowanie działa;
- można latać;
- pady sterowania wstępnie działają;
- sporo funkcji nadal działa źle albo nie ma do nich dostępu.

Nie dopowiadaj, które funkcje są uszkodzone. Najpierw przygotuj checklistę i zbierz precyzyjne obserwacje z urządzenia.

### 3.4 Bardzo ważna rozbieżność źródło ↔ działający artefakt

Działający Offline Hotfix V2 został przygotowany jako artefakt w rozmowie, ale **aktualny branch nie ma jeszcze potwierdzonej konwergencji oficjalnego buildera do identycznego działającego wyniku**.

Pierwotna awaria:

- `src/game/visual-renderer-profiles.js` nie znajdował się w `EMBEDDED_APPLICATION_SOURCES`;
- `scene_environment`, diagnostyka wizualna albo `game.js` próbowały awaryjnie pobierać go przez synchroniczny XHR;
- Android otwierał HTML pod `content://downloads/...` i próbował pobrać `content://.../src/game/visual-renderer-profiles.js`;
- to kończyło startup błędem.

Drugi wykryty problem:

- dostęp do `window.localStorage` może rzucać `SecurityError` dla dokumentu lokalnego/no-origin;
- mobile runtime shell odczytywał storage podczas startu;
- Hotfix V2 używa bezpiecznego fallbacku pamięciowego.

Na `mobile/playable-mvp` są obecnie jednorazowe pliki przygotowujące oficjalną poprawkę:

- `tools/apply_single_file_offline_fix.py`
- `tests/test_single_file_offline_contract.py`
- `.github/workflows/apply-single-file-offline-fix.yml`

Nie zakładaj, że workflow zakończył się sukcesem ani że source fix został już zastosowany. Sprawdź aktualny HEAD, workflow runy, artifacts i diff.

---

## 4. Architektura, której nie wolno złamać

### Źródła prawdy gry

- `CraftModel` jest jedynym źródłem prawdy warsztatu.
- `CraftCompiler` jest jedyną zwalidowaną ścieżką do runtime data.
- Blueprint v12, CompiledCraft V5, RuntimeAssemblyPlan V3 pozostają bez zmian.
- `AssemblyBuilder` jest granicą alokacji runtime.
- Physics Port pozostaje backend-neutralny.

### Granice mobilne

- mobilne moduły nie mogą bezpośrednio mutować CraftModel, Blueprint, physics ani runtime assembly;
- PLACE/REMOVE mają przechodzić przez `performBuildAction(0/2)`;
- wybór części przez `setSelectedTool`;
- obrót/orientacja przez istniejące autorytety;
- LAUNCH/RETURN przez `setMode`;
- flight input przez istniejące nazwane `setControlAction`;
- nie używaj syntetycznych zdarzeń myszy lub klawiatury;
- nie duplikuj kamery;
- nie zapisuj stanu mobilnego do Blueprintu;
- nie dodawaj ukrytych globali `window.VAW_*` bez jawnego kontraktu;
- nie podnoś limitu rozmiaru `game.js`; wyciągaj logikę do małych modułów.

### UI produktu

- dedykowany mobilny shell jest właściwym kierunkiem;
- nie wracaj do przemapowywania całego desktopowego Workbencha w bottom sheets;
- desktopowy `#ui-layer` może być ukryty w prezentacji mobilnej, ale jego gameplayowe autorytety pozostają używane przez command adapter;
- `mobile-playable-shell.js` nie powinien przejąć stanu joysticków;
- `mobile-flight-controls.js` pozostaje osobnym modułem.

---

## 5. Pierwsze zadania — wykonaj dokładnie w tej kolejności

### Etap A — zamrożenie i inwentaryzacja

1. Pobierz aktualny `mobile/playable-mvp` i zapisz HEAD SHA.
2. Sprawdź PR `#5`, `#7` oraz wszystkie aktywne workflow runy.
3. Sprawdź, czy `automation/mobile-flight-smoke` nadal jest jeden commit przed aktywnym branchem.
4. Porównaj dokładnie working artifact Hotfix V2 z wynikiem oficjalnego `tools/build_release.py`.
5. Zapisz listę tymczasowych workflow/skryptów w aktywnym branchu.
6. Nie usuwaj niczego przed zebraniem diffu i dowodów.

### Etap B — konwergencja offline single-file

Oficjalny builder musi odtworzyć plik działający pod Android `content://`.

Wymagania:

- `visual-renderer-profiles.js` jest jawnie w `EMBEDDED_APPLICATION_SOURCES`;
- jest wykonywany przed `scene_environment.js`, `visual-parity-diagnostic.js` i `game.js`;
- moduł sam rejestruje `game.visual-renderer-profiles` w browserze;
- single-file nie wykonuje XHR ani fetch do `src/**`;
- single-file nie ma zewnętrznych `<script src>` ani `<link rel="stylesheet" href>`;
- brak dostępu do `localStorage` nie zatrzymuje startu;
- fallback storage nie udaje trwałego zapisu — ma być jawnie tylko pamięciowy;
- builder, verifier, manifest i test release używają tej samej listy źródeł;
- `SOURCE_MANIFEST.json` i `tailwind.generated.css` są regenerowane wyłącznie oficjalnymi narzędziami;
- żadnych ręcznych poprawek generowanych plików.

Dodaj obowiązkowy test release bez originu. Sam test serwowany przez HTTP jest niewystarczający.

Rekomendowany test:

`tests/run_mobile_offline_release_smoke.mjs`

Powinien:

1. zbudować lub otworzyć wygenerowany HTML z `dist/`;
2. uruchomić go bez serwera lub w kontrolowanym no-origin sandboxie;
3. zarejestrować wszystkie żądania sieciowe;
4. zakończyć test błędem przy dowolnym request do `src/`, `vendor/`, CSS, assets wymaganych do startupu lub zewnętrznej domeny;
5. wymusić scenariusz, w którym getter `localStorage` rzuca;
6. potwierdzić `window.VAW`, `runtime.mobile-context`, command port, playable shell i flight controls;
7. potwierdzić brak fatal overlay z błędem library/XHR/storage;
8. oddzielić błąd środowiskowego WebGL od błędu startupu aplikacji;
9. zachować pełną diagnostykę JSON i screenshot.

### Etap C — rozstrzygnięcie PR #7

PR `#7` zawiera natywny browser smoke sterowania lotem i jest obecnie niezintegrowany.

- przeczytaj diff;
- uruchom jego test na aktualnym branchu;
- jeżeli nadal jest wartościowy i zgodny z aktualnym UI — zintegruj go świadomie;
- jeżeli został zastąpiony lepszym testem — zamknij PR z wyjaśnieniem i dopiero potem usuń branch;
- nie usuwaj branchu `automation/mobile-flight-smoke` przed tym rozstrzygnięciem.

### Etap D — audyt prawdziwego UX telefonu

Przygotuj tabelę kontroli i przejdź ją z użytkownikiem na prawdziwym urządzeniu.

#### Startup/offline

- otwarcie z Downloads przez `content://`;
- ponowne otwarcie po zamknięciu Chrome;
- start bez internetu;
- start z internetem;
- reload;
- powrót z backgroundu;
- obrót urządzenia w trakcie startupu.

#### BUILD

- wszystkie części widoczne i osiągalne w carouselu;
- przewijanie carouselu nie obraca kamery;
- PLACE nie uruchamia się po drag/orbit/pinch;
- REMOVE jest jawny i nie uruchamia się przypadkowo;
- ghost preview odpowiada tapowi;
- rotate left/right;
- undo/redo;
- przyciski nie nachodzą na safe area;
- możliwość postawienia Core i innych podstawowych części;
- feedback przy błędnym placement;
- dostępność akcji w portrait i landscape.

#### Kamera

- orbit jednym palcem;
- pinch zoom;
- pan dwoma palcami, jeżeli jest celowo wspierany;
- brak skoków po dodaniu/odjęciu palca;
- brak tap-to-place po ruchu;
- poprawne anulowanie przy utracie pointer capture;
- brak zablokowanej kamery po powrocie z backgroundu.

#### FLIGHT

- lewy stick: surge/sway;
- prawy stick: pitch/yaw;
- jednoczesna praca obu sticków;
- LIFT +/−;
- ROLL L/R;
- brak stuck input po zwolnieniu;
- brak stuck input po `pointercancel`;
- brak stuck input po zmianie orientacji;
- brak stuck input po zminimalizowaniu aplikacji;
- brak stuck input po RETURN TO WORKSHOP;
- RETURN i SAFE RESET zawsze dostępne;
- kontrolki nie zasłaniają całego pojazdu/HUD;
- ergonomia w portrait i landscape.

#### Dostępność i layout

- każda główna kontrolka minimum 44–48 CSS px;
- tekst nie jest obcięty przy systemowym skalowaniu fontu;
- safe-area top/bottom/left/right;
- brak horizontal page overflow;
- brak elementów poza viewportem bez możliwości przewinięcia;
- poprawny hit-test na wewnętrznych `<span>` przycisków;
- brak zależności od hover;
- czytelny aktywny tryb PLACE/REMOVE/FLIGHT.

#### Wydajność

- czas do pierwszej interakcji;
- FPS BUILD;
- FPS FLIGHT;
- maksymalny device pixel ratio;
- nagrzewanie po 5–10 minutach;
- pamięć po kilku cyklach BUILD ↔ FLIGHT;
- brak narastających listenerów po powrotach do warsztatu.

### Etap E — regresja desktopu

Po każdej poprawce mobilnej potwierdź:

- desktop mouse/keyboard nadal działa;
- desktop UI nie jest ukrywany na szerokim urządzeniu touch+mouse;
- `npm run browser:smoke` przechodzi;
- brak zmian w Blueprint/runtime semantics;
- source manifest i release parity pozostają świeże.

---

## 6. Obowiązkowe komendy walidacyjne

Uruchom co najmniej:

```bash
npm test
npm run validate:fast
npm run build
npm run verify-release
npm run browser:smoke
npm run browser:smoke:mobile
python tests/test_single_file_offline_contract.py
git diff --check
```

Po dodaniu offline smoke:

```bash
node tests/run_mobile_offline_release_smoke.mjs
```

W przypadku regeneracji CSS użyj dokładnie wersji Tailwind wymaganej przez repozytorium/checkpoint (`4.1.10`).

Nie uznawaj bramki za zieloną, jeżeli:

- test został pominięty;
- Chromium nie wystartował i test zakończył się `ENVIRONMENT`;
- release został zbudowany z nieświeżego manifestu;
- working tree zawiera nieudokumentowane wygenerowane zmiany;
- wynik działa tylko przez lokalny serwer HTTP;
- nie ma ręcznego dowodu z prawdziwego telefonu.

---

## 7. Workflow i hygiene

Na aktywnym branchu znajdują się lub mogą znajdować jednorazowe workflow/skrypty z wcześniejszych iteracji:

- `.github/workflows/apply-mobile-flight-smoke.yml`
- `.github/workflows/generate-mobile-flight-provenance.yml`
- `.github/workflows/apply-single-file-offline-fix.yml`
- `tools/apply_mobile_flight_smoke_patch.py`
- `tools/apply_single_file_offline_fix.py`

Są to narzędzia tymczasowe, nie docelowa infrastruktura projektu.

Po wykorzystaniu lub odrzuceniu:

- usuń je;
- pozostaw stałe workflow read-only;
- nie pozostawiaj `contents: write` w normalnej walidacji PR;
- nie force-pushuj aktywnego produktu;
- nie przepisuj historii;
- nie twórz kolejnych mikrobranchy automatyzacji bez realnej potrzeby.

---

## 8. Zasady pracy z generowanymi artefaktami

Nie edytuj ręcznie:

- `SOURCE_MANIFEST.json`;
- `tailwind.generated.css`;
- gotowego HTML release jako substytutu poprawki źródłowej.

Poprawka ma powstać w źródłach i builderze, a następnie oficjalny proces ma wygenerować identyczny działający artefakt.

Działający plik z rozmowy jest dowodem behawioralnym, nie źródłem prawdy.

---

## 9. Kryteria ukończenia zadania

Walidacja kompatybilności mobilnej jest zakończona dopiero, gdy wszystkie poniższe warunki są spełnione na jednym finalnym HEAD:

1. oficjalny builder generuje jednoplikowy release działający z Android `content://`;
2. brak requestów do `src/**`, vendorów, CSS i zewnętrznych domen podczas startupu single-file;
3. fallback przy niedostępnym `localStorage` jest zwalidowany;
4. pełny core suite jest zielony;
5. release build i verifier są zielone;
6. desktop browser smoke jest zielony;
7. served mobile smoke jest zielony;
8. offline/no-origin mobile smoke jest zielony;
9. natywny flight-control smoke jest rozstrzygnięty i zintegrowany albo jawnie zastąpiony;
10. realny Android potwierdza BUILD, camera, LAUNCH, flight pads, neutralizację i RETURN;
11. portrait i landscape są ręcznie sprawdzone;
12. wszystkie tymczasowe workflow/skrypty są usunięte;
13. PR #4 jest zamknięty jako historical/superseded;
14. PR #7 jest rozwiązany;
15. `AI_PROJECT_MEMORY.md` i końcowy raport są zaktualizowane;
16. dostarczony finalny HTML/ZIP ma SHA-256 i dokładny commit źródłowy.

---

## 10. Wymagane deliverables kolejnego agenta

Przygotuj:

1. `docs/MOBILE_COMPATIBILITY_VALIDATION_REPORT_2026-07-XX.md`
2. zaktualizowany `AI_PROJECT_MEMORY.md`
3. tabelę urządzeń i scenariuszy;
4. listę wykrytych problemów z severity, reproduction, expected/actual i właścicielem warstwy;
5. dokładny diff branch cleanup;
6. dowody CI z run IDs;
7. dowód prawdziwego telefonu;
8. finalny single-file HTML i ZIP;
9. SHA-256 obu artefaktów;
10. jednoznaczny werdykt: `PASS`, `PASS WITH KNOWN LIMITATIONS` albo `FAIL`.

Nie pisz „mobile działa”, jeżeli działa tylko build loop, ale część kontrolek jest niedostępna. Nie pisz „offline działa”, jeżeli test używa lokalnego serwera HTTP.

---

## 11. Krótki prompt startowy dla agenta

> Pracujesz nad repozytorium `https://github.com/Jozzpoly/voxel-aeronautics-workshop`. Bazą produktu mobilnego jest `mobile/playable-mvp`, a branch audytu to `mobile/compatibility-validation`. Najpierw przeczytaj `AI_PROJECT_MEMORY.md`, ten handoff, najnowszy mobile checkpoint, kod i testy. Twoim zadaniem jest zwalidować i skonwergować całą kompatybilność mobilną, ze szczególnym naciskiem na jednoplikowy release uruchamiany z Android `content://`, realne multi-touch flight controls, dostępność wszystkich elementów UI, lifecycle/cancel, portrait/landscape i regresję desktopu. Nie rozwijaj nowych funkcji przed zamknięciem rozbieżności source ↔ working Hotfix V2. Nie edytuj ręcznie generowanych artefaktów. Kod i najnowsze testy mają pierwszeństwo przed starszą dokumentacją.
