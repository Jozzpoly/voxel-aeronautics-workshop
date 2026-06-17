# Agent Workflow — Workflow V3 autonomous milestones

This is the operational contract for automated or assisted VAW changes. Product architecture, accepted ADRs and the user's current decision remain higher authority.

## 1. Core rule

> One exact base, one coherent milestone, one frozen candidate, one final validation sequence, one normal commit, and one remote SHA read back after push.

Safety means preventing irreversible errors, not maximizing patches, reports or repeated test runs.

## 2. Start gate

Before editing, record:

```text
REPOSITORY=
ACTIVE_BRANCH=
REMOTE_SHA=
LOCAL_HEAD=
MERGE_BASE=
WORKTREE=clean|dirty
MILESTONE=
ALLOWED_PATHS=
FORBIDDEN_PATHS=
TARGET_PLATFORM_REQUIREMENTS=
```

Stop only when the base is ambiguous, unrelated changes cannot be isolated, the milestone conflicts with a current product decision, or continuing requires destructive history operations.

Never write directly to `main` or a recovery branch without an explicit decision. Never extend or use `maintenance/workflow-bootstrap` as transport.

## 3. Work modes

### Mode R — direct Git

Use a real checkout and safe write access:

1. re-read remote SHA;
2. work on the dedicated branch;
3. use local commits only as internal checkpoints;
4. validate the frozen candidate;
5. create one normal milestone commit;
6. push without force;
7. re-read remote SHA;
8. close active documentation in the same milestone.

### Mode Z — one final milestone ZIP

Use only when direct connector/Git publication is blocked:

```text
README_FIRST.md
project/
evidence/
SHA256SUMS.txt
```

`project/` contains only repository-relative files intended for the commit. The user copies it once. Do not create a new ZIP after every targeted fix.

### Mode F — complete file

Use for one stable file replacement when the user already owns the checkout.

### Mode P — patch

Use only for recovery, independent audit or an environment where complete files cannot be copied.

Priority:

```text
direct Git > one milestone ZIP > complete single file > patch
```

## 4. Milestone scope

A milestone closes a reviewable capability or closure result. Do not stop after a plan, targeted PASS or local checkpoint.

Good milestones include documentation convergence, cross-platform release reproducibility and one bounded Gate C capability. Do not mix gameplay, schema, workflow, release engineering and repository cosmetics without a direct dependency.

Stage only the reviewed path set. Do not use uncontrolled repository-wide staging to conceal unknown files. Validation must not reset, clean, stage, commit, rebase or push as a side effect.

## 5. Validation ladder

```text
T0 STATIC
T1 TARGETED
T2 COMPONENT
T3 FAST
T4 FULL
T5 TARGET PLATFORM
```

- T1 may run repeatedly.
- T2 runs after a complete class of changes.
- FAST normally runs once or twice.
- FULL runs once on the frozen candidate when release/integration scope requires it.
- Repeat FULL only after a production or release-sensitive change.
- Report Linux, Windows, browser and cross-platform claims separately.
- A pre-existing independent failure is classified honestly instead of silently blocking unrelated work.

Validation artifacts live only under `.agent-validation/` or the selected run directory. The runner records durable summaries, event logs and stage logs, detects tracked/untracked/ignored/mode/symlink side effects, and never repairs the worktree.

## 6. Stop-loss and blockers

Change strategy after the second same-class failure, repeated manual intervention, repeated packaging cycles, or long effort without increased capability or decisive evidence.

For a real blocker, try at most three genuinely different safe mechanisms. Allowed progression is normal remote Git, normal local commit plus one ZIP, then complete files with explicit instructions.

Never bypass safeguards, obfuscate payloads, split writes to evade controls, force-push, silently rewrite history or use a historical branch as transport.

## 7. Documentation closeout

Closeout is part of Definition of Done.

Before publication:

- update active current-state documents;
- remove stale active unpublished markers, obsolete branch/SHA and patch-first instructions;
- preserve historical reports as history;
- make documentation tests reject stale active statuses;
- identify the next exact remote base in the final report.

## 8. Communication and final report

Progress updates are informational and normally require no response. Ask only for a real product decision, credentials, data-loss risk or destructive/non-fast-forward operation.

Final report:

```text
MILESTONE=
BASE_SHA=
COMMIT_SHA=
REMOTE_SHA=
LOCAL_EQUALS_REMOTE=
CHANGED_PATHS=
TARGETED=
COMPONENT=
FAST=
FULL=
TARGET_PLATFORM=
WORKTREE_AFTER=
KNOWN_NON_BLOCKING_RISKS=
DEFERRED_SCOPE=
NEXT_BASE_SHA=
NEXT_RECOMMENDED_MILESTONE=
```
