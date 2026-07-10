#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

from build_release import (  # noqa: E402
    APP_SOURCES,
    BOOTSTRAP_AUXILIARY_SOURCES,
    BOOTSTRAP_PATH,
    EMBEDDED_APPLICATION_SOURCES,
    source_manifest,
)


def main() -> None:
    expected_auxiliary = (
        Path('src/game/mobile-device-profile.js'),
        Path('src/game/mobile-runtime-shell.js'),
        Path('src/game/mobile-command-port.js'),
        Path('src/game/mobile-game-command-adapter.js'),
        Path('src/game/mobile-playable-shell.js'),
        Path('src/game/mobile-flight-controls.js'),
        Path('src/game/mobile-touch-controller.js'),
        Path('src/game/mobile-pointer-adapter.js'),
        Path('src/game/mobile-camera-gesture-bridge.js'),
        Path('src/game/mobile-camera-input-runtime.js'),
        Path('src/game/mobile-camera-autobind.js'),
    )
    assert BOOTSTRAP_AUXILIARY_SOURCES == expected_auxiliary
    assert all(path not in APP_SOURCES for path in expected_auxiliary)

    bootstrap_index = EMBEDDED_APPLICATION_SOURCES.index(BOOTSTRAP_PATH)
    auxiliary_start = bootstrap_index - len(expected_auxiliary)
    assert EMBEDDED_APPLICATION_SOURCES[auxiliary_start:bootstrap_index] == expected_auxiliary
    assert EMBEDDED_APPLICATION_SOURCES.count(BOOTSTRAP_PATH) == 1
    assert len(EMBEDDED_APPLICATION_SOURCES) == len(APP_SOURCES) + len(expected_auxiliary)
    camera_controller_path = Path('src/game/camera_controller.js')
    assert EMBEDDED_APPLICATION_SOURCES.index(camera_controller_path) < auxiliary_start

    manifest = source_manifest(ROOT)
    assert manifest['embeddedApplicationSources'] == [path.as_posix() for path in EMBEDDED_APPLICATION_SOURCES]
    for path in expected_auxiliary:
        assert path.as_posix() in manifest['files']

    bootstrap = (ROOT / BOOTSTRAP_PATH).read_text(encoding='utf-8')
    for path in expected_auxiliary:
        module_stem = path.stem
        assert path.as_posix() in bootstrap, f'{path} missing from adaptive bootstrap source list'
        assert module_stem in bootstrap
    assert "window.VAW.define('runtime.mobile-context'" in bootstrap
    assert 'subscribe: listener =>' in bootstrap
    assert "window.VAW.require('game.mobile-playable-shell')" in bootstrap
    assert 'mobilePlayableShell.start()' in bootstrap
    assert 'tapEnabled: () => Boolean(mobilePlayableShell?.tapEnabled?.())' in bootstrap
    assert 'onTap: sample => mobilePlayableShell?.handleCanvasTap?.(sample)' in bootstrap
    assert "window.VAW.require('game.mobile-camera-autobind')" in bootstrap
    assert 'mobileCameraBinder.start()' in bootstrap

    verifier = (ROOT / 'tools/verify_release.py').read_text(encoding='utf-8')
    assert 'build_release.EMBEDDED_APPLICATION_SOURCES' in verifier
    assert "manifest.get('embeddedApplicationSources')" in verifier
    assert "Embedded application source inventory mismatch." in verifier

    release_test = (ROOT / 'tests/test_release_build.py').read_text(encoding='utf-8')
    assert 'module.EMBEDDED_APPLICATION_SOURCES' in release_test

    print('OK mobile release wiring')


if __name__ == '__main__':
    main()
