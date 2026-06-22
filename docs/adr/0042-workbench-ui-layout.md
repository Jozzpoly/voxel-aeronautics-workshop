# ADR 0042 - Workbench UI layout foundation

Status: Accepted

## Context

Gate C is the stable gameplay base, but the current workspace uses one floating-panel preference model. That is not enough for the next product direction: beginner players need a useful default, advanced players need a movable workbench, and flight HUD preferences must not fight build-mode panel placement.

UI preferences are personal runtime state. They must remain outside Blueprint saves and must not affect craft determinism.

## Decision

`foundation.ui-workspace` moves to workspace version 4. It keeps the existing panel migration path and adds:

- panel placements: `floating`, `dock-left`, `dock-right`, `dock-bottom`;
- horizontal dock span modes: `compact` and `full`, with the bottom full-span dock reserving space from side panels;
- side dock stacking by saved vertical position, so several panels can share the left or right edge;
- separate `build` and `flight` layout states;
- a beginner default layout;
- reset and preset application;
- a dockable `parts` panel for the bottom hotbar, with full-span as the beginner default and compact as the user-adjusted option.
- a dockable `mission` panel for flight information; it replaces the fixed top mission HUD and defaults to the right dock above telemetry.

The top edge is intentionally not a dock target. It already carries the global game controls, so older `dock-top` preferences are migrated to the bottom dock instead of creating another competing top bar. Side docks start from the top edge and use saved vertical positions for stacking. Panel toggles and layout actions live in one compact bottom launcher above the hotbar, keeping the upper screen reserved for flight/build actions.

Existing build, contracts, telemetry and controls panels remain migrated workbench modules. Contracts remain a supporting module; they must not automatically become the main layer when returning to the workshop or entering flight. The first implementation is a shell foundation, not the final visual redesign.

## Consequences

The game shell applies workspace state through `game.workspace-controller`. Blueprint, CraftModel, CraftCompiler, physics and mission contracts do not read or store UI layout data.

Future UI work can add richer panel modules, saved presets and deeper customization without changing craft saves.
