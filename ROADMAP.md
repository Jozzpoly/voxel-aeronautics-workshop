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

**Complete** on the recovery lane.

- weak-link and exposed-fuel topology now uses compiled `rigidNeighborBlockIds` instead of reconstructing cross-space adjacency from positions;
- control percentages are explicitly `primary-body-local`; secondary-body Gyro no longer inflates them;
- articulated craft report the estimator boundary, including runtime pilot-routed secondary thrusters whose joint-coupled effect is not modeled;
- mission readiness no longer presents that partial articulated estimate as a whole-craft percentage;
- executable multi-space/multi-body tests cover the reproduced regression and control-scope behavior.

Exit result: the known topology contradiction is removed and the remaining articulated-control limitation is stated instead of guessed.

### P2-B — Test Evidence Continuity

**Complete** on the recovery lane.

- sandbox return captures one bounded `lastTestResult` before flight cleanup destroys transient state;
- contracts write the same evidence shape rather than a separate report model;
- first-failure runtime evidence now carries stable `blockId`/type/body identity when known;
- the snapshot retains lost block IDs (bounded), max impact, final load snapshot, fuel use and integrity;
- structured failure identity is cleared during later flight cleanup only after the bounded result has already captured it;
- transient damage remains outside Blueprint/CraftModel persistence.

Exit result: returning from a sandbox experiment no longer erases the minimum evidence needed for the next diagnosis/editing stage. Fixed-step scheduler-health persistence and workshop-facing inspection remain explicitly unresolved rather than being faked inside this milestone.

### P2-C — Workshop Editing Fundamentals

**Current milestone.**

Introduce a real selected-part/edit flow and expose existing high-value domain operations selectively instead of adding more future-facing domain APIs first. Start with stable selected-part identity, use preserved `lastTestResult.firstFailureEvent.blockId` to make failed-part diagnosis actionable when possible, and then enable editing of an existing placed part; do not broaden into a general mechanism/device framework.

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
