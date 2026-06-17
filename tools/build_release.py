#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
RELEASE_ID = 'foundation-1d4a-rigid-islands-mechanical-graph'
APP_VERSION = '0.7.0-foundation.1d4a'
SINGLE_NAME = 'Voxel_Aeronautics_Workshop_Foundation_Phase_1D4A_Mechanical_Platform_Convergence.html'
ZIP_NAME = 'Voxel_Aeronautics_Workshop_Foundation_Phase_1D4A_Mechanical_Platform_Convergence.zip'
MANIFEST_NAME = 'SOURCE_MANIFEST.json'
ARCHIVE_ROOT = 'Voxel_Aeronautics_Workshop_Phase_1D4A_MECHANICAL_PLATFORM_CONVERGENCE_READY_TO_PUSH'
IGNORED_ARCHIVE_PARTS = {
    'dist',
    'release',
    '.agent-validation',
    '__pycache__',
    '.pytest_cache',
    '.git',
    'node_modules',
}

APP_SOURCES = (
    Path('src/foundation/kernel.js'),
    Path('src/foundation/config.js'),
    Path('src/foundation/catalog.js'),
    Path('src/foundation/orientation.js'),
    Path('src/foundation/blueprint.js'),
    Path('src/foundation/diagnostics.js'),
    Path('src/foundation/transform_math.js'),
    Path('src/foundation/craft_model.js'),
    Path('src/foundation/craft_history.js'),
    Path('src/foundation/control_frame.js'),
    Path('src/foundation/mass_properties.js'),
    Path('src/foundation/structural_graph_compiler.js'),
    Path('src/foundation/mechanical_authoring_resolver.js'),
    Path('src/foundation/rigid_island_compiler.js'),
    Path('src/foundation/mechanical_graph_compiler.js'),
    Path('src/foundation/craft_compiler.js'),
    Path('src/foundation/runtime_assembly.js'),
    Path('src/foundation/input_profile.js'),
    Path('src/foundation/ui_workspace.js'),
    Path('src/foundation/mission_evaluator.js'),
    Path('src/foundation/aerostatics.js'),
    Path('src/foundation/flight_control.js'),
    Path('src/foundation/state.js'),
    Path('src/runtime/physics_port.js'),
    Path('src/runtime/cannon_physics_backend.js'),
    Path('src/runtime/headless_physics_backend.js'),
    Path('src/runtime/assembly_builder.js'),
    Path('src/game/scene_environment.js'),
    Path('src/game/career_service.js'),
    Path('src/game/workspace_controller.js'),
    Path('src/game/input_settings_controller.js'),
    Path('src/game/orientation_service.js'),
    Path('src/game/module_visual_factory.js'),
    Path('src/game/engineering_analysis.js'),
    Path('src/game/blueprint_controller.js'),
    Path('src/game/mission_controller.js'),
    Path('src/game/flight_session.js'),
    Path('src/game/flight_thruster_router.js'),
    Path('src/game/flight_mechanical_visuals.js'),
    Path('src/game/flight_integrity.js'),
    Path('src/game/debris_runtime.js'),
    Path('src/foundation/bootstrap.js'),
    Path('src/game.js'),
)
MANIFEST_INPUTS = (
    Path('index.html'),
    Path('styles.css'),
    Path('package.json'),
    Path('tools/build_release.py'),
    Path('tools/verify_release.py'),
    *APP_SOURCES,
)

CANONICAL_TEXT_SUFFIXES = {
    '.bat',
    '.cfg',
    '.conf',
    '.config',
    '.css',
    '.csv',
    '.html',
    '.ini',
    '.js',
    '.cjs',
    '.json',
    '.jsx',
    '.lock',
    '.md',
    '.mjs',
    '.properties',
    '.ps1',
    '.py',
    '.sh',
    '.svg',
    '.toml',
    '.ts',
    '.tsx',
    '.txt',
    '.webmanifest',
    '.xml',
    '.yaml',
    '.yml',
}
CANONICAL_TEXT_FILENAMES = {
    '.editorconfig',
    '.gitattributes',
    '.gitignore',
    '.gitkeep',
    'LICENSE',
    'NOTICE',
}
EXECUTABLE_ARCHIVE_PATHS = {
    Path('run_game.sh'),
    Path('tests/run_browser_recovery.mjs'),
    Path('tools/validate_fast.py'),
    Path('tools/validate_full.py'),
    Path('tools/validation_runner.py'),
}
SOURCE_BYTE_CONTRACT = {
    'text': 'utf-8-lf',
    'binary': 'byte-exact',
    'archive': 'deterministic-stored-zip-v1',
}
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
LOADER_BEGIN = '  <!-- BEGIN APP LOADER -->'
LOADER_END = '  <!-- END APP LOADER -->'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path: Path) -> str:
    """Hash exact artifact bytes."""
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def is_canonical_text_path(relative: Path) -> bool:
    return (
        relative.name in CANONICAL_TEXT_FILENAMES
        or relative.suffix.lower() in CANONICAL_TEXT_SUFFIXES
    )


