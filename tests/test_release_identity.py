from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
manifest = json.loads((ROOT / 'SOURCE_MANIFEST.json').read_text(encoding='utf-8'))
config = (ROOT / 'src/foundation/config.js').read_text(encoding='utf-8')
html = (ROOT / 'index.html').read_text(encoding='utf-8')

spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools/build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

version_match = re.search(r"const APP_VERSION = '([^']+)';", config)
release_match = re.search(r"const RELEASE_ID = '([^']+)';", config)
assert version_match and release_match
runtime_version = version_match.group(1)
runtime_release = release_match.group(1)

assert package['version'] == module.APP_VERSION == manifest['appVersion'] == runtime_version
assert module.RELEASE_ID == manifest['releaseId'] == runtime_release
assert 'Foundation Phase 1D.3C' in html
assert module.APP_VERSION in module.build_single_html(ROOT)
assert module.RELEASE_ID in module.build_single_html(ROOT)

print({
    'appVersion': runtime_version,
    'releaseId': runtime_release,
    'packageBuildManifestRuntimeParity': 'ok',
    'htmlBranding': 'ok',
})
