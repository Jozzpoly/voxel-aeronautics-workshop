#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = (ROOT / 'src/game/mobile-command-port.js').read_text(encoding='utf-8')
SHELL = (ROOT / 'src/game/mobile-playable-shell.js').read_text(encoding='utf-8')
BOOTSTRAP = (ROOT / 'src/foundation/bootstrap.js').read_text(encoding='utf-8')
GAME = (ROOT / 'src/game.js').read_text(encoding='utf-8')


def main() -> None:
    assert "root.VAW.define('game.mobile-command-port'" in PORT
    assert "root.VAW.define('game.mobile-playable-shell', ['game.mobile-command-port']" in SHELL

    for token in ('document.', 'querySelector', 'localStorage', 'CraftModel', 'performBuildAction', 'setMode(', 'setControlAction'):
        assert token not in PORT, f'command port must remain transport-only; found {token!r}'

    forbidden_shell_tokens = (
        'build-panel',
        'parts-hotbar',
        'workspace-toolbar',
        'workspace-layout-actions',
        'data-workspace-panel',
        'CraftModel',
        'CRAFT.',
        'performBuildAction',
        'setMode(',
        'setControlAction',
        'CANNON',
        'THREE',
    )
    for token in forbidden_shell_tokens:
        assert token not in SHELL, f'playable shell must not depend on desktop workspace/gameplay authority; found {token!r}'

    required_shell_tokens = (
        'html[data-vaw-playable-mobile="active"] #ui-layer { display: none !important; }',
        'env(safe-area-inset-top)',
        'env(safe-area-inset-bottom)',
        "commandPort.build.placeAtScreen(x, y)",
        "commandPort.build.removeAtScreen(x, y)",
        "commandPort.session.launch()",
        "commandPort.session.returnToWorkshop()",
        'tapEnabled()',
        'handleCanvasTap(sample = {})',
    )
    for token in required_shell_tokens:
        assert token in SHELL, f'playable shell contract missing {token!r}'

    assert "['game.mobile-playable-shell', 'src/game/mobile-playable-shell.js']" in BOOTSTRAP
    assert 'tapEnabled: () => Boolean(mobilePlayableShell?.tapEnabled?.())' in BOOTSTRAP
    assert 'onTap: sample => mobilePlayableShell?.handleCanvasTap?.(sample)' in BOOTSTRAP

    composition_start = GAME.index('MobileCommandPort.register({')
    composition_end = GAME.index("renderer.domElement.addEventListener('pointerenter'", composition_start)
    composition = GAME[composition_start:composition_end]
    assert 'performBuildAction(0)' in composition
    assert 'performBuildAction(2)' in composition
    assert '.click(' not in composition
    assert 'dispatchEvent(' not in composition

    print('OK mobile playable architecture')


if __name__ == '__main__':
    main()
