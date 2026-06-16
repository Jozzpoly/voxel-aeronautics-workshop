# ADR 0033 — Blueprint v11 and mechanical link authoring schema

Status: Accepted in Foundation Phase 1D.4A.

## Context
Blueprint v10 persisted blocks only. Runtime hinge fixtures therefore had no durable authoring source and could not participate in history, import/export or cache invalidation.

## Decision
Blueprint v11 adds a typed `mechanicalLinks[]` collection. The first entity is `kind: "hinge"` with a persistent `mechanicalLinkId`, two `{blockId, face}` endpoints, a signed face-axis, collision policy, force/friction and optional immutable limits. Current-version documents reject malformed or duplicate IDs; v10 migrates purely to v11 by adding an empty collection. Runtime command targets are not persisted.

## Rejected alternatives
A voxel “hinge block” was rejected because it conflates collider, structural cut, device, signal port and solver constraint. Reserving empty signal/control arrays was rejected because Gate D/E contracts are not yet approved.

## Consequences and proof
CraftModel owns links in the same revision as blocks. Tests cover v10 migration, v11 round-trip, strict IDs, malformed faces/axes, import/export and model transactions. Gate D can later add ports without changing mechanical identity.
