#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'src/game.js'
BUILD_RELEASE = ROOT / 'tools/build_release.py'
RELEASE_TEST = ROOT / 'tests/test_mobile_release_wiring.py'
RUN_ALL = ROOT / 'tests/run_all.py'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    return source.replace(old, new, 1)


def patch_game() -> None:
    source = GAME.read_text(encoding='utf-8')
    require_anchor = "    const MobileCommandPort = window.VAW.require('game.mobile-command-port');\n"
    adapter_require = "    const MobileGameCommandAdapter = window.VAW.require('game.mobile-game-command-adapter');\n"
    if adapter_require not in source:
        source = replace_once(source, require_anchor, require_anchor + adapter_require, 'game adapter require')

    start_token = '    MobileCommandPort.register({'
    end_token = "\n\n    renderer.domElement.addEventListener('pointerenter'"
    if start_token not in source:
        if 'MobileCommandPort.register(MobileGameCommandAdapter.create({' not in source:
            raise RuntimeError('game command registration anchor is missing.')
    else:
        start = source.index(start_token)
        end = source.index(end_token, start)
        replacement = """    MobileCommandPort.register(MobileGameCommandAdapter.create({
      blocks: BLOCKS, axes: AXES, state: STATE, craft: CRAFT,
      selectPart: setSelectedTool, targetScreen: rayToNDC, buildAction: performBuildAction, rotate: applyBuildRotation,
      setOrientation: setOrientationByVector, undo: undoBlueprint, redo: redoBlueprint,
      collectBlueprint, blueprintSignature, setMode, clearControlActions,
      bindableActions: InputProfile.BINDABLE_ACTIONS, setControlAction
    }));"""
        source = source[:start] + replacement + source[end:]

    line_count = len(source.splitlines())
    if line_count > 2420:
        raise RuntimeError(f'game.js remains above architecture budget: {line_count} lines.')
    GAME.write_text(source, encoding='utf-8', newline='\n')
    print(f'game.js compact mobile composition: {line_count} lines')


def patch_inventory() -> None:
    old = """    Path('src/game/mobile-command-port.js'),
    Path('src/game/mobile-playable-shell.js'),
"""
    new = """    Path('src/game/mobile-command-port.js'),
    Path('src/game/mobile-game-command-adapter.js'),
    Path('src/game/mobile-playable-shell.js'),
"""
    source = BUILD_RELEASE.read_text(encoding='utf-8')
    if "Path('src/game/mobile-game-command-adapter.js')," not in source:
        source = replace_once(source, old, new, 'release adapter source')
    BUILD_RELEASE.write_text(source, encoding='utf-8', newline='\n')

    source = RELEASE_TEST.read_text(encoding='utf-8')
    if "Path('src/game/mobile-game-command-adapter.js')," not in source:
        source = replace_once(source, old, new, 'release test adapter source')
    RELEASE_TEST.write_text(source, encoding='utf-8', newline='\n')


def patch_runner() -> None:
    source = RUN_ALL.read_text(encoding='utf-8')
    old = """    run('node', 'tests/test_mobile_command_port.js')
    run('node', 'tests/test_mobile_playable_shell.js')
"""
    new = """    run('node', 'tests/test_mobile_command_port.js')
    run('node', 'tests/test_mobile_game_command_adapter.js')
    run('node', 'tests/test_mobile_playable_shell.js')
"""
    if "tests/test_mobile_game_command_adapter.js" not in source:
        source = replace_once(source, old, new, 'core runner adapter test')
    RUN_ALL.write_text(source, encoding='utf-8', newline='\n')


def main() -> None:
    patch_game()
    patch_inventory()
    patch_runner()
    print('Applied extracted mobile command adapter composition and inventory updates.')


if __name__ == '__main__':
    main()
