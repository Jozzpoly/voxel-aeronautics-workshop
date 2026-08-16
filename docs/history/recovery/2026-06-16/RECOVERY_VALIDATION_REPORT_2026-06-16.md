# VAW Recovery Validation Report — 2026-06-16

## Scope and verified repository state

This recovery stayed inside the requested scope: repository audit, recovery attempt, three regression repairs, regression tests, browser scenario, release build and delivery validation. Gate C, assembly spaces, Device/Port Schema, ControlRuntime, blueprint format changes and unrelated redesigns were not started.

- Repository: `Jozzpoly/voxel-aeronautics-workshop`
- Verified baseline `main`: `f6082e84d3a352cea47a8e43d2260ae4d4226715`
- Recovery branch: `recovery/2026-06-16-regression-repair`
- Lost commit prefix `1b42ef6`: not present on GitHub and not recoverable without the former local object database
- Focus repair: `ec8fbcb3e8a4fdad35c916f52bf0650f73218845`
- Articulated thruster repair: `07b557f25231944ce9d91c8e9037462ef8324e69`
- Runtime hinge visual repair: `15339fab3c44091415b8d414c629abbdac0825e4`
- Browser regression scenario: `362d16a6600cd68a1b2a47860a64e73e989ed619`
- Temporary browser staging cleanup: `a2849bdce1eee8f62a615bd7e4b6117d5a7c1af6`

The final documentation/release commit is the head of the recovery branch reported in the delivery response; a commit cannot truthfully embed its own SHA.

## Baseline validation

The untouched remote baseline was validated through GitHub Actions run `27648057276`, job `81764904872`, artifact `7679596669`.

Environment:

- Python `3.13.13`
- Node.js `22.22.3`

All baseline commands exited `0`:

