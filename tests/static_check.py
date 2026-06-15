from pathlib import Path
import re, collections, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
source_files=[
 ROOT/'src/foundation/kernel.js', ROOT/'src/foundation/config.js', ROOT/'src/foundation/catalog.js',
 ROOT/'src/foundation/orientation.js', ROOT/'src/foundation/blueprint.js', ROOT/'src/foundation/craft_model.js', ROOT/'src/foundation/craft_history.js', ROOT/'src/foundation/control_frame.js', ROOT/'src/foundation/craft_compiler.js', ROOT/'src/foundation/input_profile.js', ROOT/'src/foundation/ui_workspace.js', ROOT/'src/foundation/flight_control.js', ROOT/'src/foundation/state.js',
 ROOT/'src/foundation/bootstrap.js', ROOT/'src/game.js'
]
sources={path:path.read_text(encoding='utf-8') for path in source_files}
js='\n'.join(sources.values())
game=sources[ROOT/'src/game.js']
html=(ROOT/'index.html').read_text(encoding='utf-8')
errors=[]
functions=re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',game)
dups=[name for name,count in collections.Counter(functions).items() if count>1]
if dups: errors.append(f'Duplicate game functions: {dups}')
ids=re.findall(r'id=["\']([^"\']+)',html)
dup_ids=[name for name,count in collections.Counter(ids).items() if count>1]
if dup_ids: errors.append(f'Duplicate HTML ids: {dup_ids}')
refs=set(re.findall(r"getElementById\(['\"]([^'\"]+)",game))
missing=sorted(refs-set(ids))
if missing: errors.append(f'Missing HTML ids: {missing}')
if html.count('<div') != html.count('</div>'): errors.append('Unbalanced div tags')
loader_match=re.search(r"const sources = \[(.*?)\];", html, flags=re.S)
if not loader_match:
 errors.append('Application source loader was not found')
else:
 loader_sources=re.findall(r"['\"]([^'\"]+\.js)['\"]", loader_match.group(1))
 expected_sources=[path.relative_to(ROOT).as_posix() for path in source_files]
 if loader_sources != expected_sources:
  errors.append(f'Loader order mismatch: {loader_sources} != {expected_sources}')
if 'const SAVE_VERSION = 9' not in js: errors.append('Unexpected save version')
if 'voxel-aeronautics-blueprint-v6' not in js: errors.append('Missing v6 migration key')

craft_model=sources[ROOT/'src/foundation/craft_model.js']
for forbidden in ('THREE.', 'CANNON.', 'document.', 'HTMLElement', '.mesh'):
 if forbidden in craft_model: errors.append(f'CraftModel leaks renderer/runtime dependency: {forbidden}')
compiler_model=sources[ROOT/'src/foundation/craft_compiler.js']
for forbidden in ('CANNON.', 'document.', 'HTMLElement', '.mesh'):
 if forbidden in compiler_model: errors.append(f'CraftCompiler leaks runtime dependency: {forbidden}')
history_model=sources[ROOT/'src/foundation/craft_history.js']
for forbidden in ('THREE.', 'CANNON.', 'document.', 'HTMLElement', '.mesh'):
 if forbidden in history_model: errors.append(f'CraftHistory leaks renderer/runtime dependency: {forbidden}')
if 'STATE.voxels' in game: errors.append('Legacy STATE.voxels coupling still exists in game.js')
if 'meshesByKey' not in game: errors.append('Workshop view map is missing')
for expected in [
 'foundation.config', 'foundation.catalog', 'foundation.orientation',
 'foundation.blueprint', 'foundation.craft-model', 'foundation.craft-history', 'foundation.control-frame', 'foundation.craft-compiler', 'foundation.input-profile', 'foundation.ui-workspace', 'foundation.flight-control', 'foundation.state'
]:
 if not re.search(r"window\.VAW\.define\(\s*['\"]" + re.escape(expected) + r"['\"]", js): errors.append(f'Missing module definition: {expected}')
for path in source_files:
 check=subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
 if check.returncode: errors.append(f'{path.name}: {check.stderr.strip()}')
if errors:
 print('\n'.join(errors)); sys.exit(1)
print(f'OK: {len(functions)} unique game functions, {len(ids)} unique HTML ids, {len(source_files)} ordered application sources.')
