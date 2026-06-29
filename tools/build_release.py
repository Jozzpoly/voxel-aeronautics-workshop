#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE_ID = 'foundation-workbench-foundation'
APP_VERSION = '0.8.2-foundation.workbench-foundation'
SINGLE_NAME = 'Voxel_Aeronautics_Workshop_Workbench_Foundation.html'
ZIP_NAME = 'Voxel_Aeronautics_Workshop_Workbench_Foundation.zip'
MANIFEST_NAME = 'SOURCE_MANIFEST.json'
ARCHIVE_ROOT = 'Voxel_Aeronautics_Workshop_WORKBENCH_FOUNDATION_READY_TO_PUSH'
IGNORED_ARCHIVE_PARTS = {'dist', 'release', '.agent-validation', '__pycache__', '.pytest_cache', '.git', 'node_modules'}


def files_under(relative_root: Path) -> tuple[Path, ...]:
    root = ROOT / relative_root
    if not root.exists():
        return tuple()
    ignored = {'__pycache__', '.pytest_cache'}
    return tuple(
        path.relative_to(ROOT)
        for path in sorted(root.rglob('*'))
        if path.is_file() and not any(part in ignored for part in path.relative_to(root).parts)
    )


APP_SOURCES = (
    Path('src/foundation/kernel.js'),
    Path('src/foundation/config.js'),
    Path('src/foundation/catalog.js'),
    Path('src/foundation/visual_asset_manifest.js'),
    Path('src/foundation/orientation.js'),
    Path('src/foundation/blueprint.js'),
    Path('src/foundation/diagnostics.js'),
    Path('src/foundation/transform_math.js'),
    Path('src/foundation/assembly_spaces.js'),
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
    Path('src/foundation/fixed_step_scheduler.js'),
    Path('src/foundation/state.js'),
    Path('src/runtime/physics_port.js'),
    Path('src/runtime/cannon_physics_backend.js'),
    Path('src/runtime/headless_physics_backend.js'),
    Path('src/runtime/assembly_builder.js'),
    Path('src/game/scene_environment.js'),
    Path('src/game/career_service.js'),
    Path('src/game/workspace_controller.js'),
    Path('src/game/input_settings_controller.js'),
    Path('src/game/camera_controller.js'),
    Path('src/game/build_targeting.js'),
    Path('src/game/orientation_service.js'),
    Path('src/game/power_control_readouts.js'),
    Path('src/game/visual_asset_registry.js'),
    Path('src/game/visual_asset_loader.js'),
    Path('src/game/visual_asset_dev_controls.js'),
    Path('src/game/visual_runtime_adapter.js'),
    Path('src/game/module_visual_factory.js'),
    Path('src/game/visual_asset_composition.js'),
    Path('src/game/assembly_space_controller.js'),
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
VISUAL_PACK_SOURCES = files_under(Path('assets/visual_packs'))
MANIFEST_INPUTS = (
    Path('index.html'),
    Path('tailwind.generated.css'),
    Path('styles.css'),
    Path('vendor/three-r128/three.min.js'),
    Path('vendor/three-r128/GLTFLoader.js'),
    Path('vendor/cannon-0.6.2/cannon.min.js'),
    *VISUAL_PACK_SOURCES,
    Path('tools/generate_tailwind_css.js'),
    Path('package.json'),
    Path('tools/build_release.py'),
    Path('tools/verify_release.py'),
    *APP_SOURCES,
)
STUDIO_TOOL_SOURCES = files_under(Path('tools/blockbench_import_studio'))
MANIFEST_INPUTS = (
    *MANIFEST_INPUTS,
    *STUDIO_TOOL_SOURCES,
)
LOADER_BEGIN = '  <!-- BEGIN APP LOADER -->'
LOADER_END = '  <!-- END APP LOADER -->'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def source_manifest(root: Path = ROOT) -> dict:
    files = {}
    for relative in MANIFEST_INPUTS:
        files[relative.as_posix()] = sha256(root / relative)
    return {
        'releaseId': RELEASE_ID,
        'appVersion': APP_VERSION,
        'entrypoint': 'index.html',
        'embeddedApplicationSources': [path.as_posix() for path in APP_SOURCES],
        'studioToolSources': [path.as_posix() for path in STUDIO_TOOL_SOURCES],
        'files': files,
    }


def manifest_text(root: Path = ROOT) -> str:
    return json.dumps(source_manifest(root), ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def ensure_source_manifest(root: Path = ROOT) -> Path:
    destination = root / MANIFEST_NAME
    content = manifest_text(root)
    if not destination.exists() or destination.read_text(encoding='utf-8') != content:
        destination.write_text(content, encoding='utf-8', newline='\n')
    return destination


def source_bundle(root: Path = ROOT) -> str:
    chunks: list[str] = []
    for relative in APP_SOURCES:
        source = (root / relative).read_text(encoding='utf-8').rstrip()
        chunks.append(f'/* BEGIN {relative.as_posix()} */\n{source}\n/* END {relative.as_posix()} */')
    return '\n\n'.join(chunks)


def replace_loader(html: str, replacement: str) -> str:
    start = html.find(LOADER_BEGIN)
    end = html.find(LOADER_END)
    if start < 0 or end < 0 or end < start:
        raise RuntimeError('Application loader markers were not found in index.html')
    end += len(LOADER_END)
    return html[:start] + replacement + html[end:]


def build_single_html(root: Path = ROOT) -> str:
    html = (root / 'index.html').read_text(encoding='utf-8')
    generated_css = (root / 'tailwind.generated.css').read_text(encoding='utf-8').rstrip()
    custom_css = (root / 'styles.css').read_text(encoding='utf-8').rstrip()
    css = generated_css + '\n\n' + custom_css
    three = (root / 'vendor/three-r128/three.min.js').read_text(encoding='utf-8').rstrip()
    gltf_loader = (root / 'vendor/three-r128/GLTFLoader.js').read_text(encoding='utf-8').rstrip()
    cannon = (root / 'vendor/cannon-0.6.2/cannon.min.js').read_text(encoding='utf-8').rstrip()
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

    generated_link = '<link rel="stylesheet" href="tailwind.generated.css" />'
    custom_link = '<link rel="stylesheet" href="styles.css" />'
    if generated_link not in html or custom_link not in html:
        raise RuntimeError('Expected generated and custom stylesheet links were not found in index.html')
    html = html.replace(
        generated_link + '\n  ' + custom_link,
        f'<style>\n/* BEGIN EMBEDDED STYLES */\n{css}\n/* END EMBEDDED STYLES */\n  </style>',
        1,
    )
    three_script = '<script src="vendor/three-r128/three.min.js"></script>'
    if three_script not in html:
        raise RuntimeError('Expected local Three.js script was not found in index.html')
    html = html.replace(
        three_script,
        f'<script>\n/* BEGIN EMBEDDED THREE R128 */\n{three}\n/* END EMBEDDED THREE R128 */\n  </script>',
        1,
    )
    gltf_script = '<script src="vendor/three-r128/GLTFLoader.js"></script>'
    if gltf_script not in html:
        raise RuntimeError('Expected local GLTFLoader script was not found in index.html')
    html = html.replace(
        gltf_script,
        f'<script>\n/* BEGIN EMBEDDED THREE GLTFLoader R128 */\n{gltf_loader}\n/* END EMBEDDED THREE GLTFLoader R128 */\n  </script>',
        1,
    )
    cannon_script = '<script src="vendor/cannon-0.6.2/cannon.min.js"></script>'
    if cannon_script not in html:
        raise RuntimeError('Expected local Cannon script was not found in index.html')
    html = html.replace(
        cannon_script,
        f'<script>\n/* BEGIN EMBEDDED CANNON 0.6.2 */\n{cannon}\n/* END EMBEDDED CANNON 0.6.2 */\n  </script>',
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
        showFatal('Required embedded Three.js or Cannon.js runtime is unavailable.');
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


def _deterministic_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info


def write_zip(root: Path, destination: Path, single_file: Path | None = None) -> None:
    ensure_source_manifest(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(root.rglob('*')):
            relative = path.relative_to(root)
            if not path.is_file() or any(part in IGNORED_ARCHIVE_PARTS for part in relative.parts):
                continue
            if path.resolve() == destination.resolve():
                continue
            archive.write(path, Path(ARCHIVE_ROOT) / relative)
        if single_file is not None:
            release_path = (Path(ARCHIVE_ROOT) / 'release' / single_file.name).as_posix()
            archive.writestr(_deterministic_info(release_path), single_file.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            single_hash = f'{sha256(single_file)}  {single_file.name}\n'.encode('utf-8')
            hash_path = (Path(ARCHIVE_ROOT) / 'release' / 'SHA256.txt').as_posix()
            archive.writestr(_deterministic_info(hash_path), single_hash, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def main() -> None:
    parser = argparse.ArgumentParser(description='Build source-parity-verified single-file and ZIP releases.')
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
        f'{sha256(args.single)}  {args.single.name}\n{sha256(args.zip_path)}  {args.zip_path.name}\n',
        encoding='utf-8',
    )
    print(args.single)
    print(args.zip_path)
    print(args.hashes)


if __name__ == '__main__':
    main()
