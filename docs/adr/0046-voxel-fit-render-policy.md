# ADR 0046 - Voxel Fit Render Policy

Status: Draft

## Context

Module visuals in the game renderer are placed on a unit-spaced logical grid, but every procedural and fallback block root is uniformly shrunk by a hidden `0.96` scale factor. Placement, physics, blueprint topology and compiler output remain unit-spaced; only the visible mesh group is smaller. The result is a persistent ~4% visible gap between adjacent blocks that reads as a renderer policy, not a grid defect.

The shrink is applied in `game.module-visual-factory` at `createModuleVisual` time on the stable VAW root group that also owns the `vawHitProxy`. Imported glTF subtrees mount under that root, so the scale affects procedural geometry, registered visual assets and ghost previews alike. M4L Visual Truth closed render-environment parity at the current shrink; changing scale without an explicit contract risks false PASS on hit testing, ghost readability, selection and Studio/game preview alignment.

Roadmap planning on 2026-07-07 rejected a single-PR removal of `0.96` (variant W1: no baseline) and selected variant **W2**: audit first, then named policy at `0.96` with no visual delta, then regression tests, then an optional `1.0` experiment behind a dev flag after proof.

## Decision

Adopt **W2** as the M5 execution contract:

1. **m5-000 (this ADR)** — audit and document the `0.96` call-site inventory; classify greedy-meshing boundaries; define validation gates. No product behavior change.
2. **m5-001** — introduce a named constant `MODULE_VISUAL_CELL_SCALE` in `src/game/module_visual_factory.js`, default **`0.96`**, replacing the magic number. Zero visual delta at default.
3. **m5-002** — add hit-proxy and ghost-placement regression tests that lock behavior at scale `0.96` before any scale change is accepted.
4. **m5-003** — optional owner-controlled experiment: dev-flag path to scale **`1.0`**, with `npm run parity:capture` re-baseline before promotion.

Studio preview and game runtime must consume the **same** cell-scale policy once m5-001 lands. M4L renderer profiles (`STUDIO_PREVIEW_PROFILE`, `GAME_DEFAULT_PROFILE`, `GAME_STUDIO_PARITY_PROFILE`) govern lighting and environment only; cell fit is a separate shared policy owned by the module visual factory seam.

### Greedy meshing boundaries

Future greedy meshing is an optimization pass on **structural render candidates** only. It must not merge visuals across categories that break selection, animation, damage or imported-asset boundaries.

| Category | Greedy-mesh candidate | Rationale |
|----------|----------------------|-----------|
| Structural hull-like blocks (e.g. Hull, simple mass panels) | Yes, after M5 contract tests | Homogeneous faces; no per-block animation seam |
| Functional blocks (Core, Thruster, Fuel, power/actuation) | No | Gameplay semantics, gimbal channels, effect slots |
| Animated or rig-driven blocks (VectorThruster, articulated previews) | No | Per-node motion; ADR 0045 rig profiles |
| Imported / registered visual assets | No | External bounds, overflow and material policy (ADR 0043) |
| Damaged or state-variant visuals | No | Identity and material state must stay per block |
| Ghost / placement preview instances | No | Opacity and hit-proxy contract are placement UX |

Greedy meshing remains **out of scope** for M5 phase 1. m5-005 may extend boundary classification documentation; no greedy merge ships before the block-fit contract and render-stat baseline (m5-004) exist.

## 0.96 call-site inventory

Authoritative audit as of m5-000. Only renderer cell-fit sites affect this ADR.

| Location | Value | Classification |
|----------|-------|----------------|
| `src/game/module_visual_factory.js` line **33** | `root.scale.set(0.96, 0.96, 0.96)` | **Primary cell-fit policy** — sole authoritative shrink applied to every module visual root |
| `src/game/module_visual_factory.js` line 149 | Balloon dome material `opacity: … 0.96` | **Excluded** — material alpha, not spatial cell scale |
| `release/**` HTML snapshots | `root.scale.set(0.96, …)` | **Excluded** — frozen release artifacts; not runtime authority |
| `src/foundation/config.js`, `styles.css`, terrain JSON | `0.96` roughness / CSS alpha | **Excluded** — unrelated numeric coincidence |

No other `src/**` runtime path applies module cell shrink. Studio local preview does not currently import `module_visual_factory`; parity depends on mirroring `MODULE_VISUAL_CELL_SCALE` through the shared visual factory seam in m5-001 rather than duplicating a second magic number.

## Consequences

- Block gaps become an **explicit, named** renderer policy instead of an undocumented implementation detail.
- Hit-proxy geometry scales with the root group today; tests in m5-002 must assert raycast bounds, selection and ghost opacity at the active scale before `1.0` is considered.
- Promoting scale `1.0` changes visible flush fit and may shift M4L capture metrics; m5-003 requires parity re-capture, not assumption of PASS.
- Imported visuals that intentionally overflow a unit cell must document overflow in the visual pack contract; flush fit at `1.0` does not authorize silent bounds clipping.
- Greedy meshing work stays blocked until structural classification, hit-proxy proof and a render-stat baseline exist.

## Validation gates

| Gate | Task | Requirement |
|------|------|-------------|
| G0 — Audit | m5-000 | ADR 0046 draft accepted; inventory complete |
| G1 — Explicit policy | m5-001 | `MODULE_VISUAL_CELL_SCALE === 0.96`; no visual delta vs pre-M5 |
| G2 — Placement proof | m5-002 | Hit-proxy + ghost regression tests green at `0.96` |
| G3 — Scale experiment | m5-003 | Dev-flag `1.0` only after G2; `parity:capture` re-baseline if promoted |
| G4 — Optimization readiness | m5-004 / m5-005 | Render-stat baseline + greedy boundary doc before merge claims |
| Milestone close | M5 phase 1 | G0–G2 complete; ADR 0046 status promoted to **Accepted** |

Each wave ends with `validate:fast` 6/6, task validation, and evidence JSON under `.codex/agent_mesh/assignments/` per PROOF policy.