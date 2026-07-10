#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'tests' / 'run_mobile_browser_smoke.mjs'
source = path.read_text(encoding='utf-8')
old = """    if (!button) return null;
    const rect = button.getBoundingClientRect();
"""
new = """    if (!button) return null;
    button.scrollIntoView({ block: 'nearest', inline: 'center' });
    const rect = button.getBoundingClientRect();
"""
if source.count(old) != 1:
    raise RuntimeError(f'Expected one shell button geometry anchor, found {source.count(old)}.')
path.write_text(source.replace(old, new, 1), encoding='utf-8', newline='\n')
print('Made mobile browser smoke scroll requested shell controls into view before native touch.')
