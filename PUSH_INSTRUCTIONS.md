# Safe commit and push instructions

## Active workflow

Use Workflow V3:

```text
direct Git > one final milestone ZIP > complete single file > patch for recovery/audit
```

Stage 1 and Documentation Convergence Stage 2 are published milestones on `maintenance/workflow-repair-clean`. Always read the latest branch SHA before starting; do not hardcode an older checkpoint as the current base.

`maintenance/workflow-bootstrap` is incomplete historical evidence and must not be extended, merged or used as transport.

## Normal publication

```powershell
$Branch = 'maintenance/workflow-repair-clean'

git fetch origin --prune
git switch $Branch
git pull --ff-only origin $Branch

$Base = (git rev-parse HEAD).Trim()
$Remote = ((git ls-remote origin "refs/heads/$Branch") -split '\s+')[0].Trim()
if ($Base -ne $Remote) { throw "Local/remote mismatch: local=$Base remote=$Remote" }
if (git status --porcelain=v1 --untracked-files=all) { throw 'Working tree is not clean.' }
```

Record milestone scope and stage only approved paths:

```powershell
git add -A -- <approved-path-1> <approved-path-2>
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
```

Run the milestone validation ladder. FAST normally runs once or twice. FULL runs once on the frozen candidate only when release/integration scope requires it.

```powershell
git commit -m '<bounded milestone message>'
$LocalSha = (git rev-parse HEAD).Trim()

git fetch origin --prune
$BeforePush = ((git ls-remote origin "refs/heads/$Branch") -split '\s+')[0].Trim()
if ($BeforePush -ne $Base) { throw "Remote moved: expected=$Base actual=$BeforePush" }

git push origin "HEAD:refs/heads/$Branch"
$RemoteSha = ((git ls-remote origin "refs/heads/$Branch") -split '\s+')[0].Trim()
if ($LocalSha -ne $RemoteSha) { throw "Remote SHA mismatch: local=$LocalSha remote=$RemoteSha" }

git status --short
$RemoteSha
```

Never force-push, silently rewrite history, publish directly to `main`/recovery without an explicit decision, or use broad staging to conceal unknown files.

## ZIP fallback

When direct publication is blocked, produce one final milestone ZIP:

```text
README_FIRST.md
project/
evidence/
SHA256SUMS.txt
```

The user copies `project/` once. Keep patches, logs, helpers and nested archives out of `project/`.

## Current sequence

1. Stage 1.1 Cross-platform release reproducibility.
2. Stop-review and branch promotion.
3. Gate C — Assembly Spaces / Sublevels.

Further cosmetic repository reorganization is frozen. Device/Port Schema, ControlRuntime, walking, docking and broad interiors remain deferred until Gate C closes.
