# Workbench Layout Guide

## Controls

Top bar buttons:

- `Left files/import`: collapse or show the left panel.
- `Right inspector`: collapse or show the right panel.
- `Bottom log`: collapse or show the bottom log.
- `Reset layout`: restore default panel sizes.

Drag handles:

- vertical handle between left panel and viewport: resize left panel;
- vertical handle between viewport and right panel: resize right panel;
- horizontal handle above the log: resize bottom log.

## Persistence

Layout state is saved in browser `localStorage` under:

```text
vaw.importStudio.workbenchLayout.v1
```

Stored values:

- left panel width;
- right panel width;
- bottom log height;
- collapsed state of left, right, and bottom panels.

## Viewport resizing

After any layout resize/collapse/reset, the workbench calls the viewer resize path so the WebGL canvas can refill the available viewport.

## Limits

This is not a full Blender-style docking system. It is a stable splitter-based workbench shell designed to make the tool usable without risking viewer regressions.
