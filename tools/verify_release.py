#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import zipfile
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


def verify_artifacts(
    root: Path,
    single: Path,
    zip_path: Path | None = None,
    hashes_path: Path | None = None,
) -> dict[str, str | int]:
    if (zip_path is None) != (hashes_path is None):
        raise SystemExit('--zip and --hashes must be supplied together.')

    manifest_path = root / build_release.MANIFEST_NAME
    if not manifest_path.exists():
        raise SystemExit(f'Missing {manifest_path.name}; run npm run build first.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('releaseId') != build_release.RELEASE_ID:
        raise SystemExit('Release ID mismatch.')

    for relative in build_release.MANIFEST_INPUTS:
        expected = manifest['files'].get(relative.as_posix())
        actual = build_release.sha256_bytes(build_release.canonical_source_bytes(root, relative))
        if expected != actual:
            raise SystemExit(f'Source hash mismatch: {relative}')

    if not single.exists():
        raise SystemExit(f'Missing single-file artifact: {single}')
    text = single.read_text(encoding='utf-8')
    if f'RELEASE_ID: {build_release.RELEASE_ID}' not in text:
        raise SystemExit(f'Wrong release marker in {single.name}.')
    for relative in build_release.APP_SOURCES:
        expected = (root / relative).read_text(encoding='utf-8').rstrip()
        if embedded_source(text, relative) != expected:
            raise SystemExit(f'Embedded source mismatch: {relative}')

    artifact_set = 'single-only'
    if zip_path is not None and hashes_path is not None:
        if not zip_path.is_file():
            raise SystemExit(f'Missing ZIP artifact: {zip_path}')
        if not hashes_path.is_file():
            raise SystemExit(f'Missing checksum artifact: {hashes_path}')

        expected_hash_lines = {
            single.name: build_release.sha256(single),
            zip_path.name: build_release.sha256(zip_path),
        }
        actual_hash_lines: dict[str, str] = {}
        for line in hashes_path.read_text(encoding='utf-8').splitlines():
            digest, separator, filename = line.partition('  ')
            if not separator or not digest or not filename:
                raise SystemExit(f'Malformed checksum line: {line!r}')
            actual_hash_lines[filename] = digest
        if actual_hash_lines != expected_hash_lines:
            raise SystemExit(
                f'Checksum artifact mismatch: expected={expected_hash_lines!r} actual={actual_hash_lines!r}'
            )

        prefix = build_release.ARCHIVE_ROOT + '/'
        with zipfile.ZipFile(zip_path) as archive:
            corrupt = archive.testzip()
            if corrupt is not None:
                raise SystemExit(f'Corrupt ZIP member: {corrupt}')
            for relative in build_release.MANIFEST_INPUTS:
                archived = archive.read(prefix + relative.as_posix())
                current = build_release.canonical_source_bytes(root, relative)
                if archived != current:
                    raise SystemExit(f'ZIP source mismatch: {relative}')
            packaged_single = archive.read(prefix + 'release/' + single.name)
            if packaged_single != single.read_bytes():
                raise SystemExit('ZIP packaged single-file artifact differs from the verified HTML.')
            packaged_hash = archive.read(prefix + 'release/SHA256.txt').decode('utf-8')
            expected_packaged_hash = f'{build_release.sha256(single)}  {single.name}\n'
            if packaged_hash != expected_packaged_hash:
                raise SystemExit('ZIP internal single-file checksum mismatch.')
        artifact_set = 'html+zip+sha256'

    return {
        'releaseId': build_release.RELEASE_ID,
        'manifestFiles': len(manifest['files']),
        'embeddedSources': len(build_release.APP_SOURCES),
        'singleFile': single.name,
        'sourceParity': 'ok',
        'artifactSet': artifact_set,
        'zipIntegrity': 'ok' if zip_path is not None else 'not-requested',
        'externalChecksums': 'ok' if hashes_path is not None else 'not-requested',
        'zipSourceParity': 'ok' if zip_path is not None else 'not-requested',
    }


def resolve_single(explicit: Path | None) -> Path:
    expected_name = build_release.SINGLE_NAME
    candidates = [explicit] if explicit is not None else [
        ROOT / 'dist' / expected_name,
        ROOT / 'release' / expected_name,
    ]
    single = next((candidate for candidate in candidates if candidate is not None and candidate.exists()), None)
    if single is None:
        raise SystemExit(f'No packaged {expected_name} found in dist/ or release/.')
    return single


def main() -> None:
    parser = argparse.ArgumentParser(description='Verify release identity, source parity and exact artifacts.')
    parser.add_argument('--single', type=Path, help='explicit single-file artifact to verify')
    parser.add_argument('--zip', dest='zip_path', type=Path, help='explicit ZIP artifact to verify')
    parser.add_argument('--hashes', type=Path, help='explicit checksum file to verify')
    args = parser.parse_args()

    print(verify_artifacts(ROOT, resolve_single(args.single), args.zip_path, args.hashes))


if __name__ == '__main__':
    main()
