#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools' / 'validate_clean_candidate.py'


def load_module():
    spec = importlib.util.spec_from_file_location('validate_clean_candidate', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def assert_protected_staged_refusal(module) -> None:
    original_argv = sys.argv[:]
    originals = {
        'root_dirty_paths': module.root_dirty_paths,
        'staged_paths': module.staged_paths,
        'staged_patch_bytes': module.staged_patch_bytes,
        'unique_candidate_dir': module.unique_candidate_dir,
    }

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError('protected staged refusal must happen before candidate cloning or patch reads')

    try:
        sys.argv = [str(SCRIPT)]
        module.root_dirty_paths = lambda: (['assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json'], [])
        module.staged_paths = lambda: ['assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json']
        module.staged_patch_bytes = fail_if_called
        module.unique_candidate_dir = fail_if_called

        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            code = module.main()
        assert code == 2
        payload = json.loads(stderr.getvalue())
        assert payload['status'] == 'REFUSED'
        assert payload['reason'] == 'protected visual-pack paths are staged'
        assert payload['stagedProtectedPaths'] == ['assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json']
        assert payload['protectedRootDirty'] == ['assets/visual_packs/local_working_visuals/VAW_VISUAL_ASSET_PACK_V1.json']
    finally:
        sys.argv = original_argv
        for name, value in originals.items():
            setattr(module, name, value)


def assert_candidate_dirs_are_atomically_unique(module) -> None:
    original_dir = module.AGENT_VALIDATION_DIR
    with tempfile.TemporaryDirectory(prefix='vaw-clean-candidate-test-') as temporary:
        try:
            module.AGENT_VALIDATION_DIR = Path(temporary)
            first = module.unique_candidate_dir('same-label')
            second = module.unique_candidate_dir('same-label')
            assert first != second
            assert first.is_dir() and second.is_dir()
            assert first.parent == module.AGENT_VALIDATION_DIR
            assert second.parent == module.AGENT_VALIDATION_DIR
            assert first.name.startswith('clean-candidate-')
            assert second.name.startswith('clean-candidate-')
        finally:
            module.AGENT_VALIDATION_DIR = original_dir


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
        'tempfile.mkdtemp',
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
    assert_protected_staged_refusal(module)
    assert_candidate_dirs_are_atomically_unique(module)

    print('validate_clean_candidate contract ok')


if __name__ == '__main__':
    main()
