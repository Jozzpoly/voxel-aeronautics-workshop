# VAW Documentation Index

This index defines the authority and lifecycle of project documents. When documents disagree, use this order:

1. the user's explicit current decision;
2. the latest verified remote SHA of the active branch;
3. source code and direct test evidence from that SHA;
4. active product and workflow contracts listed below;
5. accepted ADRs and current architecture/readiness documents;
6. current supporting evidence;
7. recovery evidence and retrospectives;
8. historical reports, old prompts, synthetic commits and obsolete patch instructions.

Historical documents preserve what was true at the time. They are evidence, not current instructions.

## Active product source of truth

- [`../README.md`](../README.md) — project entry point and current release summary.
- [`../PROJECT_VISION.md`](../PROJECT_VISION.md) — durable product pillars.
- [`../AI_PROJECT_MEMORY.md`](../AI_PROJECT_MEMORY.md) — compact current state and continuation guardrails.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — current architecture and ownership boundaries.
- [`../ROADMAP_NEXT.md`](../ROADMAP_NEXT.md) — current product sequence.
- [`../FOUNDATION_READINESS_REVIEW.md`](../FOUNDATION_READINESS_REVIEW.md) — Gate B closeout and Gate C readiness.
- [`../PROGRAMMABLE_MACHINE_RESEARCH.md`](../PROGRAMMABLE_MACHINE_RESEARCH.md) — deferred Gate D/E research; it does not authorize implementation before Gate C.

Current product state: Foundation Phase 1D.4A, Gate B closed, Gate C — Assembly Spaces / Sublevels next.

## Active workflow contracts

- [`../AGENT_WORKFLOW.md`](../AGENT_WORKFLOW.md) — Workflow V3 milestone execution.
- [`../DELIVERY_WORKFLOW.md`](../DELIVERY_WORKFLOW.md) — Git-first publication and one-ZIP fallback.
- [`../PUSH_INSTRUCTIONS.md`](../PUSH_INSTRUCTIONS.md) — safe normal commit/push procedure.
- [`WORKFLOW_REPAIR_HANDOFF.md`](WORKFLOW_REPAIR_HANDOFF.md) — Stage 1/Stage 2 handoff and known platform evidence.

The default transport order is:

```text
direct Git > one final milestone ZIP > complete single file > patch for recovery/audit
```

A milestone is not closed while an active document still carries an unpublished status marker, names an obsolete active SHA, or requires patch-first micro-delivery.

## Accepted ADRs

Accepted decisions live in [`adr/`](adr/). ADR 0033–0040 define the current Mechanical Platform Convergence contracts. ADRs are immutable evidence except for explicit status or supersession metadata.

Gate C requires a new accepted ADR before implementation expands spatial ownership.

## Current supporting evidence

- [`../CODE_REVIEW_REPORT.md`](../CODE_REVIEW_REPORT.md)
- [`../TEST_REPORT.md`](../TEST_REPORT.md)
- [`../VALIDATION_REPORT.md`](../VALIDATION_REPORT.md)
- [`history/phases/PHASE_1D4A_REPORT.md`](history/phases/PHASE_1D4A_REPORT.md)
- [`repository/REPOSITORY_STRUCTURE_AUDIT.md`](repository/REPOSITORY_STRUCTURE_AUDIT.md)
- [`repository/REPOSITORY_STRUCTURE_TARGET.md`](repository/REPOSITORY_STRUCTURE_TARGET.md)
- [`repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md`](repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md)
- [`repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md`](repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md)

Supporting evidence explains or validates current contracts but does not outrank them.

## Recovery evidence

Dated recovery reports remain in the repository root until a separate reference-safe recovery migration is justified. The active recovery baseline currently references:

- `RECOVERY_AUDIT_2026-06-16.md`
- `RECOVERY_BASELINE_TESTS.md`
- `BROWSER_RECOVERY_SCENARIO_2026-06-16.md`
- `RECOVERY_VALIDATION_REPORT_2026-06-16.md`

Read them before changing input focus, flight thruster routing, mechanical visuals, hinge-authoring cancellation or lifecycle cleanup. They do not replace the current architecture or product roadmap.

## Historical and superseded material

- [`history/phases/`](history/phases/) — phase delivery reports.
- [`history/reviews/`](history/reviews/) — superseded reviews retained byte-for-byte.
- Old autonomous prompts, patch stacks, synthetic local commit IDs and the incomplete `maintenance/workflow-bootstrap` branch are historical evidence only.

## Repository-reorganization freeze

Documentation Convergence Stage 2 is the final planned cosmetic repository-reorganization increment before Gate C. Stages for recovery documents, workflow namespaces, tools, tests and tracked releases are frozen unless a concrete blocker directly affects data safety, deterministic builds, supported-platform execution, source-of-truth clarity or Gate C validation.
