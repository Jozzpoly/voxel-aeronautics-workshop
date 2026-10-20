# Roadmap Rebase - Visual Truth, Mechanics and Control

Status: Active strategic roadmap rebase
Date: 2026-07-01
Scope: near-term and mid-term direction after M4K, before broad Gate D/E work

This document captures the current owner feedback, the preliminary evidence, and the revised work order. It exists to prevent the next months of work from turning into disconnected fixes.

It does not change source-of-truth boundaries by itself. ADRs still accept durable architecture decisions. Source and tests still prove product behavior. `ROADMAP_NEXT.md` should stay the short route map; this file is the current detailed roadmap rebase behind it.

## Why A Rebase Is Needed

The previous roadmap had the right boundary discipline, but it is now too linear:

- M4K focuses on provenance and local visual-pack safety.
- Gate D is correctly deferred, but it is too broad to be the next practical target.
- Mechanical ambition, VectorThruster correctness, visual fidelity, block fit, effects and device tuning are now all converging.

If the project continues by taking whichever symptom is freshest, the likely result is a pile of small patches:

- one-off VectorThruster Euler fixes;
- asset color tweaks that hide a renderer color-space bug;
- hinge fields added before joint frames are designed;
- visual effects mixed into gameplay data;
- block gap removal without a renderer contract;
- premature signal/programming schema before simple device tuning is usable.

That would damage the project's core identity: build real machines from stable authored truth, then render and control them through explicit boundaries.

The recalibration rule after the external audit is: do not let infrastructure replace the game, but do not dismiss the asset pipeline as cosmetic. For VAW, Blockbench/Studio-to-game visual iteration is a core creative workflow. The boundary is that asset tooling must remain renderer-only while gameplay authority stays in catalog, Blueprint, CraftModel, compiler output and accepted runtime contracts.

## Owner Feedback Captured

The latest owner feedback is treated as roadmap input, not as isolated bugs:

1. Balloon texture looks correct in Studio and Blockbench, but much darker in the game. Other blocks may share this, but Balloon makes it most visible.
2. Thruster fire needs better control and better visual quality. Future work should support richer effects, animated fire/smoke textures and eventually a Studio particle/effects editor.
3. Blocks should ultimately fit flush, without the current small visible gap. This supports a cleaner voxel identity and future greedy meshing.
4. Hinge is too primitive and too narrow. Future mechanics need more axes, explicit orientation, explicit center/pivot control, better servo behavior and advanced mechanical connections.
5. The game is approaching the point where engines and blocks need per-block tuning, binding and dependency control.
6. Individual block binding, simple "what depends on what" logic, and simple mechanism programming are a high-value direction.
7. VectorThruster nozzle rotation is still wrong in some cases: sometimes inverted, sometimes on the wrong rotation axis.
8. A critical missing proof is a test that compares visual nozzle direction with the real force direction across all 24 block orientations. Without that, any axis fix can look correct in one setup and break another.

## Preliminary Evidence From 2026-07-01

Commands run:

```text
git status --short --branch
git rev-parse HEAD origin/current_work origin/main
git log --oneline --decorate origin/current_work..HEAD
git diff --name-only -- SOURCE_MANIFEST.json assets/visual_packs release
node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
npm.cmd run browser:smoke
```

Observed state:

- `HEAD` and `origin/current_work` both point at `914eb88d9ad70831ccc5c800bfb68c4330d78dcf`.
- The worktree has dirty local visual-pack files only:
  - `assets/visual_packs/installed_visual_packs.json`
  - `assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json`
- The current local Balloon manifest has inherited thruster bindings again:
  - `assets[4].bindings.nodes.flame = "thuster_fire"`
  - `assets[4].bindings.nodes.gimbalAssembly = "thuster_nozzle"`
- Visual-pack audit is `ok: false` because those Balloon bindings point at missing Balloon nodes and are unusual for Balloon.
- The audit's dry-run cleanup suggestion is to set both optional Balloon bindings to `null`.
- `npm.cmd run browser:smoke` passes with `starterBlocks: 17`, `flightMode: true` and `consoleErrors: 0`.
- In-app Browser loaded `http://127.0.0.1:8765/index.html`.
- Runtime console warnings reported duplicate material override names such as `material_0` and `material_0__fire_blend`. This is not a startup failure, but it is relevant to visual fidelity and material-authoring diagnostics.

## M4L Implementation Update - 2026-07-01

Current M4L evidence after the first implementation pass:

