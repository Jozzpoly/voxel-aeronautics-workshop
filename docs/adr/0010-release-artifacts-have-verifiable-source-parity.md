# ADR 0010 — Release artifacts have verifiable source parity

- Status: accepted
- Milestone: Foundation Phase 1C.1 Hotfix

## Context

A source ZIP and a single-file HTML were distributed separately. Even when locally generated from the same worktree, identical or reused filenames made it difficult for the user to know whether both downloads represented the same release.

## Decision

Every release must:

- use a unique release identifier and filenames;
- generate `SOURCE_MANIFEST.json` with hashes of build inputs;
- embed release and manifest markers in the single-file HTML;
- package that exact HTML inside the source ZIP under `release/`;
- test every embedded application module against the corresponding source file;
- test ZIP source bytes against the build worktree;
- provide a local `verify-release` command.

## Consequences

A release is no longer trusted merely because two files share a milestone label. Their relationship is mechanically verifiable and protected by automated tests.
