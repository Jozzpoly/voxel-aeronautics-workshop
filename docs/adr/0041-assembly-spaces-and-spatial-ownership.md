# ADR 0041 — Assembly Spaces and Spatial Ownership

Status: Accepted.

## Decision

Blueprint v12 owns durable `assemblySpaces[]`. `space:root` is mandatory, parentless and identity-posed. Every child stores a finite parent-local position and canonical unit quaternion. Blueprint stores no world pose and no Three.js/Cannon.js objects.

Every v12 block stores one `assemblySpaceId`; its integer `x/y/z` is local to that space. Structural adjacency exists only inside one space. Every mechanical link stores the deterministic lowest-common-ancestor owner of its endpoint spaces. Every compiled rigid island belongs to exactly one space. `bodyId` remains a deterministic compiler/runtime identity and must never be used as persistent spatial identity.

Runtime startup composition is:

```text
spawn pose × space parent chain × body pose in space × body/block local pose
```

Blueprint v11 migrates by creating `space:root` and assigning all blocks/links to it. Missing roots/parents/owners, duplicate IDs, parent cycles and stale link ownership are errors. Root-only craft behavior remains backward compatible.

## Authoring transactions

Create, rename, reparent, block reassignment and leaf deletion are atomic. Failed off-grid transforms, collisions or cycles leave the model unchanged. Reparent preserves root-relative pose. Copy remaps persistent IDs. Root cannot be deleted or reparented.

## Runtime ownership

CompiledCraft V5 and RuntimeAssemblyPlan V3 expose deterministic block→space, block→body, body→space, space→parent and body/part/collider/constraint indexes. AssemblyBuilder validates them before allocation. FlightSession exposes owner-correct lookup for camera, visuals, collisions, damage and thrusters. Lifecycle cleanup is idempotent.

## Non-goals

Walking, docking gameplay, broad interiors, Device/Port Schema, signal graph, ControlRuntime, multiplayer, dynamic articulated fracture and generalized constrained-body rebase are not Gate C features.
