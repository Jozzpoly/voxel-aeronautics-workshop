# AI Project Memory — Voxel Aeronautics Workshop

## 2026-10-20 — Select-mode planar drag experiment (released; Owner feel unverified)

- **Gesture surface**: `Select / Inspect (V)` now captures a selected part on pointerdown; movement beyond the established 6px click slop previews a snapped move in that part's local XZ plane. The origin remains physically present until drop and an amber bounding outline shows the tentative target. Single click still inspects. Y movement remains available through existing discrete nudges; this is not a 3D gizmo or a full mechanical joint editor.
- **Truth boundary**: `workshop_selection_controller.js` owns drag start/preview/end/cancel, computes drag intersections against the local assembly plane from the selected visual's world transform, converts the snapped target through the actual parent world matrix and calls existing `nudge` exactly once on drop. The `CraftModel` and `Blueprint` are **not mutated during preview**, and `blockId` is preserved. Mechanically linked blocks refuse the move; destination validity is authoritatively checked by `CraftModel.move` only at drop, so amber is a tentative indicator, **not a green-valid claim**.
- **Cancel contract**: pointercancel, Escape, window blur, selection sync and non-select pointer movement clear a transient visual preview without changing history or saves. Normal Build placement and right-click removal use the separately validated drag suppression from the previous shipped revision.
- **Tests**: `tests/test_workshop_drag.js` covers real Three.js parent-space transforms, no-op clicks, preview cancellation, single commit/undo history and linked-part refusal. Chromium smoke now attempts a *real cursor drag* of a manually built Core in Select, checks unchanged `blockId`, one block, moved coordinates and undo recovery. One-time exact CSS regeneration and core tests PASS: [run 39342199826](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39342199826), then archived as `docs/history/ONE_TIME_SELECTION_DRAG_CSS_2026-10-20.yml`.
- **Release truth**: [real Chromium Validation](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39342384192) PASS (physically dragged the Owner-like manually placed Core, confirmed unchanged part ID, changed coordinates and restored it with Undo); [release reproducibility](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39342384091) PASS. Published source `52ec698813f2822350d4c4ae1b64ed5056f82f54` is confirmed by [publish](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39342612435), [Pages deployment](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39342712681) and actual public `/BUILD_INFO.json` read in Opera. **Not yet Owner-tested:** natural mouse feel, all orientations/nested scenes in real browser, older browsers and mobile touch. The published gesture is desktop mouse Select, not a full 3D transform system.
- **Follow-up pressure**: interaction logic in `game.js` has reached the architecture size ceiling. Further gestures should justify a dedicated controller extraction; do not keep adding giant inline handlers merely to satisfy an arbitrary file-length guard.

---


## 2026-10-20 — Pointer gesture regression containment (candidate)

- **Reproduced in source**: `src/game.js` previously set `STATE.input.downMoved` only during camera pan/orbit, not ordinary left/right pointer movements. Therefore a pointerdown→move→pointerup in BUILD could still execute `performBuildAction` and place/remove a block at release.
- **Bounded correction**: track slop greater than 6 screen pixels as a sticky drag for non-camera mouse buttons; suppress placement/deletion after any such drag, even if the pointer returns to its initial pixel. Confirm the release button matches the original press and independently check final displacement to guard against missed move events. Existing Alt/middle camera orbit and pan behavior remains unchanged.
- **Actual browser regression probe added**: disposable Chromium free-build smoke now exercises left-drag-return without placement, normal stationary left placement, right-drag-return without deletion, stationary right deletion and undo restore, then the pre-existing Select/Build/Sandbox lifecycle.
- **Evidence boundary**: controller/core and source-derived CSS generation passed in the one-time workflow, archived as `docs/history/ONE_TIME_POINTER_DRAG_GUARD_CSS_2026-10-20.yml`. The final real browser gate and published Pages identity require independent verification. No user gesture-feel acceptance claimed, and this is **not** free transform/drag editing yet.
- **Architectural lesson**: the 2400-line `game.js` composition limit is almost saturated. Substantial future gesture behavior should be owned by a purpose-built input/controller boundary, not extended with long inline event handlers; this release intentionally fixes only the accidental destructive gesture.

