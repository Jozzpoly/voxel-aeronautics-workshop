#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import build_release  # noqa: E402


def embedded_source(single_text: str, relative: Path) -> str:
    begin = f'/* BEGIN {relative.as_posix()} */\n'
    end = f'\n/* END {relative.as_posix()} */'
    start = single_text.index(begin) + len(begin)
    finish = single_text.index(end, start)
    return single_text[start:finish]


def main() -> None:
    manifest_path = ROOT / build_release.MANIFEST_NAME
    if not manifest_path.exists():
        raise SystemExit(f'Missing {manifest_path.name}; run npm run build first.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('releaseId') != build_release.RELEASE_ID:
        raise SystemExit('Release ID mismatch.')

    for relative in build_release.MANIFEST_INPUTS:
        expected = manifest['files'].get(relative.as_posix())
        actual = build_release.sha256(ROOT / relative)
        if expected != actual:
            raise SystemExit(f'Source hash mismatch: {relative}')

    expected_name = build_release.SINGLE_NAME
    candidates = [
        ROOT / 'dist' / expected_name,
        ROOT / 'release' / expected_name,
    ]
    single = next((candidate for candidate in candidates if candidate.exists()), None)
    if single is None:
        raise SystemExit(f'No packaged {expected_name} found in dist/ or release/.')
    text = single.read_text(encoding='utf-8')
    if f'RELEASE_ID: {build_release.RELEASE_ID}' not in text:
        raise SystemExit(f'Wrong release marker in {single.name}.')
    for relative in build_release.APP_SOURCES:
        expected = (ROOT / relative).read_text(encoding='utf-8').rstrip()
        if embedded_source(text, relative) != expected:
            raise SystemExit(f'Embedded source mismatch: {relative}')

    print({
        'releaseId': build_release.RELEASE_ID,
        'manifestFiles': len(manifest['files']),
        'embeddedSources': len(build_release.APP_SOURCES),
        'singleFile': single.name,
        'sourceParity': 'ok',
    })


if __name__ == '__main__':
    main()
