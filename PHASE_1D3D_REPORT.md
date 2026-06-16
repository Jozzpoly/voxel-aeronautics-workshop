# Phase 1D.3D Report — Assembly-Centric Flight Lifecycle

> **Dokument historyczny.** Phase 1D.3D była częściową migracją i nie zamknęła Gate A. Aktualny stan po pełnej konwergencji opisują `PHASE_1D3E_REPORT.md`, `ARCHITECTURE.md` i `FOUNDATION_CONVERGENCE_REVIEW.md`. Poniższe deklaracje należy czytać jako opis seamów z baseline'u, nie jako aktualny kontrakt produkcyjny.


This phase moves flight runtime ownership toward RuntimeAssembly as the source of truth. The launched craft now records `STATE.flight.assembly`, `assemblyRuntime`, `bodyById`, `bodies`, and an explicit `primaryBody`. The legacy `STATE.flight.body` is retained only as a compatibility alias for current single-body gameplay and camera/HUD paths.

## Implemented seams

- Added `game.flight-session` as the lifecycle seam for building, registering, selecting primary body, ownership checks, and cleanup of a runtime assembly.
- Added `game.flight-integrity` as the integrity seam for body/collider ownership lookup by part and block id.
- Updated flight state to expose `primaryBody` and `assembly` explicitly.
- Replaced many direct single-body reads with `primaryFlightBody()` and body ownership lookups.
- Updated source manifest, loader order, architecture tests, version and release id for Phase 1D.3D.

## Intentional limitations

- The current CraftCompiler still emits one rigid island. Multi-body runtime remains exercised by AssemblyBuilder/joint harnesses, not player blueprints.
- Gameplay detach remains effectively root-island gameplay. The new integrity seam makes this limitation explicit and prepares the migration path.
- Visuals still use a root group for the current craft, but body ownership is now represented in state and ready for per-body visual ownership.

## Next gate

The next safe gate remains Rigid Island Compiler plus per-body visual transform ownership. Do not add signal graph, cables, block programming, multiplayer, or player-authored joints before rigid islands are first-class in compilation.
