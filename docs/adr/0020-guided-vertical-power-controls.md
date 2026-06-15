# ADR 0020 — Guided Vertical Power Controls

- Status: Accepted
- Phase: Foundation 1D.2E

## Context

Balloon power exposed a hover marker and altitude guidance, while Passive vertical thrust exposed only a percentage. The hardcoded `−/+` handling also bypassed the rebindable input profile introduced in ADR 0019. This created two user interfaces and two input paths for closely related vertical support systems.

## Decision

1. Input profile v3 includes `thrusterPower-`, `thrusterPower+`, `balloonPower-` and `balloonPower+`.
2. Default passive-thrust adjustment uses physical codes `Minus` and `Equal`; default balloon adjustment uses `Comma` and `Period`.
3. Both controls are rebindable and their displayed shortcut labels come from the active profile.
4. `setThrusterPower()` and `setBalloonPower()` are the only runtime mutation paths for their respective states.
5. A shared vertical support sample contains weight, altitude, available balloon lift and maximum passive upward thruster lift.
6. `requiredSupplementalPowerForHover()` computes the required fraction of an additional lift source after subtracting a baseline source.
7. Passive-thrust guidance uses current altitude-dependent balloon lift as baseline and upward passive thrusters as the supplemental source.
8. Guidance is a static engineering estimate; it must not claim to include transient wing lift, pilot commands or atmospheric disturbances.
9. ADR 0009 remains authoritative: passive power never caps direct pilot authority.

## Consequences

- Both vertical controls have consistent feedback and input ownership.
- Legacy profiles receive new defaults only when those physical codes are not already claimed.
- Damage, detach, mass and altitude can move the displayed threshold.
- The next physics extraction can consume the same pure aerostatic helper without depending on DOM.
