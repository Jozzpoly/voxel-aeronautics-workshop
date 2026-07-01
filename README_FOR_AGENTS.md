# VAW Agent Entry Point

Status: Active agent entrypoint
Last verified: 2026-07-01
Authority: Operational routing only; product truth remains in source, active contracts and accepted ADRs.

Use this file before searching widely. It should get a fresh agent onto the correct branch, validation path and scope boundary in under 10 minutes.

## Start Gate

Run and record:

```text
git status --short --branch
git rev-parse HEAD origin/main origin/current_work
git diff --stat
git diff --name-status
git diff -- SOURCE_MANIFEST.json
git status --porcelain=v1 -- SOURCE_MANIFEST.json assets/visual_packs/local_working_visuals release .agent-validation
```

Default branch rule:

- Work on `current_work` for multi-session checkpoints unless Jozz explicitly names another branch.
- Treat `main` as the reviewed stable landing line.
- Use named milestone branches only for isolated experiments or explicit owner direction.
- Never use historical recovery or maintenance branch names unless Git verifies they exist.
- Never force-push or rewrite history without explicit owner approval.
- Before any merge or push from `current_work` to `main`, classify local changes and run clean-candidate validation. Prefer fast-forward or PR flow; if `--ff-only` does not apply, stop and report why.

Classify local changes before staging:

- `USER_ART`: user-authored visual work, especially `assets/visual_packs/local_working_visuals/**`.
- `CODE`: app, tool or test changes.
- `DOCS`: documentation, roadmap, ADR or handoff changes.
- `GENERATED`: generated provenance, release output or validation artifacts.
- `UNKNOWN`: anything not understood yet.

Do not use `git add .` in a mixed worktree. Stage by responsibility.

## Reading Order

1. `README.md`
2. `AGENT_WORKFLOW.md`
3. `AI_PROJECT_MEMORY.md`
4. `docs/README.md`
5. `ARCHITECTURE.md`
6. `ROADMAP_NEXT.md`
7. `docs/ROADMAP_REBASE_2026-07-01.md`
8. `docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md`
9. accepted ADRs under `docs/adr/`
10. current contract docs such as `docs/visual_asset_pack_v1.md`
11. latest relevant `.codex/handoff/*.md`

Session-specific handoffs live under `.codex/handoff/`. Do not turn temporary handoff notes into product authority.

## Current Route

The active detailed roadmap rebase is `docs/ROADMAP_REBASE_2026-07-01.md`.

Near-term order:

1. M4L - Visual Truth and VectorThruster proof.
2. M5 - Voxel Fit and renderer optimization contract.
3. M6 - Mechanical V2 design spike.
4. M7 - Device tuning and direct binding.
5. M8 - Signal graph and deterministic ControlRuntime.

Do not treat Gate D as the next broad implementation lane while M4L/M5/M6 uncertainty remains. In particular, do not expand persistent device/port schema, hinge schema, Blueprint, CraftModel or compiler output to solve visual fidelity, block-fit or VectorThruster renderer issues.

## Source Of Truth Boundary

`CraftModel` is the workshop source of truth. `CraftCompiler` is the verified path to compiled runtime data. Blueprint, CraftModel, compiler output and accepted contracts stay authoritative.

Engine, UI, renderer, Studio and visual assets are execution or authoring surfaces. Visual Asset Pack V1 is renderer-only and must not carry gameplay authority.

The asset pipeline is a core creative workflow, not cosmetic polish. It must make Blockbench/Studio-to-game visual iteration fast, faithful and diagnosable, while still staying renderer-only. Fix visual import, scale, materials, pivots and rig metadata through explicit renderer-facing contracts; do not move mass, force, fuel, collision, port identity, control semantics or save data into visual packs.

## Validation Tiers

- Targeted: smallest relevant test or static check.
- Component: the owning suite for a changed subsystem.
- Fast: `tools/validate_fast.py`.
- Full: `tools/validate_full.py`.
- Target platform: browser, Windows, GitHub Actions or release matrix evidence, reported separately.

Use bundled Python aware entrypoints where possible:

