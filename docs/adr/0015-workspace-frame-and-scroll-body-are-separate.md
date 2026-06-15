# ADR 0015 — Workspace frame and scroll body are separate

## Status

Accepted in Foundation Phase 1D.2 UI recovery.

## Context

The same element handled fixed positioning, native resize and content scrolling. The Build panel could become inaccessible, especially after saved geometry or viewport changes.

## Decision

Each primary panel contains:

- an outer `.workspace-panel` frame responsible for position, size and clipping;
- a fixed `.workspace-panel-handle`;
- one focusable `.workspace-panel-scroll` responsible for vertical scrolling.

`UIWorkspace.fitPanelRect()` clamps the complete frame to the viewport. Workspace schema v2 resets geometry from v1 while preserving visibility preferences.

## Consequences

- Headers and close/minimize actions remain reachable.
- Wheel, touch, touchpad and keyboard scrolling have one explicit target.
- Saved off-screen geometry cannot permanently block the interface.
- Docking and tabs can later build on a stable frame/body contract.
