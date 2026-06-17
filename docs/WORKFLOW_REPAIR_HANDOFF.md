# Workflow Repair Handoff

## Current source of truth

```text
repository=Jozzpoly/voxel-aeronautics-workshop
active_branch=maintenance/workflow-repair-clean
trusted_parent_sha=d386bc56659b2fa99ed406dd68ed9781cc6dba1e
stage1_commit=306d5690cae647066acc00a80bcf26a1d47c0441
stage1_closeout_commit=4de64fdea17d4fa2af896e9c3b005679096fff84
stage1=PUBLISHED_AND_CLOSED
documentation_convergence_stage2=eaa5e01fcccef4d801106e150ff59a1761f11a87
documentation_convergence_stage2_status=PUBLISHED_AND_CLOSED
stage1_1_candidate_base=eaa5e01fcccef4d801106e150ff59a1761f11a87
stage1_1_status=LOCAL_LINUX_FULL_PASS_AWAITING_FINAL_SHA_CI
CROSS_PLATFORM_RELEASE_REPRODUCIBILITY=CI_PENDING
```

Always re-read the branch before work. The exact Stage 2 remote SHA is the branch head containing this document and must be read back after publication.

## Historical branch warning

`maintenance/workflow-bootstrap` at `a983f02f86184798fb804d582c0da15264fccab1` is incomplete historical evidence. Do not merge it, extend it, use it as transport, reset it, delete it automatically or force-push it.

## Delivered workflow capability

Stage 1 provides durable validation, exact resume identity, tracked/untracked/ignored/mode/symlink side-effect detection, controlled interruption and timeout cleanup, isolated FULL artifacts and safe delivery tooling.

Stage 2 adds:

- `docs/README.md` as the authority index;
- Workflow V3 in `AGENT_WORKFLOW.md` and `DELIVERY_WORKFLOW.md`;
- active/supporting/recovery/history classification;
- historical review archive and index;
- tests that reject stale active publication state and old review placement;
- a freeze on cosmetic repository Stages 3–6 before Gate C.

## Platform evidence

```text
LINUX_STAGE1_FAST=PASS
LINUX_STAGE1_FULL=PASS
WINDOWS_TARGETED=PASS
WINDOWS_FAST=PASS
WINDOWS_FULL=PARTIAL
WINDOWS_FULL_FAILURE_CLASS=PRE_EXISTING_CRLF_SENSITIVE_SOURCE_MANIFEST
```

Do not convert the Windows FULL partial result into a Stage 1 regression. Resolve it in the separate Stage 1.1 milestone by defining canonical text bytes for release construction and verification.

## Stage 1.1 Cross-platform release reproducibility

Stage 1.1 uses canonical UTF-8/LF bytes for text, byte-exact binary bytes and deterministic stored ZIP members. `SOURCE_MANIFEST.json`, embedded application sources, source ZIP and verifier share this view. The full-tree LF/CRLF test is required locally; formal PASS additionally requires Linux FULL and Windows FULL on the same exact published SHA.

Current implementation evidence is documented in `repository/CROSS_PLATFORM_RELEASE_REPRODUCIBILITY_STAGE1_1.md`.

```text
STAGE1_1_TARGETED=PASS
STAGE1_1_COMPONENT=PASS
STAGE1_1_FAST=PASS
STAGE1_1_LOCAL_LINUX_FULL=PASS
STAGE1_1_PUBLISHED_SHA_LINUX_FULL=CI_PENDING
STAGE1_1_WINDOWS_FULL=CI_PENDING
```

## Documentation authority

Start at `docs/README.md`. Active documents must not contain stale unpublished markers, old active SHA claims or patch-first daily delivery. Historical reports remain historical and are not rewritten as current truth.

## Next sequence

1. Complete and publish the Stage 1.1 implementation from the exact Stage 2 SHA.
2. Require Linux FULL and Windows FULL on the same implementation SHA.
3. Publish the formal Stage 1.1 closeout.
4. Perform a stop-review and keep cosmetic repository moves frozen.
5. Create `foundation/gate-c-assembly-spaces` from the latest verified SHA.
6. Begin Gate C with an ADR and pure domain/serialization contract.

Do not start Device/Port Schema, ControlRuntime, walking, docking, broad interiors or placeholder future APIs before Gate C stabilizes spatial ownership.
