from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

import build_release as module  # noqa: E402
import verify_release  # noqa: E402


def embedded_source(single_text: str, relative: Path) -> str:
    begin = f'/* BEGIN {relative.as_posix()} */\n'
    end = f'\n/* END {relative.as_posix()} */'
    start = single_text.index(begin) + len(begin)
    finish = single_text.index(end, start)
    return single_text[start:finish]


def write_checksums(single: Path, archive: Path, destination: Path) -> None:
    destination.write_text(
        f'{module.sha256(single)}  {single.name}\n'
        f'{module.sha256(archive)}  {archive.name}\n',
        encoding='utf-8',
        newline='\n',
    )


def build(output: Path) -> tuple[Path, Path, Path]:
    output.mkdir(parents=True, exist_ok=True)
    single = output / module.SINGLE_NAME
    archive = output / module.ZIP_NAME
    hashes = output / 'SHA256.txt'
    single.write_text(module.build_single_html(ROOT), encoding='utf-8', newline='\n')
    module.write_zip(ROOT, archive, single)
    write_checksums(single, archive, hashes)
    return single, archive, hashes


assert '.agent-validation' in module.IGNORED_ARCHIVE_PARTS
assert module.SOURCE_BYTE_CONTRACT == {
    'text': 'utf-8-lf',
    'binary': 'byte-exact',
    'archive': 'deterministic-stored-zip-v1',
}

module.ensure_source_manifest(ROOT)
manifest_path = ROOT / module.MANIFEST_NAME
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest == module.source_manifest(ROOT)
for relative in module.MANIFEST_INPUTS:
    assert manifest['files'][relative.as_posix()] == module.sha256_source(ROOT, relative)

