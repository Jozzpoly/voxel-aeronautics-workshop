# VAW Documentation Index

This index separates **current truth**, **technical contracts/reference** and **history**.

## Current truth

Only these files describe the active project state and direction:

- [`../README.md`](../README.md)
- [`../AI_PROJECT_MEMORY.md`](../AI_PROJECT_MEMORY.md)
- [`../PROJECT_VISION.md`](../PROJECT_VISION.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../ROADMAP.md`](../ROADMAP.md)
- [`../AGENTS.md`](../AGENTS.md)

If one of these conflicts with live source or new owner/manual evidence, the document is wrong and must be corrected.

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

It contains old:

- milestone/phase reports;
- readiness reviews;
- validation snapshots;
- roadmaps and planning rebases;
- agent handoffs;
- recovery packages/reports;
- workflow and push instructions;
- repository-reorganization reports;
- changelog material.

Historical files are preserved because they contain useful design reasoning and evidence. Their words `current`, `stable`, `ready`, `next`, `complete` or branch names apply only to the old checkpoint in which they were written.

**Never use a file under `docs/history/` to decide the active branch, next milestone or current feature status.**

## Practical reading order

For normal project work:

1. root current docs;
2. exact source involved in the task;
3. relevant contract/ADR;
4. history only when the reason behind an old decision is needed.

Do not begin by recursively reading the history archive.
