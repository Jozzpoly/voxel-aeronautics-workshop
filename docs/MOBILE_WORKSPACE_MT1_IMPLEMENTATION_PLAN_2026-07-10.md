# MT1 Mobile Workspace Presentation — Test-First Implementation Plan

Branch: `mobile/touch-foundation`  
Base checkpoint: validated mobile camera foundation at `a3e1d7b0b49f2dd55598a10ff4a7c0d363422085`  
Gate: MT1  
Status: implementation planned, no gameplay mutation

## Objective

Present the existing Workbench on phone-sized touch screens without shrinking the desktop layout, forking workspace authority or modifying craft/gameplay state.

MT1 is a presentation adapter over the existing panel DOM. It must preserve the desktop Workbench state and remain independent from Blueprint, CraftModel, compiler, runtime assembly, physics and touch build actions.

## Audit findings

1. The current toolbar buttons are substantially below the 44 CSS px minimum touch target.
2. The desktop workspace supports multiple simultaneously positioned, docked and floating panels. Reflowing those positions into a phone viewport would create overlapping controls and unstable canvas exposure.
3. The parts hotbar already has the correct horizontal-list semantics and should become an independent bottom tray rather than a large sheet.
4. `workspace_controller.js` owns persisted desktop panel state. Mobile presentation must not call its open/close methods or write `state.uiWorkspace`.
5. The existing desktop-only media query is superseded at runtime by the validated mobile shell; MT1 must key every rule to `html[data-vaw-presentation="mobile"]` rather than viewport width alone.
6. BUILD and FLIGHT have different panel availability. Mobile presentation must never expose BUILD-only panels while the UI reports FLIGHT.
7. The camera checkpoint requires an unobscured canvas interaction region. MT1 acceptance must verify a real hit-testable canvas area after the toolbar, sheet and parts tray are laid out.

## Presentation model

### Persistent top toolbar

- Safe-area-aware fixed toolbar.
- Horizontal overflow instead of compressed labels.
- Every tab is at least 44 CSS px high and wide.
- Toolbar selection controls only mobile presentation state.
- Mobile tab clicks are intercepted in capture phase so existing desktop handlers do not mutate persisted Workbench state.

### One large mobile sheet

Large sheets:

- `build`
- `contracts`
- `telemetry`
- `mission`
- `controls`

At most one large sheet is active.

- Portrait: bottom sheet above the parts tray.
- Landscape: right-side sheet with bounded width, preserving a left canvas thumb/gesture zone.
- Active mobile presentation uses explicit data attributes and CSS; desktop positioning data is not rewritten.
- A second tap on the active tab closes the large sheet and exposes more canvas.

### Independent parts tray

- `parts` is not counted as a large sheet.
- BUILD default: tray open.
- FLIGHT: tray unavailable and hidden.
- Horizontal scrolling with stable item widths.
- Safe-area-aware bottom padding.

### Secondary workspace actions

`#workspace-layout-actions` remains reachable as a horizontally scrollable secondary strip. It is not permanently hidden. On phone presentation it appears below the primary toolbar and uses 44 px touch targets.

## Mode policy

The controller reads the presentation mode from `#ui-mode` text:

- `BUILD`: `build`, `contracts`, `telemetry`, `mission`, `controls`, `parts` available.
- `FLIGHT`: `telemetry`, `mission`, `controls` available.

Defaults:

- BUILD large sheet: `build`.
- BUILD parts tray: open.
- FLIGHT large sheet: `telemetry`.
- FLIGHT parts tray: closed.

A MutationObserver watches `#ui-mode`. When mode changes:

- unavailable mobile selections are removed;
- a valid default is selected;
- mobile presentation is reapplied;
- no desktop workspace state is persisted or overwritten.

## Controller contract

New module: `game.mobile-workspace-controller`.

Constructor dependencies:

- `document`
- `window`
- `mobileContext.currentProfile()`
- optional `mobileContext.subscribe()`
- optional `MutationObserver`
- optional diagnostics callbacks

Public API:

- `bind()`
- `destroy()`
- `refresh()`
- `setActivePanel(name)`
- `setPartsOpen(value)`
- `snapshot()`
- `active()`

Snapshot fields:

- `active`
- `mode`
- `activePanel`
- `partsOpen`
- `availablePanels`
- `bound`

