# ADR 0034 — Persistent mechanicalLinkId and deterministic bodyId policy

Status: Accepted in Foundation Phase 1D.4A.

## Decision
`blockId` remains durable through moves and changes only on copy. `mechanicalLinkId` is authored and maps 1:1 to runtime `constraintId`. A rigid island uses an anchor: Core when present, otherwise its lexicographically smallest block ID; `bodyId` is `body:<anchorBlockId>`. IDs never use array indexes, positions, random compiler state or native handles.

## Alternatives
Membership hashes were rejected because adding a non-anchor block would rename a body. Positional IDs were rejected because movement would rewrite identity.

## Consequences and proof
Input permutations preserve signatures, body IDs and constraints. Split-side identity remains with the old anchor. Copy creates new block/link IDs and remaps only internal endpoints. Future `assemblySpaceId` remains distinct from `bodyId`.
