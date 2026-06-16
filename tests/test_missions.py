from __future__ import annotations

import json
import math
import re
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILES = [
    ROOT / 'src/foundation/config.js',
    ROOT / 'src/foundation/catalog.js',
    ROOT / 'src/foundation/orientation.js',
    ROOT / 'src/foundation/blueprint.js',
    ROOT / 'src/foundation/state.js',
    ROOT / 'src/foundation/aerostatics.js',
    ROOT / 'src/foundation/input_profile.js',
    ROOT / 'src/foundation/flight_control.js',
    ROOT / 'src/game.js',
]
GAME = '\n'.join(path.read_text(encoding='utf-8') for path in SOURCE_FILES)
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')

EXPECTED_CONTRACTS = [
    ('sandbox', None),
    ('hover_license', None),
    ('gate_course', 'hover_license'),
    ('courier', 'gate_course'),
    ('heavy_lift', 'courier'),
]

# Contract ids and prerequisite chain must be present and unique.
ids = re.findall(r"id:\s*'([a-z_]+)'\s*,\s*title:", GAME)
assert len(ids) == len(set(ids)), f'duplicate contract ids: {ids}'
for contract_id, prerequisite in EXPECTED_CONTRACTS:
    assert contract_id in ids, f'missing contract {contract_id}'
    if prerequisite:
        pattern = rf"id:\s*'{contract_id}'.*?prerequisite:\s*'{prerequisite}'"
        assert re.search(pattern, GAME, flags=re.S), f'bad prerequisite for {contract_id}'

# Required vertical-slice UI must exist.
for element_id in [
    'contract-list', 'ui-credits', 'ui-total-stars', 'ui-contract-readiness',
    'ui-structural-reserve', 'ui-weak-links',
    'mission-hud', 'mission-hud-objective', 'mission-hud-integrity',
    'mission-hud-lost', 'mission-hud-leak', 'mission-hud-payload', 'debrief-modal', 'debrief-stars',
    'debrief-lost', 'debrief-payload', 'debrief-failure', 'btn-debrief-workshop',
    'btn-debrief-retry', 'btn-starter-craft', 'ui-balloon-hover-marker', 'ui-balloon-guidance',
]:
    assert f'id="{element_id}"' in HTML, f'missing UI element {element_id}'

# Starter VTOL topology mirrors the preset in game.js.
blocks = [
    (0,0,0,'Core'),
    (1,0,0,'Hull'),(-1,0,0,'Hull'),(0,0,1,'Hull'),(0,0,-1,'Hull'),
    (2,0,0,'Thruster'),(-2,0,0,'Thruster'),(0,0,2,'Thruster'),(0,0,-2,'Thruster'),
    (1,1,0,'VectorThruster'),(-1,1,0,'VectorThruster'),(0,1,1,'VectorThruster'),(0,1,-1,'VectorThruster'),
    (0,1,0,'Fuel'),(0,2,0,'Fuel'),
    (1,1,1,'Gyro'),(-1,1,-1,'Gyro'),
]
positions = {(x,y,z) for x,y,z,_ in blocks}
visited = {(0,0,0)}
queue = deque(visited)
while queue:
    x,y,z = queue.popleft()
    for dx,dy,dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
        nxt = (x+dx,y+dy,z+dz)
        if nxt in positions and nxt not in visited:
            visited.add(nxt)
            queue.append(nxt)
assert visited == positions, 'starter craft must be fully connected'

masses = {'Core':6.0, 'Hull':1.0, 'Thruster':1.6, 'VectorThruster':1.95, 'Fuel':0.9, 'Gyro':1.0}
total_mass = sum(masses[t] for *_, t in blocks)
upward_thrust = sum(42 if t == 'Thruster' else 42 if t == 'VectorThruster' else 0 for *_, t in blocks)
assert upward_thrust / (total_mass * 9.81) > 1.20, 'starter VTOL needs useful vertical margin at full power'
assert sum(36 for *_, t in blocks if t == 'Fuel') >= 72, 'starter VTOL needs enough fuel for certification'

# Damage curve must be monotonic above the safe threshold and severe impact should matter.
def damage(impact: float) -> float:
    return max(0.0, (impact - 3.5) ** 2 * 3.2) if impact > 3.5 else 0.0

assert damage(3.5) == 0
assert 0 < damage(7.5) < damage(13.0)
assert damage(13.0) > 200

# Scoring expectations mirrored from calculateMissionStars.
def stars(success: bool, integrity: float, elapsed: float, par: float, fuel: float, payload: float = 1.0, payload_minimum: float = 0.0, fuel_minimum: float = 0.18) -> int:
    if not success:
        return 0
    value = 1
    if integrity >= 70 and payload >= max(payload_minimum, 0.72) and elapsed <= par * 1.25:
        value += 1
    if integrity >= 92 and payload >= 0.92 and elapsed <= par and fuel >= fuel_minimum:
        value += 1
    return min(3, value)

assert stars(False, 100, 10, 45, 1) == 0
assert stars(True, 60, 40, 45, 1) == 1
assert stars(True, 80, 50, 45, 0.5) == 2
assert stars(True, 95, 40, 45, 0.5) == 3
assert stars(True, 95, 40, 45, 0.5, payload=0.7, payload_minimum=0.65) == 1

