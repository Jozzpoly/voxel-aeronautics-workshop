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


class ReleaseVerificationError(RuntimeError):
    pass


def embedded_source(single_text: str, relative: Path) -> str:
    begin = f'/* BEGIN {relative.as_posix()} */\n'
    end = f'\n/* END {relative.as_posix()} */'
    start = single_text.index(begin) + len(begin)
    finish = single_text.index(end, start)
    return single_text[start:finish]


def parse_checksums(path: Path) -> dict[str, str]:
    checksums: dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        digest, separator, filename = line.partition('  ')
        if not separator or not digest or not filename or filename in checksums:
            raise ReleaseVerificationError(
                f'Malformed or duplicate checksum line: {line!r}'
            )
        checksums[filename] = digest
    return checksums


def _expected_member_mode(name: str) -> int:
    prefix = build_release.ARCHIVE_ROOT + '/'
    relative_text = name.removeprefix(prefix)
    if relative_text.startswith('release/'):
        return 0o100644
    return build_release.archive_file_mode(Path(relative_text))


def verify_artifacts(
    root: Path = ROOT,
    single: Path | None = None,
    zip_path: Path | None = None,
    hashes_path: Path | None = None,
) -> dict:
    if (zip_path is None) != (hashes_path is None):
        raise ReleaseVerificationError('ZIP and checksum artifacts must be supplied together.')

    manifest_path = root / build_release.MANIFEST_NAME
    if not manifest_path.is_file():
        raise ReleaseVerificationError(
            f'Missing {manifest_path.name}; build the release first.'
        )
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    expected_manifest = build_release.source_manifest(root)
    if manifest != expected_manifest:
        raise ReleaseVerificationError(
            'Source manifest does not match the canonical source-byte view.'
        )

    if single is None:
        candidates = [
            root / 'dist' / build_release.SINGLE_NAME,
            root / 'release' / build_release.SINGLE_NAME,
        ]
        single = next((candidate for candidate in candidates if candidate.exists()), None)
    if single is None or not single.is_file():
        raise ReleaseVerificationError(
            f'No packaged {build_release.SINGLE_NAME} found.'
        )

    text = single.read_text(encoding='utf-8')
    if f'RELEASE_ID: {build_release.RELEASE_ID}' not in text:
        raise ReleaseVerificationError(f'Wrong release marker in {single.name}.')
    if f'APP_VERSION: {build_release.APP_VERSION}' not in text:
        raise ReleaseVerificationError(
            f'Wrong application version marker in {single.name}.'
        )
    expected_manifest_hash = build_release.sha256_bytes(
        build_release.manifest_text(root).encode('utf-8')
    )
    if f'SOURCE_MANIFEST_SHA256: {expected_manifest_hash}' not in text:
        raise ReleaseVerificationError('Single HTML manifest provenance mismatch.')

    for relative in build_release.APP_SOURCES:
        expected = build_release.canonical_source_text(root, relative).rstrip()
        if embedded_source(text, relative) != expected:
            raise ReleaseVerificationError(
                f'Embedded canonical source mismatch: {relative}'
            )

    artifact_set = 'single-only'
    if zip_path is not None and hashes_path is not None:
        if not zip_path.is_file():
            raise ReleaseVerificationError(f'Missing ZIP artifact: {zip_path}')
        if not hashes_path.is_file():
            raise ReleaseVerificationError(
                f'Missing checksum artifact: {hashes_path}'
            )

        expected_hash_lines = {
            single.name: build_release.sha256(single),
            zip_path.name: build_release.sha256(zip_path),
        }
        actual_hash_lines = parse_checksums(hashes_path)
        if actual_hash_lines != expected_hash_lines:
            raise ReleaseVerificationError(
                f'Checksum artifact mismatch: expected={expected_hash_lines!r} '
                f'actual={actual_hash_lines!r}'
            )

        excluded = (single, zip_path, hashes_path)
        expected_names = build_release.expected_archive_names(
            root,
            single.name,
            excluded_paths=excluded,
        )
        prefix = build_release.ARCHIVE_ROOT + '/'
        with zipfile.ZipFile(zip_path) as archive:
            corrupt = archive.testzip()
            if corrupt is not None:
                raise ReleaseVerificationError(f'Corrupt ZIP member: {corrupt}')

            infos = archive.infolist()
            actual_names = tuple(info.filename for info in infos)
            if len(actual_names) != len(set(actual_names)):
                raise ReleaseVerificationError('ZIP contains duplicate member names.')
            if actual_names != expected_names:
                raise ReleaseVerificationError(
                    f'ZIP inventory/order mismatch: expected={expected_names!r} '
                    f'actual={actual_names!r}'
                )

            for info in infos:
                if info.date_time != build_release.ZIP_TIMESTAMP:
                    raise ReleaseVerificationError(
                        f'ZIP timestamp mismatch: {info.filename} {info.date_time!r}'
                    )
                if info.compress_type != zipfile.ZIP_STORED:
                    raise ReleaseVerificationError(
                        f'ZIP compression mismatch: {info.filename}'
                    )
                if info.create_system != 3:
                    raise ReleaseVerificationError(
                        f'ZIP creator system mismatch: {info.filename}'
                    )
                actual_mode = (info.external_attr >> 16) & 0o177777
                expected_mode = _expected_member_mode(info.filename)
                if actual_mode != expected_mode:
                    raise ReleaseVerificationError(
                        f'ZIP mode mismatch: {info.filename} '
                        f'expected={expected_mode:o} actual={actual_mode:o}'
                    )

            for relative in build_release.iter_archive_files(root, excluded):
                archived = archive.read(prefix + relative.as_posix())
                current = build_release.canonical_source_bytes(root, relative)
                if archived != current:
                    raise ReleaseVerificationError(
                        f'ZIP canonical source mismatch: {relative}'
                    )

            packaged_single = archive.read(prefix + 'release/' + single.name)
            if packaged_single != single.read_bytes():
                raise ReleaseVerificationError(
                    'ZIP packaged single-file artifact differs from the verified HTML.'
                )
            packaged_hash = archive.read(
                prefix + 'release/SHA256.txt'
            ).decode('utf-8')
            expected_packaged_hash = (
                f'{build_release.sha256(single)}  {single.name}\n'
            )
            if packaged_hash != expected_packaged_hash:
                raise ReleaseVerificationError(
                    'ZIP internal single-file checksum mismatch.'
                )
        artifact_set = 'html+zip+sha256'

    return {
        'releaseId': build_release.RELEASE_ID,
        'manifestFiles': len(manifest['files']),
        'embeddedSources': len(build_release.APP_SOURCES),
        'singleFile': single.name,
        'sourceByteContract': manifest['sourceByteContract'],
        'sourceParity': 'ok',
        'artifactSet': artifact_set,
        'zipIntegrity': 'ok' if zip_path is not None else 'not-requested',
        'externalChecksums': 'ok' if hashes_path is not None else 'not-requested',
        'zipSourceParity': 'ok' if zip_path is not None else 'not-requested',
        'zipInventory': 'exact' if zip_path is not None else 'not-requested',
        'zipMetadata': 'deterministic' if zip_path is not None else 'not-requested',
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Verify release identity, canonical source parity and exact artifacts.'
    )
    parser.add_argument('--single', type=Path, help='explicit single-file artifact to verify')
    parser.add_argument('--zip', dest='zip_path', type=Path, help='explicit ZIP artifact to verify')
    parser.add_argument('--hashes', type=Path, help='explicit checksum file to verify')
    args = parser.parse_args()
    try:
        result = verify_artifacts(ROOT, args.single, args.zip_path, args.hashes)
    except (ReleaseVerificationError, KeyError, ValueError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error)) from error
    print(result)


if __name__ == '__main__':
    main()
