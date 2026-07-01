from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools' / 'build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def embedded_source(single_text: str, relative: Path) -> str:
    begin = f'/* BEGIN {relative.as_posix()} */\n'
    end = f'\n/* END {relative.as_posix()} */'
    start = single_text.index(begin) + len(begin)
    finish = single_text.index(end, start)
    return single_text[start:finish]


assert '.agent-validation' in module.IGNORED_ARCHIVE_PARTS

manifest_path = ROOT / module.MANIFEST_NAME
expected_manifest_text = module.manifest_text(ROOT)
actual_manifest_text = manifest_path.read_text(encoding='utf-8')
assert actual_manifest_text == expected_manifest_text, (
    'SOURCE_MANIFEST.json is stale. Regenerate it from a clean candidate; '
    'if protected local visual work is dirty, validate release evidence with '
    'tools/validate_clean_candidate.py instead of root npm test. The release-build '
    'test must not update tracked provenance as a side effect.'
)
manifest = json.loads(actual_manifest_text)
assert manifest['releaseId'] == module.RELEASE_ID
assert manifest['appVersion'] == module.APP_VERSION
assert module.MANIFEST_INPUTS == module.manifest_inputs(ROOT)
for relative in module.manifest_inputs(ROOT):
    actual_hash = module.sha256_bytes(module.canonical_source_bytes(ROOT, relative))
    assert manifest['files'][relative.as_posix()] == actual_hash

with tempfile.TemporaryDirectory() as temporary:
    temporary = Path(temporary)
    single = temporary / module.SINGLE_NAME
    archive = temporary / module.ZIP_NAME
    second_single = temporary / ('second-' + module.SINGLE_NAME)
    second_archive = temporary / ('second-' + module.ZIP_NAME)

    single.write_text(module.build_single_html(ROOT), encoding='utf-8', newline='\n')
    module.write_zip(ROOT, archive, single)
    second_single.write_text(module.build_single_html(ROOT), encoding='utf-8', newline='\n')
    module.write_zip(ROOT, second_archive, second_single)

    text = single.read_text(encoding='utf-8')
    assert text.count('BEGIN EMBEDDED APPLICATION') == 1
    assert text.count('BEGIN EMBEDDED STYLES') == 1
    assert f'RELEASE_ID: {module.RELEASE_ID}' in text
    assert f'APP_VERSION: {module.APP_VERSION}' in text
    assert 'href="styles.css"' not in text

    for relative in module.APP_SOURCES:
        expected = (ROOT / relative).read_text(encoding='utf-8').rstrip()
        actual = embedded_source(text, relative)
        assert actual == expected, f'single-file source mismatch: {relative}'

    start = text.index('/* BEGIN EMBEDDED APPLICATION */')
    end = text.index('/* END EMBEDDED APPLICATION */')
    embedded = text[start + len('/* BEGIN EMBEDDED APPLICATION */'):end].strip()
    extracted = temporary / 'embedded_game.js'
    extracted.write_text(embedded, encoding='utf-8')
    subprocess.run(['node', '--check', str(extracted)], check=True)

    prefix = module.ARCHIVE_ROOT + '/'
    with zipfile.ZipFile(archive) as zipped:
        inventory = tuple(zipped.namelist())
        expected_inventory = module.expected_archive_names(ROOT, single.name)
        assert inventory == expected_inventory, {
            'missing': sorted(set(expected_inventory) - set(inventory)),
            'unexpected': sorted(set(inventory) - set(expected_inventory)),
        }
        names = set(inventory)

        required_docs = {
            prefix + 'docs/README.md',
            prefix + 'docs/history/phases/README.md',
            prefix + 'docs/history/phases/PHASE_1D4A_REPORT.md',
            prefix + 'docs/history/reviews/README.md',
            prefix + 'docs/history/reviews/FOUNDATION_REVIEW.md',
            prefix + 'docs/history/reviews/CRITICAL_REVIEW.md',
            prefix + 'docs/history/reviews/GAME_MODULARIZATION_REVIEW.md',
            prefix + 'docs/history/reviews/CODE_REVIEW_REPORT.md',
            prefix + 'docs/history/reviews/HOTFIX_REPORT.md',
            prefix + 'docs/history/reviews/FOUNDATION_CONVERGENCE_REVIEW.md',
            prefix + 'docs/history/validation/README.md',
            prefix + 'docs/history/validation/TEST_REPORT.md',
            prefix + 'docs/history/validation/VALIDATION_REPORT.md',
            prefix + 'docs/recovery/README.md',
            prefix + 'docs/recovery/BROWSER_RECOVERY_SCENARIO_2026-06-16.md',
            prefix + 'docs/repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md',
            prefix + 'docs/adr/0042-workbench-ui-layout.md',
            prefix + 'docs/adr/0043-visual-asset-boundary.md',
            prefix + 'AI_PROJECT_MEMORY.md',
            prefix + 'AGENT_WORKFLOW.md',
            prefix + 'DELIVERY_WORKFLOW.md',
            prefix + 'PUSH_INSTRUCTIONS.md',
        }
        assert required_docs <= names, f'missing classified documentation: {sorted(required_docs - names)}'

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
                'CODE_REVIEW_REPORT.md',
                'TEST_REPORT.md',
                'VALIDATION_REPORT.md',
                'HOTFIX_REPORT.md',
                'FOUNDATION_CONVERGENCE_REVIEW.md',
                'BROWSER_RECOVERY_SCENARIO_2026-06-16.md',
                'RECOVERY_AUDIT_2026-06-16.md',
                'RECOVERY_BASELINE_TESTS.md',
                'RECOVERY_DELIVERY_2026-06-16.md',
                'RECOVERY_VALIDATION_REPORT_2026-06-16.md',
            )},
        }
        assert not (forbidden_root_docs & names), (
            f'old root documentation paths remain in ZIP: '
            f'{sorted(forbidden_root_docs & names)}'
        )

        for relative in module.manifest_inputs(ROOT):
            archived = zipped.read(prefix + relative.as_posix())
            assert archived == module.canonical_source_bytes(ROOT, relative), f'ZIP source mismatch: {relative}'

        assert zipped.read(prefix + 'release/' + single.name) == single.read_bytes()
        packaged_hash = zipped.read(prefix + 'release/SHA256.txt').decode('utf-8')
        assert packaged_hash == f'{module.sha256(single)}  {single.name}\n'

    assert single.read_bytes() == second_single.read_bytes(), 'single-file build is not deterministic'

    same_name_single = temporary / 'repeat' / module.SINGLE_NAME
    same_name_single.parent.mkdir()
    same_name_single.write_bytes(second_single.read_bytes())
    same_name_archive = temporary / 'repeat' / module.ZIP_NAME
    module.write_zip(ROOT, same_name_archive, same_name_single)
    assert archive.read_bytes() == same_name_archive.read_bytes(), 'ZIP build is not deterministic'

print({
    'releaseBuild': 'ok',
    'archiveInventory': 'exact',
    'documentationClassification': 'ok',
    'singleDeterministic': True,
    'zipDeterministic': True,
})
