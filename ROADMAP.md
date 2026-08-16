# VAW Roadmap

This roadmap starts from the recovered reality of 2026-08-16. Historical Gate/M4/M5/M6 plans are archived under `docs/history/` and are not active commitments.

## P0 — Repository truth and recovery

**Complete** on the recovery lane.

- current documentation is small and internally consistent;
- old handoffs/roadmaps/workflows are history, not authority;
- stale process/generated release state was removed;
- `main` remains untouched until recovery promotion is justified.

## P1 — Code reality and technical-debt audit

**Complete** on the recovery lane. Detailed evidence: [`docs/CODE_REALITY_AUDIT.md`](docs/CODE_REALITY_AUDIT.md).

The audit classified major surfaces using `PROVEN`, `PARTIAL`, `ROUGH`, `STUB/CLAIM` and `ABSENT`, separating domain capability from runtime integration and actual product workflow.

The central conclusion is that VAW has a strong technical foundation but repeatedly stops before turning that capability into a coherent engineering loop. Confirmed high-value debt includes:

- incorrect multi-space weak-link analysis;
- control-authority prediction that does not match supported multi-body thruster routing;
- sandbox return discarding failure evidence needed for rebuild/learning;
- mechanical/runtime capabilities without corresponding authoring/control workflows;
- a still-heavy behavioral `src/game.js` composition root;
- duplicated prediction/runtime physics calculations;
- test coverage that mixes strong executable tests with source-shape/token guards.

## P2 — Recover the smallest truthful VAW loop

**Current phase.**

Target loop:

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

Repair order:

### P2-A — Engineering Analysis Truth

1. make topology/weak-link analysis Assembly-Space-correct;
2. align multi-body control-authority prediction with actual runtime thruster routing, or explicitly narrow/label the metric if exact prediction is not defensible yet;
3. add executable multi-space/multi-body analysis tests;
4. reduce duplicated prediction/runtime math only where the repair exposes a clean pure boundary.

Exit condition: engineering readouts do not knowingly contradict compiled topology or runtime control semantics for supported craft.

### P2-B — Test → Workshop Feedback Continuity

Preserve one bounded structured last-test result across flight cleanup, including sandbox. It should retain the first meaningful failure and enough block/load/impact/fuel-loss evidence to support the next rebuild without writing transient damage into Blueprint data.

### P2-C — Workshop Editing Fundamentals

Introduce a real selected-part/edit flow and expose existing high-value domain operations selectively instead of adding more future-facing domain APIs first.

### P2-D — Information architecture and visual polish

Only after truth and feedback continuity, simplify panels/camera/telemetry around the real task. Blockbench/visual work follows product needs rather than driving them.

## P3 — Selective salvage

Later branches (`VAW_GRoK`, mobile lanes and other post-mesh work) remain donor pools only.

Salvage one bounded capability at a time only when:

1. it solves a problem identified by the current audit;
2. its code can be understood independently of old agent status documents;
3. it preserves current architecture boundaries;
4. it improves the real product after manual validation.

Never merge donor branches wholesale.

## Long-term direction

Long-term product intent lives in `PROJECT_VISION.md`, not in this recovery roadmap. Device programming, richer mechanisms, renderer optimization, mobile support and broader content remain possible directions, but none is automatically the next milestone merely because an older roadmap named it.