with tempfile.TemporaryDirectory(prefix='vaw-release-build-') as temporary_text:
    temporary = Path(temporary_text)
    single, archive, hashes = build(temporary / 'first')
    second_single, second_archive, second_hashes = build(temporary / 'second')

    result = verify_release.verify_artifacts(ROOT, single, archive, hashes)
    assert result['sourceParity'] == 'ok'
    assert result['zipSourceParity'] == 'ok'
    assert result['zipInventory'] == 'exact'
    assert result['zipMetadata'] == 'deterministic'

    text = single.read_text(encoding='utf-8')
    assert text.count('BEGIN EMBEDDED APPLICATION') == 1
    assert text.count('BEGIN EMBEDDED STYLES') == 1
    assert f'RELEASE_ID: {module.RELEASE_ID}' in text
    assert f'APP_VERSION: {module.APP_VERSION}' in text
    assert 'href="styles.css"' not in text

    for relative in module.APP_SOURCES:
        expected = module.canonical_source_text(ROOT, relative).rstrip()
        actual = embedded_source(text, relative)
        assert actual == expected, f'single-file canonical source mismatch: {relative}'

    start = text.index('/* BEGIN EMBEDDED APPLICATION */')
    end = text.index('/* END EMBEDDED APPLICATION */')
    embedded = text[start + len('/* BEGIN EMBEDDED APPLICATION */'):end].strip()
    extracted = temporary / 'embedded_game.js'
    extracted.write_text(embedded, encoding='utf-8', newline='\n')
    subprocess.run(['node', '--check', str(extracted)], check=True)

    prefix = module.ARCHIVE_ROOT + '/'
    with zipfile.ZipFile(archive) as zipped:
        infos = zipped.infolist()
        names = tuple(info.filename for info in infos)
        expected_names = module.expected_archive_names(
            ROOT,
            single.name,
            excluded_paths=(single, archive, hashes),
        )
        assert names == expected_names, {
            'missing': sorted(set(expected_names) - set(names)),
            'unexpected': sorted(set(names) - set(expected_names)),
            'orderMismatch': names != expected_names,
        }
        assert len(names) == len(set(names)), 'release ZIP contains duplicate members'
        assert zipped.testzip() is None

        required_docs = {
            prefix + 'docs/README.md',
            prefix + 'docs/history/phases/README.md',
            prefix + 'docs/history/phases/PHASE_1D4A_REPORT.md',
            prefix + 'docs/history/reviews/README.md',
            prefix + 'docs/history/reviews/FOUNDATION_REVIEW.md',
            prefix + 'docs/history/reviews/CRITICAL_REVIEW.md',
            prefix + 'docs/history/reviews/GAME_MODULARIZATION_REVIEW.md',
            prefix + 'docs/repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md',
            prefix + 'docs/repository/CROSS_PLATFORM_RELEASE_REPRODUCIBILITY_STAGE1_1.md',
            prefix + 'AI_PROJECT_MEMORY.md',
            prefix + 'AGENT_WORKFLOW.md',
            prefix + 'DELIVERY_WORKFLOW.md',
            prefix + 'PUSH_INSTRUCTIONS.md',
            prefix + 'CODE_REVIEW_REPORT.md',
            prefix + 'TEST_REPORT.md',
            prefix + 'VALIDATION_REPORT.md',
        }
        assert required_docs <= set(names), (
            f'missing classified documentation: {sorted(required_docs - set(names))}'
        )

        forbidden_root_docs = {
            prefix + 'FOUNDATION_REVIEW.md',
            prefix + 'CRITICAL_REVIEW.md',
            prefix + 'GAME_MODULARIZATION_REVIEW.md',
            *{prefix + name for name in (
                'PHASE_1C2_REPORT.md',
                'PHASE_1D1_REPORT.md',
                'PHASE_1D2_REPORT.md',
                'PHASE_1D2A_REPORT.md',
                'PHASE_1D2B_REPORT.md',
                'PHASE_1D2C_REPORT.md',
                'PHASE_1D2D_REPORT.md',
                'PHASE_1D2E_REPORT.md',
                'PHASE_1D2F_REPORT.md',
                'PHASE_1D3A_REPORT.md',
                'PHASE_1D3B_REPORT.md',
                'PHASE_1D3B1_REPORT.md',
                'PHASE_1D3C_REPORT.md',
                'PHASE_1D3D_REPORT.md',
                'PHASE_1D3E_REPORT.md',
                'PHASE_1D4A_REPORT.md',
            )},
        }
        assert not (forbidden_root_docs & set(names)), (
            f'old root documentation paths remain in ZIP: '
            f'{sorted(forbidden_root_docs & set(names))}'
        )

        for relative in module.iter_archive_files(ROOT, (single, archive, hashes)):
            archived = zipped.read(prefix + relative.as_posix())
            expected = module.canonical_source_bytes(ROOT, relative)
            assert archived == expected, f'ZIP canonical source mismatch: {relative}'

        for info in infos:
            assert info.date_time == module.ZIP_TIMESTAMP
            assert info.compress_type == zipfile.ZIP_STORED
            assert info.create_system == 3
            relative_text = info.filename.removeprefix(prefix)
            expected_mode = (
                0o100644
                if relative_text.startswith('release/')
                else module.archive_file_mode(Path(relative_text))
            )
            assert (info.external_attr >> 16) & 0o177777 == expected_mode

        for executable in module.EXECUTABLE_ARCHIVE_PATHS:
            assert zipped.getinfo(prefix + executable.as_posix()).external_attr >> 16 == 0o100755
        assert zipped.getinfo(prefix + 'package.json').external_attr >> 16 == 0o100644
        assert zipped.getinfo(prefix + 'tools/build_release.py').external_attr >> 16 == 0o100644
        assert zipped.read(prefix + 'release/' + single.name) == single.read_bytes()
        packaged_hash = zipped.read(prefix + 'release/SHA256.txt').decode('utf-8')
        assert packaged_hash == f'{module.sha256(single)}  {single.name}\n'

    assert single.read_bytes() == second_single.read_bytes(), (
        'single-file build is not deterministic'
    )
    assert archive.read_bytes() == second_archive.read_bytes(), (
        'ZIP build is not deterministic'
    )
    assert hashes.read_bytes() == second_hashes.read_bytes(), (
        'checksum file is not deterministic'
    )

print({
    'releaseBuild': 'ok',
    'archiveInventory': 'exact-and-ordered',
    'sourceByteContract': module.SOURCE_BYTE_CONTRACT,
    'documentationClassification': 'ok',
    'singleDeterministic': True,
    'zipDeterministic': True,
    'verifier': 'ok',
})
