# VAW Browser Recovery Scenario — 2026-06-16

## Purpose

This scenario verifies the three repaired regressions in a real Chromium process against both the source application and the freshly generated single-file distribution.

## Command

```bash
python tools/build_release.py
node tests/run_browser_recovery.mjs
```

The runner starts a bounded local server and Chromium under Xvfb, drives the page through Chrome DevTools Protocol, records screenshots and console output, and terminates all child processes in `finally`.

## Environment

- Chromium: `Chrome/144.0.7559.96`
- JavaScript runtime for the runner: Node.js 22
- Physics in the browser: pinned real Cannon.js 0.6.2 from `tests/vendor/cannon-0.6.2/cannon.min.js`
- Source target: current modular `index.html` and application sources
- Distribution target: freshly generated single-file Foundation Phase 1D.4A HTML

The execution container enforces a managed Chromium `URLBlocklist: ["*"]`, including localhost. The runner temporarily removes only that URL blocklist while its isolated Chromium profile is alive and restores the exact original policy contents during cleanup. The post-run policy check confirmed restoration.

The production page normally downloads Three.js 0.128.0 from its pinned CDN. Network access is unavailable in this validation environment, so the runner uses the repository's deterministic Three-compatible browser adapter while retaining the real DOM, event system, application modules, runtime assembly, real Cannon backend, and Chromium execution. This means the screenshots prove the actual UI and lifecycle, while hinge endpoint correctness is verified numerically in Chromium rather than through WebGL pixels.

## Scenario

For both source and distribution, the runner:

1. starts a fresh application;
2. loads a six-block Blueprint v11 craft with two rigid bodies, one hinge, fuel, and a thruster on the articulated sub-body;
3. focuses and changes the hinge-axis `select` to `NY`;
4. focuses the mechanical-link list, selects `mechanical:recovery-arm`, then clicks the canvas;
5. confirms editable focus is released to `BODY`;
6. sends a real `F` key event and enters FLIGHT;
7. confirms exactly two runtime bodies and exactly one runtime hinge visual;
8. sends a real `W` keydown, advances real Cannon physics for 120 fixed steps, and sends keyup;
9. verifies the sub-body thruster received the command and the sub-body moved;
10. verifies both visual endpoints equal the current body-frame pivot transforms;
11. returns to BUILD, confirms cleanup removed the visual, launches again, and confirms exactly one visual with no duplication;
12. confirms zero page console/runtime errors.

## Result

Status: **PASS** for source and distribution.

| Measurement | Source | Distribution |
|---|---:|---:|
| Sub-body thruster body | `body:recovery:arm` | `body:recovery:arm` |
| Manual command | `0.9999976660` | `0.9999976660` |
| Sub-body movement | `0.0506239684` | `0.0506239684` |
| Hinge endpoint B movement | `0.0506471521` | `0.0506471521` |
| Endpoint A error after motion | `0` | `0` |
| Endpoint B error after motion | `0` | `0` |
| Visuals after stop | `0` | `0` |
| Visuals after relaunch | `1` | `1` |
| Console/runtime errors | `0` | `0` |

## Evidence

- `recovery-artifacts/browser/browser-recovery-report.json`
- `recovery-artifacts/browser/browser-console.log` — empty because no page console/runtime errors were emitted
- `recovery-artifacts/browser/source-01-build.png`
- `recovery-artifacts/browser/source-02-flight-subbody-thrust.png`
- `recovery-artifacts/browser/source-03-relaunch-no-duplicates.png`
- `recovery-artifacts/browser/dist-01-build.png`
- `recovery-artifacts/browser/dist-02-flight-subbody-thrust.png`
- `recovery-artifacts/browser/dist-03-relaunch-no-duplicates.png`
