# M4A Studio Validator Sync — Engine Compatibility Report

Date: 2026-06-23  
Package: `VAW_BLOCKBENCH_IMPORT_STUDIO_M4A_VISUAL_ASSET_CONTRACT_v0_7.zip`  
Scope: Studio-side validator/schema/export hardening for `VAW_VISUAL_ASSET_PACK_V1`.

## Goal

Bring Studio v0.7 in line with the engine-side M4A visual asset manifest contract so Studio does not show a false green status for packs that the current VAW engine validator would reject.

This is not a glTF runtime loader milestone. The Studio still produces renderer-facing visual asset packs only. Gameplay authority remains in `foundation.catalog`, Blueprint, CraftModel, CraftCompiler and RuntimeAssemblyPlan.

## Compatibility with engine-side M4A contract

The Studio validator is now mirrored to the provided M4A contract fixture:

- format must be `VAW_VISUAL_ASSET_PACK_V1`;
- top-level `packId`, `version`, and non-empty `assets` are required;
- `packId` and `assetId` must be stable lower-case ids using letters, numbers, `_`, or `-`;
- asset `kind` must be `blockVisual`;
- `materialPolicy` is required and must be an object;
- `bindings.nodes` may only use these aliases:
  - `visualRoot`, `flame`, `flameGlow`, `gimbalAssembly`, `controlFlapPivot`;
- `bindings.clips` may only use these aliases:
  - `idle`, `thrust`, `damage`;
- allowed `blockTypes` now match the current engine-side M4A catalog slice:
  - `Core`, `Hull`, `Frame`, `Thruster`, `VectorThruster`, `Balloon`, `Wing`, `ControlSurface`, `Gyro`, `Fuel`;
- old/non-current types are rejected:
  - `Structure`, `Structural`, `Hinge`, `Rotor`, `Sensor`, `Payload`, `MagicGameplayBlock`;
- forbidden gameplay-authority fields are rejected across the full manifest tree, including:
  - `mass`, `force`, `fuelRate`, `durability`, `dragArea`, `wingArea`, `collider`, `collision`, `controlAxis`, `blueprint`, `craftModel`;
- wider gameplay-like aliases remain blocked too, such as `massKg`, `physics`, and `gameplay`.

## Model path hardening

`model.path` must now be a plain relative pack path:

- uses `/` only;
- does not start with `/`;
- does not start with `./`;
- does not contain `..` or `.` path segments;
- does not contain empty path segments such as `models//x.gltf`;
- does not contain `\`;
- does not contain query/hash suffixes;
- does not use `http:`, `https:`, `file:`, `data:`, `blob:`, `C:/...`, or any other URI/absolute scheme.

The JSON schema was updated with the same intent so documentation/schema consumers no longer see a looser contract than the Studio runtime validator.

## Resolver noise fix

The event log no longer reports viewer-generated local `blob:http://...` URLs as scary unresolved dependencies when GLTFLoader emits an internal object URL during successful local preview. This only affects UI noise from the URL modifier path. Real dependency reports still come from `dependencyReport()` and missing/ambiguous/external dependencies remain visible there.

## Tests added

`tests/test_recovery_static.js` now includes an engine mirror fixture with cases for:

- `Structure` rejected;
- `VectorThruster`, `Frame`, `Gyro`, and `Fuel` accepted;
- unknown node alias rejected;
- unknown clip alias rejected;
- missing `materialPolicy` rejected;
- unsafe paths rejected:
  - `./models/x.gltf`,
  - `models\\x.gltf`,
  - `models/../x.gltf`,
  - `models//x.gltf`,
  - `http://example.test/x.gltf`,
  - `C:/tmp/x.gltf`;
- forbidden gameplay fields rejected:
  - `dragArea`, `fuelRate`, `controlAxis`;
- duplicate sibling node paths rejected as ambiguous when used as bindings;
- schema enum/additionalProperties/required fields checked against the engine mirror.

The previous tests for animation-list wiring, live animation time updates, data URI compaction, embedded texture count, debug export, and Visual Asset Pack export are still present.

## Commands run

Environment used here:

```text
node v22.16.0
npm 10.9.2
Python 3.13.5
```

Commands:

```bash
npm test
python tools/validate_recovery_package.py
```

Both passed.

On Windows, `npm.cmd test` is the safer equivalent when shell resolution of `npm` is inconsistent. In this container I used `npm test` because `npm.cmd` is Windows-specific.

## Browser smoke status

A local server was started with `python tools/serve.py`, and `curl` confirmed that `http://127.0.0.1:8080/index.html` returned HTTP 200 with non-empty HTML.

A headless Chromium/Playwright browser smoke attempt was made, but this environment blocks navigation to local/file URLs with:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Because of that environment policy, I could not honestly claim the interactive browser smoke passed here. The static tests cover the requested contract regressions. The remaining manual smoke on the user machine should verify:

1. open `http://127.0.0.1:8080/index.html`;
2. click `V1 preview pack`;
3. confirm the model appears;
4. confirm `Visual Asset Pack V1 OK`;
5. confirm animation list shows `up_down`;
6. click Play and confirm slider/time label changes;
7. confirm `Export Visual Asset Pack V1` is enabled;
8. break `visualRoot`, `blockTypes`, node alias, or clip alias and confirm preview remains usable but export becomes disabled.

## Result

Studio v0.7 is now stricter in the same places the engine-side M4A contract is strict. The important behavior is preserved: preview remains useful as an import lab, but VAW export is a hard contract gate.
