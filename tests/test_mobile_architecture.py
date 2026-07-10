#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PURE_INPUT_FILES = (
    Path('src/game/mobile-touch-controller.js'),
    Path('src/game/mobile-camera-gesture-bridge.js'),
)
MOBILE_INPUT_FILES = (
    *PURE_INPUT_FILES,
    Path('src/game/mobile-pointer-adapter.js'),
    Path('src/game/mobile-camera-input-runtime.js'),
    Path('src/game/mobile-camera-autobind.js'),
)


def text(relative: Path) -> str:
    return (ROOT / relative).read_text(encoding='utf-8')


def assert_absent(relative: Path, forbidden: tuple[str, ...]) -> None:
    source = text(relative)
    for token in forbidden:
        assert token not in source, f'{relative} violates mobile architecture boundary with {token!r}'


def main() -> None:
    gameplay_forbidden = (
        'CraftModel',
        'Blueprint',
        'CANNON',
        'performBuildAction',
        'raycastBuildTarget',
        'addBlock(',
        'removeBlock(',
        'STATE.',
        'STATE[',
    )
    for relative in MOBILE_INPUT_FILES:
        assert_absent(relative, gameplay_forbidden)

    pure_forbidden = (
        'THREE',
        'window.document',
        'document.getElementById',
        'document.querySelector',
        'HTMLElement',
        'setPointerCapture',
        'addEventListener',
    )
    for relative in PURE_INPUT_FILES:
        assert_absent(relative, pure_forbidden)

    runtime = text(Path('src/game/mobile-camera-input-runtime.js'))
    assert 'options.state' not in runtime

    autobind = text(Path('src/game/mobile-camera-autobind.js'))
    assert 'cameraController: controller' in autobind
    assert "const tapEnabled = typeof options.tapEnabled === 'function' ? options.tapEnabled : () => false;" in autobind
    assert "const onTap = typeof options.onTap === 'function' ? options.onTap : () => {};" in autobind
    assert 'tapEnabled,' in autobind
    assert 'onTap,' in autobind

    camera_controller = text(Path('src/game/camera_controller.js'))
    for method in ('orbitCameraByPixels', 'zoomCameraByPixels', 'onCreated', 'current'):
        assert re.search(rf'\b{re.escape(method)}\b', camera_controller), f'camera controller missing {method}'

    game = text(Path('src/game.js'))
    assert game.count("event.pointerType === 'touch'") >= 3, 'desktop handlers must keep rejecting touch so the validated mobile pointer runtime remains the sole touch owner'

    bootstrap = text(Path('src/foundation/bootstrap.js'))
    assert "window.VAW.require('game.mobile-camera-autobind')" in bootstrap
    assert 'tapEnabled: () => Boolean(mobilePlayableShell?.tapEnabled?.())' in bootstrap
    assert 'onTap: sample => mobilePlayableShell?.handleCanvasTap?.(sample)' in bootstrap
    assert 'mobileCameraBinder.start()' in bootstrap
    assert 'performBuildAction' not in bootstrap

    print('OK mobile architecture boundaries')


if __name__ == '__main__':
    main()
