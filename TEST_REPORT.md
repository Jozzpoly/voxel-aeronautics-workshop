# Test Report — Foundation Phase 1D.4A

## Environment

- Node: `v22.16.0`
- Python: `3.13.5`
- Clean 1D.3E baseline working commit: `9cca3be1b39d6276e2db8e99f847a19f10560dab`
- Baseline source-tree SHA256: `fd2f60125a5db11cd5830f602316e006e2ec37f897c752f65ac5d675ea0d9d4e`

## Final required commands

```bash
python -u tests/run_all.py
python tools/build_release.py
python tools/verify_release.py
git diff --check
```

Final full runner result: **PASS**.

- wall time: `34.91 s`;
- maximum RSS: `312520 KB`;
- application sources syntax-checked: 41;
- startup result: `singleBodyLifecycle: ok`, `articulatedUiLifecycle: ok`.

An earlier wrapper attempt was terminated by the host at 180 seconds while entering `tests/test_release_build.py`. It was not counted as a pass. The missing release-build stage passed separately in `3.02 s`, and the entire runner was then repeated successfully from the beginning with the result above.

## Schema, model and compiler coverage

- Pure stepwise legacy migrations through v11 and v10→v11 block-ID preservation.
- Current-v11 strict duplicate block/link IDs and malformed face/axis/configuration rejection.
- CraftModel move/delete/copy/link transactions, link endpoint remapping and history restoration.
- Import/export/autosave normalization parity and example v11 import.
- Structural adjacency emitted exactly once with deterministic edge IDs.
- Rigid-island anchors, stable body IDs, root/Core ownership and per-island mass/COM/inertia.
- Rigid bypass, legal mechanical cycle and combined disconnected-assembly diagnostics.
- Deterministic signatures/output under 100 seeded block/link permutations.
- 200 seeded authoring move/delete/copy/link operations with invariants.
- 2500-block structural compilation: `77.81 ms`.
- 2500 blocks with 361 valid cuts: compile `185.65 ms`, Plan V2 `41.72 ms`.
- 300 invalid-link diagnostics: `115.40 ms`.

## Plan/runtime/gameplay coverage

- Plan V2 body-local positions, body assembly poses and root/sub-body spawn composition.
- Local A/B pivots round-trip to the same assembly-space point.
- Payload changes only owner-body mass/COM/inertia/colliders and owner-side pivots.
- Normal `CraftModel → Compiler V4 → Plan V2 → FlightSession → AssemblyBuilder → real Cannon` articulated path.
- Two visual roots with independent body transforms.
- Collision queue and nearest-part damage remain owner-body scoped.
- Damage/support propagation does not cross a mechanical cut edge.
- Endpoint failure removes its constraint backend-first.
- Connected-body rebase guard rejects mutation before pivot drift can occur.
- Root-only pilot actuator policy and single-body control/mission regression.
- File-input import of the articulated example, workshop hinge visibility and normal Flight-button launch.
- 50 articulated start/stop cycles: orphan bodies `0`, orphan constraints `0`.

## Physics evidence

### Real Cannon 0.6.2 body benchmark

| Colliders | Median build | Median step | p99 step |
|---:|---:|---:|---:|
| 100 | 4.849 ms | 0.0226 ms | 0.0521 ms |
| 500 | 42.719 ms | 0.1066 ms | 0.1388 ms |
| 1000 | 142.221 ms | 0.2258 ms | 0.3260 ms |
| 2500 | 851.042 ms | 0.5592 ms | 0.7093 ms |

- real-Cannon long soak: 12,000 steps;
- real-Cannon lifecycle cycles: 50;
- measured lifecycle heap delta: 424 bytes;
- motor target/measured: `1.5 / 1.5`;
- servo target/measured: `-0.5 / -0.5`;
- configured soft limits: `[-0.3, 0.3]`;
- observed soft range: `[-0.317613, 0.31621]`;
- contacts with `collideConnected=false/true`: `0 / 4`;
- maximum free-hinge pivot drift: `0.004689`;
- maximum 12,000-step pivot drift: `0.076684`.

## Build/release coverage

- single-file syntax;
- embedded source parity;
- source ZIP parity;
- packaged single-file parity;
- manifest hashes;
- deterministic builds;
- release identity;
- documentation contract;
- explicit composition and no `window.VAW_RUNTIME` aggregate.

The delivery includes the complete console logs. No test is described as passing unless it was executed successfully.
