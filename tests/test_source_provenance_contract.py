#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    attributes = (ROOT / '.gitattributes').read_text(encoding='utf-8')
    assert '.gitattributes text eol=lf' in attributes, '.gitattributes should not drift between CRLF/LF checkouts'
    assert '*.gltf text eol=lf' in attributes, 'glTF JSON must keep stable LF line endings for provenance hashes'
    assert '*.glb binary' in attributes, 'binary glTF must not be line-ending normalized'

    build_release = (ROOT / 'tools' / 'build_release.py').read_text(encoding='utf-8')
    assert "'.agent-validation'" in build_release, 'release archive must ignore clean-candidate validation worktrees'
    assert 'def visual_pack_sources(root: Path = ROOT)' in build_release
    assert 'def studio_tool_sources(root: Path = ROOT)' in build_release
    assert 'def manifest_inputs(root: Path = ROOT)' in build_release
    assert 'def canonical_source_bytes(' in build_release
    assert 'def expected_archive_names(' in build_release
    assert 'ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)' in build_release
    assert 'BASE_MANIFEST_INPUTS[:' not in build_release

    verify_release = (ROOT / 'tools' / 'verify_release.py').read_text(encoding='utf-8')
    assert 'def verify_artifacts(' in verify_release
    assert 'canonical_source_bytes(root, relative)' in verify_release
    assert 'manifest_inputs(root)' in verify_release

    helper = (ROOT / 'tools' / 'validate_clean_candidate.py').read_text(encoding='utf-8')
    assert 'SOURCE_MANIFEST' not in helper, 'clean-candidate helper should not hand-edit generated provenance'
    assert 'local_working_visuals' in helper and 'installed_visual_packs.json' in helper
    assert 'clone' in helper and 'apply' in helper, 'helper must validate a separate staged/HEAD candidate'

    scripts = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['scripts']
    assert scripts['validate:fast'] == 'node tools/run_with_python_env.js python tools/validate_fast.py'
    assert scripts['validate:full'] == 'node tools/run_with_python_env.js python tools/validate_full.py'
    assert scripts['validate:clean'] == 'node tools/run_with_python_env.js python tools/validate_clean_candidate.py --name validate-full'
    assert scripts['validate:clean:fast'] == (
        'node tools/run_with_python_env.js python tools/validate_clean_candidate.py --name validate-fast -- '
        'node tools/run_with_python_env.js python tools/validate_fast.py'
    )

    release_test = (ROOT / 'tests' / 'test_release_build.py').read_text(encoding='utf-8')
    assert 'ensure_source_manifest(ROOT)' not in release_test, 'release-build test must not mutate root provenance'
    assert 'SOURCE_MANIFEST.json is stale' in release_test
    assert 'def expected_archive_names(' not in release_test
    assert 'module.expected_archive_names(ROOT, single.name)' in release_test

    agent_entrypoint = (ROOT / 'README_FOR_AGENTS.md').read_text(encoding='utf-8')
    assert 'validate_clean_candidate.py' in agent_entrypoint
    assert 'npm run validate:clean' in agent_entrypoint
    assert 'npm run validate:clean:fast' in agent_entrypoint
    assert 'SOURCE_MANIFEST.json' in agent_entrypoint
    assert 'local_working_visuals' in agent_entrypoint

    print('source provenance contract ok')


if __name__ == '__main__':
    main()
