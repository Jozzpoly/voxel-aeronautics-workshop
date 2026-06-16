# Safe local commit and push instructions

No push was performed by the delivery agent.

From the validated extracted project directory:

```bash
git status --short
git diff --check
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git add -A
git commit -m "Phase 1D.4A rigid islands and mechanical graph"
git push origin HEAD
```

Review the remote and branch before the final command. Do not use `git push --force`. The supplied patch is relative to the exact clean Phase 1D.3E ZIP baseline and can be applied with:

```bash
git apply --check VAW_Phase_1D4A_from_1D3E.patch
git apply VAW_Phase_1D4A_from_1D3E.patch
```
