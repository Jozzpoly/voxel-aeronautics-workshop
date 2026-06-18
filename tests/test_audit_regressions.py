from __future__ import annotations

import importlib.util
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from source_inventory import ALL_JS, FOUNDATION, GAME, RUNTIME, function_source
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
GENERATED_CSS = (ROOT / 'tailwind.generated.css').read_text(encoding='utf-8').rstrip()
CUSTOM_CSS = (ROOT / 'styles.css').read_text(encoding='utf-8').rstrip()
CSS = GENERATED_CSS + '\n\n' + CUSTOM_CSS
INTEGRITY = (ROOT / 'src/game/flight_integrity.js').read_text(encoding='utf-8')
SESSION = (ROOT / 'src/game/flight_session.js').read_text(encoding='utf-8')
ENTRY = (ROOT / 'src/game.js').read_text(encoding='utf-8')



# The project HTML and one-file release must come from one source of truth.
spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools' / 'build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)
single = module.build_single_html(ROOT)
assert "const sources = [\n      'src/" not in single
assert 'href="styles.css"' not in single
assert 'href="tailwind.generated.css"' not in single
assert f'/* BEGIN EMBEDDED STYLES */\n{CSS}\n/* END EMBEDDED STYLES */' in single
assert '/* BEGIN EMBEDDED APPLICATION */' in single
for relative in module.APP_SOURCES:
    source = (ROOT / relative).read_text(encoding='utf-8').rstrip()
    assert f'/* BEGIN {relative.as_posix()} */\n{source}\n/* END {relative.as_posix()} */' in single

# Mission and damage UI must be present in the source project, not just one release flavor.
for element_id in ('ui-structural-reserve', 'ui-weak-links', 'mission-hud-payload', 'debrief-payload'):
    assert f'id="{element_id}"' in HTML

# Branch failure is a backend-first transaction owned by FlightIntegrity.
assert 'function detachParts(entries, cascade = true)' in INTEGRITY
assert 'Backend rejected collider removal' in INTEGRITY
assert 'finalizeDetachedPart(part, reason);' in INTEGRITY
assert 'state.flight.runtimePartById?.delete(part.blockId);' in INTEGRITY
assert 'for (const bodyId of affectedBodies) recenterBody(bodyId);' in INTEGRITY
assert 'per-rigid-island-static-frame-guard' in INTEGRITY
assert 'connected-body-recenter-blocked' in INTEGRITY
assert 'mechanical-endpoint-failure' in INTEGRITY

# Neighbor lookup must remain O(1) per direction instead of scanning all runtime parts.
neighbors = function_source('runtimeNeighborCount')
assert 'runtimePartById.get' in neighbors
assert 'rigidNeighborBlockIds' in neighbors
assert 'runtimePartByKey.get' not in neighbors
assert 'runtimeParts.filter' not in neighbors and 'for (const candidate of STATE.flight.runtimeParts)' not in neighbors

# Structural stress is intentionally sampled below the 120 Hz solver rate.
step = function_source('stepFlightPhysics')
assert 'structuralAccumulator' in step
assert 'PHYSICS.structuralCheckInterval' in step
assert re.search(r'structuralCheckInterval:\s*1\s*/\s*30', ALL_JS)

# Collider mutation happens only after world.step.
fixed_step_start = GAME.index('fixedStepScheduler.advance(')
fixed_step_end = GAME.index('});', fixed_step_start)
fixed_step_source = GAME[fixed_step_start:fixed_step_end]
assert fixed_step_source.index('Physics.step(world, dt)') < fixed_step_source.index('processPendingImpacts()') < fixed_step_source.index('updateMission(dt)')
callback_start = GAME.index('collisionListener: ({ bodyId, collision }) => {')
callback = GAME[callback_start:GAME.index('const visualRootByBodyId = new Map();', callback_start)]
assert 'applyImpactDamage(' not in callback

# Debris must be bounded and isolated from debris-debris collision storms.
assert 'maxPhysicalDebris: 48' in ALL_JS
assert 'collisionGroup: COLLISION_GROUP.debris' in GAME
assert 'collisionMask: COLLISION_GROUP.world | COLLISION_GROUP.craft' in GAME

