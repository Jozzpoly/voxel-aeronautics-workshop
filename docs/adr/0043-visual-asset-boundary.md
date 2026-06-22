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
- imported Blockbench content remains an external authoring workflow until a later approved milestone.

## Consequences

Craft saves stay small, deterministic and gameplay-owned. A future `VisualAssetRegistry` can resolve model, texture and animation definitions without changing Blueprint v12 or compiled gameplay contracts.

The first Workbench Foundation milestone documents this boundary only. It does not ship a Blockbench importer.
