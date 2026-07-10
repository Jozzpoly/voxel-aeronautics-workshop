#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SMOKE = ROOT / 'tests' / 'run_mobile_browser_smoke.mjs'
MARKER = "setStage('playable-flight-controls');"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    return source.replace(old, new, 1)


def main() -> None:
    source = SMOKE.read_text(encoding='utf-8')
    if MARKER in source:
        print('Native mobile flight-control smoke is already present.')
        return

    helper_anchor = """async function canvasTapCandidates(cdp) {
"""
    helper_block = """async function flightControlGeometry(cdp, attribute, value) {
  return await evaluate(cdp, `(() => {
    const root = document.getElementById('vaw-mobile-flight-input');
    const selector = '[' + ${JSON.stringify(attribute)} + '=' + JSON.stringify(${JSON.stringify(value)}) + ']';
    const element = root?.querySelector?.(selector);
    if (!element || root.hidden || getComputedStyle(element).display === 'none') return null;
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== element && !element.contains(hit))) return null;
    return {
      x, y,
      left: rect.left, top: rect.top,
      width: rect.width, height: rect.height,
      radius: Math.min(rect.width, rect.height) / 2
    };
  })()`);
}

async function canvasTapCandidates(cdp) {
"""
    source = replace_once(source, helper_anchor, helper_block, 'flight control geometry helper')

    dependency_anchor = """    const commandPort = window.VAW?.require?.('game.mobile-command-port');
    const playableShell = context?.playableShell?.();
    const canvas = document.querySelector('#canvas-container canvas');
"""
    dependency_replacement = """    const commandPort = window.VAW?.require?.('game.mobile-command-port');
    const playableShell = context?.playableShell?.();
    const flightControls = context?.flightControls?.();
    const canvas = document.querySelector('#canvas-container canvas');
"""
    source = replace_once(source, dependency_anchor, dependency_replacement, 'flight diagnostics dependency')

    root_anchor = """    const playableRoot = document.getElementById('vaw-mobile-playable-shell');
    const uiLayer = document.getElementById('ui-layer');
"""
    root_replacement = """    const playableRoot = document.getElementById('vaw-mobile-playable-shell');
    const flightRoot = document.getElementById('vaw-mobile-flight-input');
    const uiLayer = document.getElementById('ui-layer');
"""
    source = replace_once(source, root_anchor, root_replacement, 'flight diagnostics root')

    fields_anchor = """      playableRootVisible: Boolean(playableRoot && !playableRoot.hidden && getComputedStyle(playableRoot).display !== 'none'),
      desktopUiDisplay: uiLayer ? getComputedStyle(uiLayer).display : null,
"""
    fields_replacement = """      playableRootVisible: Boolean(playableRoot && !playableRoot.hidden && getComputedStyle(playableRoot).display !== 'none'),
      flightControls: flightControls?.snapshot?.() || null,
      flightRootVisible: Boolean(flightRoot && !flightRoot.hidden && getComputedStyle(flightRoot).display !== 'none'),
      desktopUiDisplay: uiLayer ? getComputedStyle(uiLayer).display : null,
"""
    source = replace_once(source, fields_anchor, fields_replacement, 'flight diagnostics fields')

    flight_anchor = """  const flightShell = await mobileState(cdp);
  assert(flightShell.playable?.session?.mode === 'FLIGHT', `Playable shell did not enter FLIGHT: ${JSON.stringify(flightShell)}`);
  assert(!flightShell.playable?.interactionMode || flightShell.playable.session.mode === 'FLIGHT', `Invalid flight shell state: ${JSON.stringify(flightShell)}`);
  await touchShellButton(cdp, 'RETURN TO WORKSHOP', pointerId++);
"""
    flight_block = """  const flightShell = await mobileState(cdp);
  assert(flightShell.playable?.session?.mode === 'FLIGHT', `Playable shell did not enter FLIGHT: ${JSON.stringify(flightShell)}`);
  assert(!flightShell.playable?.interactionMode || flightShell.playable.session.mode === 'FLIGHT', `Invalid flight shell state: ${JSON.stringify(flightShell)}`);

  setStage('playable-flight-controls');
  await waitFor(cdp, `(() => {
    const controls = window.VAW.require('runtime.mobile-context').flightControls?.();
    const root = document.getElementById('vaw-mobile-flight-input');
    return controls?.snapshot?.().active && root && !root.hidden ? true : false;
  })()`, 'mobile flight controls activation');

  const leftStick = await flightControlGeometry(cdp, 'data-control', 'left-stick');
  const rightStick = await flightControlGeometry(cdp, 'data-control', 'right-stick');
  assert(leftStick && rightStick, `Flight sticks are not visible and hit-testable: ${JSON.stringify({ leftStick, rightStick })}`);
  const leftId = pointerId++;
  const rightId = pointerId++;
  const leftStart = touchPoint(leftStick.x, leftStick.y, leftId);
  const rightStart = touchPoint(rightStick.x, rightStick.y, rightId);
  await dispatchTouch(cdp, 'touchStart', [leftStart, rightStart]);
  await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.leftPointerId !== null && snapshot.rightPointerId !== null ? snapshot : null;
  })()`, 'dual flight-stick pointer ownership');

  const leftDelta = leftStick.radius * 0.72;
  const rightDelta = rightStick.radius * 0.72;
  await dispatchTouch(cdp, 'touchMove', [
    touchPoint(leftStick.x + leftDelta, leftStick.y - leftDelta, leftId),
    touchPoint(rightStick.x - rightDelta, rightStick.y - rightDelta, rightId)
  ]);
  const flightAxisEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    const expected = ['surge+', 'sway+', 'pitch+', 'yaw+'];
    return expected.every(action => snapshot.activeActions.includes(action)) ? snapshot : null;
  })()`, 'dual-stick named flight actions');
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'dual-stick neutral release');

  const liftButton = await flightControlGeometry(cdp, 'data-action', 'heave+');
  const rollButton = await flightControlGeometry(cdp, 'data-action', 'roll-');
  assert(liftButton && rollButton, `Lift/roll controls are not visible and hit-testable: ${JSON.stringify({ liftButton, rollButton })}`);
  const liftId = pointerId++;
  const rollId = pointerId++;
  await dispatchTouch(cdp, 'touchStart', [
    touchPoint(liftButton.x, liftButton.y, liftId),
    touchPoint(rollButton.x, rollButton.y, rollId)
  ]);
  const flightHoldEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.includes('heave+') && snapshot.activeActions.includes('roll-') ? snapshot : null;
  })()`, 'simultaneous lift and roll actions');
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'lift/roll neutral release');

  await touchShellButton(cdp, 'RETURN TO WORKSHOP', pointerId++);
"""
    source = replace_once(source, flight_anchor, flight_block, 'native flight control loop')

    return_anchor = """  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().tapEnabled() === true`, 'build tap reactivation after return');

  const plan = await findGesturePlan(cdp);
"""
    return_replacement = """  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().tapEnabled() === true`, 'build tap reactivation after return');
  await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return !snapshot.active && snapshot.activeActions.length === 0 ? true : false;
  })()`, 'flight controls deactivation after workshop return');

  const plan = await findGesturePlan(cdp);
"""
    source = replace_once(source, return_anchor, return_replacement, 'flight controls return neutralization')

    result_anchor = """    playable: {
      selectedWing: true,
      placedWing: wingPlacement.snapshot.craftSize,
      removedWing: removal.snapshot.craftSize,
      launchedCore: corePlacement.snapshot.craftSize,
      returnedToWorkshop: finalDiagnostics.playable?.session?.mode === 'BUILD'
    },
    consoleErrors: pageErrors.length
"""
    result_replacement = """    playable: {
      selectedWing: true,
      placedWing: wingPlacement.snapshot.craftSize,
      removedWing: removal.snapshot.craftSize,
      launchedCore: corePlacement.snapshot.craftSize,
      returnedToWorkshop: finalDiagnostics.playable?.session?.mode === 'BUILD'
    },
    flightControls: {
      dualStickActions: flightAxisEvidence.activeActions,
      holdActions: flightHoldEvidence.activeActions,
      neutralAfterRelease: finalDiagnostics.flightControls?.activeActions?.length === 0,
      inactiveAfterReturn: finalDiagnostics.flightControls?.active === false
    },
    consoleErrors: pageErrors.length
"""
    source = replace_once(source, result_anchor, result_replacement, 'flight evidence result')

    SMOKE.write_text(source, encoding='utf-8', newline='\n')
    print('Extended mobile browser smoke with native dual-stick and hold flight controls.')


if __name__ == '__main__':
    main()
