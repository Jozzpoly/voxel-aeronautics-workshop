# Safe commit and push instructions

## Current checkpoint

```text
repository=Jozzpoly/voxel-aeronautics-workshop
branch=maintenance/workflow-repair-clean
stage1_commit=306d5690cae647066acc00a80bcf26a1d47c0441
publication=CONFIRMED
```

Stage 1 is already published. Do not reapply the old Stage 1-R1 patch and do not use `maintenance/workflow-bootstrap` as a work branch or transport.

## Default publication model

Use normal Git work from the latest verified remote SHA:

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

Record the exact base, allowed paths and forbidden paths before editing. Stage only the reviewed milestone path set. Do not use broad repository staging to conceal unknown files.

```powershell
git add -A -- <approved-path-1> <approved-path-2>
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
```

Run the validation ladder required by the milestone. Targeted tests may run repeatedly; FAST normally runs once or twice; FULL runs once on the frozen candidate when release-sensitive scope requires it.

Then publish one normal commit and read the remote SHA back:

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

Never force-push, rewrite history silently, or publish directly to `main` or a recovery branch without an explicit product decision.

## Fallback delivery

When direct publication is blocked, produce one final milestone ZIP only after the candidate is stable:

```text
README_FIRST.md
project/
evidence/
SHA256SUMS.txt
```

`project/` contains only repository-relative files intended for the commit. Keep patches, logs, helper scripts and nested archives out of `project/`. The user copies `project/` once.

Patch delivery is recovery/audit-only, not the normal daily workflow.

## Current sequence

1. Documentation Convergence Stage 2 and Workflow V3 alignment.
2. Stage 1.1 Cross-platform release reproducibility as a separate commit.
3. Stop-review, freeze cosmetic repository moves and create the Gate C development branch from the latest verified SHA.
4. Gate C Assembly Spaces / Sublevels.

Do not begin Device/Port Schema, ControlRuntime, walking, docking or broad interiors before Gate C.