- Balloon inherited binding cleanup remains closed; the local visual-pack audit reports `ok: true`.
- `tools/visual_parity_baseline.py` now compares all local imported block visuals: Balloon, Hull, Fuel, Thruster and VectorThruster.
- The baseline classifies the visible darkness as a shared imported-visual renderer/preview mismatch, not a Balloon-only asset-data problem.
- The game renderer now matches Studio's sRGB output policy through `src/game/scene_environment.js`.
- Remaining visual parity evidence points at lighting, fog, shadows and preview-scene differences; the next proof should be a diagnostic render/capture under Studio-matched lighting/fog/shadow conditions.
- `npm.cmd run probe:vector-thruster` now passes for both the runtime-default profile and `local_vector_thruster_visual`: `192 / 192` sampled cases pass with zero mismatches.
- ADR 0045 was sufficient for this VectorThruster fix; no richer gimbal-frame ADR is required unless a future imported rig cannot pass the same probe through per-profile axis/sign metadata.

## Source-Of-Truth Rules That Must Survive

These rules are more important than any single feature:

1. Blueprint, CraftModel and compiler outputs remain authoritative for machine state.
2. Visual Asset Pack remains renderer-only.
3. Effects can react to gameplay signals, but cannot define force, fuel, heat, mass, control semantics or physics.
4. Runtime visuals can diagnose and animate; they cannot become hidden gameplay truth.
5. Persistent mechanical/device/control identities must be stable authored identifiers, not runtime `bodyId`.
6. Local user-authored visual art under `assets/visual_packs/local_working_visuals/**` is not disposable cache.
7. A future roadmap document must either supersede this one explicitly or update it; do not accumulate competing active roadmaps.
8. `current_work` can land on `main` only after local changes are classified, intended changes are staged deliberately, clean-candidate validation passes and the merge path is explicit.
9. Tracked `release/**` history cleanup is a separate repo-policy milestone. Do not mix it with M4L, Gate D, mechanics or visual bugfix work.

## Critical Diagnosis

### A. Texture Darkness Is A Pipeline Problem Until Proven Otherwise

The Balloon should not be recolored by taste until the render path is understood.

Current evidence points to a likely preview/runtime mismatch:

- Studio preview sets sRGB output when supported and uses stronger preview lighting.
- The game scene now matches Studio's sRGB output policy, but still uses darker background/fog and different light levels.
- Imported meshes can cast and receive shadows.
- The game loader applies pixel/material policy, and the current static parity baseline rules out an obvious Balloon texture-luminance outlier.
- Material override warnings show that multiple imported materials share names, so per-material policy can affect more surfaces than the author intended.

Conclusion: color-space output is no longer the primary suspect. The next proof is a render/capture baseline that isolates lighting, fog, shadows and preview-scene differences before any asset recolor.

Acceptance shape:

- one Balloon render in Studio preview;
- one Balloon render in game under a known diagnostic lighting mode;
- same imported asset, same material policy, same camera framing;
- explicit record of renderer color-space/tone-mapping/fog/shadow settings;
- decision whether mismatch is asset data, material policy, renderer setup or preview setup.

### B. Effects Need A Renderer-Only Effects Contract

The current effect adapter is intentionally small: flame/glow aliases are toggled and scaled by thrust intensity. That is enough for a proof, not for the intended product.

The next useful layer is not a full particle editor. It is a declarative renderer-only Effects V1 contract:

- effect slots attached to node aliases;
- sprite or billboard emitters;
- animated texture/sprite-sheet descriptors;
- additive/alpha material policy for fire, smoke and glow;
- runtime inputs such as `thrustIntensity`, `damage` and maybe `temperature` only if gameplay already owns them;
- Studio preview controls that match runtime.

What must not happen:

- no gameplay fields in Visual Asset Pack;
- no fuel/force/heat semantics smuggled into effect descriptors;
- no global "make fire better" hardcoded per block.

### C. Block Gaps Are A Hidden Renderer Policy

The visible gap is not a grid problem. Current module visuals are scaled to `0.96`, while placement remains unit-spaced.

Removing that scale may be visually simple, but it changes the rendering contract:

- hit proxy behavior must stay reliable;
- ghost placement must still read clearly;
- imported visuals must remain within expected cell bounds or declare overflow intentionally;
- future greedy meshing must operate on structural render candidates, not on every functional/imported/animated block.

Conclusion: the gap removal belongs to a "Voxel Fit" milestone, not an incidental CSS-like polish fix.

### D. VectorThruster Rig Profile Is Useful But Too Weak

ADR 0045 was the right move for M4J: it kept VectorThruster model correction renderer-only and prevented a hardcoded runtime patch.

But the current bug report exposes the limit of that contract.

Current profile shape:

