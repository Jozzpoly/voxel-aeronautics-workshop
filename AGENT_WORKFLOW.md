# Agent Workflow — durable validation and delivery

This file is the operational contract for automated or assisted changes to Voxel Aeronautics Workshop.
It complements `DELIVERY_WORKFLOW.md`; it does not replace product architecture, release identity, or gameplay decisions.

## 1. Start from an exact state

Record the branch and full 40-character commit SHA before editing. Work on the dedicated branch named by the task.
Do not write directly to `main` or a recovery branch unless the user explicitly changes the contract.
Keep unrelated local changes out of the delivery.

```bash
git status --short
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
```

## 2. Keep increments reversible

A workflow increment should be small enough to review and reproduce. Never use an uncontrolled `git add -A -- .` for a delivery. Prefer `git apply --index` so the reviewed patch defines the staged set. If indexed application is not possible, stage only a reviewed explicit path list with `git add -A -- <path>...` and use `git add -f -- <path>...` only for explicitly approved ignored files.
Do not reset, clean, stage, commit, rebase, or push as a side effect of validation.
Generated validation artifacts live under `.agent-validation/` and are never source changes.

## 3. Validation entry points

```bash
python tools/validate_fast.py
python tools/validate_full.py
python tests/run_all.py
```

The validation runner records one directory per run containing:

- `summary.json` — atomically replaced machine-readable state;
- `events.jsonl` — flushed append-only event stream;
- `logs/<stage>.log` — combined stdout/stderr for each stage;
- `release/` — FULL-only HTML, ZIP and SHA256 artifacts isolated to that exact run.

Useful runner controls:

```bash
python tools/validate_fast.py --list
python tools/validate_full.py --only core-suite,release-build,release-verify
python tools/validate_fast.py --from gate-b-compilers
python tools/validate_full.py --resume .agent-validation/full-<run-id>
```

Resume is accepted only when the repository HEAD, working-tree fingerprint, and complete plan digest still match.
A passed stage is reused; pending, failed, timed-out, or interrupted stages run again.

## 4. Interpret results honestly

Stage states are `pending`, `pass`, `fail`, `timeout`, and `not-run`.
A host interruption is not a pass. Timeout and controlled SIGINT/SIGTERM/SIGHUP interruption terminate the
known process family and persist a non-pass summary. An uncatchable SIGKILL, abrupt host loss, or platform
failure can only leave the last durable non-pass state; it cannot be claimed as a completed result.

The runner compares final-state identities for tracked files, ordinary untracked files, ignored files,
file modes, and symlink targets. Only its explicit artifact root (`.agent-validation/` or the selected run
folder) is exempt. Therefore creation of `dist/...` or `*.log` outside that root is a side effect even when
Git ignores it. Delete-and-recreate with byte-identical final content is intentionally outside this
final-state model. The runner reports side effects and never repairs, resets, cleans, or stages them.

## 5. Durable checkpoint

A completed increment ends in one of two forms:

1. a real remote commit whose SHA is confirmed by reading the remote branch again; or
2. a patch generated against the exact declared base, with SHA-256, test evidence, path list, and a successful `git apply --check` on a fresh copy.

Never describe a local synthetic commit as a remote checkpoint. Never force-push. Never use an unrelated historical branch as transport.


Before committing a patch delivery, verify the exact staged set against its approved manifest:

```bash
git apply --check <delivery.patch>
git apply --index <delivery.patch>
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
```

Do not compensate for a missing staged path with repository-wide staging. Stop, inspect the patch and manifest, and correct the delivery source.

## 6. Safe patch application

Use `tools/apply-agent-delivery.ps1` from a clean checkout of the exact base on the dedicated
`maintenance/workflow-repair-clean` branch. The script verifies the full base SHA, repository identity,
clean tree, patch preflight, exact expected path set (including additions, deletions and renames), validation
content fingerprints, dotfile-safe path normalization, post-commit clean-tree and reverse-apply completeness checks, and remote race before an optional normal push. It writes a durable phase record under
`.git/` and refuses a blind rerun after interruption. It never force-pushes, resets, or cleans the repository.

The PowerShell script remains experimental until its matrix is executed on Windows PowerShell 5.1 and pwsh 7.
Review its printed plan and state file before using `-Commit` or `-Push`.

Report these dimensions independently:

```text
IMPLEMENTATION_VALIDATION=PASS|FAIL|NOT-RUN
FRESH_APPLY_VALIDATION=PASS|FAIL|BLOCKED
REMOTE_DELIVERY=PASS|BLOCKED|NOT-ATTEMPTED
WINDOWS_EXECUTION=PASS|FAIL|NOT-RUN
OVERALL_GATE_STATUS=PASS|PARTIAL|BLOCKED
```
