# Validation Report — Foundation Phase 1D.4A

## Product path validated

```text
Blueprint v11
-> CraftModel
-> CraftCompiler V4
-> RuntimeAssemblyPlan V2
-> FlightSession
-> AssemblyBuilder
-> Physics Port
-> real Cannon hinge
```

The evidence does not manually construct topology. The startup harness imports `examples/articulated_hinge_v11.json` through the browser file-input path, verifies the workshop hinge projection and starts the craft with the normal Flight action.

## Safety validation

- Backend allocation is preceded by structured topology and plan validation.
- Endpoint failure removes the constraint before collider/body mutation.
- Connected-body recenter is rejected before local/world frame mutation.
- Collision queue preserves `bodyId`; nearest-part and payload checks are owner-filtered.
- Damage propagation traverses `rigidNeighborBlockIds` only.
- Root camera, mission and pilot-control policy is deterministic and not Map-order dependent.
- Stop/retry removes constraints, listeners/colliders, bodies and visual roots in owned order.
- Fifty articulated lifecycle cycles leave zero orphan bodies and zero orphan constraints.

## Primary worktree validation

Executed successfully:

```bash
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

- full runner: PASS, `34.91 s`, maximum RSS `312520 KB`;
- deterministic release build: PASS;
- release verification/source parity: PASS;
- release identity/documentation contract: PASS;
- startup single-body and articulated UI lifecycles: PASS.

An earlier full-run attempt reached `tests/test_release_build.py` but was terminated by the host's 180-second wrapper limit. It was not counted. The missing stage passed independently, then the complete worktree runner was repeated successfully from the beginning.

## Extracted source-ZIP validation

The generated source ZIP was unpacked into a new directory. A new Git worktree was initialized with intent-to-add entries so `git diff --check` inspected the extracted files rather than pretending Git metadata existed in the archive.

Executed successfully:

```bash
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

- extracted full runner: PASS, `34.61 s`, maximum RSS `311328 KB`;
- extracted deterministic rebuild: PASS;
- extracted release verification/source parity: PASS;
- articulated example import and normal Flight-button launch: PASS.

## Patch validation

The patch was generated against exact clean local baseline commit:

```text
9cca3be1b39d6276e2db8e99f847a19f10560dab
```

A fresh clone of that commit accepted both `git apply --check` and `git apply`; `git diff --check` then passed. The patch-applied tree passed every runner stage through the documentation contract. The combined host wrapper again stopped while entering the deterministic release-build stage, so the remaining required stages were executed explicitly in the same order and all returned exit code 0:

```text
tests/test_release_build.py       PASS
startup_smoke.js                  PASS
build_release.py                  PASS
verify_release.py                 PASS
git diff --check                  PASS
```

No test is marked as passed merely because a wrapper started it.

## Source parity and deterministic rebuild

Ignoring only generated/environment directories (`.git`, `dist`, `release`, caches and `node_modules`), the worktree, extracted ZIP tree and patch-applied tree contained the same 169 source/delivery files and produced the same deterministic tree hash during validation.

The final build additionally verifies:

- manifest hashes;
- 41 embedded application sources;
- single-file source parity;
- source-ZIP parity;
- packaged single-file parity;
- byte-identical deterministic rebuilds.

## Unrun tests and publication

No required test was left unexecuted. The only limitation was the host wrapper timeout described above; the interrupted stages were rerun explicitly and passed. No Git push, force-push or remote mutation was performed.
