# VAW Recovery Delivery — 2026-06-16

## Source of truth

Use branch:

```text
recovery/2026-06-16-regression-repair
```

Do not use an older local folder or the historical unpushed `1b42ef6` prefix as a source of truth.

## Update an existing local clone

First preserve any local work:

```bash
git status --short --branch
git diff > RECOVERY_UNSTAGED.patch
git diff --staged > RECOVERY_STAGED.patch
git ls-files --others --exclude-standard > RECOVERY_UNTRACKED.txt
```

Then fetch and create/update a local recovery branch without rewriting `main`:

```bash
git fetch origin --prune
git switch -C recovery/2026-06-16-regression-repair origin/recovery/2026-06-16-regression-repair
git status --short --branch
```

The final status should be clean.

## Run the modular source build

```bash
python tools/serve.py
```

Open the local URL printed by the server. Stop the server with `Ctrl+C`.

## Run the release

The ready single-file HTML is in `dist/` and can be opened directly in a browser. The full release ZIP contains the complete verified project snapshot.

## Re-run validation

```bash
python -m compileall .
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

On a Linux environment with Chromium and Xvfb:

```bash
node tests/run_browser_recovery.mjs
```

The browser command writes evidence under ignored `recovery-artifacts/browser/` and cleans up its server, Chromium profile and temporary files.

## Promote to main after review

The recovery operation intentionally leaves `main` untouched. After reviewing the draft PR and confirming the delivered build, promote the branch through GitHub's merge UI or by an explicit fast-forward where repository history permits it. Do not force-push `main`.