```bash
python -m compileall .
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

The existing baseline passed, demonstrating that the reported failures were gaps in regression coverage rather than failures detected by the old suite.

## Regression 1 — editable focus and hotkey routing

Implemented one editable-interaction policy based on the event target and current `document.activeElement`. It treats `input`, `textarea`, `select` and `contenteditable` as editable interactions without permanently locking gameplay after transient UI use.

Verified behavior includes:

- `F` is blocked while editing text;
- `F` works after leaving the editor;
- hinge-axis selection and mechanical-link selection do not leave a permanent keyboard lock;
- clicking the canvas restores control;
- binding capture keeps priority;
- Escape follows modal/panel priority;
- keyup clears the corresponding action even after focus changes;
- window blur clears active flight actions;
- ordinary buttons are not treated as persistent editors.

Coverage: `tests/test_input_focus_policy.js`, architecture checks and startup smoke interactions.

## Regression 2 — thrusters on articulated sub-bodies

The root cause was upstream of force application: functional parts were marked `pilotControlled` only when their `bodyId` equaled `primaryBodyId`, so sub-body thrusters were skipped before the already body-aware force conversion path.

`FlightThrusterRouter` now:

- requires explicit runtime-part `bodyId` ownership;
- remaps pilot intent primary-local -> world -> owning-body-local;
- computes world axis and world application point from the owning body's current transform;
- applies force only to the owning body;
- never silently redirects missing ownership to root;
- preserves manual input as first-class and composes passive vertical thrust as a base command rather than a cap;
- keeps `lastCommand`/flame state tied to the real command.

Coverage: `tests/test_flight_thruster_routing.js`, `tests/test_flight_control.js`, real Cannon tests, articulated Gate B tests and Chromium.

## Regression 3 — runtime hinge/mechanical-link visuals

`FlightMechanicalVisuals` now owns FLIGHT-only mechanical-link presentation. It creates visuals from live runtime constraints, computes pivot A and pivot B from their respective current body transforms during every synchronization, and registers disposal with the `FlightSession` transient lifecycle.

Verified behavior includes:

- one visual for each active constraint;
- each endpoint comes from the correct body;
- body translation and rotation update the corresponding endpoint;
- removed constraints remove visuals;
- stop/start does not duplicate visuals;
- partial failure cleanup is idempotent;
- visuals do not depend on a root visual object;
- missing body/pivot is a controlled error.

Coverage: `tests/test_flight_mechanical_visuals.js`, architecture checks, startup smoke and Chromium.

## Final automated suite

The final local suite executes 77 subprocess commands:

- 43 application-source `node --check` commands;
- 34 focused/runtime/architecture/release/startup commands.

Result: all commands passed. Important coverage includes:

- 12,000-step real Cannon soak;
- multi-body RuntimeAssembly and AssemblyBuilder;
- FlightSession lifecycle and cleanup;
- Gate B compiler/gameplay path;
- the three new regression suites;
- architecture contract: 14 game modules, `src/game.js` at 2499/2500 lines;
- startup smoke: 577 synthetic DOM elements, 40 registered modules, 43 application sources;
- deterministic release rebuild and source parity.

Recorded final command sequence:

| Command | Start (UTC) | End (UTC) | Exit |
|---|---|---|---:|
| `python -m compileall .` | 2026-06-16 22:14:50 | 2026-06-16 22:14:51 | 0 |
| `python -u tests/run_all.py` | 2026-06-16 22:14:51 | 2026-06-16 22:15:13 | 0 |
| `python tools/build_release.py` | 2026-06-16 22:15:24 | 2026-06-16 22:15:26 | 0 |
| `python tools/verify_release.py` | 2026-06-16 22:15:26 | 2026-06-16 22:15:27 | 0 |

`git diff --check` passed before each remote repair checkpoint and is repeated after the final documentation/release build.

## Real Chromium scenario

Command:

```bash
python tools/build_release.py
node tests/run_browser_recovery.mjs
```

Result: **PASS** for modular source and freshly generated single-file distribution. Final standalone run: 2026-06-16 22:15:58–22:16:07 UTC, exit `0`.

Environment and constraints:

- Chromium `144.0.7559.96` under Xvfb/CDP;
- real pinned Cannon.js `0.6.2`;
- real DOM, input events, application modules, compiler, RuntimeAssembly and physics backend;
- deterministic Three-compatible adapter because the validation container cannot access the pinned CDN; visual endpoint correctness is therefore asserted numerically in Chromium rather than inferred only from pixels;
- the validation container initially blocked localhost browser navigation; the bounded test harness used an isolated test profile and verified that the environment was restored afterward;
- no Chromium, Xvfb or server processes remained after cleanup.

Identical source/dist measurements:

- articulated thruster owner: `body:recovery:arm`;
- manual `lastCommand`: `0.9999976660110953`;
- sub-body movement: `0.050623968418421796`;
- hinge endpoint B movement: `0.050647152059690045`;
- endpoint A synchronization error: `0`;
- endpoint B synchronization error: `0`;
- visuals after stop: `0`;
- visuals after relaunch: `1`;
- page console/runtime errors: `0`.

Evidence is generated outside the release source tree under `recovery-artifacts/browser/` and delivered as a separate evidence archive so screenshots do not inflate the production release ZIP.

## Interrupted wrapper disclosure

One combined outer validation wrapper reached successful compileall, full suite, build and verify, then the execution tool stopped the wrapper while Chromium was starting. Recovery cleanup explicitly terminated every child process, deleted the temporary browser profile and verified restoration of the browser environment. Chromium was then run independently through its own bounded lifecycle and passed source and distribution. The interrupted wrapper is not counted as a browser pass; only the subsequent complete standalone run is counted.

## Release verification

The final release build verifies:

- `APP_VERSION`: `0.7.0-foundation.1d4a`;
- `RELEASE_ID`: `foundation-1d4a-rigid-islands-mechanical-graph`;
- modular source build starts;
- single-file distribution starts in Chromium;
- source manifest and embedded source parity pass;
- deterministic rebuild passes;
- no local absolute paths, recovery browser profiles or debug logs are included;
- browser screenshots are excluded from the production project/release and delivered separately;
- clean release ZIP size after exclusion: approximately `0.56 MB`;
- final manifest: 48 files and 43 embedded application sources.

## Known limitations

1. `1b42ef6` could not be recovered because it was never found on GitHub and the previous local `.git` object database was not available.
2. Chromium rendering used a deterministic Three-compatible adapter because external CDN access was blocked. The actual UI lifecycle, input routing, compiler/runtime and real Cannon physics ran in Chromium; WebGL pixel fidelity itself was not the subject of this regression repair.
3. The recovery branch is intentionally not merged into `main`. The user can review the draft PR and fast-forward/merge only after accepting this delivery.