def canonicalize_text_bytes(data: bytes, relative: Path) -> bytes:
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError as error:
        raise ValueError(
            f'Canonical text file is not valid UTF-8: {relative.as_posix()}'
        ) from error
    return text.replace('\r\n', '\n').replace('\r', '\n').encode('utf-8')


def canonical_source_bytes(root: Path, relative: Path) -> bytes:
    data = (root / relative).read_bytes()
    if is_canonical_text_path(relative):
        return canonicalize_text_bytes(data, relative)
    return data


def canonical_source_text(root: Path, relative: Path) -> str:
    if not is_canonical_text_path(relative):
        raise ValueError(f'Path is not canonical text: {relative.as_posix()}')
    return canonical_source_bytes(root, relative).decode('utf-8')


def sha256_source(root: Path, relative: Path) -> str:
    return sha256_bytes(canonical_source_bytes(root, relative))


def source_manifest(root: Path = ROOT) -> dict:
    files = {
        relative.as_posix(): sha256_source(root, relative)
        for relative in MANIFEST_INPUTS
    }
    return {
        'releaseId': RELEASE_ID,
        'appVersion': APP_VERSION,
        'entrypoint': 'index.html',
        'embeddedApplicationSources': [path.as_posix() for path in APP_SOURCES],
        'sourceByteContract': SOURCE_BYTE_CONTRACT,
        'files': files,
    }


def manifest_text(root: Path = ROOT) -> str:
    return json.dumps(
        source_manifest(root),
        ensure_ascii=False,
        sort_keys=True,
        indent=2,
    ) + '\n'


def ensure_source_manifest(root: Path = ROOT) -> Path:
    destination = root / MANIFEST_NAME
    expected = manifest_text(root).encode('utf-8')
    if destination.exists():
        current = canonicalize_text_bytes(destination.read_bytes(), Path(MANIFEST_NAME))
    else:
        current = None
    if current != expected:
        destination.write_bytes(expected)
    return destination


def source_bundle(root: Path = ROOT) -> str:
    chunks: list[str] = []
    for relative in APP_SOURCES:
        source = canonical_source_text(root, relative).rstrip()
        chunks.append(
            f'/* BEGIN {relative.as_posix()} */\n'
            f'{source}\n'
            f'/* END {relative.as_posix()} */'
        )
    return '\n\n'.join(chunks)


def replace_loader(html: str, replacement: str) -> str:
    start = html.find(LOADER_BEGIN)
    end = html.find(LOADER_END)
    if start < 0 or end < 0 or end < start:
        raise RuntimeError('Application loader markers were not found in index.html')
    end += len(LOADER_END)
    return html[:start] + replacement + html[end:]


def build_single_html(root: Path = ROOT) -> str:
    html = canonical_source_text(root, Path('index.html'))
    css = canonical_source_text(root, Path('styles.css')).rstrip()
    manifest = manifest_text(root).encode('utf-8')
    provenance = (
        f'<!-- RELEASE_ID: {RELEASE_ID} -->\n'
        f'<!-- APP_VERSION: {APP_VERSION} -->\n'
        f'<!-- SOURCE_MANIFEST_SHA256: {sha256_bytes(manifest)} -->\n'
    )
    if html.startswith('<!DOCTYPE html>\n'):
        html = '<!DOCTYPE html>\n' + provenance + html[len('<!DOCTYPE html>\n'):]
    else:
        html = provenance + html

    link = '<link rel="stylesheet" href="styles.css" />'
    if link not in html:
        raise RuntimeError('Expected styles.css link was not found in index.html')
    html = html.replace(
        link,
        f'<style>\n/* BEGIN EMBEDDED STYLES */\n{css}\n/* END EMBEDDED STYLES */\n  </style>',
        1,
    )

    bundle = source_bundle(root)
    inline = f'''  <script>
    (() => {{
      const fatal = document.getElementById('fatal-error');
      const showFatal = error => {{
        fatal.hidden = false;
        const message = fatal.querySelector('p');
        if (message && error) message.textContent = `Runtime error: ${{error?.message || error}}`;
      }};
      window.addEventListener('error', event => showFatal(event.error || event.message));
      window.addEventListener('unhandledrejection', event => showFatal(event.reason));
      if (!window.THREE || !window.CANNON) {{
        showFatal('Required Three.js or Cannon.js library is unavailable. Check the internet connection and reload.');
        return;
      }}
      try {{
/* BEGIN EMBEDDED APPLICATION */
{bundle}
/* END EMBEDDED APPLICATION */
      }} catch (error) {{
        console.error('Voxel Aeronautics startup failed:', error);
        showFatal(error);
      }}
    }})();
  </script>'''
    return replace_loader(html, inline)


