# Programmable Machine Research — current contract

Phase 1D.4A deliberately implements mechanics, not a signal or programming system.

## Layer separation

- Structural graph: rigid voxel support edges.
- Mechanical graph: constraints between rigid bodies.
- Future signal graph: device endpoints such as `{blockId, portId}`.
- Future transport: Kable, bus i wireless policies.
- Future ControlRuntime: deterministic fixed-tick execution issuing commands through neutral IDs.

A hinge is not a signal port. Immutable limits/friction/collision configuration belongs to the machine plan; motor speed, servo angle and current mode are runtime commands. InputProfile remains a user preference and manual piloting remains first-class.

## Gate C seam

A future `sublevel` or assembly space must use explicit transforms and stable identities. It is not a second blueprint and `bodyId` is not `assemblySpaceId`.

## Deferred work

No device catalog, ports, signal links, logic nodes or ControlRuntime placeholders were added. Their schemas require dedicated Gate D/E review after Gate C stabilizes spatial ownership.
