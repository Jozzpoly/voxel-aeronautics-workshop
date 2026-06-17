# Workflow Repair Handoff

## Source of truth

- Repository: `Jozzpoly/voxel-aeronautics-workshop`
- Trusted base branch: `recovery/2026-06-16-regression-repair`
- Trusted base SHA: `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`
- Main SHA observed during repair: `f6082e84d3a352cea47a8e43d2260ae4d4226715`
- Clean branch: `maintenance/workflow-repair-clean`
- Current remote clean-branch SHA: `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`
- Stage 1 remote publication: `NOT-PUBLISHED`

## Branch warning

`maintenance/workflow-bootstrap` is incomplete at
`a983f02f86184798fb804d582c0da15264fccab1`. Its four commits add
`AGENT_WORKFLOW.md`, `tools/validation_plan.py`, `tools/validate_fast.py` and
`tools/validate_full.py`, but not the runner they import. Do not merge it, append
new work to it, force-push it, reset it, or delete it automatically. Leave it as
historical evidence and use the clean branch from the trusted base.

## Repaired candidate

The candidate contains:

- resumable validation runner with durable JSON/event/log writes;
- tracked, untracked and ignored final-state side-effect detection;
- file-mode and symlink identity on platforms that expose them;
- controlled SIGINT/SIGTERM/SIGHUP interruption handling and process-family timeout cleanup;
- strict resume identity and saved-stage validation;
- self-contained FULL build/verify in a run-specific `.agent-validation/full-<run-id>/release/` directory;
- hardened PowerShell delivery with dotfile-safe exact path accounting, content snapshots, post-commit clean-tree and reverse-apply checks, durable phase state, normal-push race checks and remote SHA confirmation;
- a Windows matrix covering add/delete/rename, path encoding, line endings, timeout, side effects, races, rejection and interruption recovery.

## Independent review correction

An independent review found that the former `Normalize-RepositoryPath` used
`TrimStart([char[]]'./')`, which removed leading dots from `.gitignore`, `.github/...` and
other dotfiles. That version of `tools/apply-agent-delivery.ps1` must not be used with
`-Commit` or `-Push`. The repaired candidate now removes only a literal `./` prefix,
requires a clean worktree after commit, and proves complete inclusion with
`git apply --reverse --check`. The Windows harness modifies and verifies both
`.gitignore` and `.github/workflows/example.yml` for commit and push scenarios.
Windows execution remains `NOT-RUN`.

FULL artifacts are isolated per run and the verify stage directly checks the HTML, ZIP,
external `SHA256.txt`, ZIP integrity, packaged HTML, internal checksum and ZIP source parity.

## Evidence status

```text
IMPLEMENTATION_VALIDATION=PASS
FRESH_APPLY_VALIDATION=PASS_ON_RECONSTRUCTED_GIT_WORKTREE
REMOTE_DELIVERY=BLOCKED_STAGE1_UNPUBLISHED
WINDOWS_EXECUTION=NOT-RUN
OVERALL_GATE_STATUS=PARTIAL (Windows and remote remain unexecuted/blocked)
```

The clean remote branch now exists at the trusted base `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`, but Stage 1 has not been published to it. The earlier connector attempt stopped before creating a commit or moving a ref; the incomplete branch remained unchanged.

The local reconstruction is a real Git worktree but not the original remote object
database. Existing modified base blobs were compared directly with GitHub. Never
present a synthetic local commit as the original remote base commit.

## Known limitations

- SIGKILL and abrupt host loss cannot guarantee child cleanup; the last durable summary remains non-pass.
- Side-effect detection is final-state based; byte-identical delete/recreate is not observable.
- Windows-specific behavior, including dotfile commit/push completeness, is prepared but unexecuted until tested on Windows PowerShell 5.1 and pwsh 7.
- The PowerShell script intentionally blocks blind reruns when `.git/vaw-agent-delivery-state.json` remains after interruption; recovery is manual and evidence-driven.

## Repository structure state

The verified workflow repair is embedded in the local synthetic reconstruction as commit
`3078ea95e3124635f81a00614ed4d849282062a5`. The repository audit/target checkpoint is
`2440d705e28756b1f2daf8a3f0b09874e847f1da`; the first migration checkpoint is
`727966e117fa7738d5b32ba759a932ae75014d10`. These are local checkpoint SHAs, not remote GitHub identities.

The first migration moved all sixteen phase reports to `docs/history/phases/`. Read:

- `docs/repository/REPOSITORY_STRUCTURE_AUDIT.md`;
- `docs/repository/REPOSITORY_STRUCTURE_TARGET.md`;
- `docs/repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md`;
- `docs/history/phases/README.md`.

Do not restore phase reports to root or create compatibility duplicates. The next safe migration is an active documentation index plus review classification. Recovery evidence, workflow/tool grouping, tracked release history and product-source movement remain separate deferred scopes.

## Updated continuation

1. Apply the final combined patch to an exact checkout of remote base `d386bc56659b2fa99ed406dd68ed9781cc6dba1e`.
2. Re-run documentation, release, FAST and FULL validation and compare summary JSON.
3. Publish Stage 1-R1 only as one complete commit on `maintenance/workflow-repair-clean`; re-read and compare the remote SHA. Never extend `maintenance/workflow-bootstrap`.
4. Execute the PowerShell matrix on Windows PowerShell 5.1 and pwsh 7; keep `WINDOWS_EXECUTION=NOT-RUN` until then.
5. Continue repository migration only in the staged order recorded in `REPOSITORY_STRUCTURE_TARGET.md`.
