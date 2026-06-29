# ADR 0044 - Workflow checkpoint branch and CI policy

Status: Accepted

## Context

Foundation hardening exposed recurring drift between local checkpoint work,
active documentation, and CI branch triggers. Historical recovery and
maintenance branch names also remained in workflow files after the real work
had moved to `current_work`.

The repository needs a stable default that lets long agent sessions checkpoint
small verified changes without treating every checkpoint as a release matrix
event.

## Decision

`current_work` is the default checkpoint branch for multi-session work unless
Jozz explicitly names another branch.

`main` is the reviewed stable landing line.

Fast recovery validation may run on pushes to `current_work`, pushes to `main`,
pull requests targeting `main`, and manual dispatch.

Heavy release reproducibility validation runs on pushes to `main`, pull requests
targeting `main`, and manual dispatch. It should not be required for every
`current_work` checkpoint unless the owner explicitly accepts that cost.

Workflow files must not reference historical branch names unless Git verifies
that those branches are still intentionally active.

Agent final reports must include local SHA, remote SHA, validation tiers run,
and any failure classification: `PRODUCT`, `HARNESS`, `ENVIRONMENT`, `OWNER` or
`SCOPE`.

## Consequences

Agents can publish small checkpoints to `current_work` without changing the
stable landing line. CI remains useful on checkpoint pushes while release-heavy
jobs stay tied to reviewed or manual release intent.

Release artifact retention remains a separate owner decision.