Snapshots and arrays are immutable.

## DOM ownership contract

While active, the controller may write presentation-only attributes/classes:

- `#ui-layer[data-vaw-mobile-workspace="active"]`
- panel `data-vaw-mobile-sheet`
- panel `data-vaw-mobile-active`
- parts `data-vaw-mobile-tray`
- parts `data-vaw-mobile-open`
- toolbar button `data-vaw-mobile-selected`
- mobile `aria-expanded` values
- `inert` on inactive large panels when supported

On deactivation or destroy it removes its attributes/classes and restores captured accessibility values. It does not write panel coordinates, dimensions, dock state, `hidden`, Blueprint data or `state.uiWorkspace`.

## Event policy

- Capture listener is attached only to `#workspace-toolbar`.
- When mobile presentation is inactive, events pass through untouched.
- When active, recognized panel tabs call `preventDefault`, `stopPropagation` and `stopImmediatePropagation`.
- Unknown controls are not consumed.
- Parts toggles independently.
- Large panel tabs enforce one active sheet.
- Unavailable tabs are consumed but do not activate a panel.

## CSS contract

Every mobile workspace rule is scoped by:

`html[data-vaw-presentation="mobile"]`

Required properties:

- viewport uses `--vaw-viewport-height` with `100dvh` fallback;
- all four safe-area insets are respected;
- no document-level horizontal scrolling;
- toolbar/actions use horizontal scrolling;
- primary controls minimum 44 CSS px;
- large inactive sheets are not displayed;
- portrait sheet remains above tray;
- landscape sheet remains on the right and does not fill the entire width;
- parts tray remains horizontally scrollable;
- canvas retains a hit-testable region.

## Test-first matrix

### Unit tests

1. Desktop profile does not activate or consume toolbar clicks.
2. Mobile activation selects BUILD/default build sheet and opens parts.
3. Selecting telemetry closes build and activates only telemetry.
4. Selecting the active large panel closes it.
5. Parts toggles independently from the large sheet.
6. FLIGHT mode removes build/contracts/parts and defaults to telemetry.
7. Returning to BUILD restores valid BUILD defaults without mutating desktop panel `hidden` values.
8. Unavailable panel click is consumed but ignored.
9. Profile change to desktop removes presentation attributes and restores accessibility values.
10. Destroy removes listeners, observers and presentation state.
11. Snapshot is immutable.
12. Repeated bind/destroy is deterministic.

### Static CSS tests

- required mobile scope;
- dynamic viewport variable;
- safe-area usage;
- 44 px touch targets;
- portrait bottom-sheet selector;
- landscape side-sheet media query;
- horizontal toolbar and parts overflow;
- inactive-sheet hiding;
- no global `touch-action: none`.

### Browser smoke

At `390 × 844`:

- document scroll width does not exceed viewport width;
- toolbar targets are at least 44 px;
- no more than one large sheet is visible;
- parts tray is visible and horizontally scrollable in BUILD;
- telemetry tab produces telemetry-only sheet;
- second telemetry tap closes the sheet;
- parts toggle does not reopen a large sheet;
- a real canvas point remains hit-testable;
- camera orbit still passes after workspace interactions.

At `844 × 390`:

- active sheet is right-aligned with bounded width;
- left canvas interaction zone remains hit-testable;
- parts tray remains below the camera zone;
- no page overflow.

## Implementation order

1. Add unit tests for `game.mobile-workspace-controller`.
2. Implement the controller without CSS or bootstrap wiring.
3. Add architecture boundary tests.
4. Add scoped MT1 CSS and static CSS tests.
5. Add module to bootstrap auxiliary source order.
6. Instantiate controller from bootstrap and expose it through `runtime.mobile-context`.
7. Add portrait/landscape browser smoke.
8. Regenerate Tailwind CSS only if the official generator reports changed candidates.
9. Regenerate `SOURCE_MANIFEST.json` exclusively through `build_release.py`.
10. Run full suite, release verification, desktop smoke, camera mobile smoke, workspace mobile smoke and `git diff --check` on one head.

## Explicit non-goals

- Touch placement/removal.
- Virtual flight controls.
- Native mobile packaging.
- Rewriting desktop Workbench persistence.
- Removing advanced controls.
- Changing Blueprint or gameplay schemas.
