# VAW Agent Entry Point

Status: Active agent entrypoint
Last verified: 2026-06-29
Authority: Operational routing only; product truth remains in source, active contracts and accepted ADRs.

Use this file before searching widely. It should get a fresh agent onto the correct branch, validation path and scope boundary in under 10 minutes.

## Start Gate

Run and record:

```text
git status --short --branch
git rev-parse HEAD origin/main origin/current_work
git diff -- SOURCE_MANIFEST.json
```

Default branch rule:

- Work on `current_work` for multi-session checkpoints unless Jozz explicitly names another branch.
- Treat `main` as the reviewed stable landing line.
- Use named milestone branches only for isolated experiments or explicit owner direction.
- Never use historical recovery or maintenance branch names unless Git verifies they exist.
- Never force-push or rewrite history without explicit owner approval.

## Reading Order

1. `README.md`
2. `AGENT_WORKFLOW.md`
3. `AI_PROJECT_MEMORY.md`
4. `docs/README.md`
5. `ARCHITECTURE.md`
6. `ROADMAP_NEXT.md`
7. accepted ADRs under `docs/adr/`
8. current contract docs such as `docs/visual_asset_pack_v1.md`
9. latest relevant `.codex/handoff/*.md`

Session-specific handoffs live under `.codex/handoff/`. Do not turn temporary handoff notes into product authority.

## Source Of Truth Boundary

`CraftModel` is the workshop source of truth. `CraftCompiler` is the verified path to compiled runtime data. Blueprint, CraftModel, compiler output and accepted contracts stay authoritative.

Engine, UI, renderer, Studio and visual assets are execution or authoring surfaces. Visual Asset Pack V1 is renderer-only and must not carry gameplay authority.

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
node tools/run_with_python_env.js python tools/validate_fast.py
node tools/run_with_python_env.js python tools/validate_full.py
npm run browser:smoke
```

`npm run browser:smoke` is target-platform evidence, not a default core gate. If it reports `ENVIRONMENT`, document the missing browser/CDP/localhost capability instead of treating it as a product PASS.

Classify failures:

- `PRODUCT`: real product, compiler, runtime, release or contract failure.
- `HARNESS`: runner or test harness invokes valid checks incorrectly.
- `ENVIRONMENT`: missing browser, GitHub access or global dependency.
- `OWNER`: policy or data-retention decision needed.
- `SCOPE`: request belongs outside the active milestone.

## Generated And Protected Paths

- `SOURCE_MANIFEST.json` is generated provenance. Do not hand-edit hashes.
- `.agent-validation/` contains validation artifacts and may be regenerated.
- `assets/visual_packs/local_working_visuals/**` may contain user art. Do not delete, normalize, regenerate or clean it without explicit owner request.
- `release/**` is tracked historical release output. Do not delete or migrate it without owner approval.

## Current Foundation Hardening Non-Goals

Do not touch gameplay, physics semantics, save schema, Blueprint, CraftModel, compiler output, Gate D, visual runtime semantics or asset-manager UX while doing foundation workflow hardening.
