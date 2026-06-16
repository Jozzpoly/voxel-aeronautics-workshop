from __future__ import annotations

import re
from pathlib import Path

from source_inventory import GAME_PATHS, ROOT, SOURCE_PATHS, function_source

GAME_MAIN = ROOT / 'src/game.js'
GAME_MODULE_DIR = ROOT / 'src/game'
EXPECTED_MODULES = {
    'scene_environment.js': 'game.scene-environment',
    'career_service.js': 'game.career-service',
    'workspace_controller.js': 'game.workspace-controller',
    'input_settings_controller.js': 'game.input-settings-controller',
    'orientation_service.js': 'game.orientation-service',
    'module_visual_factory.js': 'game.module-visual-factory',
    'engineering_analysis.js': 'game.engineering-analysis',
    'blueprint_controller.js': 'game.blueprint-controller',
    'mission_controller.js': 'game.mission-controller',
    'flight_session.js': 'game.flight-session',
    'flight_thruster_router.js': 'game.flight-thruster-router',
    'flight_integrity.js': 'game.flight-integrity',
    'debris_runtime.js': 'game.debris-runtime',
}

paths = {path.name: path for path in GAME_PATHS if path.parent == GAME_MODULE_DIR}
assert set(paths) == set(EXPECTED_MODULES), (set(paths), set(EXPECTED_MODULES))

for filename, module_name in EXPECTED_MODULES.items():
    source = paths[filename].read_text(encoding='utf-8')
    pattern = rf"window\.VAW\.define\(\s*['\"]{re.escape(module_name)}['\"]"
    assert len(re.findall(pattern, source)) == 1, f'{filename} must define {module_name} exactly once'
    assert 'window.VAW_RUNTIME' not in source, f'{filename} bypasses explicit module injection'
    assert 'src/game.js' not in source, f'{filename} depends on the monolithic entrypoint'

ordered = [path.relative_to(ROOT).as_posix() for path in SOURCE_PATHS]
bootstrap_index = ordered.index('src/foundation/bootstrap.js')
entry_index = ordered.index('src/game.js')
for filename in EXPECTED_MODULES:
    assert ordered.index(f'src/game/{filename}') < bootstrap_index
assert entry_index == len(ordered) - 1, 'game.js must remain the final composition entrypoint'

main = GAME_MAIN.read_text(encoding='utf-8')
assert 'window.VAW_RUNTIME' not in main, 'composition root must use explicit kernel modules, not a private aggregate global'
assert "window.VAW.require('runtime.active-context')" in main
assert len(main.splitlines()) <= 2500, f'game.js regrew to {len(main.splitlines())} lines'
assert len(main.encode('utf-8')) <= 120_000, f'game.js regrew to {len(main.encode("utf-8"))} bytes'

ownership = {
    'createModuleVisual': 'module_visual_factory.js',
    'computeCraftAnalysis': 'engineering_analysis.js',
    'loadBlueprintData': 'blueprint_controller.js',
    'updateMission': 'mission_controller.js',
    'normalizeCareerData': 'career_service.js',
    'applyWorkspaceLayout': 'workspace_controller.js',
    'commitBindingCapture': 'input_settings_controller.js',
}
for function_name, owner in ownership.items():
    owners = [path.name for path in GAME_PATHS if f'function {function_name}(' in path.read_text(encoding='utf-8')]
    assert owners == [owner], f'{function_name} ownership mismatch: {owners}'

for module_name in EXPECTED_MODULES.values():
    assert f"window.VAW.require('{module_name}')" in main, f'entrypoint does not compose {module_name}'


for leaked_private in ('autosaveTimer', 'workspaceSaveTimer', 'keyboardLockActive'):
    assert leaked_private not in main, f'entrypoint reaches into private module state: {leaked_private}'
assert "document.addEventListener('fullscreenchange', handleFullscreenChange)" in main
assert 'flushPendingAutosave();' in main and 'flushPendingSave();' in main

assert 'AssemblyBuilder.build({' not in main, 'composition root must not construct RuntimeAssembly directly'
build_flight_body = function_source('buildFlightBody')
assert 'flightSession.start({' in build_flight_body
assert 'AssemblyBuilder.build({' not in build_flight_body
assert 'Physics.createBody({' not in build_flight_body
assert 'Physics.addBoxCollider(' not in build_flight_body
assert 'Physics.createBody({' not in main, 'composition root must delegate debris allocation to DebrisRuntime'
assert 'Physics.removeBody(' not in main, 'composition root must delegate debris cleanup to DebrisRuntime'
flight_session_source = paths['flight_session.js'].read_text(encoding='utf-8')
assert flight_session_source.count('AssemblyBuilder.build({') == 1
assert 'state.flight.assembly = nextRuntime' in flight_session_source
assert 'cleanupPending' in flight_session_source and 'retry stop()' in flight_session_source
flight_integrity_source = paths['flight_integrity.js'].read_text(encoding='utf-8')
assert 'per-rigid-island-static-frame-guard' in flight_integrity_source
assert 'connected-body-recenter-blocked' in flight_integrity_source
assert 'mechanical-endpoint-failure' in flight_integrity_source
assert 'Backend rejected collider removal' in flight_integrity_source
assert 'state.flight.primaryBody || state.flight.body' not in flight_integrity_source
assert 'STATE.flight.body' not in main, 'game.js must use FlightSession rather than the deprecated native-body alias'
assert 'assemblyRuntime' not in main and 'flight.group' not in main
assert not __import__('re').search(r'\bprimaryBody\b', main)
assert 'STATE.flight.body' not in paths['mission_controller.js'].read_text(encoding='utf-8')
assert 'STATE.flight.bodyById' not in main and 'STATE.flight.bodies' not in main
for path in GAME_MODULE_DIR.glob('*.js'):
    if path.name in {'scene_environment.js', 'flight_session.js', 'debris_runtime.js'}:
        continue
    source = path.read_text(encoding='utf-8')
    assert 'AssemblyBuilder.build({' not in source, f'{path.name} bypasses FlightSession lifecycle ownership'
    assert 'Physics.createBody({' not in source, f'{path.name} allocates physics bodies outside permitted runtime ownership'
    assert 'Physics.addBoxCollider(' not in source, f'{path.name} allocates colliders outside permitted runtime ownership'

print({
    'game_modules': len(EXPECTED_MODULES),
    'game_js_lines': len(main.splitlines()),
    'game_js_bytes': len(main.encode('utf-8')),
    'explicit_composition': 'ok',
    'ownership_boundaries': 'ok',
    'physics_boundary': 'ok',
})