# Gates require a forward plane crossing, not proximity alone.
def crosses(previous, current, center=(0.0, 0.0, 0.0), normal=(1.0, 0.0, 0.0), radius=5.0):
    def dot(a, b): return sum(x*y for x, y in zip(a, b))
    def sub(a, b): return tuple(x-y for x, y in zip(a, b))
    start = dot(sub(previous, center), normal)
    end = dot(sub(current, center), normal)
    if not (start < 0 <= end): return False
    denominator = start - end
    if abs(denominator) < 1e-6: return False
    t = max(0.0, min(1.0, start / denominator))
    intersection = tuple(previous[i] + (current[i] - previous[i]) * t for i in range(3))
    radial = sub(intersection, center)
    projection = dot(radial, normal)
    radial = tuple(radial[i] - normal[i] * projection for i in range(3))
    return math.sqrt(dot(radial, radial)) <= radius

assert crosses((-2, 0, 0), (2, 0, 0))
assert not crosses((2, 0, 0), (-2, 0, 0))
assert not crosses((-2, 7, 0), (2, 7, 0))
assert 'segmentCrossesGate(previousPosition, currentPosition, gate)' in GAME

# Hover certification must be a stable hold, not merely reaching altitude.
stable_hover = function_source('isStableHover')
for token in ('Math.abs(sample.velocity.y) <= 2.4', 'horizontalSpeed <= 5.5', 'craftTiltDegrees(sample.bodyId) <= 42'):
    assert token in stable_hover

# Cargo damage has gameplay consequences and is visible in the debrief.
assert "minPayloadIntegrity: 0.65" in ALL_JS
assert "minPayloadIntegrity: 0.50" in ALL_JS
assert 'Cargo integrity was only' in GAME
assert "document.getElementById('debrief-payload')" in GAME
assert 'payloadIntegrity: deliveredPayloadIntegrity' in GAME



# Large editor blueprints remain valid, but the current compound-body solver has an explicit safe launch cap.
assert 'maxFlightParts: 480' in ALL_JS
assert "snapshot.parts.length > PHYSICS.maxFlightParts" in GAME
assert 'Flight is limited to ${PHYSICS.maxFlightParts} attached modules' in GAME

# Undo/redo history is bounded by both snapshot count and stored-part budget.
assert 'maxStoredParts: 12000' in ALL_JS
assert 'foundation.craft-history' in ALL_JS
assert 'STATE.history.commit(previousBlueprint, collectBlueprint())' in GAME
assert 'STATE.history.rollbackUndo(current, target)' in GAME
assert 'storedParts > maxStoredParts' in ALL_JS

# A destroyed command core is always a terminal craft failure, regardless of remaining wing health.
assert 'const core = getRuntimeCore(primaryBodyId);' in INTEGRITY
assert 'core?.health > 0 && state.flight.initialHealth > 0' in INTEGRITY


# Editing readiness is separated from flight readiness: empty/disconnected work-in-progress is saveable,
# while CraftCompiler owns launch diagnostics and a movable Core.
assert 'foundation.craft-compiler' in ALL_JS
assert "Diagnostics.create('missing-core'" in ALL_JS
assert "Diagnostics.create('assembly-disconnected'" in ALL_JS
assert "coreAssemblyPosition" in ALL_JS
assert 'foundation.structural-graph-compiler' in ALL_JS
assert 'foundation.rigid-island-compiler' in ALL_JS
assert 'foundation.mechanical-graph-compiler' in ALL_JS
assert "resetToEmptyCraft(false)" in GAME
assert "tool === 'Core'" not in function_source('setSelectedTool')

# Flight input exposes independent translation and rotation axes with corrected yaw semantics.
assert 'foundation.flight-control' in ALL_JS
assert "'yaw+': Object.freeze(['KeyA', 'ArrowLeft'])" in ALL_JS
assert "'yaw-': Object.freeze(['KeyD', 'ArrowRight'])" in ALL_JS
assert "'lift+': Object.freeze(['Space'])" in ALL_JS
assert "'lift-': Object.freeze(['ControlLeft'])" in ALL_JS
assert "'surge+': Object.freeze(['KeyW'])" in ALL_JS and "'surge-': Object.freeze(['KeyS'])" in ALL_JS
assert 'FlightControl.neutralCommand(' in function_source('computeCraftAnalysis')
thruster_command = function_source('computeThrusterCommand')
assert 'const neutralCommand = FlightControl.neutralCommand(localAxis, STATE.thrusterPower);' in thruster_command
assert 'STATE.flight.thrusterTorqueMax' in thruster_command
assert 'FlightControl.applyTranslationMix(' in thruster_command
assert 'rotationalCommand,\n        1' in thruster_command
assert 'Flight controls use the user profile' in GAME
assert "'thrusterPower-': Object.freeze(['Minus'])" in ALL_JS
assert "'thrusterPower+': Object.freeze(['Equal'])" in ALL_JS
assert "'balloonPower-': Object.freeze(['Comma'])" in ALL_JS
assert "'balloonPower+': Object.freeze(['Period'])" in ALL_JS
assert 'navigator.keyboard.lock' in GAME and 'requestFullscreen' in GAME
assert 'InputProfile.updateBinding' in GAME and 'input-binding-list' in HTML
assert 'PROFILE_VERSION = 3' in ALL_JS
assert 'requiredSupplementalPowerForHover' in ALL_JS
assert 'function setThrusterPower(value, options = {})' in GAME
assert "adjustment?.target === 'thrusterPower' || adjustment?.target === 'balloonPower'" in GAME
assert "event.key === '-'" not in GAME and "event.key === '+'" not in GAME
for element_id in ('ui-thruster-hover-marker', 'ui-thruster-climb-zone', 'ui-thruster-guidance'):
    assert f'id="{element_id}"' in HTML
