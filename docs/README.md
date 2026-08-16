# VAW Documentation Index

This index separates **current truth**, **current evidence**, **technical contracts/reference** and **history**.

## Current truth

Only these files define active project state/direction:

- [`../README.md`](../README.md)
- [`../AI_PROJECT_MEMORY.md`](../AI_PROJECT_MEMORY.md)
- [`../PROJECT_VISION.md`](../PROJECT_VISION.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../ROADMAP.md`](../ROADMAP.md)
- [`../AGENTS.md`](../AGENTS.md)

If one conflicts with live source or new owner/manual evidence, the document is wrong and must be corrected.

## Current evidence

- [`CODE_REALITY_AUDIT.md`](CODE_REALITY_AUDIT.md) — P1 source/product audit supporting the current P2 work order. It is evidence, not independent roadmap authority.

When a current evidence document is superseded, move it to `history/` rather than leaving multiple active audits.

## Technical contracts and reference

These documents describe implementation boundaries or tool formats. They do **not** prove product quality or feature completeness:

- `adr/` — architecture decision records; read each ADR status. Superseded process ADRs are historical context, not current project-state authority;
- `visual_asset_pack_v1.md` — renderer-facing Visual Asset Pack contract;
- `blockbench_import_studio.md` — Studio integration reference;
- `mission_map_terrain_authoring.md` — mission-map/terrain authoring reference;
- `research/programming_model.md` — design intent for future programmable-machine layers; explicitly not an implementation claim.

Tool-local documents under `tools/**/docs/` are local implementation notes/reference. They are not project-state authority unless a current document explicitly promotes a specific contract.

## History — never current authority

Everything under [`history/`](history/) is historical evidence.

It contains old milestone/phase reports, readiness reviews, validation snapshots, roadmaps, agent handoffs, recovery packages/reports, workflow instructions, repository-reorganization reports and changelog material.

Historical files are preserved because they contain useful design reasoning and evidence. Their words `current`, `stable`, `ready`, `next`, `complete` or branch names apply only to the old checkpoint in which they were written.

**Never use a file under `docs/history/` to decide the active branch, next milestone or current feature status.**

## Practical reading order

1. root current docs;
2. current evidence when the task depends on its findings;
3. exact source involved in the task;
4. relevant contract/ADR;
5. history only when the reason behind an old decision is needed.

Do not begin by recursively reading the history archive.
