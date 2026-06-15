#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_SOURCES = (
    Path('src/foundation/kernel.js'),
    Path('src/foundation/config.js'),
    Path('src/foundation/catalog.js'),
    Path('src/foundation/orientation.js'),
    Path('src/foundation/blueprint.js'),
    Path('src/foundation/craft_model.js'),
    Path('src/foundation/craft_history.js'),
    Path('src/foundation/state.js'),
    Path('src/foundation/bootstrap.js'),
    Path('src/game.js'),
)
LOADER_BEGIN = '  <!-- BEGIN APP LOADER -->'
LOADER_END = '  <!-- END APP LOADER -->'


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
    css = (root / 'styles.css').read_text(encoding='utf-8').rstrip()

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


def write_zip(root: Path, destination: Path) -> None:
    ignored_parts = {'dist', '__pycache__', '.pytest_cache', '.git', 'node_modules'}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(root.rglob('*')):
            if not path.is_file() or any(part in ignored_parts for part in path.parts):
                continue
            if path.resolve() == destination.resolve():
                continue
            archive.write(path, Path(root.name) / path.relative_to(root))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description='Build deterministic single-file and ZIP releases.')
    parser.add_argument('--single', type=Path, default=ROOT / 'dist' / 'Voxel_Aeronautics_Workshop_Foundation_Phase_1B.html')
    parser.add_argument('--zip', dest='zip_path', type=Path, default=ROOT / 'dist' / 'Voxel_Aeronautics_Workshop_Foundation_Phase_1B.zip')
    parser.add_argument('--hashes', type=Path, default=ROOT / 'dist' / 'SHA256.txt')
    args = parser.parse_args()

    args.single.parent.mkdir(parents=True, exist_ok=True)
    args.single.write_text(build_single_html(ROOT), encoding='utf-8', newline='\n')
    write_zip(ROOT, args.zip_path)
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
