# Future Readiness Hardening Review

Date: 2026-06-18

## Verdict

Gate C is technically ready to become the base for Gate D. This hardening pass fixed concrete data-corruption, determinism, runtime-boundary, scaling and distribution risks rather than adding empty frameworks. No known P0–P2 remains in the hardened Gate C scope.

## Problems fixed

### Data and identity

- Canonical poses now collapse quaternion `q/-q` and negative zero to one deterministic representation.
- Parent validation and root-pose composition are iterative; a 6000-level hostile chain cannot overflow the JS stack.
- Parent/children/depth/root-pose indexes are built once; LCA and transform lookup no longer repeatedly rebuild the hierarchy.
- Anonymous blocks in different spaces receive order-independent IDs.
- Blueprint import projects only known schema fields before migration; cyclic or extremely deep unknown data cannot crash parsing.
- Hinge tuning rejects impossible values instead of silently converting them into nearly dead actuators.
- Runtime signatures ignore authoring-only space names, avoiding unnecessary rebuild/synchronization churn.

### Persistence

- Backup rotation never overwrites the last valid backup with a corrupt primary save.
- Import byte limits use UTF-8 bytes, not JavaScript character count.
- Failed reassign/delete/reparent transactions are proven atomic.

### Runtime and physics

- Physics Port rejects explicit NaN/Infinity, zero quaternions, negative inertia, contradictory body type/mass and invalid solver settings.
- Cannon and headless backends share axis-angle behavior and strict sampling.
- Spawn pose validation is fail-fast.
- Fixed-step scheduling reports clamped frame time and dropped substeps instead of silently losing simulation time.
- Body/part/collider/constraint lookup uses prebuilt ownership indexes; repeated whole-craft scans were removed from damage, impact, mission and torque hot paths.
- Deep/wide diagnostic details are bounded and deterministic, so the error system cannot be taken down by its own context.

### Distribution

- Tailwind runtime CDN was removed and replaced by generated checked-in CSS with candidate-set hash validation.
- Three r128 and Cannon 0.6.2 are vendored, licensed and checksumable.
- `index.html` and the single-file release no longer require runtime network scripts.

## Deliberately unresolved risks

1. `game.js` remains at the 2500-line composition-shell ceiling. Gate D must extract a real responsibility before adding substantial UI/runtime wiring; raising the limit is not a solution.
2. `bodyId` may change after future topology splits. Persistent devices/ports/signals must use `{blockId, portId}` and resolve bodies at compile/runtime.
3. Dynamic articulated fracture and constrained-body rebase remain blocked until atomic constraint rebuild/rollback exists.
4. WebGL context-loss restoration is not implemented.
5. Performance evidence is strong for CPU/domain/runtime plans but not yet a formal low-end GPU/browser matrix.
6. LocalStorage is suitable for current blueprints but not large content libraries; Gate D should not put large generated assets or logs there.
7. Assembly Space UX is minimal: no transform gizmo, hierarchy tree, bulk selection or visual ownership overlays.
8. Debris scatter and decorative environment use nondeterministic randomness. This is acceptable now, but replay/network determinism must isolate cosmetic RNG from simulation RNG.
9. Mobile/touch, multiplayer/network lockstep and mod/plugin loading are not supported.
10. Data-driven content is trusted code today. Any future external catalog/mod import needs schema validation and text-safe rendering.

## Gate D entry rules

- endpoint identity is `{blockId, portId}`;
- configuration is serializable and versioned;
- compiler output remains backend-neutral;
- no `bodyId` persists in Blueprint;
- port compatibility diagnostics are deterministic and bounded;
- no signal graph or ControlRuntime implementation is smuggled into the schema milestone;
- add performance baselines before optimizing or imposing hard limits.
