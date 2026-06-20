# VAW Recovery Audit — 2026-06-16

## Scope

This report records the remotely verifiable state before any recovery code changes. No source code was edited before this checkpoint.

## Verified remote state

- Repository: `Jozzpoly/voxel-aeronautics-workshop` (private).
- Default branch: `main`.
- Remote `main`: `f6082e84d3a352cea47a8e43d2260ae4d4226715`.
- Commit message at that SHA: `Foundation 1D.3E: close assembly-centric Gate A`.
- The tree/diff at that SHA contains Foundation 1D.4A identity and documentation (`APP_VERSION 0.7.0-foundation.1d4a`, Blueprint v11, CompiledCraft V4, RuntimeAssemblyPlan V2). The mismatch between commit message and delivered tree is recorded as a historical naming inconsistency, not repaired during this recovery.
- Recovery branch created from the exact remote baseline: `recovery/2026-06-16-regression-repair`.

## Local working-copy state

The current execution environment was not given the previous agent's local clone. Direct unauthenticated `git clone` access is unavailable here, while authenticated repository access is provided through the GitHub connector.

Therefore the following previous-machine-only data cannot be inspected from this environment:

- previous local working tree and index;
- local-only branches;
- local stash entries;
- previous local reflog;
- untracked files, temporary directories and patches outside the repository;
- unreachable Git objects that were never pushed.

No reset, checkout or deletion of a previous working tree was performed. This recovery starts from the remotely verified state and writes only to the dedicated recovery branch.

## Search for lost commit `1b42ef6`

- GitHub commit lookup for `1b42ef6`: **not found** (`No commit found for SHA`).
- GitHub commit search does not expose a matching pushed commit.
- Because the former local object database is unavailable, an unpushed or unreachable local commit cannot be recovered here.

Decision: `1b42ef6` is **not recoverable from GitHub**. Its intended changes must be independently reviewed and reconstructed from requirements and the current source. If a copy of the old `.git` directory or working tree is later supplied, its objects can still be audited separately; this recovery does not depend on that possibility.

## Remotely visible commits dated 2026-06-16

Newest first:

- `f6082e84d3a352cea47a8e43d2260ae4d4226715`
- `60f9c0732d5ac959858d5ed9575265e2a4dc0767`
- `5cf38926623a17290ff2c6caad24d1c36fe77ad3`
- `68b7a4b90781823aecb52194e07aa963cbddd4db`
- `0c45ecf914e0ccd1eb487eb61ab2926b73dbbbce`
- `2b516db74ff2d1812579af95f1cfbffc4821d66b`
- `ba4cdcf83c85e495488cb7db33ef13bbe8533d8d`

## Suspect / recovery-target areas

Requirements and interrupted-session notes identify these areas for focused inspection only:

- global UI focus policy and game hotkey routing;
- recovery of keyboard control after `select`, mechanical-link list and other UI interactions;
- key release and window-blur action cleanup;
- functional-part body ownership and force routing for articulated sub-bodies;
- local-axis/world-axis and local-point/world-point conversion per owning body;
- passive vertical thrust composition with manual input;
- runtime hinge/mechanical-link visuals and their lifecycle;
- `src/game.js`, `src/game/flight_session.js`, `src/runtime/assembly_builder.js`, flight simulation and multi-body code;
- possible missing `src/game/flight_mechanical_visuals.js`.

No conclusion about ownership or required edits is made until the current files and mandatory architecture documents are read.

## Baseline decision

Recovery work begins from remote `origin/main` equivalent SHA:

`f6082e84d3a352cea47a8e43d2260ae4d4226715`

on branch:

`recovery/2026-06-16-regression-repair`

The branch is isolated from `main`. Each completed repair stage must be committed to this branch and its remote SHA re-read before the next stage.
