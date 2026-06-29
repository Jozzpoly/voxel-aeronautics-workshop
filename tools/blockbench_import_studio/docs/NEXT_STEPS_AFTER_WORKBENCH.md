# Next Steps After M4A Studio Contract

## Immediate manual validation

1. Open `index.html`.
2. Load `V1 preview pack`.
3. Confirm:
   - model visible;
   - embedded texture visible;
   - animation visible in the select/list;
   - live scrubber changes during playback;
   - duplicate `Bone` node names are warnings, not fatal errors;
   - export succeeds with stable path bindings.
4. Edit the manifest:
   - remove `visualRoot`;
   - set `blockTypes` to an unknown value;
   - set `clips.thrust` to a missing clip;
   - add a forbidden gameplay field such as `massKg`.
5. Confirm preview still works and export is blocked.
6. Confirm `Export Debug Package` remains available.

## Engine-side M4A sync target

The engine-side agent should implement:

- pure manifest validator in `src/foundation/visual_asset_manifest.js`;
- no Three.js, DOM, or fetch in that validator;
- runtime visual asset registry mapping `blockType -> visualAsset`;
- procedural fallback when pack is missing/invalid;
- imported glTF under a stable VAW wrapper root;
- animation adapter surface such as `setThrusterIntensity`, `setGimbal`, `setControlDeflection`, `setDamageTint`.

## Studio-side next iteration

Only after engine-side validation accepts the sample pack:

- add a safer UI editor for node paths and clip bindings;
- add node path inspection/picking without binding LPM/PPM prematurely;
- improve material slot reporting;
- add more sample packs for non-thruster block visuals;
- add browser smoke test coverage if the runtime environment allows it.

## Do not do yet

- No gameplay data editing in Studio.
- No Blueprint schema changes.
- No mass/force/collision/durability changes through visual packs.
- No localStorage asset import into gameplay.
- No replacement of procedural models without fallback.
- No M4B imported block visual until M4A contract + engine readiness pass together.
