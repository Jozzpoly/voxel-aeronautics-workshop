#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools' / 'validate_clean_candidate.py'


def load_module():
    spec = importlib.util.spec_from_file_location('validate_clean_candidate', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def main() -> None:
    module = load_module()
    source = SCRIPT.read_text(encoding='utf-8')

    assert module.is_protected_path('assets/visual_packs/installed_visual_packs.json')
    assert module.is_protected_path('assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json')
    assert module.is_protected_path(r'assets\visual_packs\local_working_visuals\models\blocks\balloon\model.gltf')
    assert not module.is_protected_path('tools/blockbench_import_studio/app/main.js')

    assert module.AGENT_VALIDATION_DIR == ROOT / '.agent-validation'
    assert module.DEFAULT_COMMAND[-1] == 'tools/validate_full.py'
    assert 'git diff --cached --binary' not in source, 'script should use argv form, not shell strings'
    for snippet in [
        "'diff', '--cached', '--binary'",
        'core.autocrlf=false',
        'core.longpaths=true',
        '.agent-validation',
        "'apply', '--whitespace=nowarn'",
        'protectedRootDirty',
        'stagedProtectedPaths',
        '--allow-protected-staged',
        '--allow-unstaged',
    ]:
        assert snippet in source, f'missing clean-candidate workflow guard: {snippet}'
    assert 'local_working_visuals' in source

    result = subprocess.run(
        [sys.executable, str(SCRIPT), '--help'],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert 'Validate a clean staged/HEAD candidate' in result.stdout
    assert '--head-only' in result.stdout
    assert '--allow-unstaged' in result.stdout
    assert '--allow-protected-staged' in result.stdout

    print('validate_clean_candidate contract ok')


if __name__ == '__main__':
    main()