```json
{
  "channels": [
    { "input": "gimbalA", "node": "gimbalAssembly", "axis": "z", "direction": 1 },
    { "input": "gimbalB", "node": "gimbalAssembly", "axis": "y", "direction": -1 },
    { "input": "roll", "node": "gimbalAssembly", "axis": "x", "direction": 1 }
  ]
}
```

Current gameplay force calculation uses the block basis:

- forward/local thrust axis;
- local normal;
- local span;
- body-local position for torque contribution.

The visual adapter receives scalar channels and rotates local Euler axes on one alias. For the current local VectorThruster rig, ADR 0045 can express the correct mapping, and the 24-orientation probe is now green. Future rigs still need the same proof before acceptance.

Conclusion: the missing test is not optional. It is the foundation for the next VectorThruster repair.

Minimum acceptance test:

1. Iterate all 24 VectorThruster orientations.
2. For each orientation, test representative positive and negative pitch/yaw/roll inputs.
3. Compute the actual local force direction used by gameplay.
4. Apply visual gimbal animation through the runtime adapter.
5. Sample or compute the visual nozzle forward direction.
6. Assert angular error within a small tolerance.
7. Include diagnostics that name orientation, input axis, expected force direction, observed visual direction and angle error.

This proof is now represented by `tools/probe_vector_thruster_direction.js`. Use:

```text
npm.cmd run probe:vector-thruster:report
```

for diagnostics, and:

```text
npm.cmd run probe:vector-thruster
```

as the gate before accepting a VectorThruster direction fix.

If the current profile cannot pass this without hardcoded special cases, design a richer renderer-only gimbal-frame contract instead of patching the fallback again.

Possible richer contract direction:

- declare a nozzle forward axis in model local space;
- declare one or two pivot nodes;
- declare local pivot axes as vectors, not only Euler axis labels;
- support independent gimbal A/B nodes when the model has nested pivots;
- allow direction inversion per pivot;
- keep all of this renderer-only and tied to visual proof tests.

### E. Hinge Has Reached The End Of The Minimal Path

The current hinge architecture was intentionally conservative:

- first public constraint kind is hinge;
- authoring chooses adjacent endpoints and a signed axis;
- current UI is minimal;
- Gate D/E device and signal work stayed out.

That was correct for Gate C. It is not sufficient for advanced mechanisms.

The next mechanical work should not be "add a few more hinge fields." It needs a Mechanical V2 design spike.

Required design topics:

- joint frame identity;
- explicit pivot/center;
- explicit orientation basis;
- limits in joint-local coordinates;
- motor mode vs servo mode vs passive friction;
- multi-axis joints;
- slider/linear constraints;
- powered rotor/bearing use cases;
- compound mechanisms;
- how authoring UI exposes center and axis without making basic use painful;
- how solver capability limits are reported.

Hard rule: persistent schema should follow the joint model, not precede it.

### F. Device Tuning And Programming Need A Ladder

The owner wants individual block binding, dependencies and simple programming. That matches the existing project vision, but the order matters.

The ladder should be:

1. inspect a specific block and see its tuneable parameters;
2. change simple settings such as gain, trim, invert, clamp, max angle, response;
3. bind an input/action directly to a device or group;
4. create named groups;
5. add simple dependencies and gates;
6. add sensors;
7. add a visual signal graph;
8. add deterministic ControlRuntime;
9. consider scripting only after the API is safe and deterministic.

Jumping directly to a broad graph/programming system would make the project harder to steer and harder to validate.

## Revised Workstreams

The roadmap should now be understood as five staged workstreams.

### M4L - Visual Truth And VectorThruster Proof

Purpose: make imported visuals trustworthy and stop guessing.

Required outcomes:

- Balloon manifest cleanup is owner-approved, minimal and audit-clean.
- Studio/game visual parity baseline exists for all current local imported block visuals.
- Renderer color/material policy is explicit enough that texture darkness is classified as a shared renderer/preview mismatch, with color-space output aligned and lighting/fog/shadow still requiring render capture.
- Duplicate material-name warnings are either fixed in assets or surfaced as actionable Studio diagnostics.
- VectorThruster 24-orientation visual-vs-force test exists and passes for runtime-default plus local VectorThruster profiles.
- Future VectorThruster axis/profile repairs are accepted only after that test passes.
- Thruster fire gets a small renderer-only effect MVP after direction correctness is testable.

Non-goals:

- no gameplay force changes;
- no save schema changes;
- no Blueprint/CraftModel/compiler changes;
- no broad particle editor yet;
- no hardcoded one-off Euler patch.

### M5 - Voxel Fit And Renderer Optimization Contract

Purpose: remove hidden block gaps and prepare for real voxel rendering optimization.

Required outcomes:

