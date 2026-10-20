# Mission Map And Terrain Authoring

Status: Active renderer/runtime authoring contract
Last verified: 2026-07-02
Authority: Explains the current Gate C mission-map and terrain workflow. Source and tests remain authoritative.

## Ownership

`src/foundation/config.js` owns gameplay-relevant proving-range map data and the default terrain seed:

- `TEST_RANGE.pads`: named landing pads with position, radius and label.
- `TEST_RANGE.missionMap`: sector grouping and player-facing sector descriptions.
- `TEST_RANGE.terrain`: fallback terrain appearance used when no local Studio preset is installed.
- `TEST_RANGE.obstacles`: range landmarks and collidable static AABB obstacles.

`assets/terrain/local_working_terrain/VAW_TERRAIN_AUTHORING_V1.json` owns the local renderer-only terrain appearance workflow:

- `terrain.fog`: scene fog color and density for the local proving range.
- `terrain.materials`: procedural terrain material definitions.
- `terrain.patches`: placed terrain texture areas.
- `terrain.strips`: route/service strips between pads.

The game loads that local preset at startup and merges only `terrain` into a copy of `TEST_RANGE` through `foundation.terrain-authoring`. If the preset is missing or invalid, runtime falls back to `TEST_RANGE.terrain`.

`src/foundation/catalog.js` owns contract gameplay data:

- contract order and prerequisites;
- landing targets, gates, payloads, timing and reward values;
- visible route/build/hazard metadata for the contract panel.

`src/game/scene_environment.js` renders this data. It must not introduce a second copy of mission or collision schema. Terrain appearance may come from the Studio preset, but pads, sectors, contracts and collidable obstacles still come from source-owned `TEST_RANGE` and `catalog.js`.

## Terrain Material Workflow

Primary workflow:

```text
npm run studio:serve
```

Open `Terrain Authoring V1` in Studio. Edit fog, materials, patches and strips there, then use `Save / Install Terrain Preset`. The dev server writes the local preset to:

```text
assets/terrain/local_working_terrain/VAW_TERRAIN_AUTHORING_V1.json
```

Manual JSON edits to that file are acceptable for recovery, but ordinary terrain texture/map iteration should happen through Studio UI. Do not edit `src/foundation/config.js` just to recolor or reposition renderer-only terrain appearance.

Terrain material entries are deliberately simple:

```js
materialId: {
  color: 0x15283a,
  roughness: 1.0,
  texture: {
    kind: 'checker', // checker, stripe or noise
    colorA: 0x15283a,
    colorB: 0x1b3349,
    repeat: 34
  }
}
```

To change the look of the map without changing gameplay, edit material colors or texture parameters, then assign that material to a patch or strip.

Patches place material regions on the ground:

```js
{ id: 'ridge-shelf-dust', material: 'ridgeDust', center: { x: 172, z: -162 }, size: { x: 68, z: 52 }, rotation: -0.28 }
```

Strips connect pads by id:

```js
{ id: 'ridge-link', fromPad: 'northPad', toPad: 'ridgePad', width: 8, material: 'ridgeDust', opacity: 0.45 }
```

This is intentionally renderer-facing. Terrain materials do not carry friction, mission semantics, rewards, damage, collision or contract state.

## Renderer Layering

Terrain surfaces are separated as render layers to avoid z-fighting:

- ground base;
- material patches;
- route strips;
- runway/route markings.

`scene_environment.js` gives those layers distinct Y offsets, render order and polygon offset policy. Do not fix z-fighting by changing terrain gameplay data or by turning strips back into thin collision-like boxes.

## Geometry Rules

Every visible pad in `TEST_RANGE.missionMap` should have gameplay or exploration purpose:

- a contract landing zone; or
- a mission gate close enough to make the pad a readable route landmark.

Every collidable obstacle must be declared in `TEST_RANGE.obstacles`. Do not hide collidable range geometry inside `scene_environment.js`; the validator cannot protect geometry it cannot read.

`tools/validate_mission_map.js` checks:

- range size and fog density;
- sector/pad references;
- terrain material, patch and strip references;
- local `VAW_TERRAIN_AUTHORING_V1` preset validity when present;
- every landing pad against every collidable obstacle;
- every mission gate against every collidable obstacle;
- rendered pads with no mission/exploration purpose.

## Validation

Use the targeted validator while editing range data:

```text
npm run mission:validate
```

Before treating a map/content change as integrated, run at least:

```text
npm run mission:validate
npm run browser:smoke
npm run validate:fast
```

Manual flight remains required for balance claims such as par time, reward pacing, and whether a route feels fair. The geometry validator proves clearance; it does not prove mission feel.