assert 'activePointers' not in GAME and 'performTouchAction' not in GAME

# Persistence rejects unknown future blueprint versions and sanitizes career data.
validate = function_source('normalizeBlueprintData')
assert 'Blueprint.normalize(data)' in validate
assert 'version > SAVE_VERSION' in ALL_JS
normalize = function_source('normalizeCareerData')
for token in ('knownContractIds()', 'clamp(', 'source.completed?.[contract.id] === true'):
    assert token in normalize

assert 'STATE.voxels' not in GAME
assert 'CRAFT.validateAddMany(plan)' in GAME
assert 'CRAFT.toDocument' in GAME

print({
    'release_source_parity': 'ok',
    'transactional_detachment': 'ok',
    'linear_structural_checks': 'ok',
    'deferred_damage': 'ok',
    'bounded_debris': 'ok',
    'directional_gate_crossing': 'ok',
    'stable_hover': 'ok',
    'cargo_integrity_contracts': 'ok',
    'core_terminal_failure': 'ok',
    'safe_flight_part_cap': 'ok',
    'bounded_history_memory': 'ok',
    'save_sanitization': 'ok',
})

# Contract access is unified through the desktop workspace toolbar.
for element_id in ('workspace-toolbar', 'contract-panel'):
    assert f'id="{element_id}"' in HTML
for removed_id in ('btn-ui-contracts', 'mobile-topbar', 'mobile-controls', 'btn-touch-place'):
    assert f'id="{removed_id}"' not in HTML
assert 'id="desktop-required"' in HTML
assert 'Foundation Gate C • Future Hardening' in HTML
assert 'Foundation Phase 1D.2B • Mission + Balloon Control Fix' not in HTML
assert re.search(r'id="contract-panel"[^>]*\shidden', HTML)
assert 'btn-contract-panel-open' not in HTML and 'btn-contract-panel-close' not in HTML
assert 'contract-panel-trigger' not in CSS and 'panel-close-btn' not in CSS
assert 'function syncContractPanelVisibility()' in GAME
assert "panelId === 'build' || panelId === 'contracts'" in GAME
assert "if (key === 'c')" in GAME
assert "UI_SAVE_VERSION = 5" in ALL_JS
assert "UI_SAVE_KEY = 'voxel-aeronautics-ui-v5'" in ALL_JS
for legacy_key in ('voxel-aeronautics-ui-v4', 'voxel-aeronautics-ui-v3', 'voxel-aeronautics-ui-v2', 'voxel-aeronautics-ui-v1'):
    assert legacy_key in ALL_JS
assert 'foundation.ui-workspace' in ALL_JS
assert 'data-workspace-panel="controls"' in HTML
assert 'data-panel-toggle="build"' in HTML and 'aria-controls="build-panel"' in HTML
assert 'workspace-tab-unavailable' in CSS
print({'workspace_panel_close_reopen': 'ok', 'contract_access_unified': 'ok', 'workspace_preference_migration': 'ok', 'desktop_scope': 'ok'})

# Workspace panels require a dedicated scroll body, viewport-safe geometry, focus order and durable resize persistence.
for panel_id in ('build', 'contracts', 'telemetry', 'controls'):
    assert f'data-panel-scroll="{panel_id}"' in HTML
assert HTML.count('class="workspace-panel-scroll"') == 4
for token in ('overflow-y: auto', 'touch-action: pan-y', 'overscroll-behavior: contain', 'scrollbar-gutter: stable'):
    assert token in CSS
