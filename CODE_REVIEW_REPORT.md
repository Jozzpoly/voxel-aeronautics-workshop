# Code Review Report — Foundation Phase 1D.4A

## Scope

Independent principal-level second review of Blueprint v11, migration boundaries, CraftModel transactions, compiler layering, RuntimeAssemblyPlan V2, real-Cannon runtime, game-shell consumers, controls, tests, build tooling and release documentation.

## P1 findings fixed

### Current schema could silently suffix duplicate explicit block IDs
`Blueprint.createDocument` previously used permissive canonicalization for all blocks. Explicit current-version IDs are now strict; only absent authoring IDs may be allocated. CraftModel initialization normalizes the supplied document rather than rebuilding it through a permissive path.

### Duplicate mechanical-link diagnostics depended on input order
Raw links are now canonically sorted before duplicate resolution. The same invalid document produces the same diagnostics and signature projection regardless of array order.

### Invalid hinge numeric configuration could reach runtime compilation
MechanicalAuthoringResolver rejects invalid `maxForce`, negative friction and malformed limits as structured diagnostics before plan/backend allocation.

### Mutable command state leaked into immutable mechanical graph
Compiled constraints no longer contain current motor/servo commands. Plan V2 creates initial `free` runtime control; later commands live only in RuntimeAssembly/backend state.

### Private global runtime aggregate crossed application boundaries
The final entrypoint still consumed `window.VAW_RUNTIME`, despite modular internals. The aggregate was removed. `game.js` now obtains explicit kernel modules and the validated `runtime.active-context`; architecture tests forbid reintroduction.

### Collision fallback still used a removed global lower bound
A no-contact-point collision could fall back to geometry derived from the wrong body. Each body now owns its own lowest body-local Y, preserving owner-space interpretation through the whole collision pipeline.

### Root pilot commands could drive actuators on passive sub-bodies
The default mixer and torque envelope previously considered all parts in the assembly. Pilot-controlled thrusters, gyros and control surfaces are now selected from the Core/root body only. Passive aero remains per body.

### Startup smoke did not prove the articulated UI production path
The harness now imports `examples/articulated_hinge_v11.json` via FileReader/input change, checks the visible workshop hinge, launches with the ordinary Flight button and verifies two-body lifecycle cleanup.

### Ambiguous runtime position naming
Gameplay and integrity runtime parts now use `bodyLocalPosition`; compiled and plan fields distinguish assembly, body-local and world spaces.

## P2 findings fixed

### Runtime plan construction repeatedly filtered every part per island
Parts are indexed by body once before body-plan construction, removing the `islands × all parts` scan.

### Body-to-part index absent from plan
Plan V2 exposes deterministic `bodyIdToPartBlockIds` in addition to block/body and body/constraint maps.

### History inspection counted blocks only
History diagnostics expose entity counts including mechanical links while preserving legacy block metrics.

### Obsolete single-body wrappers and aliases survived the convergence
Dead `body:root`, native-body, `STATE.flight.body`, `assemblyRuntime`, `group` and old contiguity/helper seams were removed rather than maintained as a second contract.

## Reviewed invariants

- No production body ID uses array index.
- Mechanical link/constraint IDs are persistent and backend-neutral.
- Signatures, body IDs, edges and diagnostics are deterministic under input permutation.
- Every part belongs to exactly one rigid island.
- Every constraint connects two existing distinct bodies.
- Local pivots map to one assembly pivot.
- Payload changes only its owner body and recalculates owner-side pivots.
- All bodies spawn through `spawnTransform × assemblyPose`.
- Damage cannot select another body's part at the same local coordinate.
- Cut edges do not propagate rigid damage.
- Constraint removal precedes collider/body cleanup.
- Failed cleanup retains retry ownership.
- Connected-body recenter fails before frame mutation.
- `game.js` does not allocate assembly bodies/constraints or compile topology.
- Physics Port remains the sole backend boundary.
- The root-body camera, mission and pilot-control policy is explicit, not Map-order dependent.
- Current v11 normalization never invents a replacement for duplicate explicit IDs.

## Review searches

Repository-wide searches found no production occurrences of:

```text
window.VAW_RUNTIME
body:root
body:${index}
part.offset
payloadLocalPos
STATE.flight.body
assemblyRuntime
flight.group
```

Raw grid-neighbor use remains in authoring/compilation where it belongs; flight damage/support consumers use compiled `rigidNeighborBlockIds`.

## Open items

No open P0–P2 is accepted in the delivered Gate B scope. P3/future capability: atomic body-frame rebase and dynamic rigid-body split for generalized articulated damage. The current guard is explicit, documented and tested.
