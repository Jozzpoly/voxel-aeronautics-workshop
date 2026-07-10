from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools' / 'build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

profiles = Path('src/game/visual-renderer-profiles.js')
scene = Path('src/game/scene_environment.js')
parity = Path('src/game/visual-parity-diagnostic.js')
game = Path('src/game.js')

sources = module.EMBEDDED_APPLICATION_SOURCES
assert profiles in sources
assert sources.index(profiles) < sources.index(scene)
assert sources.index(profiles) < sources.index(parity)
assert sources.index(profiles) < sources.index(game)

profile_source = (ROOT / profiles).read_text(encoding='utf-8')
assert "api.ensureVawModule(globalThis.VAW)" in profile_source

runtime_shell = (ROOT / 'src/game/mobile-runtime-shell.js').read_text(encoding='utf-8')
assert 'resolveStorage(options, windowLike)' in runtime_shell
assert 'createMemoryStorage()' in runtime_shell

html = module.build_single_html(ROOT)
assert '/* BEGIN src/game/visual-renderer-profiles.js */' in html
assert html.index('/* BEGIN src/game/visual-renderer-profiles.js */') < html.index('/* BEGIN src/game/scene_environment.js */')
assert html.index('/* BEGIN src/game/visual-renderer-profiles.js */') < html.index('/* BEGIN src/game/visual-parity-diagnostic.js */')
assert html.index('/* BEGIN src/game/visual-renderer-profiles.js */') < html.index('/* BEGIN src/game.js */')
assert 'window.__VAW_OFFLINE_STORAGE_FALLBACK__' in html
assert "const localStorage = (() =>" in html
assert '<script src=' not in html
assert '<link rel="stylesheet" href=' not in html

print({
    'singleFileOfflineContract': 'ok',
    'rendererProfilesEmbedded': True,
    'offlineStorageFallback': True,
    'externalRuntimeDependencies': 0,
})
