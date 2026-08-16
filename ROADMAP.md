# VAW Roadmap

This roadmap starts from the recovered reality of 2026-08-16. Historical Gate/M4/M5/M6 plans are archived under `docs/history/` and are not active commitments.

## P0 — Repository truth and recovery

Current.

- keep one clearly identified recovery lane;
- make current documentation short and internally consistent;
- remove stale active branch/milestone instructions;
- move handoffs, old roadmaps, readiness reviews and old workflow instructions into history;
- ensure tests enforce the current/history boundary instead of old milestone vocabulary;
- do not modify gameplay merely to make recovery documentation look complete.

Exit condition: a new agent can identify the current source, current uncertainty and next task without reading historical material.

## P1 — Code reality and technical-debt audit

Next.

Audit the actual source rather than historical claims. For each major subsystem classify the state as:

- `PROVEN` — demonstrated by code evidence and meaningful runtime/manual behavior;
- `PARTIAL` — real implementation exists but important capability is missing;
- `ROUGH` — works in some form but quality/design is not acceptable;
- `STUB/CLAIM` — documentation/tests imply more than the implementation provides;
- `ABSENT` — desired capability does not exist.

The audit should cover at least:

- build/editing flow;
- launch/test lifecycle;
- manual controls;
- physics and failure behavior;
- mechanical links/hinges;
- camera and UI/workspace architecture;
- telemetry/diagnostics;
- persistence/save/load;
- visual asset pipeline and renderer;
- mission/terrain systems;
- release/build tooling;
- test architecture and generated provenance;
- coupling, oversized modules, duplication and dead/legacy code.

Synthetic tests are supporting evidence, not the verdict.

## P2 — Define the smallest real VAW loop worth polishing

Only after P1.

Choose the minimum product surface that should feel coherent:

```text
build
-> understand what was built
-> launch/test
-> control the machine
-> observe physics/failure
-> understand the result
-> return
-> rebuild
```

Fix the highest-leverage blockers to that loop before broad feature expansion.

## P3 — Selective salvage

Later branches (`VAW_GRoK`, mobile lanes and other post-mesh work) are donor pools only.

Salvage one bounded capability at a time only when:

1. it solves a problem identified by the current audit;
2. its code can be understood independently of old agent status documents;
3. it preserves current architecture boundaries;
4. it improves the real product after manual validation.

Never merge the donor branches wholesale.

## Long-term direction

Long-term product intent lives in `PROJECT_VISION.md`, not in this recovery roadmap. Device programming, richer mechanisms, renderer optimization, mobile support and broader content remain possible directions, but none is automatically the next milestone merely because an older roadmap named it.
