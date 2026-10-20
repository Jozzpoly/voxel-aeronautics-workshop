# VAW Historical Archive

**Everything in this directory is non-authoritative history.**

Historical documents are preserved because they contain useful reasoning, evidence, experiments and implementation context. They must never override live source, current manual evidence or the active root documentation.

A historical document may contain words such as `current`, `stable`, `ready`, `next`, `complete`, old branch names or old milestone numbers. Those statements apply only to the checkpoint in which the document was written.

## Archive areas

- `phases/` — old phase reports;
- `reviews/` — historical reviews/readiness assessments;
- `validation/` — old validation snapshots/evidence;
- `planning/` — superseded roadmaps and planning rebases;
- `handoffs/` — old agent/session handoffs;
- `workflows/` — superseded agent/delivery/push instructions;
- `recovery/` — older recovery evidence, separated by date;
- `research/` — superseded research notes retained for context;
- `repository/` — old repository-structure/release-policy reviews;
- `CHANGELOG.md` — historical change log from the pre-recovery documentation model.

## Rule for agents

Do not recursively ingest this archive as a startup procedure. Read a historical file only when investigating why a specific decision or piece of code exists.

Current project truth starts at repository root: `README.md`, `AI_PROJECT_MEMORY.md`, `PROJECT_VISION.md`, `ARCHITECTURE.md`, `ROADMAP.md` and `AGENTS.md`.
