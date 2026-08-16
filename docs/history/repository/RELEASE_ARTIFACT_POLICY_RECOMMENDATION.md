# Release Artifact Policy Recommendation

Status: Recommendation; owner decision required before migration
Last verified: 2026-06-29
Authority: Repository policy evidence, not an executed cleanup.

The tracked `release/` directory currently contains historical single-file release HTML artifacts plus `SHA256.txt`. Foundation Hardening M1 does not delete or migrate those files.

## Recommendation

Move historical binary-style release artifacts out of Git during a dedicated owner-approved migration:

- publish historical HTML/ZIP artifacts through GitHub Releases or tags;
- keep source manifests, checksums, release notes and reproducibility evidence in Git;
- keep generated validation releases under `.agent-validation/<run>/release/`;
- keep `dist/` as ignored local output.

## Rationale

Tracked historical release output is useful evidence, but it increases repository weight and makes release policy ambiguous. Source, checksums and reproducibility scripts are the long-term authority; bulky historical artifacts are better attached to immutable release records.

## M1 Decision

No files under `release/**` are removed, regenerated, normalized or migrated in Foundation Hardening M1. Any cleanup requires an explicit owner decision and a separate migration with release verification before and after.
