#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD_RELEASE = ROOT / 'tools/build_release.py'
RELEASE_TEST = ROOT / 'tests/test_mobile_release_wiring.py'
RUN_ALL = ROOT / 'tests/run_all.py'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    return source.replace(old, new, 1)


def patch_file(path: Path, old: str, new: str, marker: str, label: str) -> None:
    source = path.read_text(encoding='utf-8')
    if marker not in source:
        source = replace_once(source, old, new, label)
        path.write_text(source, encoding='utf-8', newline='\n')


def main() -> None:
    patch_file(
        BUILD_RELEASE,
        """    Path('src/game/mobile-playable-shell.js'),
    Path('src/game/mobile-touch-controller.js'),
""",
        """    Path('src/game/mobile-playable-shell.js'),
    Path('src/game/mobile-flight-controls.js'),
    Path('src/game/mobile-touch-controller.js'),
""",
        "Path('src/game/mobile-flight-controls.js'),",
        'release flight controls source',
    )
    patch_file(
        RELEASE_TEST,
        """        Path('src/game/mobile-playable-shell.js'),
        Path('src/game/mobile-touch-controller.js'),
""",
        """        Path('src/game/mobile-playable-shell.js'),
        Path('src/game/mobile-flight-controls.js'),
        Path('src/game/mobile-touch-controller.js'),
""",
        "Path('src/game/mobile-flight-controls.js'),",
        'release test flight controls source',
    )
    patch_file(
        RUN_ALL,
        """    run('node', 'tests/test_mobile_game_command_adapter.js')
    run('node', 'tests/test_mobile_playable_shell.js')
""",
        """    run('node', 'tests/test_mobile_game_command_adapter.js')
    run('node', 'tests/test_mobile_playable_shell.js')
    run('node', 'tests/test_mobile_flight_controls.js')
""",
        "tests/test_mobile_flight_controls.js",
        'core runner flight controls test',
    )
    print('Applied mobile flight controls release and core-test wiring.')


if __name__ == '__main__':
    main()