def _resolved_paths(paths: Iterable[Path]) -> set[Path]:
    return {path.resolve() for path in paths}


def iter_archive_files(
    root: Path,
    excluded_paths: Iterable[Path] = (),
) -> tuple[Path, ...]:
    excluded = _resolved_paths(excluded_paths)
    relative_paths: list[Path] = []
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any(part in IGNORED_ARCHIVE_PARTS for part in relative.parts):
            continue
        if path.resolve() in excluded:
            continue
        relative_paths.append(relative)
    return tuple(sorted(relative_paths, key=lambda item: item.as_posix()))


def archive_file_mode(relative: Path) -> int:
    return 0o100755 if relative in EXECUTABLE_ARCHIVE_PATHS else 0o100644


def _deterministic_info(name: str, mode: int) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = mode << 16
    info.extra = b''
    info.comment = b''
    return info


def expected_archive_names(
    root: Path,
    single_name: str | None = None,
    excluded_paths: Iterable[Path] = (),
) -> tuple[str, ...]:
    prefix = ARCHIVE_ROOT + '/'
    names = [
        prefix + relative.as_posix()
        for relative in iter_archive_files(root, excluded_paths)
    ]
    if single_name is not None:
        names.extend((
            prefix + 'release/' + single_name,
            prefix + 'release/SHA256.txt',
        ))
    return tuple(sorted(names))


def write_zip(root: Path, destination: Path, single_file: Path | None = None) -> None:
    ensure_source_manifest(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    excluded = [destination]
    if single_file is not None:
        excluded.append(single_file)

    prefix = ARCHIVE_ROOT + '/'
    members: list[tuple[str, bytes, int]] = []
    for relative in iter_archive_files(root, excluded):
        members.append((
            prefix + relative.as_posix(),
            canonical_source_bytes(root, relative),
            archive_file_mode(relative),
        ))
    if single_file is not None:
        members.append((
            prefix + 'release/' + single_file.name,
            single_file.read_bytes(),
            0o100644,
        ))
        members.append((
            prefix + 'release/SHA256.txt',
            f'{sha256(single_file)}  {single_file.name}\n'.encode('utf-8'),
            0o100644,
        ))

    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, data, mode in sorted(members, key=lambda item: item[0]):
            archive.writestr(_deterministic_info(name, mode), data)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Build canonical source-parity-verified single-file and ZIP releases.'
    )
    parser.add_argument('--single', type=Path, default=ROOT / 'dist' / SINGLE_NAME)
    parser.add_argument('--zip', dest='zip_path', type=Path, default=ROOT / 'dist' / ZIP_NAME)
    parser.add_argument('--hashes', type=Path, default=ROOT / 'dist' / 'SHA256.txt')
    args = parser.parse_args()

    ensure_source_manifest(ROOT)
    args.single.parent.mkdir(parents=True, exist_ok=True)
    args.single.write_text(build_single_html(ROOT), encoding='utf-8', newline='\n')
    write_zip(ROOT, args.zip_path, args.single)
    args.hashes.parent.mkdir(parents=True, exist_ok=True)
    args.hashes.write_text(
        f'{sha256(args.single)}  {args.single.name}\n'
        f'{sha256(args.zip_path)}  {args.zip_path.name}\n',
        encoding='utf-8',
        newline='\n',
    )
    print(args.single)
    print(args.zip_path)
    print(args.hashes)


if __name__ == '__main__':
    main()
