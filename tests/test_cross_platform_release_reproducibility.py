from __future__ import annotations

import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import build_release  # noqa: E402
import verify_release  # noqa: E402

COPY_IGNORED_PARTS = {
    '.git',
    '.agent-validation',
    'dist',
    '__pycache__',
    '.pytest_cache',
    'node_modules',
}
BINARY_FIXTURE = Path('tests/fixtures/stage11-binary-exactness.bin')
BINARY_BYTES = b'\x00\xff\r\n\x10VAW-stage-1.1\x00\x80'


def ignored_copy(directory: str, names: list[str]) -> set[str]:
    return {name for name in names if name in COPY_IGNORED_PARTS}


def project_files(root: Path) -> tuple[Path, ...]:
    return tuple(sorted(
        (
            path.relative_to(root)
            for path in root.rglob('*')
            if path.is_file()
            and not any(part in COPY_IGNORED_PARTS for part in path.relative_to(root).parts)
        ),
        key=lambda relative: relative.as_posix(),
    ))


def convert_text_checkout(root: Path, *, crlf: bool) -> int:
    changed = 0
    for relative in project_files(root):
        if not build_release.is_canonical_text_path(relative):
            continue
        path = root / relative
        canonical = build_release.canonicalize_text_bytes(path.read_bytes(), relative)
        target = canonical.replace(b'\n', b'\r\n') if crlf else canonical
        if path.read_bytes() != target:
            path.write_bytes(target)
            changed += 1
    return changed


def create_variant(source: Path, destination: Path, *, crlf: bool) -> int:
    shutil.copytree(
        source,
        destination,
        symlinks=True,
        copy_function=shutil.copy2,
        ignore=ignored_copy,
    )
    changed = convert_text_checkout(destination, crlf=crlf)
    fixture = destination / BINARY_FIXTURE
    fixture.parent.mkdir(parents=True, exist_ok=True)
    fixture.write_bytes(BINARY_BYTES)
    return changed


def write_checksums(single: Path, archive: Path, destination: Path) -> None:
    destination.write_text(
        f'{build_release.sha256(single)}  {single.name}\n'
        f'{build_release.sha256(archive)}  {archive.name}\n',
        encoding='utf-8',
        newline='\n',
    )


def build_variant(root: Path, output: Path) -> tuple[Path, Path, Path, dict]:
    output.mkdir(parents=True, exist_ok=True)
    build_release.ensure_source_manifest(root)
    single = output / build_release.SINGLE_NAME
    archive = output / build_release.ZIP_NAME
    hashes = output / 'SHA256.txt'
    single.write_text(
        build_release.build_single_html(root),
        encoding='utf-8',
        newline='\n',
    )
    build_release.write_zip(root, archive, single)
    write_checksums(single, archive, hashes)
    result = verify_release.verify_artifacts(root, single, archive, hashes)
    return single, archive, hashes, result


def member_snapshot(path: Path) -> tuple[tuple[str, tuple[int, ...], int, int, int, bytes], ...]:
    with zipfile.ZipFile(path) as archive:
        return tuple(
            (
                info.filename,
                info.date_time,
                info.compress_type,
                info.create_system,
                (info.external_attr >> 16) & 0o177777,
                archive.read(info.filename),
            )
            for info in archive.infolist()
        )


def assert_repeatable(root: Path, first_output: Path, second_output: Path) -> None:
    first = build_variant(root, first_output)
    second = build_variant(root, second_output)
    assert first[0].read_bytes() == second[0].read_bytes(), 'single HTML repeat mismatch'
    assert first[1].read_bytes() == second[1].read_bytes(), 'source ZIP repeat mismatch'
    assert first[2].read_bytes() == second[2].read_bytes(), 'checksum repeat mismatch'


assert build_release.canonicalize_text_bytes(
    b'alpha\rbeta\r\ngamma\n',
    Path('fixture.txt'),
) == b'alpha\nbeta\ngamma\n'

with tempfile.TemporaryDirectory(prefix='vaw-manifest-root-scope-') as temporary_root_scope:
    root_scope = Path(temporary_root_scope) / 'candidate'
    shutil.copytree(
        ROOT,
        root_scope,
        symlinks=True,
        copy_function=shutil.copy2,
        ignore=ignored_copy,
    )
    probe = Path('assets/visual_packs/root_scope_probe.json')
    (root_scope / probe).write_text('{"probe": true}\n', encoding='utf-8', newline='\n')
    scoped_inputs = build_release.manifest_inputs(root_scope)
    assert probe in scoped_inputs, 'manifest inputs must be computed from the supplied root'
    assert probe not in build_release.MANIFEST_INPUTS, 'default manifest inputs must not observe temp-root probes'
    scoped_manifest = build_release.source_manifest(root_scope)
    assert probe.as_posix() in scoped_manifest['files'], 'source manifest must include target-root visual sources'

