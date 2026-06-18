from __future__ import annotations

import hashlib
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
BUILD = (ROOT / 'tools/build_release.py').read_text(encoding='utf-8')
NOTICES = (ROOT / 'THIRD_PARTY_NOTICES.md').read_text(encoding='utf-8')

external_scripts = re.findall(r'<script[^>]+src=["\'](https?://[^"\']+)', HTML)
assert external_scripts == [], external_scripts
assert 'cdn.tailwindcss.com' not in HTML
assert 'unpkg.com/cannon' not in HTML
assert '<script src="vendor/three-r128/three.min.js"></script>' in HTML
assert '<script src="vendor/cannon-0.6.2/cannon.min.js"></script>' in HTML
assert '<link rel="stylesheet" href="tailwind.generated.css" />' in HTML

three = ROOT / 'vendor/three-r128/three.min.js'
three_license = ROOT / 'vendor/three-r128/LICENSE'
assert three.stat().st_size == 603445
assert hashlib.sha256(three.read_bytes()).hexdigest() == '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2'
assert 'Copyright © 2010-2021 three.js authors' in three_license.read_text(encoding='utf-8')
cannon = ROOT / 'vendor/cannon-0.6.2/cannon.min.js'
license_file = ROOT / 'vendor/cannon-0.6.2/LICENSE'
assert cannon.stat().st_size == 132199
assert hashlib.sha256(cannon.read_bytes()).hexdigest() == '54e8b646e97daef2cff3c7af99fcd0fe768dc74e7d46498f68a869c7dc9dc906'
assert 'Permission is hereby granted, free of charge' in license_file.read_text(encoding='utf-8')
assert "Path('vendor/cannon-0.6.2/cannon.min.js')" in BUILD
assert "Path('tailwind.generated.css')" in BUILD
assert "Path('vendor/three-r128/three.min.js')" in BUILD
assert 'BEGIN EMBEDDED THREE R128' in BUILD
assert 'BEGIN EMBEDDED CANNON 0.6.2' in BUILD

check = subprocess.run(
    ['node', 'tools/generate_tailwind_css.js', '--check'],
    cwd=ROOT,
    capture_output=True,
    text=True,
)
assert check.returncode == 0, check.stdout + check.stderr
css = (ROOT / 'tailwind.generated.css').read_text(encoding='utf-8')
for selector in ('.flex', '.grid', '.text-white', '.rounded', '.w-full'):
    assert selector in css, selector

assert 'no network-loaded production dependency' in NOTICES
assert 'browser does not execute Tailwind or load it from a CDN' in NOTICES

print({
    'externalRuntimeScripts': external_scripts,
    'threeVendored': True,
    'tailwindRuntimeCdn': False,
    'cannonVendored': True,
    'generatedCssCurrent': True,
})