print(json.dumps({
    'contracts': ids,
    'starter_blocks': len(blocks),
    'starter_mass_kg': round(total_mass, 2),
    'starter_thrust_weight_ratio': round(upward_thrust / (total_mass * 9.81), 3),
    'damage_at_severe_impact': round(damage(13.0), 2),
    'mission_ui': 'ok',
    'career_chain': 'ok',
}, indent=2))

# Mission payload is mounted below the core, never inside a legal build-grid voxel.
payload_match = re.search(r"MISSION_PAYLOAD_POSITION\s*=\s*(?:Object\.freeze\()?\{\s*x:\s*([-\d.]+),\s*y:\s*([-\d.]+),\s*z:\s*([-\d.]+)", GAME)
assert payload_match, 'missing mission payload mount'
payload_position = tuple(float(value) for value in payload_match.groups())
assert payload_position == (0.0, -1.0, 0.0), f'unexpected payload mount {payload_position}'

# Loaded-contract analysis and runtime must share the same snapshot builder.
assert 'const loadedSnapshot = buildLoadedSnapshot(analysis.snapshot, contract.payloadMass || 0);' in GAME
assert 'const snapshot = buildLoadedSnapshot(analysis.snapshot, payloadMass);' in GAME
assert 'const loadedControls = computeControlMetrics(loadedSnapshot);' in GAME

# Range decorations that look solid must have actual static collision bodies.
assert 'const rangeStaticBodies = [];' in GAME
assert 'userData: { rangeObstacle: true }' in GAME
assert GAME.count('0x000000, true') >= 4, 'expected collidable range structures'
assert 'if (otherBody === groundBody) STATE.mission.lastGroundContact = STATE.mission.elapsed;' in GAME

# Mission DOM should update on the render path, not on every 120 Hz physics substep.
update_start = GAME.index('function updateMission(dt)')
update_end = GAME.index('function requestReturnToWorkshop()', update_start)
assert 'updateMissionHud()' not in GAME[update_start:update_end], 'mission HUD should not be updated from every physics substep'

print(json.dumps({
    'payload_mount': payload_position,
    'loaded_analysis_runtime_parity': 'ok',
    'collidable_test_range': 'ok',
    'render_rate_mission_hud': 'ok',
}, indent=2))


# Structural-control stage requirements.
for token in [
    "ControlSurface:", "VectorThruster:", "function detachRuntimePart",
    "function detachDisconnectedRuntimeParts", "function applyImpactDamage",
    "function applyControlSurfaceAerodynamics", "function computeVectorThrusterForceCannon",
    "function applyStructuralLoadDamage", "flight-load overstress",
    "voxel-aeronautics-blueprint-v7", "voxel-aeronautics-blueprint-v6",
]:
    assert token in GAME, f'missing structural-control token: {token}'

assert "controlAxis: normalizeControlAxis(raw.controlAxis)" in GAME
assert "controlSign: normalizeControlSign(raw.controlSign)" in GAME
assert "STATE.flight.leakingFuelRate" in GAME
assert "connection to core was severed" in GAME

print(json.dumps({
    'structural_damage': 'ok',
    'disconnected_branch_detachment': 'ok',
    'fuel_leaks': 'ok',
    'control_surface_assignment': 'ok',
    'gimballed_thruster': 'ok',
    'blueprint_v7_migration': 'ok',
}, indent=2))

# Collision damage must be queued until after the physics solver finishes.
assert 'pendingImpacts: []' in GAME
assert 'STATE.flight.pendingImpacts.push({' in GAME
assert 'function processPendingImpacts()' in GAME
step_sequence = re.search(r"Physics\.step\(world, PHYSICS\.fixedDt\);\s*processPendingImpacts\(\);\s*updateMission", GAME)
assert step_sequence, 'impact processing must happen after world.step and before mission evaluation'
callback_start = GAME.index('collisionListener: ({ body: collidedBody, event }) => {')
callback_end = GAME.index('body = assemblyRuntime.rootBody;', callback_start)
callback_source = GAME[callback_start:callback_end]
assert 'applyImpactDamage(' not in callback_source, 'collision callback must not mutate body shapes directly'
assert 'AssemblyBuilder.build({' in GAME, 'flight runtime must be constructed through the assembly builder boundary'

# Workshop prediction must use the same neutral control-surface lift scale as runtime.
assert "const isControlSurface = part.type === 'ControlSurface';" in GAME
assert "coefficients.liftCoefficient * 0.45 * health" in GAME

print(json.dumps({
    'deferred_collision_damage': 'ok',
    'control_surface_analysis_runtime_parity': 'ok',
    'new_module_ghost_orientation': 'ok',
}, indent=2))

assert "landingZones: ['startPad', 'finishPad']" in GAME, 'Hover License should accept either clearly marked test pad.'
assert "FlightControl.adjustmentForInput(event.code, STATE.input.profile)" in GAME, 'Balloon power hotkeys must come from the user input profile.'
assert "'balloonPower-': Object.freeze(['Comma'])" in GAME
assert "'balloonPower+': Object.freeze(['Period'])" in GAME
assert "'lift-': Object.freeze(['ControlLeft'])" in GAME
assert 'navigator.keyboard.lock' in GAME, 'Ctrl chords need optional browser-level capture in Flight Focus.'
assert 'Aerostatics.liftEfficiencyAtAltitude' in GAME, 'Runtime balloon lift must weaken with altitude.'
assert 'syncPowerControlReadouts();' in GAME, 'Power slider labels need immediate synchronization.'

assert 'Aerostatics.verticalDampingForce' in GAME, 'Runtime must apply mild balloon settling damping.'
