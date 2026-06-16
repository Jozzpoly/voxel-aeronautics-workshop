# ADR 0035 — Structural edge cuts, rigid bypass and combined assembly connectivity

Status: Accepted in Foundation Phase 1D.4A.

## Decision
Structural adjacency is compiled once from face-neighbor voxels. A valid mechanical link cuts exactly one canonical structural edge. Rigid islands are connected components after all cuts. Mechanical constraints then connect island nodes. If an alternate rigid path leaves both endpoints in one island, compilation emits `mechanical-rigid-bypass`. Launch readiness is based on the combined rigid-island plus mechanical-link graph; multiple unconnected assemblies emit `assembly-disconnected`. Mechanical cycles are legal.

## Consequences and proof
Damage/support consumers use compiled rigid neighbors and cannot propagate across a cut. Tests cover adjacency uniqueness, bypass, cycles, disconnected assemblies, permutations and 2500 blocks without all-pairs scans.
