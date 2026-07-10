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
    )
    assert BOOTSTRAP_AUXILIARY_SOURCES == expected_auxiliary
    assert all(path not in APP_SOURCES for path in expected_auxiliary)

    bootstrap_index = EMBEDDED_APPLICATION_SOURCES.index(BOOTSTRAP_PATH)
    assert EMBEDDED_APPLICATION_SOURCES[bootstrap_index - 2:bootstrap_index] == expected_auxiliary
    assert EMBEDDED_APPLICATION_SOURCES.count(BOOTSTRAP_PATH) == 1
    assert len(EMBEDDED_APPLICATION_SOURCES) == len(APP_SOURCES) + len(expected_auxiliary)

    manifest = source_manifest(ROOT)
    assert manifest['embeddedApplicationSources'] == [path.as_posix() for path in EMBEDDED_APPLICATION_SOURCES]
    for path in expected_auxiliary:
        assert path.as_posix() in manifest['files']

    bootstrap = (ROOT / BOOTSTRAP_PATH).read_text(encoding='utf-8')
    assert "tryEnsureBrowserModule('game.mobile-device-profile'" in bootstrap
    assert "tryEnsureBrowserModule('game.mobile-runtime-shell'" in bootstrap
    assert "window.VAW.define('runtime.mobile-context'" in bootstrap

    print('OK mobile release wiring')


if __name__ == '__main__':
    main()
