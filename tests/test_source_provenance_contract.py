#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    attributes = (ROOT / '.gitattributes').read_text(encoding='utf-8')
    assert '.gitattributes text eol=lf' in attributes, '.gitattributes should not drift between CRLF/LF checkouts'
    assert '*.gltf text eol=lf' in attributes, 'glTF JSON must keep stable LF line endings for provenance hashes'
    assert '*.glb binary' in attributes, 'binary glTF must not be line-ending normalized'

    build_release = (ROOT / 'tools' / 'build_release.py').read_text(encoding='utf-8')
    assert "'.agent-validation'" in build_release, 'release archive must ignore clean-candidate validation worktrees'
    assert 'VISUAL_PACK_SOURCES = files_under(Path(\'assets/visual_packs\'))' in build_release

    helper = (ROOT / 'tools' / 'validate_clean_candidate.py').read_text(encoding='utf-8')
    assert 'SOURCE_MANIFEST' not in helper, 'clean-candidate helper should not hand-edit generated provenance'
    assert 'local_working_visuals' in helper and 'installed_visual_packs.json' in helper
    assert 'clone' in helper and 'apply' in helper, 'helper must validate a separate staged/HEAD candidate'

    agent_entrypoint = (ROOT / 'README_FOR_AGENTS.md').read_text(encoding='utf-8')
    assert 'validate_clean_candidate.py' in agent_entrypoint
    assert 'SOURCE_MANIFEST.json' in agent_entrypoint
    assert 'local_working_visuals' in agent_entrypoint

    print('source provenance contract ok')


if __name__ == '__main__':
    main()
