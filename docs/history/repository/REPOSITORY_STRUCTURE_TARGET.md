# Repository Structure Target

## Target tree

```text
/
├── README.md
├── AI_PROJECT_MEMORY.md
├── PROJECT_VISION.md
├── ARCHITECTURE.md
├── ROADMAP_NEXT.md
├── CHANGELOG.md
├── THIRD_PARTY_NOTICES.md
├── index.html
├── styles.css
├── package.json
├── jsconfig.json
├── run_game.{bat,sh}
├── run_tests.{bat,sh}
├── src/
│   ├── foundation/
│   ├── runtime/
│   ├── game/
│   └── game.js
├── tests/
│   ├── workflow/              # future focused migration
│   ├── windows/
│   ├── vendor/
│   └── product and release tests
├── tools/
│   ├── workflow/              # future focused migration
│   ├── release/               # future focused migration
│   └── development utilities
├── docs/
│   ├── README.md              # later active documentation index
│   ├── adr/
│   ├── repository/
│   ├── workflow/              # later move of active workflow docs
│   ├── recovery/              # later move of recovery evidence
│   └── history/
│       ├── phases/
│       ├── reviews/
│       └── validation/
├── examples/
└── release/                   # tracked release policy to be resolved separately
```

The tree is a direction, not permission for one mass move. Every subtree is migrated in a separately reversible increment.

## Directory responsibilities

### Root

The root contains only:

- product entry points required to run/build the application;
- the smallest active set of human entry documents;
- package/toolchain metadata;
- legal and changelog files.

Historical reports, dated evidence and specialist handoffs do not remain in the root long term.

### `src`

Product source only. Existing architectural ownership remains authoritative:

- `foundation`: domain, pure compiler pipeline, neutral plans and shared deterministic utilities;
- `runtime`: physics ports/backends and runtime assembly allocation;
- `game`: controllers, services, visuals and application coordination;
- `game.js`: composition root.

No empty future API or Gate C placeholder is created by repository reorganization.

### `tools`

Executable developer tooling, not product runtime code. A later migration may group tools only when entry points and import behavior are protected by tests. Tools must derive repository paths from `__file__` or explicit arguments, never an assumed current working directory.

### `tests`

Tests mirror the contract they protect, not implementation trivia. Cross-platform workflow tests belong together; vendor code remains isolated. Test entry points must remain stable or be changed with all scripts and documentation in the same increment.

### `docs`

- `adr`: accepted architectural decisions, immutable except for status/supersession metadata;
- `repository`: current repository audits, target structure and migration records;
- `workflow`: active workflow/delivery documentation after a later focused move;
- `recovery`: dated recovery evidence and operational scenarios;
- `history/phases`: phase delivery reports preserved as historical evidence;
- `history/reviews`: superseded reviews and audits;
- `history/validation`: superseded test/validation snapshots.

## Placement rules for new files

1. A new root Markdown file requires proof that it is an active universal entry point.
2. A dated report goes under `docs/history`, `docs/recovery` or `docs/repository`, depending on purpose.
3. An accepted architecture decision goes under `docs/adr` with the next sequential ADR number.
4. Product JavaScript goes under the owning `src` boundary; no new global runtime aggregate is introduced.
5. Generated files go only to ignored directories unless a release policy explicitly makes them tracked evidence.
6. Windows-only workflow evidence belongs under `tests/windows` or a future dedicated workflow test directory.

## Naming rules

- Active contracts use stable descriptive names without dates where practical.
- Historical evidence may retain original filenames to preserve searchability and provenance.
- New dated evidence uses ISO `YYYY-MM-DD`.
- Directory names are lowercase ASCII with hyphens only where needed.
- Case-only renames are avoided because they are fragile across Windows and Linux filesystems.

## Historical-document policy

Historical documents are preserved, not rewritten into current truth. A move should normally be byte-preserving. If an internal relative link must change, that content edit is explicit and tested. Each history directory has an index explaining authority and chronology.

## Recovery policy

Recovery documentation remains easy to find and keeps exact base/head SHA evidence. Recovery scripts or workflows are not mixed with normal delivery tooling. A recovery item is archived only after current active documents no longer require it as mandatory reading.

## Release policy

Generated validation releases belong under `.agent-validation/<run>/release/`. `dist/` remains ignored local output. The policy for tracked historical files in `release/` is deferred until a dedicated audit verifies external download expectations, checksums and historical references.

## Migration stages

### Stage 1 — phase-report archive

Move all sixteen `PHASE_*_REPORT.md` files to `docs/history/phases/`, add an index, and update every reference plus ZIP/documentation tests.

Rollback: one reverse patch or commit revert. No product code or release identity changes.

### Stage 2 — active documentation index and review classification

Create `docs/README.md`, classify root review/test/validation documents as active or historical, then move only superseded material.

Rollback: reverse documentation-only patch.

### Stage 3 — recovery documentation

Move dated recovery evidence to `docs/recovery/`, updating mandatory-reading references and workflow checks.

Rollback: reverse recovery-only patch; no recovery branch/history rewrite.

### Stage 4 — workflow documentation and tests

Move active workflow docs to `docs/workflow/` and, if justified, workflow Python tests to `tests/workflow/`. Preserve executable entry points unless a separate tool migration is approved.

Rollback: reverse patch; run workflow targeted suite.

### Stage 5 — tool namespace

Evaluate `tools/workflow`, `tools/release` and development-tool grouping. Only proceed with explicit command compatibility and import tests.

Rollback: reverse patch; verify package and shell entry points.

### Stage 6 — tracked release history

Define whether old single-file builds remain tracked, move to a release archive, or are represented by tags/checksums. This stage requires explicit product/release policy review.

Rollback: restore tracked release paths and checksums.

### Product-source migration

No product-source move is planned until a concrete architectural ownership defect is demonstrated. Directory aesthetics alone are insufficient justification.

## First-increment safety constraints

- documentation-only moves plus reference/test updates;
- no gameplay, schema, physics, workshop, mission or release-identity change;
- no compatibility duplicates or shims;
- every old phase-report path must disappear;
- moved files remain byte-identical except reports whose explicit relative document paths must change;
- release ZIP must include the new paths and exclude the old paths;
- FAST and FULL must remain green with zero side effects.
