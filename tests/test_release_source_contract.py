#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import build_release  # noqa: E402
from release_source_contract import discover_runtime_sources, validate_application_source_contract  # noqa: E402

result = validate_application_source_contract(
    ROOT,
    build_release.APP_SOURCES,
    build_release.BOOTSTRAP_AUXILIARY_SOURCES,
    build_release.EMBEDDED_APPLICATION_SOURCES,
    build_release.BOOTSTRAP_PATH,
)
assert result['status'] == 'ok'
assert result['runtimeSources'] == len(discover_runtime_sources(ROOT))

renderer = Path('src/game/visual-renderer-profiles.js')
mutated_app = tuple(path for path in build_release.APP_SOURCES if path != renderer)
bootstrap_index = mutated_app.index(build_release.BOOTSTRAP_PATH)
mutated_embedded = (
    *mutated_app[:bootstrap_index],
    *build_release.BOOTSTRAP_AUXILIARY_SOURCES,
    *mutated_app[bootstrap_index:],
)
try:
    validate_application_source_contract(
        ROOT,
        mutated_app,
        build_release.BOOTSTRAP_AUXILIARY_SOURCES,
        mutated_embedded,
        build_release.BOOTSTRAP_PATH,
    )
except ValueError as error:
    assert renderer.as_posix() in str(error), error
else:
    raise AssertionError('Source contract did not reject a builder inventory with renderer profiles removed.')

mutated_auxiliary = tuple(path for path in build_release.BOOTSTRAP_AUXILIARY_SOURCES if path.name != 'mobile-flight-controls.js')
try:
    validate_application_source_contract(
        ROOT,
        build_release.APP_SOURCES,
        mutated_auxiliary,
        build_release.EMBEDDED_APPLICATION_SOURCES,
        build_release.BOOTSTRAP_PATH,
    )
except ValueError as error:
    assert 'mobile-flight-controls.js' in str(error), error
else:
    raise AssertionError('Source contract did not reject an incomplete mobile auxiliary inventory.')

print({'releaseSourceContract': 'ok', **result, 'mutationChecks': 2})
