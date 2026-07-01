(() => {
  'use strict';

  window.VAW.define('foundation.config', [], () => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }

    const APP_VERSION = '0.8.2-foundation.workbench-foundation';
    const RELEASE_ID = 'foundation-workbench-foundation';
    const GRID = { halfExtent: 18, minY: 0, maxY: 20, maxBlocks: 2500 };
    const SAVE_VERSION = 12;
    const SAVE_KEY = 'voxel-aeronautics-blueprint-v12';
    const SAVE_BACKUP_KEY = `${SAVE_KEY}:backup`;
    const LEGACY_SAVE_KEYS = [
      'voxel-aeronautics-blueprint-v11',
      'voxel-aeronautics-blueprint-v10',
      'voxel-aeronautics-blueprint-v9',
      'voxel-aeronautics-blueprint-v8',
      'voxel-aeronautics-blueprint-v7',
      'voxel-aeronautics-blueprint-v6',
      'voxel-aeronautics-blueprint-v5',
      'voxel-aeronautics-blueprint-v4',
      'voxel-aeronautics-blueprint-v3'
    ];
    const CAREER_SAVE_KEY = 'voxel-aeronautics-career-v1';
    const CAREER_SAVE_VERSION = 2;
    const UI_SAVE_VERSION = 9;
    const UI_SAVE_KEY = 'voxel-aeronautics-ui-v9';
    const LEGACY_UI_SAVE_KEYS = ['voxel-aeronautics-ui-v8', 'voxel-aeronautics-ui-v7', 'voxel-aeronautics-ui-v6', 'voxel-aeronautics-ui-v5', 'voxel-aeronautics-ui-v4', 'voxel-aeronautics-ui-v3', 'voxel-aeronautics-ui-v2', 'voxel-aeronautics-ui-v1'];
    const NEIGHBOR_DIRECTIONS = [
      [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
    ];
    const COLLISION_GROUP = { craft: 1, world: 2, debris: 4 };
    const RANGE_PADS = {
      startPad: { x: 0, y: 0, z: 0, radius: 10, label: 'Launch Yard' },
      finishPad: { x: 100, y: 0, z: 0, radius: 9, label: 'Yard Receiver' },
      weatherSpirePad: { x: 174, y: 0, z: -46, radius: 8, label: 'Weather Spire Service Pad' },
      northPad: { x: 92, y: 0, z: -108, radius: 9, label: 'North Survey Pad' },
      ridgePad: { x: 172, y: 0, z: -162, radius: 8.5, label: 'Ridge Shelf' },
      southPad: { x: 86, y: 0, z: 120, radius: 8.5, label: 'South Basin' },
      towerPad: { x: 144, y: 0, z: 188, radius: 8, label: 'Tower Service Pad' },
      eastDepot: { x: 252, y: 0, z: 70, radius: 10, label: 'East Cargo Depot' },
      skyhookPad: { x: 250, y: 0, z: 178, radius: 9, label: 'Skyhook Mast Pad' },
      frontierPad: { x: 312, y: 0, z: -218, radius: 11, label: 'Frontier Relay Pad' }
    };
    const RANGE_SECTORS = [
      { id: 'yard', title: 'Launch Yard', short: 'Basic certification, pad recovery and short control lanes.', padIds: ['startPad', 'finishPad'] },
      { id: 'ridge', title: 'North Ridge Survey Line', short: 'Off-axis navigation, drift control and ridge shelf recovery.', padIds: ['northPad', 'ridgePad'] },
      { id: 'mesa', title: 'South Mesa Tower Line', short: 'Altitude discipline around the basin, tower and skyhook pads.', padIds: ['southPad', 'towerPad', 'skyhookPad'] },
      { id: 'depot', title: 'East Depot Freight Line', short: 'Payload routes and fuel planning around the weather spire.', padIds: ['weatherSpirePad', 'eastDepot'] },
      { id: 'frontier', title: 'Frontier Relay Corridor', short: 'The longest current route, ending at the outer relay pad.', padIds: ['frontierPad'] }
    ];
    const TERRAIN_MATERIALS = {
      basin: { color: 0x15283a, roughness: 1.0, texture: { kind: 'checker', colorA: 0x15283a, colorB: 0x1b3349, repeat: 34 } },
      runway: { color: 0x334155, roughness: 0.88, texture: { kind: 'stripe', colorA: 0x334155, colorB: 0x475569, repeat: 18 } },
      serviceConcrete: { color: 0x475569, roughness: 0.9, texture: { kind: 'checker', colorA: 0x3f4f64, colorB: 0x56677c, repeat: 10 } },
      ridgeDust: { color: 0x4c3f7a, roughness: 1.0, texture: { kind: 'noise', colorA: 0x3a3568, colorB: 0x61579a, repeat: 20 } },
      mesaClay: { color: 0x7c4a22, roughness: 1.0, texture: { kind: 'noise', colorA: 0x6b3f1c, colorB: 0x9a5d2e, repeat: 18 } },
      depotGravel: { color: 0x2f4a3a, roughness: 0.96, texture: { kind: 'checker', colorA: 0x263f34, colorB: 0x3d5f4b, repeat: 22 } },
      frontierAsh: { color: 0x4a2424, roughness: 1.0, texture: { kind: 'noise', colorA: 0x341818, colorB: 0x693333, repeat: 24 } },
      routePaint: { color: 0x93c5fd, roughness: 0.8, opacity: 0.34, texture: { kind: 'stripe', colorA: 0x60a5fa, colorB: 0x1e3a8a, repeat: 12 } }
    };
    const TERRAIN_PATCHES = [
      { id: 'yard-apron', material: 'runway', center: { x: 50, z: 0 }, size: { x: 148, z: 38 }, rotation: 0 },
      { id: 'launch-service-concrete', material: 'serviceConcrete', center: { x: -8, z: 0 }, size: { x: 50, z: 48 }, rotation: 0 },
      { id: 'north-survey-dust', material: 'ridgeDust', center: { x: 92, z: -108 }, size: { x: 66, z: 50 }, rotation: -0.18 },
      { id: 'ridge-shelf-dust', material: 'ridgeDust', center: { x: 172, z: -162 }, size: { x: 68, z: 52 }, rotation: -0.28 },
      { id: 'south-basin-clay', material: 'mesaClay', center: { x: 86, z: 120 }, size: { x: 68, z: 54 }, rotation: 0.14 },
      { id: 'tower-service-clay', material: 'mesaClay', center: { x: 144, z: 188 }, size: { x: 64, z: 54 }, rotation: 0.26 },
      { id: 'skyhook-clay', material: 'mesaClay', center: { x: 250, z: 178 }, size: { x: 72, z: 58 }, rotation: -0.12 },
      { id: 'weather-service-gravel', material: 'depotGravel', center: { x: 174, z: -46 }, size: { x: 58, z: 48 }, rotation: 0.08 },
      { id: 'east-depot-gravel', material: 'depotGravel', center: { x: 252, z: 70 }, size: { x: 92, z: 64 }, rotation: -0.18 },
      { id: 'frontier-ash', material: 'frontierAsh', center: { x: 312, z: -218 }, size: { x: 86, z: 70 }, rotation: 0.18 }
    ];
    const TERRAIN_STRIPS = [
      { id: 'yard-runway', fromPad: 'startPad', toPad: 'finishPad', width: 14, material: 'runway', opacity: 0.58 },
      { id: 'north-approach', fromPad: 'finishPad', toPad: 'northPad', width: 8, material: 'ridgeDust', opacity: 0.42 },
      { id: 'ridge-link', fromPad: 'northPad', toPad: 'ridgePad', width: 8, material: 'ridgeDust', opacity: 0.45 },
      { id: 'south-basin-link', fromPad: 'startPad', toPad: 'southPad', width: 8, material: 'mesaClay', opacity: 0.38 },
      { id: 'tower-line', fromPad: 'southPad', toPad: 'towerPad', width: 9, material: 'mesaClay', opacity: 0.42 },
      { id: 'skyhook-line', fromPad: 'towerPad', toPad: 'skyhookPad', width: 9, material: 'mesaClay', opacity: 0.40 },
      { id: 'spire-service-road', fromPad: 'finishPad', toPad: 'weatherSpirePad', width: 8, material: 'depotGravel', opacity: 0.38 },
      { id: 'depot-road', fromPad: 'weatherSpirePad', toPad: 'eastDepot', width: 10, material: 'depotGravel', opacity: 0.46 },
      { id: 'frontier-track', fromPad: 'weatherSpirePad', toPad: 'frontierPad', width: 8, material: 'frontierAsh', opacity: 0.36 }
    ];
    const RANGE_OBSTACLES = [
      { id: 'yard_hangar', size: { x: 15, y: 6, z: 15 }, position: { x: -24, y: 2.5, z: -24 }, color: 0x26364c, collidable: true },
      { id: 'yard_equipment', size: { x: 8, y: 4, z: 9 }, position: { x: -8, y: 1.5, z: -30 }, color: 0x374151, collidable: true },
      { id: 'yard_barrier', size: { x: 20, y: 1, z: 6 }, position: { x: -18, y: 0, z: 24 }, color: 0x475569, collidable: true },
      { id: 'weather_spire', size: { x: 7, y: 30, z: 7 }, position: { x: 174, y: 14.5, z: -20 }, color: 0x0f172a, collidable: true },
      { id: 'east_depot_bldg', size: { x: 18, y: 8, z: 18 }, position: { x: 226, y: 3.5, z: 98 }, color: 0x1f2937, collidable: true },
      { id: 'tower_observation_bldg', size: { x: 10, y: 34, z: 10 }, position: { x: 166, y: 16.5, z: 168 }, color: 0x431407, collidable: true },
      { id: 'ridge_marker_rock', size: { x: 12, y: 18, z: 12 }, position: { x: 145, y: 8.5, z: -132 }, color: 0x312e81, collidable: true },
      { id: 'frontier_relay_mast', size: { x: 9, y: 30, z: 9 }, position: { x: 286, y: 14.5, z: -190 }, color: 0x450a0a, collidable: true },
      { id: 'skyhook_mast', size: { x: 8, y: 38, z: 8 }, position: { x: 250, y: 18.5, z: 204 }, color: 0x831843, collidable: true },
      { id: 'clutter_west_rack', size: { x: 4, y: 5.4, z: 4 }, position: { x: -36, y: 2.25, z: -44 }, color: 0x26384d, collidable: true },
      { id: 'clutter_yard_south', size: { x: 5, y: 4.6, z: 4 }, position: { x: 24, y: 1.85, z: 58 }, color: 0x26384d, collidable: true },
      { id: 'clutter_north_low', size: { x: 4, y: 5.8, z: 5 }, position: { x: 48, y: 2.45, z: -76 }, color: 0x26384d, collidable: true },
      { id: 'clutter_mid_ridge', size: { x: 5, y: 6.2, z: 4 }, position: { x: 132, y: 2.65, z: -72 }, color: 0x26384d, collidable: true },
      { id: 'clutter_depot_west', size: { x: 5, y: 5.2, z: 5 }, position: { x: 158, y: 2.15, z: 36 }, color: 0x26384d, collidable: true },
      { id: 'clutter_mesa_west', size: { x: 4, y: 5.7, z: 5 }, position: { x: 38, y: 2.4, z: 166 }, color: 0x26384d, collidable: true },
      { id: 'clutter_mesa_pass', size: { x: 5, y: 6.0, z: 4 }, position: { x: 118, y: 2.55, z: 92 }, color: 0x26384d, collidable: true },
      { id: 'clutter_far_north', size: { x: 4, y: 7.0, z: 5 }, position: { x: 212, y: 3.05, z: -112 }, color: 0x26384d, collidable: true },
      { id: 'clutter_frontier_inner', size: { x: 5, y: 6.8, z: 5 }, position: { x: 258, y: 2.95, z: -142 }, color: 0x26384d, collidable: true },
      { id: 'clutter_depot_outer', size: { x: 4, y: 5.8, z: 5 }, position: { x: 304, y: 2.45, z: 18 }, color: 0x26384d, collidable: true },
      { id: 'clutter_skyhook_outer', size: { x: 5, y: 7.2, z: 4 }, position: { x: 314, y: 3.15, z: 126 }, color: 0x26384d, collidable: true },
      { id: 'clutter_south_outer', size: { x: 4, y: 5.5, z: 5 }, position: { x: 58, y: 2.3, z: 224 }, color: 0x26384d, collidable: true },
      { id: 'clutter_tower_outer', size: { x: 5, y: 7.5, z: 5 }, position: { x: 170, y: 3.3, z: 250 }, color: 0x26384d, collidable: true },
      { id: 'clutter_frontier_edge', size: { x: 5, y: 6.5, z: 5 }, position: { x: 330, y: 2.8, z: -260 }, color: 0x26384d, collidable: true },
      { id: 'clutter_south_frontier', size: { x: 4, y: 6.0, z: 5 }, position: { x: 248, y: 2.55, z: -284 }, color: 0x26384d, collidable: true }
    ];
    const TEST_RANGE = {
      ...RANGE_PADS,
      pads: RANGE_PADS,
      padIds: Object.keys(RANGE_PADS),
      spawn: { x: 0, y: 3.5, z: 0 },
      bounds: 360,
      maxAltitude: 260,
      groundY: -0.5,
      missionMap: {
        label: 'Gate C extended proving range',
        summary: 'A larger proving range for exploration, mission variety and aircraft identity tests without changing Blueprint or compiler authority.',
        sectors: RANGE_SECTORS
      },
      terrain: {
        fog: { color: 0x0b1220, density: 0.0038 },
        baseMaterial: 'basin',
        materials: TERRAIN_MATERIALS,
        patches: TERRAIN_PATCHES,
        strips: TERRAIN_STRIPS
      },
      obstacles: RANGE_OBSTACLES
    };
    const MISSION = {
      landing: {
        requiredHoldSeconds: 1.6,
        zoneMargin: 0.25,
        maxGroundClearance: 0.30,
        contactGraceSeconds: 0.45,
        maxContactClearance: 0.55,
        maxHorizontalSpeed: 1.8,
        maxVerticalSpeed: 0.85,
        maxTotalSpeed: 2.2,
        maxTiltDegrees: 24,
        holdDecayRate: 1.75
      }
    };
    const AEROSTATICS = {
      scaleHeight: 72,
      minimumEfficiency: 0.06,
      gravity: 9.81,
      controlStep: 0.02,
      verticalDampingRate: 0.52,
      maxDampingWeightRatio: 0.10,
      minimumDampingActivation: 0.08
    };
    const MISSION_PAYLOAD_POSITION = { x: 0, y: -1, z: 0 };
    const degToRad = degrees => degrees * Math.PI / 180;
    const PHYSICS = {
      fixedDt: 1 / 120,
      maxSubSteps: 8,
      airDensity: 1.12,
      cruiseReferenceSpeed: 12,
      wingBaseLiftCoefficient: 0.30,
      wingLiftSlope: 3.25,
      wingStallStart: degToRad(20),
      wingStallEnd: degToRad(65),
      thrusterControlGain: 0.94,
      gyroManualTorque: 7.5,
      targetAngularAcceleration: 1.15,
      bodyDragCoefficient: 0.105,
      crossflowDragCoefficient: 0.22,
      hardImpactSpeed: 7.5,
      severeImpactSpeed: 13,
      controlSurfaceMaxDeflection: degToRad(28),
      controlSurfaceLiftGain: 1.35,
      gimbalAngle: degToRad(16),
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
    const HISTORY_POLICY = { maxSnapshots: 80, maxStoredParts: 12000, maxStoredBytes: 16 * 1024 * 1024 };
    const IMPORT_POLICY = { maxBlueprintBytes: 8 * 1024 * 1024 };

    return deepFreeze({
      APP_VERSION, RELEASE_ID, GRID, SAVE_VERSION, SAVE_KEY, SAVE_BACKUP_KEY, LEGACY_SAVE_KEYS,
      CAREER_SAVE_KEY, CAREER_SAVE_VERSION, UI_SAVE_VERSION, UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS,
      NEIGHBOR_DIRECTIONS, COLLISION_GROUP, TEST_RANGE, MISSION, AEROSTATICS,
      MISSION_PAYLOAD_POSITION, PHYSICS, AXIS_VECTORS,
      AXIS_LABELS, SYMMETRY_MODES, CONTROL_AXES,
      CONTROL_SIGNS, HISTORY_POLICY, IMPORT_POLICY, deepFreeze
    });
  });
})();
