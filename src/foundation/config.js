(() => {
  'use strict';

  window.VAW.define('foundation.config', [], () => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }

    const GRID = { halfExtent: 18, minY: 0, maxY: 20, maxBlocks: 2500 };
    const SAVE_VERSION = 7;
    const SAVE_KEY = 'voxel-aeronautics-blueprint-v7';
    const LEGACY_SAVE_KEYS = [
      'voxel-aeronautics-blueprint-v6',
      'voxel-aeronautics-blueprint-v5',
      'voxel-aeronautics-blueprint-v4',
      'voxel-aeronautics-blueprint-v3'
    ];
    const CAREER_SAVE_KEY = 'voxel-aeronautics-career-v1';
    const CAREER_SAVE_VERSION = 2;
    const UI_SAVE_KEY = 'voxel-aeronautics-ui-v1';
    const NEIGHBOR_DIRECTIONS = [
      [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
    ];
    const COLLISION_GROUP = { craft: 1, world: 2, debris: 4 };
    const TEST_RANGE = {
      startPad: { x: 0, y: 0, z: 0, radius: 9 },
      finishPad: { x: 82, y: 0, z: 0, radius: 9 },
      spawn: { x: 0, y: 3.5, z: 0 },
      bounds: 190
    };
    const MISSION_PAYLOAD_POSITION = { x: 0, y: -1, z: 0 };
    const PHYSICS = {
      fixedDt: 1 / 120,
      maxSubSteps: 8,
      airDensity: 1.12,
      cruiseReferenceSpeed: 12,
      wingBaseLiftCoefficient: 0.30,
      wingLiftSlope: 3.25,
      wingStallStart: THREE.MathUtils.degToRad(20),
      wingStallEnd: THREE.MathUtils.degToRad(65),
      thrusterControlGain: 0.94,
      gyroManualTorque: 7.5,
      targetAngularAcceleration: 1.15,
      bodyDragCoefficient: 0.105,
      crossflowDragCoefficient: 0.22,
      hardImpactSpeed: 7.5,
      severeImpactSpeed: 13,
      controlSurfaceMaxDeflection: THREE.MathUtils.degToRad(28),
      controlSurfaceLiftGain: 1.35,
      gimbalAngle: THREE.MathUtils.degToRad(16),
      damagePropagation: 0.34,
      debrisLifetime: 28,
      maxPhysicalDebris: 48,
      maxFlightParts: 480,
      hudRefreshInterval: 1 / 20,
      structuralCheckInterval: 1 / 30
    };
    const AXIS_VECTORS = [
      [1, 0, 0], [0, 1, 0], [-1, 0, 0],
      [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];
    const AXIS_LABELS = ['+X', '+Y', '-X', '-Y', '+Z', '-Z'];
    const SYMMETRY_MODES = ['NONE', 'X', 'Z', 'XZ'];
    const CONTROL_AXES = ['pitch', 'yaw', 'roll'];
    const CONTROL_SIGNS = [0, 1, -1];
    const HISTORY_POLICY = { maxSnapshots: 80, maxStoredParts: 12000 };

    return deepFreeze({
      GRID, SAVE_VERSION, SAVE_KEY, LEGACY_SAVE_KEYS,
      CAREER_SAVE_KEY, CAREER_SAVE_VERSION, UI_SAVE_KEY,
      NEIGHBOR_DIRECTIONS, COLLISION_GROUP, TEST_RANGE,
      MISSION_PAYLOAD_POSITION, PHYSICS, AXIS_VECTORS,
      AXIS_LABELS, SYMMETRY_MODES, CONTROL_AXES,
      CONTROL_SIGNS, HISTORY_POLICY, deepFreeze
    });
  });
})();
