#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'tests' / 'run_mobile_browser_smoke.mjs'
source = path.read_text(encoding='utf-8')
old = """    return document.elementFromPoint(x, y) === button ? { x, y } : null;
"""
new = """    const hit = document.elementFromPoint(x, y);
    return hit && (hit === button || button.contains(hit)) ? { x, y } : null;
"""
if source.count(old) != 1:
    raise RuntimeError(f'Expected one shell button hit-test anchor, found {source.count(old)}.')
path.write_text(source.replace(old, new, 1), encoding='utf-8', newline='\n')
print('Updated mobile shell button hit-test to accept button descendants.')
