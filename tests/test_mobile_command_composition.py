#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / 'src/game.js').read_text(encoding='utf-8')
PORT = (ROOT / 'src/game/mobile-command-port.js').read_text(encoding='utf-8')
ADAPTER = (ROOT / 'src/game/mobile-game-command-adapter.js').read_text(encoding='utf-8')
BOOTSTRAP = (ROOT / 'src/foundation/bootstrap.js').read_text(encoding='utf-8')
BUILD_RELEASE = (ROOT / 'tools/build_release.py').read_text(encoding='utf-8')


def main() -> None:
    port_require = "const MobileCommandPort = window.VAW.require('game.mobile-command-port');"
    adapter_require = "const MobileGameCommandAdapter = window.VAW.require('game.mobile-game-command-adapter');"
    register_token = 'MobileCommandPort.register(MobileGameCommandAdapter.create({'
    assert GAME.count(port_require) == 1
    assert GAME.count(adapter_require) == 1
    assert GAME.count(register_token) == 1
    assert GAME.index(port_require) < GAME.index(register_token)
    assert GAME.index(adapter_require) < GAME.index(register_token)

    start = GAME.index(register_token)
    end = GAME.index("renderer.domElement.addEventListener('pointerenter'", start)
    composition = GAME[start:end]
    required_dependencies = (
        'blocks: BLOCKS',
        'axes: AXES',
        'state: STATE',
        'craft: CRAFT',
        'selectPart: setSelectedTool',
        'targetScreen: rayToNDC',
        'buildAction: performBuildAction',
        'rotate: applyBuildRotation',
        'setOrientation: setOrientationByVector',
        'undo: undoBlueprint',
        'redo: redoBlueprint',
        'collectBlueprint',
        'blueprintSignature',
        'setMode',
        'clearControlActions',
        'bindableActions: InputProfile.BINDABLE_ACTIONS',
        'setControlAction',
    )
    for token in required_dependencies:
        assert token in composition, f'mobile command composition missing dependency {token!r}'

    adapter_delegations = (
        'selectPart(normalized)',
        'targetScreen(point.clientX, point.clientY)',
        'buildAction(0)',
        'buildAction(2)',
        'rotate(Number(direction) < 0 ? -1 : 1)',
        'setOrientation(axes[index])',
        'runHistory(undo)',
        'runHistory(redo)',
        "setMode('FLIGHT')",
        "setMode('BUILD')",
        'setControlAction(normalized, Boolean(active))',
        'clearControlActions()',
    )
    for token in adapter_delegations:
        assert token in ADAPTER, f'mobile game command adapter missing delegation {token!r}'

    forbidden = (
        '.click(',
        'dispatchEvent(',
        'MouseEvent(',
        'KeyboardEvent(',
        'craft.set(',
        'craft.delete(',
        'world.addBody(',
        'document.',
        'querySelector',
    )
    for token in forbidden:
        assert token not in ADAPTER, f'mobile game command adapter must not bypass gameplay authority with {token!r}'

    assert "root.VAW.define('game.mobile-command-port'" in PORT
    assert "root.VAW.define('game.mobile-game-command-adapter'" in ADAPTER
    assert 'document.' not in PORT
    assert 'querySelector' not in PORT
    assert 'localStorage' not in PORT

    for source_path in ('src/game/mobile-command-port.js', 'src/game/mobile-game-command-adapter.js'):
        assert source_path in BOOTSTRAP
        assert source_path in BUILD_RELEASE

    print('OK mobile command composition')


if __name__ == '__main__':
    main()