- visual shrink becomes an explicit policy or is removed with tests;
- selection and hit proxies still work;
- placement ghost readability remains acceptable;
- imported visuals have a documented cell-fit/overflow rule;
- structural blocks are classified for future greedy meshing;
- functional/animated/imported blocks are excluded unless proven safe;
- a small benchmark or render-stat baseline exists before optimization claims.

Non-goals:

- no compiler/data ownership change;
- no broad renderer rewrite;
- no greedy meshing before the block-fit contract is tested.

### M6 - Mechanical V2 Design Spike

Purpose: replace the "minimal hinge" mental model with a future-proof mechanical model.

Required outcomes:

- Mechanical V2 ADR or design doc;
- solver capability spike;
- explicit joint frames and pivots;
- servo/motor/limit model;
- multi-axis joint feasibility decision;
- body-frame rebase/constraint rebuild risks understood;
- authoring UX sketch grounded in the model.

Non-goals:

- no quick schema expansion before the model is stable;
- no device/port/control graph work inside the joint schema;
- no claim that Cannon supports a joint until tested.

### M7 - Device Tuning And Direct Binding

Purpose: make individual blocks feel controllable before adding programming complexity.

Required outcomes:

- device endpoint identity model uses stable `{blockId, portId}`;
- tuneable parameters are listed per block type;
- direct input/action binding works for at least one engine-like block;
- groups, gain, invert, trim and clamp have a minimal path;
- diagnostics explain missing or broken bindings.

Non-goals:

- no arbitrary scripts;
- no persistent `bodyId`;
- no visual node graph until direct binding is useful.

Planning note: a small Gate D V0 spike can define endpoint identity and diagnostics, but it must not become a broad programming/runtime project. If M4L/M5/M6 uncertainty is still active, keep Gate D work to planning/design evidence rather than schema implementation.

### M8 - Signal Graph And Deterministic Control Runtime

Purpose: add real programming only after devices and binding are usable.

Required outcomes:

- fixed-tick deterministic evaluator;
- boolean/event and scalar signal types first;
- explicit delay/state nodes for cycles;
- sensors and actuators communicate through public runtime APIs;
- headless tests prove determinism.

Non-goals:

- no JavaScript in saves;
- no hidden runtime object references;
- no cable/transport semantics mixed into signal meaning.

## Validation Ladder

Every workstream needs a proof ladder before it is called done.

Visual truth:

```text
visual-pack audit
Studio preview check
game diagnostic render check
browser smoke
targeted visual/runtime tests
```

VectorThruster:

```text
manifest/profile validation
24-orientation visual-vs-force unit/integration test
browser/manual spot check
no hardcoded per-asset runtime exception
```

Voxel fit:

```text
cell-fit unit tests
hit-proxy and placement tests
browser smoke
render-stat baseline
```

Mechanical V2:

```text
ADR/design review
headless solver capability spike
constraint lifecycle tests
rollback/rebase tests
minimal authoring proof
```

Device/control:

```text
schema validation
CraftModel transaction tests
compiler diagnostics
headless control evaluator tests
browser binding workflow smoke
```

## Documentation Rules To Avoid Future Mess

1. `ROADMAP_NEXT.md` remains the short active roadmap.
2. This file is the detailed active rebase behind the current roadmap.
3. Accepted design decisions become ADRs.
4. Session handoff notes under `.codex/handoff/**` are operational evidence, not product authority.
5. When this rebase becomes stale, create one explicit superseding roadmap rebase and update `ROADMAP_NEXT.md` plus `docs/README.md`.
6. Do not keep multiple active roadmap reviews with overlapping authority.
7. Do not bury owner feedback only in chat or handoff files.

## Immediate Next Work Order

1. Do not start Gate D schema work.
2. Do not start Mechanical V2 implementation.
3. First close the visual truth lane:
   - minimal Balloon cleanup;
   - visual-pack audit clean;
   - Studio/game render parity baseline;
   - VectorThruster 24-orientation proof.
4. After VectorThruster proof exists, decide whether ADR 0045 is enough or whether a richer renderer-only gimbal-frame ADR is needed.
5. Only then move to Voxel Fit or Mechanical V2, depending on what blocks near-term progress more.

## Stop Conditions

Stop and write a design note instead of patching when:

- a visual fix requires changing force/control semantics;
- a VectorThruster axis fix cannot pass all 24 orientations;
- hinge work needs new persistent schema before joint frames are documented;
- renderer optimization changes Blueprint/CraftModel/compiler authority;
- effects start carrying gameplay authority;
- a device/control feature wants persistent `bodyId`;
- a new document would duplicate this roadmap instead of superseding or updating it.
