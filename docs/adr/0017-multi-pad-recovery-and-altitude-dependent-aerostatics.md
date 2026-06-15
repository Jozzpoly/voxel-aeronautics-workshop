# ADR 0017 — Recovery zones and aerostatic lift are explicit domain rules

## Status

Accepted; keyboard input clause superseded by ADR 0018 in Foundation Phase 1D.2C.

## Context

The first flight contract visually marked both the launch pad and the remote test pad, but its completion rule silently accepted only the launch pad. A player could land correctly on the prominent green pad and remain stuck in `RECOVERY` while the HUD still reported a long distance to the launch pad.

Balloon power was also treated as a constant force independent of altitude. The slider exposed only the selected percentage, gave no indication of neutral hover power, refreshed its number through an indirect telemetry path, and had no keyboard control.

## Decision

1. Every contract declares an explicit `landingZones` list.
2. The mission evaluator can assess several authorized zones and returns either the settled zone or the nearest zone for guidance.
3. `Hover License` accepts the launch and remote pads because it is a basic recovery exercise. Route and courier contracts keep the remote pad; Heavy-Lift keeps the launch pad.
4. Aerostatic lift uses one pure policy shared by physics and UI:

```text
liftEfficiency(altitude) = max(minimumEfficiency, exp(-altitude / scaleHeight))
actualLift = seaLevelLift × power × liftEfficiency
```

5. The balloon control displays the calculated static neutral-power marker at the current altitude. It includes healthy balloon capacity, current mass and passive upward thruster lift, but deliberately excludes dynamic wing lift and direct pilot input.
6. Slider state, numeric readout and saved preference are synchronized by one setter.
7. Balloon power has keyboard adjustment during flight. The original Page Up/Page Down binding was replaced by Comma/Period in ADR 0018.

## Consequences

- The screenshot case on the remote test pad can complete the first contract after the normal stable dwell.
- Contract destinations are data, not assumptions hidden in mission code.
- A fixed balloon command has a finite equilibrium altitude instead of producing unchanged lift at every height.
- The neutral marker is guidance, not an autopilot: damage, motion, changing mass and passive thrust can move the required value.
- Future gas cells, weather and pressure models must extend `foundation.aerostatics` rather than duplicating lift math in the UI or physics loop.
