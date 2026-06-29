# ADR 0043 - Visual asset boundary

Status: Accepted

## Context

The project is moving toward user-authored low-poly/pixel-art models, textures and animations. The current engine was not designed around external asset packs, so the boundary must be defined before a Blockbench importer or asset studio is added.

The durable rule remains: the blueprint and machine model are the source of truth. Rendering assets may present the machine, but they must not become gameplay data.

## Decision

`foundation.catalog` remains the owner of gameplay block data: mass, force, fuel, durability, drag, descriptions and gameplay type identity.

`game.module-visual-factory` and `game.scene-environment` remain the default procedural Three.js fallback renderer.

Future visual data will be separate:

- a block type maps to a visual asset id;
- a missing visual asset falls back to the procedural renderer;
- visual asset packs are external project/dev artifacts, not Blueprint save payloads;
- asset packs are not loaded from localStorage;
- Blockbench Import Studio may live in the repository under `tools/`, but remains an authoring/export tool rather than game runtime code.
- imported Blockbench content enters the game only through validated Visual Asset Pack V1 manifests listed by a renderer-only pack index.

## Consequences

Craft saves stay small, deterministic and gameplay-owned. `VisualAssetRegistry` can resolve model, texture and animation definitions without changing Blueprint v12 or compiled gameplay contracts.

The first Workbench Foundation milestone documented this boundary. M4B/M4C consume validated renderer-facing packs under stable VAW roots while preserving procedural fallback. M4E hardens that consequence: imported glTF resources are cloned per instance, failed model loads can retry, and `visualRoot` selects a renderer subtree without ever replacing VAW roots, hit proxies, physics bodies or compiled gameplay contracts.

M4G keeps that ownership rule while improving real authoring fidelity: the `vawHitProxy` remains present and raycastable but is render-invisible by default, with visual debug as an explicit diagnostic mode. Material policy stays renderer-only and can use `auto` plus per-material alpha overrides so opaque block bodies/nozzles are not forced into transparent sorting just because flame/glass materials need blending.
