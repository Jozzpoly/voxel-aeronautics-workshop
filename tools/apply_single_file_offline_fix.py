#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    source = path.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    path.write_text(source.replace(old, new, 1), encoding='utf-8', newline='\n')


def main() -> None:
    profiles = ROOT / 'src/game/visual-renderer-profiles.js'
    replace_once(
        profiles,
        """if (typeof module === 'object' && module.exports) {
  module.exports = api;
}
""",
        """if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis === 'object' && globalThis.VAW) {
  api.ensureVawModule(globalThis.VAW);
}
""",
        'browser visual renderer profile registration',
    )

    runtime_shell = ROOT / 'src/game/mobile-runtime-shell.js'
    replace_once(
        runtime_shell,
        """  function create(options = {}) {
""",
        """  function createMemoryStorage() {
    const values = new Map();
    return Object.freeze({
      get length() { return values.size; },
      key(index) { return [...values.keys()][Number(index)] ?? null; },
      getItem(key) { key = String(key); return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(String(key), String(value)); },
      removeItem(key) { values.delete(String(key)); },
      clear() { values.clear(); }
    });
  }

  function resolveStorage(options, windowLike) {
    if (Object.prototype.hasOwnProperty.call(options, 'storage') && options.storage) return options.storage;
    try { return windowLike?.localStorage || createMemoryStorage(); }
    catch (_) { return createMemoryStorage(); }
  }

  function create(options = {}) {
""",
        'safe mobile runtime storage helper',
    )
    replace_once(
        runtime_shell,
        """          storage: options.storage || windowLike?.localStorage || null
""",
        """          storage: resolveStorage(options, windowLike)
""",
        'safe mobile runtime storage use',
    )

    build_release = ROOT / 'tools/build_release.py'
    replace_once(
        build_release,
        """    Path('src/runtime/assembly_builder.js'),
    Path('src/game/scene_environment.js'),
""",
        """    Path('src/runtime/assembly_builder.js'),
    Path('src/game/visual-renderer-profiles.js'),
    Path('src/game/scene_environment.js'),
""",
        'embed visual renderer profiles before scene environment',
    )
    replace_once(
        build_release,
        """      if (!window.THREE || !window.CANNON) {{
        showFatal('Required embedded Three.js or Cannon.js runtime is unavailable.');
        return;
      }}
      try {{
""",
        """      if (!window.THREE || !window.CANNON) {{
        showFatal('Required embedded Three.js or Cannon.js runtime is unavailable.');
        return;
      }}
      const __vawMemoryStorage = (() => {{
        const values = new Map();
        return Object.freeze({{
          get length() {{ return values.size; }},
          key(index) {{ return [...values.keys()][Number(index)] ?? null; }},
          getItem(key) {{ key = String(key); return values.has(key) ? values.get(key) : null; }},
          setItem(key, value) {{ values.set(String(key), String(value)); }},
          removeItem(key) {{ values.delete(String(key)); }},
          clear() {{ values.clear(); }}
        }});
      }})();
      const localStorage = (() => {{
        try {{
          const candidate = window.localStorage;
          const probe = '__vaw_offline_probe__';
          candidate.setItem(probe, '1');
          candidate.removeItem(probe);
          return candidate;
        }} catch (_) {{
          try {{
            Object.defineProperty(window, 'localStorage', {{
              configurable: true,
              enumerable: true,
              value: __vawMemoryStorage
            }});
          }} catch (_) {{}}
          return __vawMemoryStorage;
        }}
      }})();
      window.__VAW_OFFLINE_STORAGE_FALLBACK__ = localStorage === __vawMemoryStorage;
      try {{
""",
        'single-file offline storage compatibility',
    )

    index = ROOT / 'index.html'
    replace_once(
        index,
        """        'src/runtime/assembly_builder.js',
        'src/game/scene_environment.js',
""",
        """        'src/runtime/assembly_builder.js',
        'src/game/visual-renderer-profiles.js',
        'src/game/scene_environment.js',
""",
        'development loader visual renderer profiles order',
    )

    print('Applied single-file offline release fix.')


if __name__ == '__main__':
    main()
