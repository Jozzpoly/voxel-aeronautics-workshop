# Implementation report — Recovery Viewer First v0.4

## Co naprawiono

- Odbudowano viewer lifecycle: reset modelu nie kasuje pętli renderowania.
- Dodano `minimal_viewer.html` bez sidecara, walidatora i eksportu VAW.
- Zostawiono główny workflow `.gltf + .bin + tekstury` jako podstawowy.
- Dodano resolver zależności plików z obsługą:
  - relative paths;
  - Windows backslash;
  - encoded URI;
  - data URI;
  - folderów;
  - duplicate basename jako `ambiguous`, bez cichego zgadywania.
- Dodano custom camera controls:
  - MMB = obrót;
  - Shift+MMB = pan;
  - wheel = zoom;
  - F = fit;
  - R = reset;
  - LPM/PPM ignorowane przez kamerę.
- Dodano texture diagnostic:
  - lista `images`;
  - resolved path/status;
  - materiały i sloty tekstur;
  - runtime mesh/material/UV report;
  - checker override;
  - pixel texture mode;
  - diagnostic double-sided fallback.
- Rozdzielono statusy:
  - `viewer/import` mówi, czy model został załadowany i jest w scenie;
  - `VAW readiness` mówi, czy asset jest gotowy do eksportu paczki.

## Co zawiera paczka

- `index.html` — recovery Import Studio.
- `minimal_viewer.html` — nagi viewer proof.
- `src/file_bundle_resolver.js` — resolver `.gltf + dependencies`.
- `src/minimal_gltf_viewer.js` — viewer lifecycle, scene, camera, render loop.
- `src/viewport_controls.js` — MMB controls.
- `src/fit_camera.js` — bounding box i fit.
- `src/texture_report.js` — diagnostyka tekstur/materiałów/runtime meshów.
- `src/vaw_validator.js` — readiness validator oddzielony od preview.
- `src/package_exporter.js` — prosty ZIP store exporter.
- `tests/test_recovery_static.js` — testy statyczne i logiczne.
- `tools/validate_recovery_package.py` — walidacja paczki.
- `tools/serve.py` — lokalny serwer.

## Testy wykonane w tej paczce

Polecenie:

```bash
npm test
```

Sprawdza:

- składnię JS;
- wymagane pliki;
- resolver `.gltf + .bin + textures`;
- data URI;
- duplicate basename ambiguity;
- blob URL suffix fallback;
- texture report na sample glTF;
- klasyfikację MMB/LPM/PPM;
- oddzielenie VAW readiness od viewer import;
- brak powrotu starego wzorca `cancelAnimationFrame(state.animationFrame)`.

## Uczciwe ograniczenie testów

W sandboxie automatyczne testy nie są równoważne manualnemu testowi w normalnej przeglądarce na komputerze użytkownika. Dlatego paczka zawiera `USER_TESTING_GUIDE.md` i minimal viewer, żeby ręcznie potwierdzić realny rendering pikseli.
