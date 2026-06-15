# ADR 0009 — Passive thrust does not cap pilot authority

- Status: accepted
- Milestone: Foundation Phase 1C.1 Hotfix

## Context

The Phase 1C mixer treated the thruster slider as both passive vertical thrust and a hard ceiling for all directional commands. This made direct pilot input weaker at low slider values and allowed a sign error to make downward-facing engines appear active until Left Ctrl was pressed.

## Decision

The slider controls only passive thrust for engines pointing toward craft-local `+Y`.

- Horizontal and downward-facing engines have zero passive command.
- Matching pilot translation or rotational commands may raise an engine to 100% independently of the slider.
- Opposing input reduces an existing passive command toward zero.
- The semantic `lift-` command activates downward-facing engines and suppresses upward passive thrust; its current keyboard binding is Shift under ADR 0018.

## Consequences

- Passive hover power and pilot authority are separate concepts.
- A slider value of 0% does not disable W/S, Space/Shift, yaw, pitch or roll thruster mixing.
- Future programmable controllers must receive the same separation between trim/passive values and actuator authority.


## Binding update

ADR 0018 moved vertical descent from Ctrl to Shift; the passive-authority decision itself is unchanged.
