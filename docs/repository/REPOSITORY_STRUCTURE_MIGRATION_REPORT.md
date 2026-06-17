# Repository Structure Migration Report

Date: 2026-06-17

## Scope

This first migration increment archives phase delivery reports only. It does not move product source, tools, workflow tests, recovery evidence, review reports or tracked release artifacts.

## Exact migration manifest

| From | To | Pre-migration SHA-256 |
| --- | --- | --- |
| `PHASE_1C2_REPORT.md` | `docs/history/phases/PHASE_1C2_REPORT.md` | `cc39948853756c3e966848213d737e58b3b4a1760293fb639806f90b6f2ff49f` |
| `PHASE_1D1_REPORT.md` | `docs/history/phases/PHASE_1D1_REPORT.md` | `ea3f98891c9308e0767de7bff28594cae58bef3f7fa1e758d234fa39ac9776fb` |
| `PHASE_1D2A_REPORT.md` | `docs/history/phases/PHASE_1D2A_REPORT.md` | `f0fb8d6500bc86cccee60026c65e7273f0dbc918f43a19bbd3b25a642bbf3dea` |
| `PHASE_1D2B_REPORT.md` | `docs/history/phases/PHASE_1D2B_REPORT.md` | `0fefc0b9f68feda4e24f80149fc01a2df56d1a27a6f7b658ee7e205f8ad54eb5` |
| `PHASE_1D2C_REPORT.md` | `docs/history/phases/PHASE_1D2C_REPORT.md` | `36a85311610f425798ebf1136f8cd0a56b585845bba97a22b176bb8dcd562259` |
| `PHASE_1D2D_REPORT.md` | `docs/history/phases/PHASE_1D2D_REPORT.md` | `c5b06892777ecbfc6a12b93abc85c67f2f62a0481feba3b3d3601ef91d9ef239` |
| `PHASE_1D2E_REPORT.md` | `docs/history/phases/PHASE_1D2E_REPORT.md` | `5745a2da295ee1dbca01f75a4fcc4c9b7c8c2cbd5d37fd68d714ac9ce9dcbea8` |
| `PHASE_1D2F_REPORT.md` | `docs/history/phases/PHASE_1D2F_REPORT.md` | `2d9c1d0c8edebfc6deb5241836824cf79f3408b33d09ae3b78b435665534254c` |
| `PHASE_1D2_REPORT.md` | `docs/history/phases/PHASE_1D2_REPORT.md` | `a8c03c5c9570791cf47a2b30aaf50bc7d27c3dc1f15b47ba6c6554aae1682ca6` |
| `PHASE_1D3A_REPORT.md` | `docs/history/phases/PHASE_1D3A_REPORT.md` | `ec0186fc5b369bbb7368d998e9b341ad1039abaaa4ca98e8e6ba7e630b069a7e` |
| `PHASE_1D3B1_REPORT.md` | `docs/history/phases/PHASE_1D3B1_REPORT.md` | `8c69ba08bbc80ba9882ddafc2eab734611d3cdb2050dd8d6f86b0d2df65969b5` |
| `PHASE_1D3B_REPORT.md` | `docs/history/phases/PHASE_1D3B_REPORT.md` | `e27d61cd9ba7c9efe013a13470b06e9d3043dbc69b00fd65ca8acb84ad111201` |
| `PHASE_1D3C_REPORT.md` | `docs/history/phases/PHASE_1D3C_REPORT.md` | `55305ab8edca6a0a5eaf4fd211c6463494cc1f682e9836dd5698d92b327038e4` |
| `PHASE_1D3D_REPORT.md` | `docs/history/phases/PHASE_1D3D_REPORT.md` | `8bafdd9f0e92a829c456cf5faad7faee2573e3678fa22388a46be12ec42f646a` |
| `PHASE_1D3E_REPORT.md` | `docs/history/phases/PHASE_1D3E_REPORT.md` | `5acbfb7002e245540018f7656a7be1a9eeee033f745c943e2542f5f7a3f4a2ef` |
| `PHASE_1D4A_REPORT.md` | `docs/history/phases/PHASE_1D4A_REPORT.md` | `5798ba14966e0c944574c2f85bf7b2d86b467bd37f46d5743976097b8da76efc` |

