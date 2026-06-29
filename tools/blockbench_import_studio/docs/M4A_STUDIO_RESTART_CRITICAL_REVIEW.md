# M4A Studio Restart — critical review

The previous hardening pass was useful, but too narrow. It fixed visible issues in the prototype: animation list wiring, timeline updates, data URI spam, embedded texture counts, and resolver noise. That work made the lab less broken, but it still left a dangerous architectural ambiguity: `.vaw.json` sidecar data could drift into becoming a quasi-gameplay contract.

This pass restarts the export path around a named contract: `VAW_VISUAL_ASSET_PACK_V1`.

## What changed in method

- Preview and export are treated as different products.
- Preview remains permissive so artists can inspect models early.
- Export is strict and must pass a manifest validator.
- Visual data is explicitly renderer-facing.
- Gameplay-authority fields are rejected recursively.
- Stable node paths are introduced for duplicated glTF node names.
- Package export now includes validation reports, not just source files.

## What is still intentionally not done

- No VAW engine integration.
- No gameplay schema editing.
- No Blueprint/CraftModel changes.
- No Three.js runtime registry in the game.
- No localStorage asset import.
- No replacement of procedural visuals without fallback.

## Next intended handoff

Engine-side M4A can now implement a pure validator and runtime registry against this draft. Studio-side M4B should only begin after the engine accepts the sample pack and fallback behavior is proven.
