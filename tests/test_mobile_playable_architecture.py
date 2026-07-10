#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = (ROOT / 'src/game/mobile-command-port.js').read_text(encoding='utf-8')
ADAPTER = (ROOT / 'src/game/mobile-game-command-adapter.js').read_text(encoding='utf-8')
SHELL = (ROOT / 'src/game/mobile-playable-shell.js').read_text(encoding='utf-8')
FLIGHT = (ROOT / 'src/game/mobile-flight-controls.js').read_text(encoding='utf-8')
BOOTSTRAP = (ROOT / 'src/foundation/bootstrap.js').read_text(encoding='utf-8')
GAME = (ROOT / 'src/game.js').read_text(encoding='utf-8')
SMOKE = (ROOT / 'tests/run_mobile_browser_smoke.mjs').read_text(encoding='utf-8')


def main() -> None:
    assert "root.VAW.define('game.mobile-command-port'" in PORT
    assert "root.VAW.define('game.mobile-game-command-adapter'" in ADAPTER
    assert "root.VAW.define('game.mobile-playable-shell', ['game.mobile-command-port']" in SHELL
    assert "root.VAW.define('game.mobile-flight-controls', ['game.mobile-command-port']" in FLIGHT

    for token in ('document.', 'querySelector', 'localStorage', 'CraftModel', 'performBuildAction', 'setMode(', 'setControlAction'):
        assert token not in PORT, f'command port must remain transport-only; found {token!r}'

    for token in ('document.', 'querySelector', 'localStorage', '.click(', 'dispatchEvent(', 'MouseEvent(', 'KeyboardEvent(', 'craft.set(', 'craft.delete('):
        assert token not in ADAPTER, f'game command adapter must delegate without DOM or direct craft mutation; found {token!r}'

    forbidden_shell_tokens = (
        'build-panel', 'parts-hotbar', 'workspace-toolbar', 'workspace-layout-actions', 'data-workspace-panel',
        'CraftModel', 'CRAFT.', 'performBuildAction', 'setMode(', 'setControlAction', 'CANNON', 'THREE',
    )
    for token in forbidden_shell_tokens:
        assert token not in SHELL, f'playable shell must not depend on desktop workspace/gameplay authority; found {token!r}'

    required_shell_tokens = (
        'html[data-vaw-playable-mobile="active"] #ui-layer { display: none !important; }',
        'env(safe-area-inset-top)', 'env(safe-area-inset-bottom)',
        "commandPort.build.placeAtScreen(x, y)", "commandPort.build.removeAtScreen(x, y)",
        "commandPort.session.launch()", "commandPort.session.returnToWorkshop()",
        'tapEnabled()', 'handleCanvasTap(sample = {})',
    )
    for token in required_shell_tokens:
        assert token in SHELL, f'playable shell contract missing {token!r}'

    forbidden_flight_tokens = (
        'build-panel', 'parts-hotbar', 'workspace-toolbar', 'CraftModel', 'CRAFT.', 'performBuildAction',
        'setMode(', 'setControlAction', 'CANNON', 'THREE', 'localStorage', '.click(', 'dispatchEvent(',
    )
    for token in forbidden_flight_tokens:
        assert token not in FLIGHT, f'flight controls must remain command-port and pointer-lifecycle only; found {token!r}'

    required_flight_tokens = (
        "commandPort.flight.setAction(action, activeValue)",
        "commandPort.flight.clearActions()",
        "commandPort.subscribeActivity(handleActivity)",
        "windowLike.addEventListener('blur', handleBlur)",
        "documentLike.addEventListener('visibilitychange', handleVisibility)",
        "element.addEventListener('lostpointercapture'",
        "const DEADZONE = 0.28",
        "left: Object.freeze({ xNegative: 'sway-', xPositive: 'sway+', yNegative: 'surge+', yPositive: 'surge-' })",
        "right: Object.freeze({ xNegative: 'yaw+', xPositive: 'yaw-', yNegative: 'pitch+', yPositive: 'pitch-' })",
        "Object.freeze({ action: 'heave+', label: 'LIFT +' })",
        "Object.freeze({ action: 'roll+', label: 'ROLL R' })",
    )
    for token in required_flight_tokens:
        assert token in FLIGHT, f'flight controls contract missing {token!r}'

    assert "['game.mobile-game-command-adapter', 'src/game/mobile-game-command-adapter.js']" in BOOTSTRAP
    assert "['game.mobile-playable-shell', 'src/game/mobile-playable-shell.js']" in BOOTSTRAP
    assert "['game.mobile-flight-controls', 'src/game/mobile-flight-controls.js']" in BOOTSTRAP
    assert 'flightControls: () => mobileFlightControls' in BOOTSTRAP
    assert 'mobileFlightControls.start()' in BOOTSTRAP
    assert 'tapEnabled: () => Boolean(mobilePlayableShell?.tapEnabled?.())' in BOOTSTRAP
    assert 'onTap: sample => mobilePlayableShell?.handleCanvasTap?.(sample)' in BOOTSTRAP

    register_token = 'MobileCommandPort.register(MobileGameCommandAdapter.create({'
    composition_start = GAME.index(register_token)
    composition_end = GAME.index("renderer.domElement.addEventListener('pointerenter'", composition_start)
    composition = GAME[composition_start:composition_end]
    assert 'buildAction: performBuildAction' in composition
    assert 'setMode' in composition
    assert 'setControlAction' in composition
    assert '.click(' not in composition
    assert 'dispatchEvent(' not in composition
    assert len(GAME.splitlines()) <= 2420, f'game.js composition root regrew to {len(GAME.splitlines())} lines'

    assert "button.scrollIntoView({ block: 'nearest', inline: 'center' });" in SMOKE
    assert "await dispatchTouch(cdp, 'touchStart'" in SMOKE
    assert "await dispatchTouch(cdp, 'touchEnd', [])" in SMOKE
    assert "window.VAW.require('game.mobile-command-port').session.snapshot()" in SMOKE
    assert "candidate.textContent.trim() === ${JSON.stringify(label)}" in SMOKE

    print('OK mobile playable architecture')


if __name__ == '__main__':
    main()
