from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_release import APP_SOURCES  # noqa: E402

SOURCE_PATHS = tuple(ROOT / relative for relative in APP_SOURCES)
FOUNDATION_PATHS = tuple(path for path in SOURCE_PATHS if path.parent.name == 'foundation')
RUNTIME_PATHS = tuple(path for path in SOURCE_PATHS if path.parent.name == 'runtime')
GAME_PATHS = tuple(path for path in SOURCE_PATHS if path == ROOT / 'src/game.js' or path.parent == ROOT / 'src/game')


def read(paths: tuple[Path, ...]) -> str:
    return '\n'.join(path.read_text(encoding='utf-8') for path in paths)


FOUNDATION = read(FOUNDATION_PATHS)
RUNTIME = read(RUNTIME_PATHS)
GAME = read(GAME_PATHS)
ALL_JS = read(SOURCE_PATHS)


def function_source(name: str) -> str:
    marker = f'function {name}('
    matches = []
    for path in GAME_PATHS:
        source = path.read_text(encoding='utf-8')
        if marker in source:
            matches.append((path, source))
    if len(matches) != 1:
        raise AssertionError(f'expected exactly one game function {name}, found {[str(path) for path, _ in matches]}')
    _, source = matches[0]
    start = source.index(marker)
    brace = source.index('{', start)
    depth = 0
    quote = None
    escaped = False
    template_depth = 0
    for index in range(brace, len(source)):
        character = source[index]
        if quote:
            if escaped:
                escaped = False
            elif character == '\\':
                escaped = True
            elif character == quote and template_depth == 0:
                quote = None
            elif quote == '`' and character == '$' and index + 1 < len(source) and source[index + 1] == '{':
                template_depth += 1
            elif quote == '`' and character == '}' and template_depth:
                template_depth -= 1
            continue
        if character in "'\"`":
            quote = character
        elif character == '{':
            depth += 1
        elif character == '}':
            depth -= 1
            if depth == 0:
                return source[start:index + 1]
    raise AssertionError(f'unclosed function {name}')
