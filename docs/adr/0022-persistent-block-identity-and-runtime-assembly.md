# ADR 0022 — Persistent block identity and runtime assembly

## Status

Accepted in Foundation Phase 1D.2F.

## Context

A coordinate key is sufficient while a craft is one immutable voxel island with hardcoded control logic. It is not sufficient when:

- a block moves but its configuration must survive;
- signal links address a specific device;
- a craft is divided into multiple rigid subassemblies;
- multiple local grids may contain the same coordinates;
- a joint connects bodies without merging their structures.

The former model used `x,y,z` both as spatial index and effective identity.

## Decision

Every block has a persistent `blockId`. Its `gridKey` remains a position index only.

The compiler and runtime expose mappings based on `blockId`.

Runtime construction is represented by `RuntimeAssemblyPlan` containing:

- `rigidBodies[]`;
- `constraints[]`;
- `signalLinks[]`;
- `parts[]`;
- `blockIdToBodyId`;
- `blockIdToPartIndex`.

Phase 1D.2F emits one root body. This is a compatibility case, not a permanent invariant.

Structural, mechanical and signal connections are separate graphs.

## Consequences

- Blueprint schema advances to v10.
- v3–v9 documents receive migrated block identifiers.
- Moving a block preserves identity; copying creates a new identity.
- Future control links must reference `blockId`, never coordinates alone.
- Joint compilation can divide structural islands without changing device identities.
