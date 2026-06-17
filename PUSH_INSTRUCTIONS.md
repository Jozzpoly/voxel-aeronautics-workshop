# Safe local commit and push instructions

No Stage 1 push was performed by the delivery agent. Publish only from a real local clone with working GitHub credentials.

Current publication target:

```text
repository=Jozzpoly/voxel-aeronautics-workshop
branch=maintenance/workflow-repair-clean
expected_base=d386bc56659b2fa99ed406dd68ed9781cc6dba1e
```

Keep the patch, delivery ZIP and generated evidence outside the repository working tree. The preferred staging mechanism is `git apply --index`; the command below adds the project whitespace policy explicitly. On Windows PowerShell, set the paths and run:

```powershell
$Base = 'd386bc56659b2fa99ed406dd68ed9781cc6dba1e'
$Branch = 'maintenance/workflow-repair-clean'
$Patch = 'C:\Users\Jozz\Downloads\VAW-deliveries\VAW_REPOSITORY_REORGANIZATION_STAGE1_R1.patch'
$Manifest = 'C:\Users\Jozz\Downloads\VAW-deliveries\VAW_REPOSITORY_REORGANIZATION_STAGE1_R1_PATHS.txt'

# Run inside the real clone.
git fetch origin --prune
git switch $Branch
git pull --ff-only origin $Branch
if ((git rev-parse HEAD).Trim() -ne $Base) { throw 'Wrong base SHA; stop without applying the patch.' }
if (git status --porcelain=v1 --untracked-files=all) { throw 'Working tree is not clean; stop.' }

Get-FileHash -Algorithm SHA256 -LiteralPath $Patch
git -c core.whitespace=cr-at-eol apply --check --whitespace=error-all $Patch
git -c core.whitespace=cr-at-eol apply --index --whitespace=error-all $Patch
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
Get-Content -LiteralPath $Manifest
```

Compare `git diff --cached --name-status` with the approved manifest before testing or committing. The patch must define the complete staged set. Do not run `git add -A -- .`; do not stage delivery ZIPs, patches, logs or unrelated local files.

Then validate the exact staged tree:

```powershell
python tests/test_documentation_contract.py
python tests/test_apply_agent_delivery_contract.py
python tests/test_validation_runner.py
python tests/test_release_build.py
python tools/validate_fast.py
python tools/validate_full.py

git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
git status --short
```

If every required result is PASS and the staged paths still match the manifest:

```powershell
git commit -m 'Workflow repair and repository structure Stage 1-R1'
$LocalSha = (git rev-parse HEAD).Trim()
git push origin HEAD:refs/heads/maintenance/workflow-repair-clean
$RemoteSha = ((git ls-remote origin refs/heads/maintenance/workflow-repair-clean) -split '\s+')[0].Trim()
if ($LocalSha -ne $RemoteSha) { throw "Remote SHA mismatch: local=$LocalSha remote=$RemoteSha" }
$RemoteSha
```

Do not use `git push --force`. Do not begin Stage 2 until the printed remote SHA exactly matches the local commit SHA.
