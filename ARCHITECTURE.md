# VAW Architecture

This document describes the **current code boundaries observed in the recovery source**. It is not a claim that the corresponding user-facing features are complete or well designed.

## Core data flow

```text
Blueprint v12 / CraftModel
  assemblySpaces + blocks + mechanicalLinks
        |
CraftCompiler
  structural graph
  -> mechanical authoring resolution
  -> rigid islands
  -> mechanical graph
        |
CompiledCraft V5
        |
RuntimeAssemblyPlan V3
        |
FlightSession
        |
AssemblyBuilder
        |
Physics Port
        |
Cannon backend / headless backend
```

The recovery validation around `80c0ae4` exercised this path, including articulated and multi-space assembly. That is evidence that the architecture exists; it does not prove authoring UX or gameplay quality.

## Authority boundaries

### Authoring

`CraftModel` owns editable machine state. Blueprint data is serializable authoring data only. Engine-native Three/Cannon objects do not belong in Blueprint saves.

### Compilation

`CraftCompiler` translates authoring state into deterministic runtime-oriented data. Compilation owns derived topology and diagnostics rather than UI code guessing runtime structure.

### Runtime allocation

`AssemblyBuilder` is the boundary that allocates runtime bodies, colliders and constraints from the compiled plan. `FlightSession` owns flight/test lifecycle and transient runtime presentation.

### Physics

Physics is accessed through a backend-neutral port. Cannon is the real browser physics backend; a headless backend exists for deterministic/system tests. Runtime physics identity must not become persistent authoring identity.

## Identity domains

These IDs are not interchangeable:

- `assemblySpaceId` — durable local spatial ownership;
- `blockId` — durable authored part/device identity;
- `mechanicalLinkId` — durable authored mechanical connection identity;
- `bodyId` — compiled/runtime body identity.

Future persistent device or signal references must resolve from stable authored identities, not persist `bodyId`.

## Separate graphs

The project intentionally separates:

- structural connectivity;
- mechanical constraints;
- future signal connectivity;
- control/input bindings;
- future cable/bus/wireless transport.

A mechanical hinge is not a signal connection. A cable is not the meaning of the signal it carries.

## Visual boundary

Gameplay data belongs to the foundation/catalog and runtime systems. Visual Asset Pack V1 and Blockbench Import Studio are renderer/authoring surfaces.

Imported visual data must not become the authority for mass, force, fuel, collision, persistent IDs, controls or save semantics. Procedural visuals remain a fallback path when imported visuals are unavailable or invalid.

## UI boundary

Workspace layout, panel state and camera preferences are user-interface preferences. They are not Blueprint/craft data.

The current Workbench UI is technically substantial but **not accepted as product-quality UX**. Architecture tests around it must not be interpreted as usability evidence.

## Known areas requiring a reality audit

The following are deliberately not declared mature here:

- the large game composition shell and responsibility distribution;
- mechanical/hinge authoring and joint capability;
- device tuning, ports, direct binding and signal/control runtime;
- visual fidelity, lighting/readability and renderer policy;
- failure/rebuild ergonomics;
- target-platform/browser behavior beyond the manually demonstrated recovery path;
- dynamic articulated fracture and constrained-body rebase;
- release/generated-provenance policy.

The next code audit must distinguish sound architectural seams from code that only satisfies synthetic contracts.