with tempfile.TemporaryDirectory(prefix='vaw-stage11-full-tree-') as temporary_text:
    temporary = Path(temporary_text)
    lf_root = temporary / 'lf-checkout'
    crlf_root = temporary / 'crlf-checkout'
    lf_changed = create_variant(ROOT, lf_root, crlf=False)
    crlf_changed = create_variant(ROOT, crlf_root, crlf=True)

    assert project_files(lf_root) == project_files(crlf_root), 'variant file trees differ'
    assert lf_changed >= 0
    assert crlf_changed > 0, 'CRLF variant did not change any text files'
    assert (lf_root / 'index.html').read_bytes() != (crlf_root / 'index.html').read_bytes()
    assert b'\r\n' not in (lf_root / 'index.html').read_bytes()
    assert b'\r\n' in (crlf_root / 'index.html').read_bytes()
    assert (lf_root / BINARY_FIXTURE).read_bytes() == BINARY_BYTES
    assert (crlf_root / BINARY_FIXTURE).read_bytes() == BINARY_BYTES

    lf_single, lf_zip, lf_hashes, lf_result = build_variant(
        lf_root,
        temporary / 'lf-output',
    )
    crlf_single, crlf_zip, crlf_hashes, crlf_result = build_variant(
        crlf_root,
        temporary / 'crlf-output',
    )

    lf_manifest = build_release.canonical_source_bytes(
        lf_root,
        Path(build_release.MANIFEST_NAME),
    )
    crlf_manifest = build_release.canonical_source_bytes(
        crlf_root,
        Path(build_release.MANIFEST_NAME),
    )
    assert lf_manifest == crlf_manifest, 'canonical SOURCE_MANIFEST.json differs'
    assert build_release.manifest_text(lf_root) == build_release.manifest_text(crlf_root)
    assert lf_single.read_bytes() == crlf_single.read_bytes(), 'single HTML differs'
    assert lf_zip.read_bytes() == crlf_zip.read_bytes(), 'source ZIP differs'
    assert lf_hashes.read_bytes() == crlf_hashes.read_bytes(), 'checksums differ'
    assert lf_result == crlf_result, 'verifier results differ'

    lf_members = member_snapshot(lf_zip)
    crlf_members = member_snapshot(crlf_zip)
    assert lf_members == crlf_members, 'archive inventory, metadata or bytes differ'
    expected_names = build_release.expected_archive_names(
        lf_root,
        lf_single.name,
        excluded_paths=(lf_single, lf_zip, lf_hashes),
    )
    assert tuple(member[0] for member in lf_members) == expected_names

    prefix = build_release.ARCHIVE_ROOT + '/'
    member_map = {member[0]: member for member in lf_members}
    assert member_map[prefix + BINARY_FIXTURE.as_posix()][5] == BINARY_BYTES
    for executable in build_release.EXECUTABLE_ARCHIVE_PATHS:
        assert member_map[prefix + executable.as_posix()][4] == 0o100755
    assert member_map[prefix + 'package.json'][4] == 0o100644
    assert member_map[prefix + 'tools/build_release.py'][4] == 0o100644
    assert all(member[1] == build_release.ZIP_TIMESTAMP for member in lf_members)
    assert all(member[2] == zipfile.ZIP_STORED for member in lf_members)

    assert_repeatable(
        lf_root,
        temporary / 'lf-repeat-a',
        temporary / 'lf-repeat-b',
    )
    assert_repeatable(
        crlf_root,
        temporary / 'crlf-repeat-a',
        temporary / 'crlf-repeat-b',
    )

    print({
        'sourceTreeFiles': len(project_files(lf_root)),
        'archiveMembers': len(lf_members),
        'rawTextCheckoutBytes': 'different',
        'canonicalManifest': 'identical',
        'embeddedApplicationSources': 'identical',
        'singleHtml': 'identical',
        'sourceZip': 'identical',
        'checksums': 'identical',
        'inventory': 'exact-and-identical',
        'binaryBytes': 'exact',
        'executableMode': '100755',
        'regularMode': '100644',
        'repeatBuilds': 'identical',
        'verifierLF': lf_result['sourceParity'],
        'verifierCRLF': crlf_result['sourceParity'],
    })
