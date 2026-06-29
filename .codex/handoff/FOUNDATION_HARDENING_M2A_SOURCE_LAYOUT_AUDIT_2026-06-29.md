# Foundation Hardening M2A Source Layout Audit

Date: 2026-06-29
Workspace: `C:\Pliki_Joza\Gamo_devovo\VAW\voxel-aeronautics-workshop-foundation-gate-c-assembly-spaces`
Branch: `current_work`
Base before M2A implementation: `HEAD = origin/current_work = 6f0a914045b3ffe5f2da6508dbefc94255f7e980`

## Purpose

M2A is source-layout risk reduction only. It must make future work easier to review without changing gameplay, physics, Blueprint, CraftModel, compiler output, save schema, Gate D behavior, or visual runtime semantics.

The selected first extraction is a composition-only visual asset helper. It moves wiring for registry, loader, runtime adapter, module visual factory, and developer controls out of `src/game.js`, while leaving runtime use sites and visual behavior unchanged.

## `src/game.js` Responsibility Map

Current responsibilities that still live in `src/game.js`:

- Boot and composition root: explicit `window.VAW.require(...)` calls, environment creation, controller/service wiring, and global state references.
- Workshop model-to-view bridge: block placement, mesh maps, raycast roots, ghost previews, and assembly-space rendering.
- UI/HUD update loop: engineering telemetry, mode readouts, sliders, camera controls, status messages, and mission panels.
- Flight lifecycle glue: launch/stop flow, FlightSession calls, transient flight visual setup, and frame scheduling.
- Flight control loop: pilot input propagation, thruster router use, control surfaces, passive thrust, and balloon power.
- Integrity and debris orchestration: health fractions, damage tint calls, debris runtime delegation, and cleanup calls.
- Build interaction adapters: pointer picking, command selection, mirrored placement plans, delete/move/paint style interactions, and authoring toggles.
- Visual runtime use sites: imported visual attachment, damage tint, gimbal intensity, thruster intensity, and control deflection calls.

Existing module owners that should remain owners:

- `src/game/flight_session.js`: RuntimeAssembly build lifecycle and physics body allocation for the craft.
- `src/game/debris_runtime.js`: debris body allocation and cleanup.
- `src/game/module_visual_factory.js`: procedural fallback and imported visual root creation.
- `src/game/visual_runtime_adapter.js`: renderer-only visual bindings such as damage tint, gimbal, thruster, and control surface animation.
- `src/game/engineering_analysis.js`: craft analysis and engineering UI calculations.
- `src/game/build_targeting.js`: build validation feedback and placement targeting helpers.
- `src/game/*_controller.js`: bounded UI/service ownership for existing controller areas.

## M2A Extraction Boundary

New module:

- `src/game/visual_asset_composition.js`
- Module id: `game.visual-asset-composition`
- Owns only composition of:
  - `game.visual-asset-registry`
  - `game.visual-asset-loader`
  - `game.visual-asset-dev-controls`
  - `game.visual-runtime-adapter`
  - `game.module-visual-factory`

`src/game.js` should receive only the handles it already used:

- `visualAssetLoader`
- `visualRuntimeAdapter`
- `createModuleVisual`

The architecture test should keep `src/game.js` from regaining low-level visual asset bootstrap calls.

## Forbidden Scope

Do not change these areas in M2 source-layout work unless a new explicit plan says otherwise:

- Blueprint, CraftModel, CraftCompiler, RuntimeAssembly, migration code, save schema, or compiler output.
- `stepFlightPhysics`, physics integration, rigid body ownership, body ids, or Gate D device/port concepts.
- Visual runtime semantics: imported visual attachment, procedural fallback, damage tint, gimbal, thruster intensity, or control deflection behavior.
- `assets/visual_packs/local_working_visuals/**`.
- `release/**` cleanup or deletion.

If an extraction touches any forbidden area, stop and split a separate plan.

## Future Safe Candidates

Lower-risk follow-ups, each requiring focused tests before movement:

- HUD/telemetry formatting and DOM update helpers.
- Build interaction adapters around command selection and placement plan application.
- Dev-only controls that are already renderer-only and have clear dependency injection.
- Bootstrap composition shell after enough smaller seams are proven.

Avoid early extraction of:

- `stepFlightPhysics`
- damage propagation and integrity ownership
- RuntimeAssembly/FlightSession lifecycle
- save/load/migration code
- visual runtime adapter semantics

## Validation Commands

Minimum M2A validation:

```powershell
node --check src/game/visual_asset_composition.js
node --check src/game.js
python tests/test_game_architecture.py
npm.cmd run visual:test
npm.cmd run test
python tools/validate_fast.py
python tools/validate_full.py
git diff --check
git status --short --branch
```

On Windows, prefer the repository npm scripts or `tools/run_with_python_env.js` when invoking Python-dependent workflows, because M1 made bundled Python propagation part of the foundation contract.

## M2A Validation Evidence

Completed locally on 2026-06-29:

- `node --check src/game/visual_asset_composition.js`: PASS
- `node --check src/game.js`: PASS
- `node tools/run_with_python_env.js python tests/test_game_architecture.py`: PASS
- `node tools/run_with_python_env.js python tests/static_check.py`: PASS
- `npm.cmd run visual:test`: PASS
- `npm.cmd run test`: PASS after regenerating `tailwind.generated.css`
- `node tools/run_with_python_env.js python tools/validate_fast.py`: PASS
- `node tools/run_with_python_env.js python tools/validate_full.py`: PASS
- `git diff --check`: PASS

Validation artifacts:

- `.agent-validation/fast-20260629T125611.335665Z-21788`
- `.agent-validation/full-20260629T125726.045443Z-16852`

Observed issue:

- Classification: `HARNESS`
- Evidence: the first `npm.cmd run test` stopped in `tests/test_runtime_dependency_contract.py` because `tailwind.generated.css` had a stale candidate hash after adding the new JS source and HTML loader token.
- Resolution: `npm.cmd run generate:css` updated only the generated header hash; no generated CSS rule body changed.
