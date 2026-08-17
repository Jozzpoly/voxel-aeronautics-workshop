# Stage 1.1 — Cross-platform Release Reproducibility

Date: 2026-06-18

## Base and scope

```text
branch=maintenance/workflow-repair-clean
base_sha=eaa5e01fcccef4d801106e150ff59a1761f11a87
product_source_changed=NO
gameplay_changed=NO
```

Stage 1.1 changes only release construction, verification, release tests, the validation plan, CI and the active workflow closeout documents required by those changes.

## Source-byte contract

The release pipeline distinguishes four byte views:

1. **raw checkout bytes** — physical bytes in a local worktree; diagnostic, not release identity;
2. **canonical text bytes** — valid UTF-8 with CRLF and bare CR normalized to LF;
3. **Git blob bytes** — repository history identity, kept separate from release normalization;
4. **exact archive bytes** — canonical text or byte-exact binary payloads with deterministic ZIP metadata and ordering.

The machine-readable contract is:

```text
text=utf-8-lf
binary=byte-exact
archive=deterministic-stored-zip-v1
```

`.gitattributes` improves checkout consistency, but release correctness does not depend only on `core.autocrlf` or filesystem metadata.

## Implementation

- `SOURCE_MANIFEST.json` hashes the canonical bytes consumed by the release builder.
- Single HTML embeds the same canonical application-source view.
- Source ZIP text members use canonical UTF-8/LF bytes.
- Binary members retain exact bytes.
- ZIP member names are sorted and unique.
- ZIP timestamps, creator system, file modes and storage method are fixed.
- Declared executable scripts receive deterministic mode `100755`; regular files receive `100644`.
- The verifier checks the complete ordered inventory, every source member, embedded sources, external checksums, internal checksum and ZIP metadata against the same contract.

## Full-tree LF/CRLF proof

`tests/test_cross_platform_release_reproducibility.py` creates two complete copies of the project source tree:

- an LF checkout;
- a CRLF checkout.

It proves physical text-byte differences while requiring identical canonical manifest content, embedded application sources, single HTML, source ZIP, checksum file, ordered inventory and repeated builds. A binary fixture is included in both complete trees to prove byte exactness.

## Validation state

```text
STATIC=PASS
LF_CRLF_FULL_TREE=PASS
RELEASE_BUILD=PASS
VERIFIER=PASS
DOCUMENTATION_CONTRACT=PASS
FAST=PASS
LOCAL_LINUX_FULL=PASS
PUBLISHED_SHA_LINUX_FULL=CI_PENDING
WINDOWS_FULL=CI_PENDING
CROSS_PLATFORM_RELEASE_REPRODUCIBILITY=CI_PENDING
```

Do not replace `CI_PENDING` with `PASS` until Linux FULL and Windows FULL both pass on the same exact published commit SHA.

## Deferred scope

Stage 1.1 does not change application behavior, Blueprint v11, CompiledCraft V4, RuntimeAssemblyPlan V2, tracked historical releases or Gate C architecture. Cosmetic repository reorganization remains frozen.
