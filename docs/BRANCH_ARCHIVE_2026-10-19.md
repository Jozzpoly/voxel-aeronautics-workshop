# VAW branch compression — 2026-10-19

Owner requested drastic branch reduction because the old multiagent/automation branch forest makes VAW hard to recover. This is not permission to erase historical code or promote unaccepted gameplay.

## Canonical branch roles

- `main`: untouched historical default; not accepted recovery until later deliberate promotion.
- `recovery/playable-truth`: current source of truth for workshop fixes and genuine Owner testing; PR #16 stays draft.
- `gh-pages`: generated, tested standalone playable HTML and supporting public visual assets; no source authority.

Build entry: [Launch VAW through HTMLPreview](https://htmlpreview.github.io/?https://raw.githubusercontent.com/Jozzpoly/voxel-aeronautics-workshop/gh-pages/index.html). Generated from `recovery/playable-truth` via `.github/workflows/publish-playable.yml`. `gh-pages/BUILD_INFO.json` pins the source commit. GitHub Pages activation is a separate repository setting; HTMLPreview does not depend on that setting. The HTMLPreview entrance has not received Owner gameplay acceptance.

## Frozen archive tags replacing the historical branches

Each tag points at the original, exact branch tip. Archived sources remain retrievable by tag/commit; these are *not active roadmap, CI lanes or promises*. Tag names replace slashes with `--`.

| Retired branch | Original SHA | Archive tag |
| --- | --- | --- |
| `VAW_GRoK` | `9851ad56a12bf38a628f0cf5016064ace9196f6a` | `archive/vaw-2026-10-19/VAW_GRoK` |
| `automation/mobile-compatibility-clean-result-29104753424` | `27a4342dcbf5a4aab953556ef84c9183f05176c9` | `archive/vaw-2026-10-19/automation--mobile-compatibility-clean-result-29104753424` |
| `automation/mobile-compatibility-transport-trigger` | `0c98849076484a78be33652ca9fc663c1bf1a2f3` | `archive/vaw-2026-10-19/automation--mobile-compatibility-transport-trigger` |
| `automation/mobile-flight-smoke` | `dc3b17bb41adc34a2cc8aad27f2f86d0dbc45d30` | `archive/vaw-2026-10-19/automation--mobile-flight-smoke` |
| `automation/mobile-smoke-neutral-result-29106764698` | `02e231fc3cd32f3243de67a0873f0ad9c5c52edd` | `archive/vaw-2026-10-19/automation--mobile-smoke-neutral-result-29106764698` |
| `automation/mobile-smoke-neutral-trigger` | `6c42bb85f7141b061c3456118615053c180c74f6` | `archive/vaw-2026-10-19/automation--mobile-smoke-neutral-trigger` |
| `automation/mobile-smoke-watchdog-result-29106019729` | `6c118461f6f8e7b240370c058bc3ed1147897bad` | `archive/vaw-2026-10-19/automation--mobile-smoke-watchdog-result-29106019729` |
| `automation/mobile-smoke-watchdog-trigger` | `bbeca7704b97a030da50158201f67e4837791387` | `archive/vaw-2026-10-19/automation--mobile-smoke-watchdog-trigger` |
| `current_work` | `80c0ae4aced1dd695af217cdeadea9025c6305c8` | `archive/vaw-2026-10-19/current_work` |
| `mobile/compatibility-validation` | `99c24752bfdf9575cc32989701a0d13a4cc5cfdd` | `archive/vaw-2026-10-19/mobile--compatibility-validation` |
| `mobile/playable-mvp` | `3da2d2aa05b9c3f6aa208dc9a703a843fea292ca` | `archive/vaw-2026-10-19/mobile--playable-mvp` |
| `mobile/touch-foundation` | `460b6ebeb23b1541e9b923783a06f13e9ec05467` | `archive/vaw-2026-10-19/mobile--touch-foundation` |

## Safety rules

- The completed one-time cleanup workflow (preserved as `docs/history/BRANCH_COMPRESSION_WORKFLOW_2026-10-19.yml`, no longer executable by Actions) independently checked that each branch still points to its pinned SHA, that its archive tag exists and matches, and that no open PR depends on the branch. Only then does it delete the old branch *ref*, never its source/commits/tags.
- If a branch moves after this table was written, halt rather than deleting unknown work.
- Old links containing retired branch names may stop resolving; use the exact commit or archive tag instead. Closed PR diffs remain recorded.
- No history rewrites, force pushes, product code changes, or promotion into `main` are part of this compression.
- The archive is for archaeological retrieval, *not* a reason to re-enable the former agent mesh.
