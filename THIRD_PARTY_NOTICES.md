# Third-Party Notices

## Three.js r128 — vendored production and release runtime

The browser entry point, generated single-file release and source ZIP use the exact vendored `three@0.128.0` UMD build at:

- `vendor/three-r128/three.min.js`
- `vendor/three-r128/GLTFLoader.js`
- `vendor/three-r128/LICENSE`

Three.js is distributed under the MIT License. The exact runtime SHA-256 is checked by automated dependency-contract tests. The application has no network-loaded production dependency.

The repository also includes the Studio tool package under `tools/blockbench_import_studio/`. Its local preview pages vendor Three.js r128 and `GLTFLoader.js` for authoring/testing only; those files are recorded in release provenance but are not imported by the game runtime.

## Cannon.js 0.6.2 — vendored production and validation runtime

The production entry point, generated single-file release, automated real-backend parity harness and browser runtime harness use the canonical vendored copy at:

- `vendor/cannon-0.6.2/cannon.min.js`
- `vendor/cannon-0.6.2/LICENSE`

Cannon.js is distributed under the MIT License. The upstream copyright and complete license text are preserved beside the vendored runtime.

## Tailwind CSS 4.1.10 — build-time generator only

`tailwind.generated.css` is generated from the repository's HTML and JavaScript candidates by `tools/generate_tailwind_css.js`. The browser does not execute Tailwind or load it from a CDN. The generated file records the exact candidate SHA-256 and is checked without requiring Tailwind to be installed.

Tailwind CSS is distributed under the MIT License.
