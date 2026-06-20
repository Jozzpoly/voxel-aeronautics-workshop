from pathlib import Path
import re, collections, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_release import APP_SOURCES
source_files=[ROOT/path for path in APP_SOURCES]
sources={path:path.read_text(encoding='utf-8') for path in source_files}
js='\n'.join(sources.values())
game_paths=[path for path in source_files if path == ROOT/'src/game.js' or path.parent == ROOT/'src/game']
game='\n'.join(sources[path] for path in game_paths)
html=(ROOT/'index.html').read_text(encoding='utf-8')
errors=[]
functions=[]
for path in game_paths:
 file_functions=re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',sources[path])
 functions.extend(file_functions)
 dups=[name for name,count in collections.Counter(file_functions).items() if count>1]
 if dups: errors.append(f'Duplicate functions in {path.relative_to(ROOT)}: {dups}')
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
if 'const SAVE_VERSION = 12' not in js: errors.append('Unexpected save version')
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
 'foundation.blueprint', 'foundation.craft-model', 'foundation.craft-history', 'foundation.control-frame', 'foundation.mass-properties', 'foundation.craft-compiler', 'foundation.runtime-assembly', 'foundation.input-profile', 'foundation.ui-workspace', 'foundation.mission-evaluator', 'foundation.aerostatics', 'foundation.flight-control', 'foundation.fixed-step-scheduler', 'foundation.state', 'runtime.physics-port', 'runtime.cannon-physics-backend', 'runtime.headless-physics-backend', 'runtime.assembly-builder',
 'game.scene-environment', 'game.career-service', 'game.workspace-controller',
 'game.input-settings-controller', 'game.orientation-service', 'game.module-visual-factory', 'game.assembly-space-controller',
 'game.engineering-analysis', 'game.blueprint-controller', 'game.mission-controller',
 'game.flight-session', 'game.flight-integrity'
]:
 if not re.search(r"window\.VAW\.define\(\s*['\"]" + re.escape(expected) + r"['\"]", js): errors.append(f'Missing module definition: {expected}')


aerostatics=sources[ROOT/'src/foundation/aerostatics.js']
for forbidden in ('THREE.', 'CANNON.', 'document.', 'HTMLElement', 'window.innerWidth'):
 if forbidden in aerostatics: errors.append(f'Aerostatics leaks runtime/presentation dependency: {forbidden}')

mission_evaluator=sources[ROOT/'src/foundation/mission_evaluator.js']
for forbidden in ('THREE.', 'CANNON.', 'document.', 'HTMLElement', 'window.innerWidth'):
 if forbidden in mission_evaluator: errors.append(f'Mission evaluator leaks runtime/presentation dependency: {forbidden}')

physics_port=sources[ROOT/'src/runtime/physics_port.js']
for forbidden in ('THREE.', 'CANNON.', 'document.', 'HTMLElement'):
 if forbidden in physics_port: errors.append(f'Physics port leaks backend/presentation dependency: {forbidden}')
for forbidden in ('new CANNON.World', 'new CANNON.Body', 'new CANNON.Box', 'new CANNON.Plane', 'world.addBody(', 'world.removeBody(', 'world.step('):
 if forbidden in game: errors.append(f'game.js bypasses physics lifecycle boundary: {forbidden}')

for path in source_files:
 check=subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
 if check.returncode: errors.append(f'{path.name}: {check.stderr.strip()}')
if errors:
 print('\n'.join(errors)); sys.exit(1)
print(f'OK: {len(functions)} unique game functions, {len(ids)} unique HTML ids, {len(source_files)} ordered application sources.')
