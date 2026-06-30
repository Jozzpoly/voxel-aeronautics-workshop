# VAW Visual Asset Pack V1

`VAW_VISUAL_ASSET_PACK_V1` is the narrow visual contract between VAW Studio and the game runtime.

The pack is a rendering artifact only. It must not define gameplay data, blueprint data, craft model data, physics colliders or control semantics. `foundation.catalog`, Blueprint, CraftModel and CraftCompiler remain authoritative.

## Manifest Shape

Required top-level fields:

- `format`: exactly `VAW_VISUAL_ASSET_PACK_V1`
- `packId`: stable non-empty string
- `version`: non-empty string
- `assets`: array of visual assets

Each M4A asset must use:

- `kind`: `blockVisual`
- `assetId`: stable non-empty string
- `model.path`: forward-slash relative model path inside the asset pack
- `model.unitMeters`: positive number
- `model.forwardAxis` and `model.upAxis`: one of `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`, using different axes
- optional `model.transform.position`, `model.transform.rotationDegrees`, `model.transform.scale`: renderer-only transform for the imported child
- `bindings.blockTypes`: known `foundation.catalog` block types
- `bindings.nodes`: only `visualRoot`, `flame`, `flameGlow`, `gimbalAssembly`, `controlFlapPivot`
- `bindings.clips`: only `idle`, `thrust`, `damage`
- optional `bindings.rig.vectorThruster.channels`: renderer-only VectorThruster visual motion profile
- `materialPolicy`: object reserved for visual policy

## Forbidden Fields

The validator rejects these keys anywhere in the manifest:

`mass`, `force`, `fuelRate`, `durability`, `dragArea`, `wingArea`, `collider`, `collision`, `controlAxis`, `blueprint`, `craftModel`.

The validator also rejects model paths that leave the pack or require external loading: absolute paths, drive-letter paths, URLs, `data:` URIs, `..`, `.` segments, `./` prefixes and backslashes.

## Runtime Behavior

Invalid packs are blocked at registration time. The game must continue with procedural fallback visuals.

M4A validates the manifest, registers visual metadata and keeps a stable VAW visual root. M4B loads one validated glTF block visual as a renderer-only child of that existing root. M4C extends this to an explicit installed-pack index at `assets/visual_packs/installed_visual_packs.json` and replacement coverage for all current Catalog block types. M4E hardens real-asset loading: imported instances clone renderer resources per block, rejected model loads can retry, `bindings.nodes.visualRoot` mounts the selected glTF subtree, and `unitMeters`/axis metadata affect only the imported child transform. M4F adds fast iteration through `local_working_visuals`, explicit reload, material policy and optional renderer-only transform. The imported model must never replace `root.userData.isVoxelRoot`, the `vawHitProxy`, hit-testing, damage/debris ownership or flight lifecycle.

M4J adds an optional VectorThruster renderer rig profile. It maps existing runtime visual inputs to imported model node rotations without changing control semantics:

```json
{
  "bindings": {
    "rig": {
      "vectorThruster": {
        "channels": [
          { "input": "gimbalA", "node": "gimbalAssembly", "axis": "z", "direction": -1 },
          { "input": "gimbalB", "node": "gimbalAssembly", "axis": "y", "direction": 1 },
          { "input": "roll", "node": "gimbalAssembly", "axis": "x", "direction": 1 }
        ]
      }
    }
  }
}
```

`input` is `gimbalA`, `gimbalB` or `roll`; `node` references a `bindings.nodes` alias; `axis` is `x`, `y` or `z`; `direction` is `1` or `-1`. The runtime applies these rotations from the imported node's cached base pose. Missing metadata falls back to the legacy procedural gimbal path; invalid metadata is blocked by validators/audits or no-ops at runtime.

The M4B development fixture is a source-tree artifact at `assets/visual_packs/test_anim_preview_visual_pack/`. It proves the loader boundary and alias-binding path for a `Thruster` visual only. The M4E real fixture is `assets/visual_packs/real_blockbench_thruster_pack/`; it is a source-tree smoke pack copied from real Blockbench exports and is still renderer-only. M4C/M4E pack installation is a simple folder/index workflow, not a user-facing mod manager.

## Installed Pack Index

`assets/visual_packs/installed_visual_packs.json` is a renderer-only project/dev index:

```json
{
  "format": "VAW_VISUAL_PACK_INDEX_V1",
  "version": "0.1.0",
  "packs": [
    {
      "source": "local:local_working_visuals",
      "manifestUrl": "local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json",
      "revision": 0
    },
    {
      "source": "dev:real_blockbench_thruster_pack",
      "manifestUrl": "real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json"
    },
    {
      "source": "dev:test_anim_preview_visual_pack",
      "manifestUrl": "test_anim_preview_visual_pack/VAW_VISUAL_ASSET_PACK_V1.json"
    }
  ]
}
```

`manifestUrl` is resolved relative to the index file. Invalid index entries, missing manifests, invalid manifests and model loader failures must produce diagnostics and leave procedural fallback active. If multiple valid packs bind the same block type, the registry keeps the first mapping and records duplicate diagnostics.

`local_working_visuals` is the default first entry for rapid local art iteration. Studio updates one block folder in this pack in place through the local development endpoint. Revision is used only for renderer cache-busting and diagnostics; `model.path` stays a clean pack-relative path.

## Material Policy

`materialPolicy.alpha` is renderer-only:

- `auto`: default safe policy; keep ordinary materials opaque and use blend/mask only for materials with glTF alpha signals
- `from-gltf`: keep GLTFLoader defaults
- `blend`: global semi-transparent rendering (`transparent=true`, `alphaTest=0`, `depthWrite=false`); use carefully because it can make solid parts such as nozzles sort like translucent geometry
- `mask`: cutout alpha (`transparent=false`, nonzero `alphaTest`)
- `opaque`: force opaque rendering

`materialPolicy.materialOverrides` can target glTF materials by name:

```json
{
  "alpha": "auto",
  "materialOverrides": [
    { "materialName": "NozzleMat", "alpha": "opaque" },
    { "materialName": "FlameMat", "alpha": "blend" }
  ]
}
```

Use this for mixed models where a body/nozzle must stay opaque while flame, glass or glow materials use alpha blending.

Material override matching is by exact glTF material name, case-insensitive. If an imported model contains duplicate material names, the runtime applies the override to every matching material and records a diagnostic. Rename materials in Blockbench when one duplicate should be opaque and another should blend.

This policy never changes physics, hit-testing, collision or gameplay semantics.

## Known Limitation

The current reimported thruster/checker sample lost its original gameplay look after being extracted from the game and reimported. Do not treat that fixture as a final asset or as proof of visual fidelity. It exists to exercise validation, registry, loader, fallback and alias-binding paths.

Global `blend` can produce edge bleed and camera-angle transparency on otherwise solid block parts because transparent meshes are depth-sorted differently by WebGL. Prefer `auto` plus per-material overrides: body/nozzle `opaque` or `mask`, flame/glass `blend`.

For M4E and later acceptance, a newly designed Studio asset should be exported as a Visual Asset Pack V1 and compared in game against the Studio preview. If it differs materially, capture the mismatch as a pipeline bug instead of moving gameplay data into the asset pack. Runtime animation playback is not part of M4E; clip aliases remain contract metadata for a later animation milestone.