---


## 2026-10-20 — Bounded builder-camera quality pass (recovery candidate)

- **Product distinction confirmed**: the launcher button previously labeled compact `⛶ FOCUS` toggles fullscreen flight focus plus keyboard capture; it does **not** frame craft geometry. Renamed its compact visible label to `⛶ PILOT` to reduce camera/keyboard focus ambiguity without changing its behavior.
- **New Builder action**: the Selected Part inspector now has a disabled-until-selected `FRAME` button. `game.workshop-selection-controller` owns its event; `game.camera-controller.frameWorkshopObject` uses real `THREE.Box3` of the selected visual rather than the block's potentially assembly-local coordinates, fits a safe perspective distance, preserves view yaw/pitch and does nothing during FLIGHT. No auto-framing was introduced: the player explicitly requests it.
- **Critical falsification**: a real Three.js test reproduced stale nested-parent transforms. The first frame implementation aimed at local coordinates. Calling `object.updateWorldMatrix(true, true)` before deriving world bounds fixed this. `tests/test_camera_controller.js` now enforces the nested-space case and flight no-op; selection tests cover disabled state; the actual Chromium smoke physically clicks FRAME after manually building/selecting a craft before flight.
- **Architecture containment**: `game.js` has an explicit 2400-line limit. Initial button wiring breached it; logic was moved into `workshop_selection_controller.js`, preserving controller ownership. The exact Tailwind 4.1.10 CSS generator passed its one-time gate ([CI run](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39338263534)) and archived the temporary workflow at `docs/history/ONE_TIME_FRAME_SELECTION_CSS_2026-10-20.yml`.
- **Evidence boundary**: the CI generator and core suite passed. Full source/release browser CI, publication and Owner ergonomic/feel acceptance must be rechecked independently. This camera candidate was **not automatically deployed by the CSS generator**. Existing published rescue build remains the last live truth until separately promoted.

---


## 2026-10-20 — Two-tab autosave containment (candidate, not yet published)

- **Validated source change**: `src/game/blueprint_controller.js` now observes the shared primary save at tab startup, refuses a stale write when another tab changed it, preserves the local draft under a distinct `:conflict:` rescue key and shows `SAVE CONFLICT • EXPORT BLUEPRINT`. Loading the actual current primary intentionally updates the baseline. Existing backup writes remain scoped to successful saves.
- **Executable regression**: `tests/test_blueprint_controller_hardening.js` opens two controllers against one simulated same-origin storage, confirms that B cannot overwrite A's primary/backup, checks B's retained conflict JSON, and tests recovery through explicit loading. This is a deterministic controller/storage test, not a true two-window Chromium test.
- **Build evidence**: one-time [CSS regeneration workflow](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39335359317) generated the exact Tailwind 4.1.10 artifact, passed the targeted test and core `tests/run_all.py`, then archived itself under `docs/history/ONE_TIME_CROSS_TAB_SAVE_CSS_2026-10-20.yml`. Source candidate hash `5357899f7de1523cf16074436ad0c2d49a450dacca7706832229a9c8f6f9d1b9`.
- **Rescue export**: `index.html` and the Blueprint controller now expose a compact, normally hidden `LOCAL RESCUE COPY` selector and `EXPORT RESCUE JSON` action in BUILD whenever a valid retained `:conflict:` document exists. Export never overwrites or deletes the shared primary, backup, or rescue; use normal `IMPORT JSON` to open a chosen rescued craft. Deterministic controller coverage and the [actual Chromium browser smoke](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39336675281) verify that a simulated foreign same-origin write makes the visible rescue action available and leaves the foreign primary intact.
- **Limitations (do not overclaim)**: a read/compare/write sequence in `localStorage` is **not atomic across tabs** and therefore is not a complete guarantee against tightly interleaved saves. The browser test simulates the foreign write on one real running page; it is **not a true two-tab concurrency stress test**. Quota/storage errors can still prevent saving even a rescue. Older already-open VAW builds do not have this protection. An Owner-quality or staged release decision remains separate from green CI.
- **Release boundary**: Jaskinia/Pages still runs source `2681c383489ad95913a0780589f15186b93320fd` as verified through `gh-pages/BUILD_INFO.json`; these new edits are **unpublished** on recovery only. Do not promote `main` or publish merely because tests are green.
- **Next gate**: replay genuine isolated two-tab contention and crash/reload scenarios to resolve the remaining atomicity/legacy-build boundary, then test the accessible rescue/export flow as an Owner. Continue toward tactile editing, camera framing, mechanical feedback and good flying feel; postpone broad UI replacement.