## Required reference updates

- `README.md` mandatory-reading path;
- `AI_PROJECT_MEMORY.md` mandatory-reading path;
- `tests/test_documentation_contract.py` required/current-phase path;
- `tests/test_release_build.py` expected ZIP inventory;
- phase archive index;
- repository migration handoff and memory after validation.

## Compatibility policy

No compatibility copies or shims are permitted. Old root paths must disappear. The source ZIP retains all reports under the new paths.

## Rollback

Revert the migration commit or reverse-apply the migration patch. Because the increment is documentation-only, rollback does not require product-state or schema migration.

## Execution result

- Local workflow-repair checkpoint: `3078ea95e3124635f81a00614ed4d849282062a5`.
- Structure audit/target checkpoint: `2440d705e28756b1f2daf8a3f0b09874e847f1da`.
- First migration checkpoint: `727966e117fa7738d5b32ba759a932ae75014d10`.
- Repository root files: 51 before, 35 after.
- Phase reports archived: 16.
- Byte-identical renames: 12.
- Reports with deliberate relative-path corrections: 4 (`PHASE_1D2B_REPORT.md`, `PHASE_1D2C_REPORT.md`, `PHASE_1D3C_REPORT.md`, `PHASE_1D3D_REPORT.md`).
- Compatibility copies/shims: none.
- Product source, gameplay, schema, release identity and ADR content: unchanged.

## Validation results

```text
DOCUMENTATION_CONTRACT=PASS
RELEASE_BUILD_AND_ZIP_CONTRACT=PASS
MIGRATION_INVARIANTS=PASS
FAST_VALIDATION=PASS
FULL_VALIDATION=PASS
RELEASE_VALIDATION=PASS
SIDE_EFFECTS=0
LINGERING_PROCESSES=0
WINDOWS_EXECUTION=NOT-RUN
REMOTE_DELIVERY=BLOCKED/NOT_ATTEMPTED_FOR_THIS_INCREMENT
```

Measured on the delivery host:

- FAST: static `4.261 s`, foundation `0.118 s`, Gate B compilers `0.925 s`, audit regressions `1.374 s`, runner contract `60.251 s`; overall approximately `66.9 s`.
- FULL: core suite `88.920 s`, release build `1.680 s`, exact release verification `1.446 s`; overall approximately `92.0 s`.

The FULL summary reported zero side effects for every stage. The release ZIP contained all sixteen reports and the archive index under `docs/history/phases/`; no old root phase-report path remained.

## Critical review

The review checked:

- accidental content edits during `git mv`;
- exact Linux case of new archive paths;
- explicit document references inside moved reports;
- old-path absence in the repository root and release ZIP;
- ZIP inventory and deterministic build behavior;
- `SOURCE_MANIFEST.json` stability;
- working-tree cleanliness after FAST/FULL;
- lingering validation/build processes.

Two pre-checkpoint defects were found and fixed:

1. trailing whitespace introduced while editing the release inventory test;
2. an archive index that abbreviated ranges instead of naming every archived file individually.

A helper audit also initially treated test fixtures listing forbidden old paths as live references. The audit was corrected to distinguish assertions from active documentation paths.

## Deferred migration stages

1. Create an active `docs/README.md` index and classify review/test/validation reports.
2. Move dated recovery evidence in a dedicated increment.
3. Evaluate workflow documentation and workflow-test grouping.
4. Evaluate tool subdirectories only with command/import compatibility tests.
5. Resolve tracked historical `release/` policy separately.
6. Do not reorganize `src/` without a demonstrated ownership defect.
