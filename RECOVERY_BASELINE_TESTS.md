# VAW Recovery Baseline Tests — 2026-06-16

## Baseline identity

- Remote source branch: `recovery/2026-06-16-regression-repair`
- Branch head submitted for validation: `045d96ec34a52189704a289137100a9c1cd360d3`
- Baseline inherited from `main`: `f6082e84d3a352cea47a8e43d2260ae4d4226715`
- GitHub Actions run: `27648057276`
- Job: `81764904872` (`baseline`)
- Artifact: `7679596669`
- Artifact digest: `sha256:1b46913e284d65cc4b59b5d210eceac12791512e7eb8ba8a47a667e90092c8fa`

GitHub checked out the pull-request validation merge ref at `17009fe9cbb5169d76fcca022f3b25f32ba782fe`; the recovery branch itself remained at `045d96ec34a52189704a289137100a9c1cd360d3`. No merge into `main` occurred.

## Environment

- Runner: GitHub Actions `ubuntu-latest`
- Python: `3.13.13`
- Node.js: `22.22.3`

## Commands and results

All commands below completed with exit code `0`:

1. `python -m compileall .`
2. `python -u tests/run_all.py`
3. `python tools/build_release.py`
4. `python tools/verify_release.py`
5. `git diff --check`

The workflow recorded command output in the uploaded artifact. Exact per-command wall-clock timestamps were not emitted by the existing runner, so this report does not invent them.

## Test inventory and result

`tests/run_all.py` completed successfully and printed `All core tests passed.`

The runner executed:

- 41 JavaScript source syntax checks through `node --check`;
- 30 test commands/groups, including foundation, compiler, runtime assembly, AssemblyBuilder, FlightSession, integrity, real Cannon, Gate B gameplay, flight control, architecture, documentation, release determinism and browser startup smoke;
- 71 subprocess commands in total.

The startup smoke result was:

- 166 required DOM IDs;
- 567 synthetic DOM elements;
- 38 registered modules;
- 41 application source files;
- interaction scenario: passed;
- single-body lifecycle: passed;
- articulated UI lifecycle: passed.

## Release baseline

`tools/build_release.py` generated the Foundation Phase 1D.4A single-file HTML, full ZIP and SHA256 list.

`tools/verify_release.py` confirmed:

- release ID: `foundation-1d4a-rigid-islands-mechanical-graph`;
- app version: `0.7.0-foundation.1d4a`;
- 46 manifest files;
- 41 embedded application sources;
- source parity: passed.

`git diff --check` produced no output and passed.

## Baseline conclusion

The remotely delivered baseline builds and passes its existing suite. The three reported regressions are therefore coverage gaps rather than failures detected by the old suite:

1. global editable-focus and hotkey recovery policy;
2. manual thruster command delivery to articulated sub-bodies;
3. runtime hinge/mechanical-link visual synchronization.

Recovery work must add dedicated regression coverage before those areas can be considered repaired.
