# ADR 0021 — Release Delivery Includes Repository Update Instructions

- Status: Accepted
- Phase: Foundation 1D.2E

## Context

A valid local commit was rejected because the remote `main` contained work missing from the local branch. Delivering correct files and green tests did not by itself tell the user how to synchronize, copy, validate and publish the release safely.

## Decision

1. Every artifact handoff must include exact repository-update instructions in the chat response and package documentation.
2. The full source ZIP is the repository source of truth; single HTML is a runnable release artifact.
3. The user synchronizes `main` with `git fetch` and `git pull --rebase origin main` before copying new sources.
4. The release is tested and rebuilt before commit.
5. Immediately before push, the user runs `git fetch` and `git rebase origin/main` again.
6. The standard push is `git push origin HEAD:main`.
7. Conflict resolution and `git rebase --abort` must be documented.
8. Routine force-push is prohibited.
9. `DELIVERY_WORKFLOW.md` is the persistent process contract for future agents.

## Consequences

- File delivery becomes reproducible rather than dependent on remembered Git commands.
- Concurrent remote changes are integrated before publication.
- The user retains control of the repository; an agent must state explicitly whether it performed any write.
