# Foundation Hardening M3B Polish Handoff

Status: Active handoff for the next foundation-hardening continuation
Date: 2026-06-29
Branch: `current_work`
Base before M3B implementation: `4dcebda0df4719e378dcfbc6c647d7018d637815`

## Purpose

M3B polishes already-published M2B/M2C/M3A work. It does not start gameplay, Gate D, save schema, compiler, physics, Blueprint, CraftModel, release cleanup or visual asset manager work.

The durable goal is a safer continuation workflow:

- `src/game.js` remains the final composition entrypoint.
- Browser smoke is target-platform evidence, not a default core gate.
- Browser smoke must report `PASS`, `ENVIRONMENT` or `PRODUCT` with a concrete `stage`.
- `PRODUCT` means real UI/runtime behavior needs fixing before claiming readiness.
- `ENVIRONMENT` means missing or unusable browser/CDP/localhost capability and must not be treated as PASS.

## What M3B Changes

- Tightens `tests/test_game_architecture.py` guards after M2C:
  - `game.js` line limit: 2400.
  - `game.js` byte limit: 116000.
- Extends direct seam tests:
  - `tests/test_power_control_readouts.js` covers missing DOM nodes, cached build analysis, no-craft guidance and dependency validation.
  - `tests/test_visual_asset_composition.js` covers sparse logger fallback, missing document/window and no long-lived BroadcastChannel after dispose.
- Polishes `tests/run_browser_smoke.mjs`:
  - keeps the public entrypoint as `npm run browser:smoke`;
  - adds `stage`, `diagnostics`, browser log excerpt and stable PASS/ENVIRONMENT/PRODUCT JSON;
  - enters the normal help-modal start path before panel hit-testing;
  - handles favicon noise in the local static server;
  - uses Chrome/Edge CDP flags similar to the recovery runner without modifying `tests/run_browser_recovery.mjs`.

## Evidence To Reproduce

Run from repo root:

```text
git status --short --branch
git rev-parse HEAD origin/current_work origin/main
git diff -- SOURCE_MANIFEST.json
node --check tests/run_browser_smoke.mjs
node tests/test_visual_asset_composition.js
node tests/test_power_control_readouts.js
node tools/run_with_python_env.js python tests/test_game_architecture.py
node tools/run_with_python_env.js python tests/test_documentation_contract.py
npm.cmd run browser:smoke
npm.cmd run test
node tools/run_with_python_env.js python tools/validate_fast.py
node tools/run_with_python_env.js python tools/validate_full.py
git diff --check
```

Expected local browser smoke on this Windows/Chrome checkout:

```text
status: PASS
stage: complete
starterBlocks: 17
flightFocusButtons: 2
flightMode: true
consoleErrors: 0
```

If another environment reports `ENVIRONMENT`, keep the exact `stage`, `reason`, browser path and CDP diagnostics in the final report. Do not convert it into PASS. If it reports `PRODUCT`, stop and fix or split a new plan.

## Known Harness History

M3A originally stopped at `Page.enable timed out` in this local checkout. M3B added stabilizing browser flags and stage diagnostics, then exposed two harness issues:

- The initial help modal was still visible, so contract hit-testing was blocked by `.modal-content`. The smoke now clicks `#start-engineering` through the normal user path before panel checks.
- Chrome requested `/favicon.ico`; the local static server returned 404 and surfaced a network console error. The smoke server now returns 204 for that request.

These were harness issues. Do not change UI layout or product behavior just to satisfy a smoke runner unless the new report is classified as `PRODUCT` with clear evidence.

## Next Work Order

1. Finish M3B validation and push `current_work`.
2. Read back `HEAD == origin/current_work` and record the final SHA.
3. For the next milestone, choose exactly one:
   - M4 visual authoring proof across current Catalog block types, renderer-only.
   - One additional low-risk `src/game.js` extraction with tests.
   - CI placement for browser smoke as optional target-platform evidence.

Do not combine M4, more extraction and CI policy changes in one checkpoint.

## Non-Goals

- No gameplay or physics semantic changes.
- No Blueprint, CraftModel, compiler output or save schema changes.
- No Gate D device/port schema work.
- No changes under `assets/visual_packs/local_working_visuals/**` without explicit owner request.
- No deletion or migration of `release/**`.
- No new browser automation dependency such as Playwright in M3B.