---


## 2026-10-19 — Browser proof of a freely authored craft

- **Source checkpoint:** `5b66ca36e6a5a29dae1909bc91f91a40652fafa1`, after the original published `3307e3f`. Gameplay `src/**` is unchanged between them; these commits extend `tests/run_browser_smoke.mjs` and a temporary CI gate.
- **Actual Chromium player-input path:** from an empty workshop, choose a Core from the parts bar; place it with a real pointer click on the build plane; Shift+click to select; move the selected Core using the X+ inspector button; verify its identity remains stable and its position changes; undo the move; undo/redo the first placement; choose Hull; find a valid adjacent face from real mouse feedback; place it; Shift+click a part and confirm it remains two blocks; undo/redo; choose Sandbox through the contract-card UI; launch this handmade two-block craft in real Cannon flight; return to workshop; verify both blocks persist; clear the craft; finally run the 17-part starter launch smoke.
- **Browser proof:** [one-time isolated Chromium run 39312934267](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39312934267), rerun attempt 2 PASS. [Validation run 39312940840](https://github.com/Jozzpoly/voxel-aeronautics-workshop/actions/runs/39312940840) and Release Reproducibility PASS. Browser outputs `manualBuild.stableIdMove=true`, `secondBlock='Hull'`, `selection=true`, `sandbox=true`, `returnToWorkshop=true`, and zero console errors.
- **Known harness interference:** the isolated CI browser sometimes hangs at the Chromium remote-debug startup before gameplay. One earlier test validation failed in the known Linux process-family/SIGTERM runner test. Classify failures by stage and inspect job logs: neither is proof of a product failure. The same authored test passed without a production-code change when Chromium did start.
- **Not proven:** natural feel/readability of constructing multiple parts; drag/rotate editing; intuitive mechanical authoring; meaningful flight controls and physics feel; productive visual diagnosis after real damage; usable phone/touch play; Jaskinia iframe focus/persistence across devices. This is engineering confidence, *not Owner PASS*.
- **Release boundary:** `gh-pages/BUILD_INFO.json` still pins `3307e3f`; its underlying gameplay is identical to the recovery test commit, so no Jaskinia/game release is required merely to add tests. Do not imply that a new published build was created by the tests.
- **Next appropriate move:** prioritize bounded visual/Owner experiments and tactile builder improvements where evidence supports them, rather than more breadth or a new agent mesh. The user wants VAW to be a complete, attractive, immediately accessible game in Jaskinia; the separate Jozz Vehicle / Box3D matter-builder visions remain strategic future conversations.

---

## Live checkpoint — 2026-10-19 (supersedes dated browser/deployment claims below)

- **Goal**: Owner confirmed VAW now works as a playable entry in Jaskinia. Access is no longer the blocker; the task is to recover the *quality of building, launching, observing, understanding and rebuilding*. No Owner acceptance of gameplay feel/UI has been granted.
- **Direct launch**: https://jozzpoly.github.io/voxel-aeronautics-workshop/ ; GitHub Pages is enabled. Jaskinia v6.3's refreshed project snapshot has VAW `pages` and three source branches. Do not confuse a live entry with validated desktop/mobile usability.
- **Version truth**: `gh-pages/BUILD_INFO.json` pins the published playable source at `8f0ec44b1a641df64a6b5c66ca8e500d29c2d1b6`. As checked on 19 October, recovery HEAD was `9df67c85e9c6553ca9be277878740d776db53213`, four commits newer; those intervening commits changed browser-test/CI files, not product `src/**`. Always recheck the live ref and build info. `main` is still the older historical default, not the recovery product.
- **Validation boundary**: current recovery passed core and release reproduction CI as well as a *real Chromium* browser lifecycle gate. `tests/run_browser_smoke.mjs` physically clicks preset/launch UI; `tests/run_browser_recovery.mjs` loads a predefined articulated Blueprint using an injected probe, checks real Two-body/Cannon runtime and return/relaunch. Neither is Owner-authored free-build testing, ergonomic assessment or real mobile acceptance. Older claims below that no browser test can bootstrap were historical constraints, not current truth.
- **Workstation continuity**: 14 source branches were reduced to exactly three: `main`, `recovery/playable-truth`, and generated `gh-pages`. The 12 retired heads are safeguarded by exact Git tags, mapped in `docs/BRANCH_ARCHIVE_2026-10-19.md`. Do not restore the agent mesh.
- **Owner's product judgement**: sandbox first; an arbitrary first block, manual piloting, readable physical consequences and the ability to diagnose and rebuild matter more than new domain subsystems or contract checklists. Historical pain points to *retest*, not assume current: UI panels/focus, hinge authoring/feedback, building ergonomics, flight feel (drag/damping, lift), symmetry/controls and response clarity. Keep Jozz Vehicle, Box3D/ANVIL and future matter-based builders separate strategic research horizons; they do not authorize a VAW rewrite.
- **Next product gate**: test the *actual published game* from empty craft through a freely designed machine, control/launch, failure/observation, return, selected-part edit and repeated test. Prefer captured Owner evidence/remarks from Jaskinia and concise targeted fixes. Protect user saves and exact build identity. Do not merge PR #16 solely because tests are green.

---

Historical recovery grounding: **2026-08-16**.

This file is intentionally short. It records current truth, not project history.

## Repository state

- Repository: `Jozzpoly/voxel-aeronautics-workshop`.
- Active recovery lane: `recovery/playable-truth`.
- Recovery lineage started from `80c0ae4aced1dd695af217cdeadea9025c6305c8` (`current_work` pre-agent-mesh snapshot).
- `main` is not the current recovery authority until an explicit promotion decision is made.
- Later branches, including `VAW_GRoK` and mobile branches, are **salvage sources only**. Never merge them wholesale or treat their documentation as current truth.
- Historical agent-mesh material is not an active operating model for VAW.

Always resolve the live remote branch head before changing the repository. Do not hardcode this document's commit SHA as the next base.

## Manual product truth

Owner test on 2026-08-16 proved only the following about the exact `80c0ae4` runtime:

- Workbench loads and renders;
- an existing craft is visible;
- `Launch Sandbox Test` enters the test/flight scene;
- physics/runtime starts;
- telemetry changes during the test.

Owner explicitly **did not accept the current quality**. There are many visible and behavioral problems, especially UI/readability/polish. Do not convert code presence or a passing test into a product-quality claim.

## Machine evidence

The `80c0ae4` product source passed broad recovery validation across core domain/compiler/runtime, Cannon physics, articulated and multi-space assembly, flight lifecycle, damage/debris, missions, visual asset loading/Studio integration and VectorThruster orientation probing.

P0 release/repository cleanup preserved deterministic source parity and LF/CRLF reproducibility.

Known tooling caveat: validation-runner timeout/process-family tests are nondeterministic across current Windows/Ubuntu CI even after release reproducibility itself passes. Keep this classified as `HARNESS/ENVIRONMENT` unless evidence ties it to product execution.

## P1 code-reality result

P1 is complete. Detailed current evidence: [`docs/CODE_REALITY_AUDIT.md`](docs/CODE_REALITY_AUDIT.md).

Key conclusions:

- Blueprint/CraftModel/compiler and multi-body Cannon runtime are substantial technical foundations.
- The workshop editor, mechanisms, UI information architecture and test/rebuild feedback loop are much less mature than those foundations.
- Engineering analysis contains a reproduced multi-space topology bug and does not model supported secondary-body thruster routing consistently with runtime.
- Sandbox return clears the very failure evidence needed for the project's experiment -> understand -> rebuild loop.
- Runtime motor/servo, copy-subgraph and other domain capabilities exist without corresponding player workflows.
- Device tuning/direct binding is absent beyond global input settings and placement-time ControlSurface axis/sign; `portId`, device runtime, signal graph, sensors/PID and `ControlRuntime` are absent from current `src/**`.
- Visual/Blockbench tooling is technically extensive but should not lead recovery while core product truth/feedback remains weak.

## P2-A result

P2-A Engineering Analysis Truth is complete on the recovery lane.

- weak-link/fuel-exposure analysis uses compiler-owned `rigidNeighborBlockIds`, fixing the reproduced transformed-Assembly-Space error;
- control metrics are explicitly scoped to `primary-body-local` authority;
- secondary-body Gyro no longer inflates manual authority;
- articulated analysis reports runtime pilot-routed secondary thrusters but does not invent joint-coupled whole-craft authority;
- mission readiness uses the same scope and stops presenting the partial articulated estimate as exact whole-craft control;
- the new executable engineering-analysis test reproduces the old boundary and protects the corrected behavior.

A broad disposable core-suite run passed after the repair with only the known nondeterministic `test_validation_runner.py` harness excluded. Current browser smoke still cannot provide rendered proof in this environment because app bootstrap does not complete through its Chromium/CDP path.

## P2-B result — Test Evidence Continuity

P2-B Test -> Workshop Feedback Continuity is complete on the recovery lane.

- one bounded top-level `lastTestResult` survives flight cleanup without entering Blueprint/CraftModel persistence;
- sandbox return captures the result before `setMode('BUILD')` destroys transient flight evidence;
- contract completion/failure uses the same evidence shape and keeps contract-only outcome data nested;
- `FlightIntegrity` records structured `firstFailureEvent` identity (`blockId`, type, body and reason) when the runtime knows it;
- the result keeps bounded lost block IDs, max impact, final load snapshot, fuel use and integrity;
- current game composition deliberately does not pretend to persist fixed-step scheduler health or provide a finished workshop diagnosis surface yet; P2-C consumes the preserved failed `blockId`/result to make the evidence actionable.

Executable tests cover destructive cleanup continuity, shared sandbox/contract capture, cleanup reset of structured failure identity and stable failed-block identity. Startup smoke still passes single-body, articulated and multi-space UI lifecycle on the disposable candidate. This does not constitute owner acceptance of a workshop diagnosis workflow, which does not exist yet.

## Architectural boundaries currently worth preserving

- `CraftModel` is workshop authoring authority.
- `CraftCompiler` is the path from authoring state to compiled runtime data.
- Blueprint/CraftModel data stays serializable and engine-neutral.
- structural, mechanical and future signal/control concerns remain separate.
- `assemblySpaceId`, `blockId`, `mechanicalLinkId` and runtime `bodyId` are different identity domains.
- future persistent device endpoints should use stable authoring identity such as `{blockId, portId}`, never runtime `bodyId`.
- Visual Asset Pack / Blockbench data is renderer-facing and must not become gameplay authority.
- UI workspace/camera preferences and transient flight damage are not craft/Blueprint data.
- manual control remains first-class; future programming should be layered rather than mandatory.

## Current priority

P2-C is active: **Workshop Editing Fundamentals**.

1. Establish stable selected-part identity distinct from hover target and selected placement tool.
2. Surface the preserved last-test failed `blockId` through that selection/inspection path when the block still exists.
3. Allow a useful edit of an already placed part without delete/re-place.
4. Reuse existing CraftModel operations where they solve the workflow; do not add future-facing APIs first.
5. Keep Blueprint/CraftModel authority and history/undo semantics intact.

After P2-C: P2-D information architecture / visual polish.

There is **no active M4/M5/M6/Gate-D feature roadmap during recovery**. Those names belong to history unless current product needs justify them.

## Documentation authority

Read current docs in this order:

1. `README.md`
2. `AI_PROJECT_MEMORY.md`
3. `PROJECT_VISION.md`
4. `ARCHITECTURE.md`
5. `ROADMAP.md`
6. `AGENTS.md`
7. `docs/README.md`

`docs/CODE_REALITY_AUDIT.md` is current evidence supporting the summary above; it does not override `ROADMAP.md` or `PROJECT_VISION.md`.

Anything under `docs/history/` is non-authoritative historical evidence.
