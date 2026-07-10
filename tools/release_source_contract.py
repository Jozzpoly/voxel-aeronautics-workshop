#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Iterable

RUNTIME_SOURCE_DIRS = (
    Path('src/foundation'),
    Path('src/runtime'),
    Path('src/game'),
)
ENTRYPOINT = Path('src/game.js')
CRITICAL_ORDER = (
    (Path('src/game/storage_capability.js'), Path('src/game/visual-renderer-profiles.js')),
    (Path('src/game/visual-renderer-profiles.js'), Path('src/game/scene_environment.js')),
    (Path('src/game/visual-renderer-profiles.js'), Path('src/game/visual-parity-diagnostic.js')),
    (Path('src/game/visual-renderer-profiles.js'), ENTRYPOINT),
)


def normalized_paths(paths: Iterable[Path]) -> tuple[Path, ...]:
    return tuple(Path(path) for path in paths)


def duplicate_paths(paths: Iterable[Path]) -> tuple[Path, ...]:
    seen: set[Path] = set()
    duplicates: list[Path] = []
    for path in paths:
        if path in seen and path not in duplicates:
            duplicates.append(path)
        seen.add(path)
    return tuple(duplicates)


def discover_runtime_sources(root: Path) -> tuple[Path, ...]:
    discovered: set[Path] = {ENTRYPOINT}
    for relative_dir in RUNTIME_SOURCE_DIRS:
        directory = root / relative_dir
        discovered.update(path.relative_to(root) for path in directory.glob('*.js') if path.is_file())
    return tuple(sorted(discovered, key=lambda item: item.as_posix()))


def validate_application_source_contract(
    root: Path,
    app_sources: Iterable[Path],
    auxiliary_sources: Iterable[Path],
    embedded_sources: Iterable[Path],
    bootstrap_path: Path,
) -> dict[str, int | str]:
    root = Path(root)
    app = normalized_paths(app_sources)
    auxiliary = normalized_paths(auxiliary_sources)
    embedded = normalized_paths(embedded_sources)
    bootstrap = Path(bootstrap_path)

    for label, paths in [('APP_SOURCES', app), ('BOOTSTRAP_AUXILIARY_SOURCES', auxiliary), ('EMBEDDED_APPLICATION_SOURCES', embedded)]:
        duplicates = duplicate_paths(paths)
        if duplicates:
            raise ValueError(f'{label} contains duplicates: {[path.as_posix() for path in duplicates]}')
        for relative in paths:
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError(f'{label} contains unsafe path: {relative}')
            if not (root / relative).is_file():
                raise ValueError(f'{label} references missing source: {relative.as_posix()}')

    overlap = set(app) & set(auxiliary)
    if overlap:
        raise ValueError(f'Application and auxiliary inventories overlap: {[path.as_posix() for path in sorted(overlap)]}')

    discovered = set(discover_runtime_sources(root))
    expected_app = discovered - set(auxiliary)
    actual_app = set(app)
    if actual_app != expected_app:
        missing = sorted(expected_app - actual_app, key=lambda item: item.as_posix())
        unexpected = sorted(actual_app - expected_app, key=lambda item: item.as_posix())
        raise ValueError(
            'Application source inventory is incomplete or misclassified: '
            f'missing={[path.as_posix() for path in missing]} '
            f'unexpected={[path.as_posix() for path in unexpected]}'
        )

    discovered_mobile = {path for path in discovered if path.parent == Path('src/game') and path.name.startswith('mobile-')}
    if set(auxiliary) != discovered_mobile:
        missing = sorted(discovered_mobile - set(auxiliary), key=lambda item: item.as_posix())
        unexpected = sorted(set(auxiliary) - discovered_mobile, key=lambda item: item.as_posix())
        raise ValueError(
            'Mobile auxiliary inventory mismatch: '
            f'missing={[path.as_posix() for path in missing]} '
            f'unexpected={[path.as_posix() for path in unexpected]}'
        )

    if bootstrap not in app:
        raise ValueError(f'Bootstrap source is absent from APP_SOURCES: {bootstrap.as_posix()}')
    bootstrap_index = app.index(bootstrap)
    expected_embedded = (*app[:bootstrap_index], *auxiliary, *app[bootstrap_index:])
    if embedded != expected_embedded:
        raise ValueError('Embedded application inventory does not place the auxiliary modules immediately before bootstrap.')
    if not app or app[-1] != ENTRYPOINT:
        raise ValueError(f'{ENTRYPOINT.as_posix()} must remain the final application source.')

    positions = {path: index for index, path in enumerate(embedded)}
    for earlier, later in CRITICAL_ORDER:
        if earlier not in positions or later not in positions:
            raise ValueError(f'Critical release source is missing: {earlier.as_posix()} -> {later.as_posix()}')
        if positions[earlier] >= positions[later]:
            raise ValueError(f'Critical release source order is invalid: {earlier.as_posix()} must precede {later.as_posix()}')

    return {
        'runtimeSources': len(discovered),
        'applicationSources': len(app),
        'auxiliarySources': len(auxiliary),
        'embeddedSources': len(embedded),
        'status': 'ok',
    }