assert 'UIWorkspace.fitPanelRect(panel' in GAME
assert 'workspaceTopInset()' in GAME
assert 'viewportHeight - visibleHeight - gap' in ALL_JS
assert 'WORKSPACE_VERSION = 3' in ALL_JS
assert 'function focusWorkspacePanel(panelId' in GAME
assert 'UIWorkspace.topPanel(' in GAME
assert 'workspace-panel-front' in CSS
resize_observer = GAME[GAME.index('if (typeof ResizeObserver'):GAME.index("window.addEventListener('resize'", GAME.index('if (typeof ResizeObserver'))]
assert 'scheduleWorkspaceSave()' in resize_observer
print({'workspace_inner_scroll': 'ok', 'workspace_viewport_clamp': 'ok', 'workspace_z_order': 'ok', 'workspace_resize_persistence': 'ok'})

# Landing completion is evaluated from physical state; a one-shot collision event is only corroborating evidence.
assert 'foundation.mission-evaluator' in ALL_JS
landing_sample = function_source('landingSample')
landing = function_source('evaluateCraftLandingZones')
assert 'groundClearance: estimateCraftGroundClearance()' in landing_sample
assert 'contactAge: STATE.mission.elapsed - STATE.mission.lastGroundContact' in landing_sample
assert 'MissionEvaluator.evaluateLandingZones' in landing
assert 'MissionEvaluator.advanceHold' in function_source('updateMission')
assert 'STATE.mission.landingHold = 0;' not in function_source('isCraftSettledAtAny')
assert 'elapsed - STATE.mission.lastGroundContact < 0.3' not in GAME
assert 'return lowestWorldY - TEST_RANGE.groundY;' in function_source('estimateCraftGroundClearance')
print({'state_based_landing': 'ok', 'collision_event_not_required_for_dwell': 'ok', 'landing_hysteresis': 'ok'})

# Runtime assembly construction is a real boundary: game.js consumes AssemblyBuilder instead of
# rebuilding craft bodies and colliders through the physics backend.
build_flight = function_source('buildFlightBody')
assert 'flightSession.start({' in build_flight
assert 'AssemblyBuilder.build({' not in build_flight
assert 'flightSession.getColliderOwnershipByBlockId' in build_flight
assert 'Physics.createBody({' not in build_flight
assert 'Physics.addBoxCollider(' not in build_flight
assert 'flightSession.recenterBody(bodyId, shift);' in INTEGRITY
assert 'flightSession.setBodyMassProperties(bodyId' in INTEGRITY
assert 'body.angularVelocity.cross' not in function_source('pointVelocityWorld')
assert 'flightSession.getBodyPointVelocity(bodyId, localPoint)' in function_source('pointVelocityWorld')
assert 'runtime.headless-physics-backend' in ALL_JS
assert 'runtime.assembly-builder' in ALL_JS
print({'assembly_builder_boundary': 'ok', 'recenter_physics_boundary': 'ok', 'headless_backend_registered': 'ok'})

# Runtime collision callbacks expose a backend-neutral event instead of Cannon contact internals.
collision_callback_start = GAME.index('collisionListener: ({ bodyId, collision }) => {')
collision_callback = GAME[collision_callback_start:GAME.index('const visualRootByBodyId = new Map();', collision_callback_start)]
assert 'event.contact' not in collision_callback
assert 'event.body' not in collision_callback
assert 'collision.impactSpeed' in collision_callback
assert 'collision.kind' in collision_callback
assert 'collision.relativePoint' in collision_callback
assert 'normalizeCollisionEvent' in ALL_JS
print({'physics_collision_event_boundary': 'ok'})

# Mechanical constraints remain behind RuntimeAssembly + Physics Port. The game shell may consume
# RuntimeAssembly state later, but it must not construct native Cannon joints or use the experimental seam.
CANNON_BACKEND = (ROOT / 'src/runtime/cannon_physics_backend.js').read_text(encoding='utf-8')
GAME_SOURCES = '\n'.join(path.read_text(encoding='utf-8') for path in [ROOT / 'src/game.js', *(ROOT / 'src/game').glob('*.js')])
assert 'new CANNON.HingeConstraint' in CANNON_BACKEND
assert 'new CANNON.HingeConstraint' not in GAME_SOURCES
assert 'constraintBuilder' not in ENTRY, 'composition root must not inject custom solver handles'
assert 'constraintBuilder' in SESSION, 'FlightSession may expose the neutral AssemblyBuilder test seam'
assert 'Physics.createConstraint(' not in GAME_SOURCES
assert 'Physics.addConstraint(' not in GAME_SOURCES
assert 'Physics.removeConstraint(' not in GAME_SOURCES
print({'hinge_physics_port_boundary': 'ok', 'experimental_constraint_seam_isolated': 'ok'})