```text
npm run test
npm run studio:test
npm run visual:test
npm run validate:fast
npm run validate:full
npm run browser:smoke
```

When `assets/visual_packs/local_working_visuals/**` or `assets/visual_packs/installed_visual_packs.json` is dirty, root release validation can regenerate `SOURCE_MANIFEST.json` from protected local art. For release-grade evidence, stage only the intended candidate and validate an isolated clean checkout instead:

```text
npm run validate:clean
```

The helper clones HEAD into `.agent-validation/**`, applies the staged patch if present, and runs bundled `tools/validate_full.py` by default. It reports protected visual dirty paths but does not copy them into the candidate. Use an explicit command after `--` for narrower evidence, for example:

```text
npm run validate:clean:fast
```

The npm shortcuts pass stable candidate labels (`validate-full` and `validate-fast`) so `.agent-validation/**` evidence is easy to scan after repeated runs.

The helper refuses staged protected visual-pack paths by default. Use `--allow-protected-staged` only for an explicit owner-approved art commit, never for routine code/docs/tooling validation.
Root `npm run test` includes release-build coverage and may fail with `SOURCE_MANIFEST.json is stale` while protected visual work is dirty. Treat that as an expected workflow guard, not as permission to commit local art hashes. Use clean-candidate validation for the release-grade gate.

`npm run browser:smoke` is target-platform evidence, not a default core gate. If it reports `ENVIRONMENT`, document the missing browser/CDP/localhost capability instead of treating it as a product PASS.
The browser smoke JSON contract is `status`, `stage`, `reason`, `diagnostics` and, on PASS only, `result`. `PRODUCT` blocks the checkpoint. `ENVIRONMENT` is acceptable only when the stage and diagnostics identify a missing or unusable browser/CDP/localhost capability.

For Visual Asset Pack / Studio work, add a read-only local pack audit:

```text
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
```

Treat diagnostics under `assets/visual_packs/local_working_visuals/**` as `OWNER` evidence unless the owner explicitly approves editing that art. The `--suggest-cleanup` report is dry-run only. The 2026-07-01 feature-expansion handoff records a narrow owner-approved Balloon binding cleanup; do not infer broader asset-edit permission from it.

For VectorThruster visual direction work, use the 24-orientation probe:

```text
npm run probe:vector-thruster:report
```

The default gate form exits nonzero until visual nozzle direction matches gameplay force direction:

```text
npm run probe:vector-thruster
```

Do not accept one-off Euler/profile edits that only look right in one orientation.

Classify failures:

- `PRODUCT`: real product, compiler, runtime, release or contract failure.
- `HARNESS`: runner or test harness invokes valid checks incorrectly.
- `ENVIRONMENT`: missing browser, GitHub access or global dependency.
- `OWNER`: policy or data-retention decision needed.
- `SCOPE`: request belongs outside the active milestone.

## Generated And Protected Paths

- `SOURCE_MANIFEST.json` is generated provenance. Do not hand-edit hashes.
- Treat `SOURCE_MANIFEST.json` as provenance for a clean candidate, not for protected local Balloon/visual WIP. If root validation changes it while protected visuals are dirty, regenerate/verify through `tools/validate_clean_candidate.py` before committing.
- `.agent-validation/` contains validation artifacts and may be regenerated.
- Use `node tools/run_with_python_env.js python tools/prune_agent_validation.py --keep 5` to inspect old `.agent-validation/` artifacts. It is dry-run by default; add `--apply` only after explicit owner approval for deletion.
- `assets/visual_packs/local_working_visuals/**` may contain user art. Do not delete, normalize, regenerate or clean it without explicit owner request.
- `release/**` is tracked historical release output. Do not delete or migrate it without owner approval. If release cleanup is approved, handle it as a separate repo-policy milestone: verify `tools/build_release.py` / `tools/verify_release.py`, update policy/docs or `.gitignore` as needed, run release validation, and do not mix it with visual pipeline, Gate D or mechanics work.

## Current Foundation Hardening Non-Goals

Do not touch gameplay, physics semantics, save schema, Blueprint, CraftModel, compiler output, Gate D, visual runtime semantics or asset-manager UX while doing foundation workflow hardening.
