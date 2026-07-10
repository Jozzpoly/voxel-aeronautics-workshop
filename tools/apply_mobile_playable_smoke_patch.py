#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SMOKE = ROOT / 'tests' / 'run_mobile_browser_smoke.mjs'
MARKER = "setStage('playable-build-loop');"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    return source.replace(old, new, 1)


def main() -> None:
    source = SMOKE.read_text(encoding='utf-8')
    if MARKER in source:
        print('Playable mobile browser smoke is already installed.')
        return

    helper_anchor = """function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 4, radiusY: 4, force: 1 };
}

async function mobileState(cdp) {
"""
    helpers = """function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 4, radiusY: 4, force: 1 };
}

async function shellButtonPoint(cdp, label) {
  return await evaluate(cdp, `(() => {
    const root = document.getElementById('vaw-mobile-playable-shell');
    const button = [...(root?.querySelectorAll?.('button') || [])]
      .find(candidate => candidate.textContent.trim() === ${JSON.stringify(label)} && getComputedStyle(candidate).display !== 'none' && !candidate.disabled);
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    return document.elementFromPoint(x, y) === button ? { x, y } : null;
  })()`);
}

async function touchShellButton(cdp, label, pointerId) {
  const point = await shellButtonPoint(cdp, label);
  assert(point, `Mobile shell button ${label} is missing or not hit-testable.`);
  await dispatchTouch(cdp, 'touchStart', [touchPoint(point.x, point.y, pointerId)]);
  await dispatchTouch(cdp, 'touchEnd', []);
  await evaluate(cdp, 'true');
  return point;
}

async function canvasTapCandidates(cdp) {
  return await evaluate(cdp, `(() => {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return [];
    const rect = canvas.getBoundingClientRect();
    const points = [];
    for (let y = rect.top + 110; y < rect.bottom - 210; y += 32) {
      for (let x = rect.left + 36; x < rect.right - 36; x += 32) {
        if (document.elementFromPoint(x, y) === canvas) points.push({ x: Math.round(x), y: Math.round(y) });
      }
    }
    return points;
  })()`);
}

async function touchCanvasTap(cdp, point, pointerId) {
  await dispatchTouch(cdp, 'touchStart', [touchPoint(point.x, point.y, pointerId)]);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'TAP_CANDIDATE'`, 'canvas tap candidate', 3000);
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'IDLE'`, 'canvas tap release', 3000);
  return await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
}

async function findCraftChangingTap(cdp, points, startingSize, direction, pointerIdStart) {
  let pointerId = pointerIdStart;
  for (const point of points) {
    const snapshot = await touchCanvasTap(cdp, point, pointerId++);
    const changed = direction === 'increase'
      ? snapshot.craftSize > startingSize
      : snapshot.craftSize < startingSize;
    if (changed) return { point, snapshot, nextPointerId: pointerId };
  }
  return null;
}

async function mobileState(cdp) {
"""
    source = replace_once(source, helper_anchor, helpers, 'touch helper insertion')

    state_anchor = """    const camera = window.VAW?.require?.('game.camera-controller')?.current?.();
    const canvas = document.querySelector('#canvas-container canvas');
    const blocker = document.getElementById('desktop-required');
    return {
"""
    state_replacement = """    const camera = window.VAW?.require?.('game.camera-controller')?.current?.();
    const commandPort = window.VAW?.require?.('game.mobile-command-port');
    const playableShell = context?.playableShell?.();
    const canvas = document.querySelector('#canvas-container canvas');
    const blocker = document.getElementById('desktop-required');
    const playableRoot = document.getElementById('vaw-mobile-playable-shell');
    const uiLayer = document.getElementById('ui-layer');
    return {
"""
    source = replace_once(source, state_anchor, state_replacement, 'mobile state dependencies')

    state_fields_anchor = """      touchAction: canvas?.style?.touchAction || '',
      camera: camera?.snapshot?.() || null,
      gesture: runtime?.snapshot?.() || null,
      trace: window.__VAW_MOBILE_SMOKE_TRACE__ || []
"""
    state_fields = """      touchAction: canvas?.style?.touchAction || '',
      camera: camera?.snapshot?.() || null,
      gesture: runtime?.snapshot?.() || null,
      commandRegistered: Boolean(commandPort?.current?.()),
      playable: playableShell?.snapshot?.() || null,
      playableRootVisible: Boolean(playableRoot && !playableRoot.hidden && getComputedStyle(playableRoot).display !== 'none'),
      desktopUiDisplay: uiLayer ? getComputedStyle(uiLayer).display : null,
      partButtonCount: playableRoot?.querySelectorAll?.('[data-part-id]')?.length || 0,
      trace: window.__VAW_MOBILE_SMOKE_TRACE__ || []
"""
    source = replace_once(source, state_fields_anchor, state_fields, 'mobile state playable fields')

    initial_anchor = """  assert(initial.touchAction === 'none', `Canvas touch-action was not scoped for gestures: ${JSON.stringify(initial)}`);
  assert(initial.camera && initial.gesture?.mode === 'IDLE', `Initial camera/gesture diagnostics are invalid: ${JSON.stringify(initial)}`);

  const plan = await findGesturePlan(cdp);
"""
    playable_block = """  assert(initial.touchAction === 'none', `Canvas touch-action was not scoped for gestures: ${JSON.stringify(initial)}`);
  assert(initial.camera && initial.gesture?.mode === 'IDLE', `Initial camera/gesture diagnostics are invalid: ${JSON.stringify(initial)}`);
  await waitFor(cdp, `(() => {
    const context = window.VAW.require('runtime.mobile-context');
    const shell = context.playableShell?.();
    const port = window.VAW.require('game.mobile-command-port');
    return shell?.snapshot?.().ready && port.current?.() ? true : false;
  })()`, 'mobile playable shell and command port');

  setStage('playable-build-loop');
  let pointerId = 20;
  const playableInitial = await mobileState(cdp);
  assert(playableInitial.commandRegistered, `Mobile command port is not registered: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.playable?.active && playableInitial.playable?.ready, `Playable shell is not active: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.playableRootVisible, `Playable shell root is not visible: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.desktopUiDisplay === 'none', `Desktop workspace was not replaced by the dedicated mobile shell: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.partButtonCount >= 2, `Part carousel is incomplete: ${JSON.stringify(playableInitial)}`);

  await touchShellButton(cdp, 'Wing', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().selectedPart === 'Wing'`, 'Wing selection through mobile carousel');
  const canvasPoints = await canvasTapCandidates(cdp);
  assert(canvasPoints.length > 0, 'No hit-testable canvas points are available between the mobile bars.');
  const wingStart = await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
  const wingPlacement = await findCraftChangingTap(cdp, canvasPoints, wingStart.craftSize, 'increase', pointerId);
  assert(wingPlacement, `No real canvas tap placed the selected Wing from ${canvasPoints.length} candidates.`);
  pointerId = wingPlacement.nextPointerId;
  assert(wingPlacement.snapshot.selectedPart === 'Wing', `Placed part selection changed unexpectedly: ${JSON.stringify(wingPlacement)}`);

  await touchShellButton(cdp, 'REMOVE', pointerId++);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().snapshot().interactionMode === 'remove'`, 'explicit remove mode');
  const removalPoints = [
    wingPlacement.point,
    { x: wingPlacement.point.x - 10, y: wingPlacement.point.y },
    { x: wingPlacement.point.x + 10, y: wingPlacement.point.y },
    { x: wingPlacement.point.x, y: wingPlacement.point.y - 10 },
    { x: wingPlacement.point.x, y: wingPlacement.point.y + 10 }
  ];
  const removal = await findCraftChangingTap(cdp, removalPoints, wingPlacement.snapshot.craftSize, 'decrease', pointerId);
  assert(removal, `Explicit REMOVE mode did not remove the touch-placed Wing: ${JSON.stringify({ wingPlacement, removalPoints })}`);
  pointerId = removal.nextPointerId;

  await touchShellButton(cdp, 'PLACE', pointerId++);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().snapshot().interactionMode === 'place'`, 'explicit place mode');
  await touchShellButton(cdp, 'Core', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().selectedPart === 'Core'`, 'Core selection through mobile carousel');
  const coreStart = await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
  const corePlacement = await findCraftChangingTap(cdp, canvasPoints, coreStart.craftSize, 'increase', pointerId);
  assert(corePlacement, 'No real canvas tap placed the Core required for launch.');
  pointerId = corePlacement.nextPointerId;

  await touchShellButton(cdp, 'LAUNCH', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().mode === 'FLIGHT'`, 'mobile launch command');
  const flightShell = await mobileState(cdp);
  assert(flightShell.playable?.session?.mode === 'FLIGHT', `Playable shell did not enter FLIGHT: ${JSON.stringify(flightShell)}`);
  assert(!window.VAW, 'unreachable');
"""
    # Replace the deliberate unreachable marker below immediately to keep JS template generation simple.
    playable_block = playable_block.replace("  assert(!window.VAW, 'unreachable');\n", """  assert(!flightShell.playable?.interactionMode || flightShell.playable.session.mode === 'FLIGHT', `Invalid flight shell state: ${JSON.stringify(flightShell)}`);
  await touchShellButton(cdp, 'RETURN TO WORKSHOP', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().mode === 'BUILD'`, 'return to workshop command');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().tapEnabled() === true`, 'build tap reactivation after return');

  const plan = await findGesturePlan(cdp);
""")
    source = replace_once(source, initial_anchor, playable_block, 'playable build loop')

    result_anchor = """    touchAction: finalDiagnostics.touchAction,
    consoleErrors: pageErrors.length
"""
    result_fields = """    touchAction: finalDiagnostics.touchAction,
    playable: {
      selectedWing: true,
      placedWing: wingPlacement.snapshot.craftSize,
      removedWing: removal.snapshot.craftSize,
      launchedCore: corePlacement.snapshot.craftSize,
      returnedToWorkshop: finalDiagnostics.playable?.session?.mode === 'BUILD'
    },
    consoleErrors: pageErrors.length
"""
    source = replace_once(source, result_anchor, result_fields, 'playable result fields')

    SMOKE.write_text(source, encoding='utf-8', newline='\n')
    print('Extended mobile browser smoke with the playable build loop.')


if __name__ == '__main__':
    main()
