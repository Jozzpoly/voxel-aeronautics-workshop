# Workflow Repair Handoff

## Source of truth

```text
repository=Jozzpoly/voxel-aeronautics-workshop
active_branch=maintenance/workflow-repair-clean
trusted_parent_sha=d386bc56659b2fa99ed406dd68ed9781cc6dba1e
stage1_commit=306d5690cae647066acc00a80bcf26a1d47c0441
stage1_implementation=PUBLISHED
stage1_documentation_closeout=CLOSED
```

Always re-read the active remote branch before editing. The SHA above is the confirmed Stage 1 checkpoint, not a promise that the branch has not advanced.

## Historical branch warning

`maintenance/workflow-bootstrap` at `a983f02f86184798fb804d582c0da15264fccab1` is incomplete historical evidence. Do not merge it, append work to it, use it as transport, reset it, delete it automatically or force-push it.

## Delivered Stage 1 capability

Stage 1 provides:

- durable validation summaries, events and logs;
- resumable validation with exact repository, worktree and plan identity checks;
- tracked, ordinary untracked and ignored final-state side-effect detection;
- file-mode and symlink identity where the platform exposes them;
- controlled interruption and process-family timeout cleanup;
- run-isolated FULL release construction and verification;
- dotfile-safe delivery tooling with exact path accounting and normal-push race checks;
- repository structure audit/target documents;
- archival relocation of all sixteen phase reports to `docs/history/phases/`.

The published production and gameplay state remains Foundation Phase 1D.4A. No gameplay behavior changed in Stage 1.

## Evidence status

```text
LINUX_DOCUMENTATION=PASS
LINUX_RELEASE=PASS
LINUX_FAST=PASS
LINUX_FULL=PASS
REPOSITORY_SIDE_EFFECTS=0
LINGERING_PROCESSES=0

WINDOWS_TARGETED_PATHS=PASS
WINDOWS_TARGETED_PROCESS_FAMILY=PASS
WINDOWS_TARGETED_RUN_DIR_TOKENS=PASS
WINDOWS_VALIDATION_RUNNER=PASS
WINDOWS_FAST=PASS
WINDOWS_FULL=PARTIAL
WINDOWS_FULL_FAILURE_CLASS=PRE_EXISTING_CRLF_SENSITIVE_SOURCE_MANIFEST
```

The Windows FULL limitation is not a Stage 1 or product regression. The current release source manifest hashes raw checkout bytes, so semantically equivalent LF and CRLF text checkouts can produce different identities. Resolve this in the separate Stage 1.1 milestone.

## Known limitations

- SIGKILL and abrupt host loss cannot guarantee child cleanup; the last durable summary remains non-pass.
- Side-effect detection is final-state based; byte-identical delete/recreate is not observable.
- The delivery helper deliberately blocks blind reruns when its durable state file remains after interruption.
- Cross-platform release reproducibility is not closed until Stage 1.1 proves canonical LF/CRLF behavior on Linux and Windows.

## Repository structure state

Read:

- `docs/repository/REPOSITORY_STRUCTURE_AUDIT.md`;
- `docs/repository/REPOSITORY_STRUCTURE_TARGET.md`;
- `docs/repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md`;
- `docs/history/phases/README.md`.

The next bounded repository milestone is Documentation Convergence Stage 2:

- create `docs/README.md`;
- classify active, supporting, accepted ADR, recovery and historical documents;
- update root navigation and active workflow contracts to Workflow V3;
- update the documentation contract test;
- move only unquestionably superseded review material after reference checks.

Do not move `src/`, tools, tests, recovery evidence or tracked releases.

## Continuation sequence

1. Re-read `maintenance/workflow-repair-clean`.
2. Complete Documentation Convergence Stage 2 as one coherent milestone.
3. Complete Stage 1.1 Cross-platform release reproducibility as a separate milestone.
4. Perform a stop-review, freeze further cosmetic repository reorganization and create a dedicated Gate C branch from the latest verified SHA.
5. Begin Gate C Assembly Spaces / Sublevels.

Do not start Device & Port Schema, ControlRuntime, walking, docking, broad interiors or placeholder future APIs before Gate C stabilizes spatial ownership.

## Publication model

Prefer one normal Git commit and remote SHA readback per bounded milestone. When connector publication is blocked, deliver one final milestone ZIP with `README_FIRST.md`, `project/`, `evidence/` and `SHA256SUMS.txt`. Patch is recovery/audit-only.
