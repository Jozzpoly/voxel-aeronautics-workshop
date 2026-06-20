# Voxel Aeronautics Workshop — Architecture

Current milestone: **Foundation Gate C Future Hardening**.

```text
Blueprint v12 / CraftModel
  assemblySpaces + blocks + mechanicalLinks
        |
CraftCompiler
  structural -> mechanical authoring -> rigid islands -> mechanical graph
        |
CompiledCraft V5
        |
RuntimeAssemblyPlan V3
        |
FlightSession -> AssemblyBuilder -> Physics Port -> Cannon/headless backend
```

Pure foundation/compiler modules contain no DOM, Three or Cannon. Blueprint contains serializable authoring data only. AssemblyBuilder is the runtime allocation boundary. FlightSession owns start/stop/retry and transient presentation ownership. `window.VAW_RUNTIME` remains forbidden.

## Identity and coordinates

`assemblySpaceId` is durable spatial identity. `blockId` and `mechanicalLinkId` are durable authoring identities. `bodyId` is deterministic compiled identity and may not persist into future device/signal schemas.

A block's grid coordinates are local to its Assembly Space. Runtime world pose is spawn × space chain × body-in-space pose × body/block-local pose. Space hierarchy indexes and root poses are canonicalized once.

## Runtime health

Runtime plans carry exact indexes for block/body/space/part/collider/constraint lookup. Physics inputs and sampled outputs are finite and normalized or fail explicitly. Fixed-step scheduling exposes overload metrics. Hot paths use owner indexes rather than repeatedly scanning the whole craft.

## Distribution boundary

Three r128, Cannon 0.6.2 and generated UI CSS are vendored and recorded in third-party notices. Release verification hashes the exact canonical bytes. Runtime startup has no CDN dependency.

## Safety boundaries

Connected-body rebase and dynamic articulated fracture remain guarded. Future ports must use `{blockId, portId}` and resolve runtime bodies rather than persisting `bodyId`. Gate D must extract a real responsibility from the full-size composition shell before adding broad wiring.
