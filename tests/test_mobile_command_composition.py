#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / 'src/game.js').read_text(encoding='utf-8')
PORT = (ROOT / 'src/game/mobile-command-port.js').read_text(encoding='utf-8')
BOOTSTRAP = (ROOT / 'src/foundation/bootstrap.js').read_text(encoding='utf-8')
BUILD_RELEASE = (ROOT / 'tools/build_release.py').read_text(encoding='utf-8')


def main() -> None:
    require_token = "const MobileCommandPort = window.VAW.require('game.mobile-command-port');"
    register_token = 'MobileCommandPort.register({'
    assert GAME.count(require_token) == 1
    assert GAME.count(register_token) == 1
    assert GAME.index(require_token) < GAME.index(register_token)

    start = GAME.index(register_token)
    end = GAME.index("renderer.domElement.addEventListener('pointerenter'", start)
    composition = GAME[start:end]

    required_delegations = (
        'setSelectedTool(normalized)',
        'rayToNDC(clientX, clientY)',
        'performBuildAction(0)',
        'performBuildAction(2)',
        'applyBuildRotation(',
        'setOrientationByVector(AXES[index])',
        'undoBlueprint()',
        'redoBlueprint()',
        "setMode('FLIGHT')",
        "setMode('BUILD')",
        'setControlAction(normalized, Boolean(active))',
        'clearControlActions()',
    )
    for token in required_delegations:
        assert token in composition, f'mobile command composition missing {token!r}'

    forbidden = (
        '.click(',
        'dispatchEvent(',
        'MouseEvent(',
        'KeyboardEvent(',
        'CRAFT.set(',
        'CRAFT.delete(',
        'world.addBody(',
    )
    for token in forbidden:
        assert token not in composition, f'mobile command composition must not bypass gameplay authority with {token!r}'

    assert "root.VAW.define('game.mobile-command-port'" in PORT
    assert 'document.' not in PORT
    assert 'querySelector' not in PORT
    assert 'localStorage' not in PORT

    source_path = "src/game/mobile-command-port.js"
    assert source_path in BOOTSTRAP
    assert source_path in BUILD_RELEASE

    print('OK mobile command composition')


if __name__ == '__main__':
    main()
