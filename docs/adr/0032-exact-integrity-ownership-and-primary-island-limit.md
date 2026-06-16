# ADR 0032 — Exact integrity ownership and former primary-island limit

Status: Superseded in part by Foundation Phase 1D.4A ADR 0035 and ADR 0039.

Exact part/collider/body ownership remains mandatory. Phase 1D.3E temporarily restricted detach to the primary island; Phase 1D.4A generalizes integrity to explicit rigid islands and compiled rigid neighbors. A narrower safety limit remains: parts cannot detach while their body still has active constraints, and connected-body recenter is blocked until atomic constraint rebasing is available.
