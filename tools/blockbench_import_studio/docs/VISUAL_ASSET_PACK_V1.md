# VAW_VISUAL_ASSET_PACK_V1

Status: **M4A draft / Studio export contract**  
Scope: **renderer-facing visual asset package only**

## Decision

Blockbench Import Studio produces and validates visual asset packs. The VAW engine may later consume those packs through a runtime registry and animation adapter, but gameplay authority remains in `foundation.catalog`, Blueprint, CraftModel, CraftCompiler, and RuntimeAssemblyPlan.

This contract deliberately avoids becoming a temporary sidecar that quietly becomes permanent. A Studio preview may be permissive; VAW export must be strict.

## Non-goals

Visual asset packs must not define or override:

- mass, thrust power, lift, drag, durability, health, collisions, hitboxes, fuel, energy, recipes, or other gameplay data;
- Blueprint schema;
- CraftModel schema;
- catalog definitions;
- runtime assembly logic;
- localStorage-imported gameplay state.

## Minimal manifest

```json
{
  "format": "VAW_VISUAL_ASSET_PACK_V1",
  "packId": "core_blockbench_test",
  "version": "0.1.0",
  "assets": [
    {
      "assetId": "thruster_basic",
      "kind": "blockVisual",
      "model": {
        "path": "models/thruster_basic.gltf",
        "unitMeters": 1,
        "forwardAxis": "+X",
        "upAxis": "+Y"
      },
      "bindings": {
        "blockTypes": ["Thruster"],
        "nodes": {
          "visualRoot": "Root",
          "flame": "Flame",
          "flameGlow": "FlameGlow",
          "gimbalAssembly": null,
          "controlFlapPivot": null
        },
        "clips": {
          "idle": null,
          "thrust": "thrust_loop",
          "damage": null
        }
      },
      "materialPolicy": {
        "pixelated": true,
        "alpha": "mask-or-blend",
        "doubleSided": "from-gltf"
      }
    }
  ]
}
```

## Studio behavior

Preview is allowed when:

- no manifest exists;
- bindings are incomplete;
- duplicate node names exist;
- the asset is still only a visual experiment.

Export is blocked when:

- `format` is not `VAW_VISUAL_ASSET_PACK_V1`;
- `visualRoot` is missing;
- `blockTypes` contains an unknown block type;
- forbidden gameplay fields are present;
- non-null node bindings do not resolve to glTF nodes;
- non-null clip bindings do not resolve to glTF animations;
- a duplicated node name is used as a bare binding instead of a stable path;
- the manifest model path does not match the loaded model.

Duplicate node names are warnings by themselves. They become export-blocking only when a binding uses an ambiguous bare name. Use stable paths such as `/Root/Armature/Flame`.

## Engine consumption expectation

The engine side should not insert glTF scene contents as authoritative game objects. It should:

1. validate the manifest without Three.js, DOM, or fetch;
2. register `blockType -> visualAsset` mappings;
3. keep procedural visual fallback available for every block;
4. mount imported glTF under a stable VAW wrapper root containing `isVoxelRoot`, `blockKey`, `type`, and `orientation`;
5. drive runtime visuals through an adapter such as `setThrusterIntensity`, `setGimbal`, `setControlDeflection`, and `setDamageTint`.

Hit-testing, damage/debris, lifecycle, physics, and gameplay simulation must not depend on arbitrary glTF node structure.

## Included Studio sample

`assets/sample_visual_asset_pack_v1/` contains a preview/test pack built from embedded `test_anim.gltf`.

It is explicitly not a final gameplay asset. It exists to test:

- embedded buffer handling;
- embedded texture handling;
- duplicate node-name warnings;
- stable path bindings;
- clip binding validation;
- export packaging and validation reports.

## M4A engine-sync rules added after v0.7 polish

Current Studio validation mirrors the engine-side M4A contract slice supplied on 2026-06-23.

Allowed `blockTypes` are now exactly:

- `Core`
- `Hull`
- `Frame`
- `Thruster`
- `VectorThruster`
- `Balloon`
- `Wing`
- `ControlSurface`
- `Gyro`
- `Fuel`

The following older or speculative types are not accepted as VAW-ready in V1:

- `Structure`
- `Structural`
- `Hinge`
- `Rotor`
- `Sensor`
- `Payload`
- `MagicGameplayBlock`

Allowed node aliases are exactly `visualRoot`, `flame`, `flameGlow`, `gimbalAssembly`, and `controlFlapPivot`.

Allowed clip aliases are exactly `idle`, `thrust`, and `damage`.

`materialPolicy` is required. It may be an empty object, but it must exist as an object so engine-side consumers can rely on a stable shape.

`model.path` must be a plain relative pack path. It must use `/`, must not start with `/` or `./`, must not contain `..`, `.`, empty segments, `\`, query/hash suffixes, or URI/absolute schemes such as `http:`, `https:`, `file:`, `data:`, `blob:`, or `C:/`.


## Package ZIP layout rule

A Visual Asset Pack ZIP must contain the model file at the path declared by `assets[0].model.path`, relative to the pack root.

Example:

```json
"model": { "path": "models/thruster_basic.gltf" }
```

The ZIP must contain:

```text
VAW_VISUAL_ASSET_PACK_V1.json
models/thruster_basic.gltf
validation/...
```

Studio debug/provenance data belongs under `validation/` or in a separate Debug Package. Engine-facing files must not exist only under `source/`, because the future M4B/M4C loader should be able to resolve paths from the manifest without Studio-specific knowledge.

## Common Blockbench warnings

Blockbench may export repeated node names such as `group`. This is not a preview failure. It is a warning because VAW export bindings need stable references.

Safe:

- duplicate names exist;
- bindings use unique stable paths.

Blocked:

- binding uses an ambiguous bare name such as `group`;
- duplicated sibling names create an ambiguous path;
- no V1 manifest is loaded and the user tries to export a VAW pack.


## Pack-root path rule after final audit

`assets[].model.path` is a path inside the exported Visual Asset Pack root. It must not contain the Studio sample folder, the browser upload folder, or any local machine prefix.

Correct:

```json
"model": { "path": "models/test_anim.gltf" }
```

Incorrect:

```json
"model": { "path": "sample_visual_asset_pack_v1/models/test_anim.gltf" }
```

Studio may load a file from a folder such as `sample_visual_asset_pack_v1/models/test_anim.gltf`, but export must write it to `models/test_anim.gltf` if that is the manifest path. The extra browser/source folder is provenance, not part of the engine-facing contract.

Plain Blockbench import without a V1 manifest is not an error. Preview and Debug Package export remain allowed; Visual Asset Pack export waits for a loaded or inferred V1 manifest.
