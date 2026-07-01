# Mission Map And Terrain Authoring

Status: Active renderer/runtime authoring contract
Last verified: 2026-07-01
Authority: Explains the current Gate C mission-map and terrain workflow. Source and tests remain authoritative.

## Ownership

`src/foundation/config.js` owns the proving-range map data:

- `TEST_RANGE.pads`: named landing pads with position, radius and label.
- `TEST_RANGE.missionMap`: sector grouping and player-facing sector descriptions.
- `TEST_RANGE.terrain.fog`: scene fog color and density.
- `TEST_RANGE.terrain.materials`: editable procedural terrain material definitions.
- `TEST_RANGE.terrain.patches`: placed terrain texture areas.
- `TEST_RANGE.terrain.strips`: route/service strips between pads.
- `TEST_RANGE.obstacles`: range landmarks and collidable static AABB obstacles.

`src/foundation/catalog.js` owns contract gameplay data:

- contract order and prerequisites;
- landing targets, gates, payloads, timing and reward values;
- visible route/build/hazard metadata for the contract panel.

`src/game/scene_environment.js` renders this data. It must not introduce a second copy of the map schema. Terrain, strips, pads and collidable obstacles should come from `TEST_RANGE`.

## Terrain Material Workflow

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

## Geometry Rules

Every visible pad in `TEST_RANGE.missionMap` should have gameplay or exploration purpose:

- a contract landing zone; or
- a mission gate close enough to make the pad a readable route landmark.

Every collidable obstacle must be declared in `TEST_RANGE.obstacles`. Do not hide collidable range geometry inside `scene_environment.js`; the validator cannot protect geometry it cannot read.

`tools/validate_mission_map.js` checks:

- range size and fog density;
- sector/pad references;
- terrain material, patch and strip references;
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
