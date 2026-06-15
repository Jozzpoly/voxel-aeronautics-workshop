from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools' / 'build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory() as temporary:
    temporary = Path(temporary)
    single = temporary / 'game.html'
    archive = temporary / 'project.zip'
    hashes = temporary / 'SHA256.txt'
    single.write_text(module.build_single_html(ROOT), encoding='utf-8')
    module.write_zip(ROOT, archive)
    hashes.write_text(f'{module.sha256(single)}  {single.name}\n{module.sha256(archive)}  {archive.name}\n', encoding='utf-8')

    text = single.read_text(encoding='utf-8')
    assert text.count('BEGIN EMBEDDED APPLICATION') == 1
    assert text.count('BEGIN EMBEDDED STYLES') == 1
    assert "gameScript.src = 'src/game.js'" not in text
    assert 'href="styles.css"' not in text

    start = text.index('/* BEGIN EMBEDDED APPLICATION */')
    end = text.index('/* END EMBEDDED APPLICATION */')
    embedded = text[start + len('/* BEGIN EMBEDDED APPLICATION */'):end].strip()
    extracted = temporary / 'embedded_game.js'
    extracted.write_text(embedded, encoding='utf-8')
    subprocess.run(['node', '--check', str(extracted)], check=True)

    with zipfile.ZipFile(archive) as zipped:
        names = set(zipped.namelist())
        prefix = ROOT.name + '/'
        required = {
            prefix + 'index.html', prefix + 'styles.css', prefix + 'src/game.js',
            prefix + 'README.md', prefix + 'CHANGELOG.md', prefix + 'CRITICAL_REVIEW.md',
            prefix + 'AI_PROJECT_MEMORY.md', prefix + 'ARCHITECTURE.md', prefix + 'FOUNDATION_REVIEW.md',
            prefix + 'ROADMAP_NEXT.md', prefix + 'TEST_REPORT.md', prefix + 'VALIDATION_REPORT.md',
            prefix + 'docs/adr/0004-craft-model-is-authoritative.md',
            prefix + 'docs/adr/0005-atomic-editor-transactions-and-history.md',
            prefix + 'tools/build_release.py',
            prefix + 'tests/test_audit_regressions.py',
            prefix + 'src/foundation/kernel.js', prefix + 'src/foundation/config.js',
            prefix + 'src/foundation/catalog.js', prefix + 'src/foundation/orientation.js',
            prefix + 'src/foundation/blueprint.js', prefix + 'src/foundation/craft_model.js', prefix + 'src/foundation/craft_history.js', prefix + 'src/foundation/state.js',
            prefix + 'src/foundation/bootstrap.js',
        }
        missing = required - names
        assert not missing, f'missing release files: {sorted(missing)}'
        assert not any('/dist/' in name for name in names)

print({'single_file_syntax': 'ok', 'zip_contents': 'ok', 'sha256_generation': 'ok'})
