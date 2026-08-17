(() => {
  'use strict';

  window.VAW.define('foundation.catalog', ['foundation.config'], config => {
    const { deepFreeze, TEST_RANGE } = config;

    const BLOCKS = {
      Core:     { mass: 6.0, color: 0x9f7aea, desc: 'Oriented command anchor defining craft forward, up and right.', orientationMode: 'basis', dragArea: 0.18, durability: 260, structural: 2.5 },
      Hull:     { mass: 1.0, color: 0x9a6b45, desc: 'Light structural block.', orientationMode: 'none', dragArea: 0.15, durability: 72, structural: 0.75 },
      Frame:    { mass: 2.6, color: 0x7c8ea8, desc: 'Reinforced load-bearing block.', orientationMode: 'none', dragArea: 0.18, durability: 210, structural: 2.6 },
      Thruster: { mass: 1.6, color: 0xff5a55, desc: 'Fixed directional engine; off-center units provide differential control.', orientationMode: 'direction', force: 42, fuelRate: 0.34, dragArea: 0.12, durability: 96, structural: 0.9 },
      VectorThruster: { mass: 1.95, color: 0xc084fc, desc: 'Gimballed engine that bends thrust to create real control torque.', orientationMode: 'basis', force: 42, fuelRate: 0.39, dragArea: 0.14, durability: 108, structural: 1.05, gimbal: true },
      Balloon:  { mass: 0.75, color: 0x46a6ff, desc: 'Heated lift cell; damaged cells lose buoyancy quickly.', orientationMode: 'none', force: 25, fuelRate: 0.10, dragArea: 0.55, durability: 44, structural: 0.35 },
      Wing:     { mass: 1.1, color: 0x34d399, desc: 'Fixed aerodynamic surface with chord, normal, drag and stall.', orientationMode: 'basis', wingArea: 1.0, dragArea: 0.08, durability: 62, structural: 0.55 },
      ControlSurface: { mass: 0.78, color: 0x22d3ee, desc: 'Configurable aerodynamic surface assigned to pitch, yaw or roll.', orientationMode: 'basis', wingArea: 0.58, dragArea: 0.07, durability: 48, structural: 0.42, controlSurface: true },
      Gyro:     { mass: 1.0, color: 0xf59e0b, desc: 'Provides powered rotational control and stabilization.', orientationMode: 'none', gyroTorque: 7.5, dragArea: 0.10, durability: 84, structural: 0.8 },
      Fuel:     { mass: 0.9, color: 0xfacc15, desc: 'Adds 36 units of propellant; damaged tanks leak.', orientationMode: 'none', fuelCapacity: 36, dragArea: 0.12, durability: 66, structural: 0.65, leakRate: 0.22 }
    };

    const CONTRACTS = [
      {
        id: 'sandbox', title: 'Sandbox Test', short: 'Free engineering flight', sector: 'yard', difficulty: 0,
        description: 'Use the full proving range without objectives, time limits, payload or rewards. Scout distant pads, practice approaches and break strange prototypes here before risking a paid contract.',
        reward: 0, payloadMass: 0, timeLimit: 0, kind: 'sandbox', prerequisite: null,
        routeLabel: 'Full range free-flight',
        engineeringFocus: ['Explore the extended range', 'Practice approaches on distant pads', 'Tune stability and power settings'],
        recommendedModules: ['Any experimental layout'],
        hazards: ['No score pressure', 'Good place to learn camera and landing feel'],
        objectives: ['Experiment freely across the full range', 'Scout the distant pads and landmarks', 'Return to the workshop whenever ready']
      },
      {
        id: 'hover_license', title: '01 - Hover License', short: 'Basic hover and pad recovery', sector: 'yard', difficulty: 1,
        description: 'Climb out of the launch yard, settle the craft into a stable hover and recover on either yard pad. The range crew accepts a careful touchdown over raw speed.',
        reward: 260, payloadMass: 0, timeLimit: 95, parTime: 50, kind: 'hover-return', prerequisite: null,
        targetAltitude: 8, holdSeconds: 3, landingZones: ['startPad', 'finishPad'],
        routeLabel: 'Launch Yard hover box -> either yard pad',
        engineeringFocus: ['Static lift margin', 'Low-speed stability', 'Gentle touchdown control'],
        recommendedModules: ['Thrusters or balloons for clean lift', 'Gyro for easy leveling', 'Fuel reserve for repeated landing attempts'],
        hazards: ['Hard touchdown loses stars', 'Overpowered craft can bounce above the hover band'],
        objectives: ['Reach 8 m altitude without tumbling', 'Hold a stable hover for 3 seconds', 'Land gently on either marked yard pad']
      },
      {
        id: 'gate_course', title: '02 - Yard Control Course', short: 'Compact route with real turns', sector: 'yard', difficulty: 2,
        description: 'Fly the yard S-curve and align with the receiver pad. The course is short enough for quick iteration, but weak yaw control and unstable approaches will show immediately.',
        reward: 540, payloadMass: 0, timeLimit: 155, parTime: 96, kind: 'gate-course', prerequisite: 'hover_license',
        landingZones: ['finishPad'],
        routeLabel: 'Launch Yard -> S-curve control gates -> Yard Receiver',
        engineeringFocus: ['Yaw authority', 'Forward thrust balance', 'Recovering from shallow turns'],
        recommendedModules: ['VectorThruster for turning authority', 'Gyro if the craft oscillates', 'Small wings/control surfaces for smoother forward flight'],
        hazards: ['Do not rush the second gate', 'Final gate points directly into the landing setup'],
        gates: [
          { x: 26, y: 8, z: 4, radius: 5.8 },
          { x: 54, y: 12, z: -16, radius: 5.4 },
          { x: 80, y: 10, z: 16, radius: 5.2 },
          { x: 100, y: 7, z: 0, radius: 5.8 }
        ],
        objectives: ['Pass all four yard gates in order', 'Avoid overcorrecting through the S-turn', 'Land on the receiver pad with the craft under control']
      },
      {
        id: 'courier', title: '03 - Ridge Mail Run', short: 'First meaningful cargo route', sector: 'ridge', difficulty: 3,
        description: 'Carry a light instrument case north of the yard and deliver it to the survey pad. Keep the cargo protected, keep fuel in reserve and use the northbound gates as the approach line.',
        reward: 880, payloadMass: 7, timeLimit: 205, parTime: 132, minFuelFraction: 0.20, minPayloadIntegrity: 0.76, kind: 'courier', prerequisite: 'gate_course',
        landingZones: ['northPad'],
        routeLabel: 'Launch Yard -> northern approach -> North Survey Pad',
        engineeringFocus: ['Light cargo handling', 'Fuel reserve planning', 'Stable off-axis approach'],
        recommendedModules: ['Extra Fuel if you need more attempts', 'Frame around the payload if landings are rough', 'Forward thrust for the longer northbound leg'],
        hazards: ['Cargo damage matters now', 'North pad is far enough to expose inefficient builds'],
        gates: [
          { x: 34, y: 8, z: -14, radius: 5.8 },
          { x: 64, y: 12, z: -56, radius: 5.4 },
          { x: 92, y: 10, z: -108, radius: 5.6 }
        ],
        objectives: ['Carry the 7 kg instrument case', 'Pass the northbound delivery gates', 'Land with at least 20% fuel and 76% cargo integrity']
      },
      {
        id: 'heavy_lift', title: '04 - Heavy-Lift Qualification', short: 'Lift margin under real load', sector: 'yard', difficulty: 4,
        description: 'A reinforced payload hangs below the command core. Add enough lift to climb cleanly, hold a controlled hover and recover gently at the launch pad.',
        reward: 1080, payloadMass: 18, timeLimit: 145, parTime: 90, minPayloadIntegrity: 0.60, kind: 'hover-return', prerequisite: 'courier',
        targetAltitude: 14, holdSeconds: 4.5, landingZones: ['startPad'],
        routeLabel: 'Launch Yard heavy hover -> launch-pad recovery',
        engineeringFocus: ['Payload lift margin', 'Vertical damping', 'Low-impact landing under load'],
        recommendedModules: ['Balloons or additional upward thrusters', 'Gyro to stop payload swing', 'Frame reinforcement near the core'],
        hazards: ['Too little lift fails before the test begins', 'Too much thrust makes the landing bouncy'],
        objectives: ['Lift the 18 kg qualification payload', 'Reach 14 m and hold for 4.5 seconds', 'Recover on the launch pad with at least 60% cargo integrity']
      },
      {
        id: 'ridge_slalom', title: '05 - Ridge Slalom Survey', short: 'Longer off-axis handling route', sector: 'ridge', difficulty: 5,
        description: 'Climb toward the northern shelf, bend across the ridge line and settle on a smaller recovery pad. Plan speed, turn radius and altitude before the final approach.',
        reward: 1340, payloadMass: 0, timeLimit: 235, parTime: 152, kind: 'gate-course', prerequisite: 'heavy_lift',
        landingZones: ['ridgePad'],
        routeLabel: 'Launch Yard -> North Ridge -> Ridge Shelf',
        engineeringFocus: ['Sustained turn control', 'Altitude management', 'Small-pad recovery'],
        recommendedModules: ['ControlSurface or vector thrust for cleaner turns', 'Wing lift for efficient cruise', 'Moderate fuel reserve for retrying the final landing'],
        hazards: ['Final pad is smaller than the yard pads', 'Approach too fast and you overshoot the shelf'],
        gates: [
          { x: 42, y: 10, z: -26, radius: 5.3 },
          { x: 82, y: 16, z: -86, radius: 5.0 },
          { x: 128, y: 20, z: -134, radius: 4.8 },
          { x: 172, y: 14, z: -162, radius: 5.0 }
        ],
        objectives: ['Pass the ridge gates without diving below the shelf line', 'Keep enough control authority for the final turn', 'Land on the smaller Ridge Shelf pad']
      },
      {
        id: 'south_basin_survey', title: '06 - South Basin Survey', short: 'First mesa-sector recovery', sector: 'mesa', difficulty: 6,
        description: 'Cross the south basin and land on the basin pad. The route rewards calm pitch control and a craft that can turn without bleeding all its altitude.',
        reward: 1480, payloadMass: 0, timeLimit: 235, parTime: 154, kind: 'gate-course', prerequisite: 'ridge_slalom',
        landingZones: ['southPad'],
        routeLabel: 'Launch Yard -> South Basin -> Basin Pad',
        engineeringFocus: ['Pitch stability', 'Energy management', 'Wide approach planning'],
        recommendedModules: ['Wings for a smoother basin crossing', 'Gyro if descent oscillates', 'Vector thrust for compact corrections'],
        hazards: ['South basin looks open but punishes late turns', 'Low-altitude dives leave little recovery room'],
        gates: [
          { x: 32, y: 10, z: 28, radius: 5.6 },
          { x: 58, y: 16, z: 76, radius: 5.2 },
          { x: 86, y: 10, z: 120, radius: 5.6 }
        ],
        objectives: ['Cross the south basin gates', 'Keep descent controlled through the final marker', 'Land on the South Basin pad']
      },
      {
        id: 'tower_inspection', title: '07 - South Tower Inspection', short: 'High approach through the tower line', sector: 'mesa', difficulty: 7,
        description: 'Fly the tower service line, level off near the observation structure and descend beside the service pad. Clear altitude planning matters more than a fast final dive.',
        reward: 1640, payloadMass: 0, timeLimit: 255, parTime: 168, kind: 'gate-course', prerequisite: 'south_basin_survey',
        landingZones: ['towerPad'],
        routeLabel: 'South Basin -> Tower Service Pad',
        engineeringFocus: ['Climb rate', 'High-altitude control', 'Descent planning'],
        recommendedModules: ['Wings help hold altitude efficiently', 'Gyro helps when descending around the tower', 'Extra lift prevents hard falls near the last gate'],
        hazards: ['High gates tempt overclimb', 'Descent control matters more than raw speed'],
        gates: [
          { x: 102, y: 22, z: 144, radius: 5.2 },
          { x: 130, y: 28, z: 176, radius: 5.0 },
          { x: 144, y: 20, z: 188, radius: 5.4 }
        ],
        objectives: ['Climb through the south tower line', 'Avoid entering the final gate too fast', 'Land beside the tower service pad']
      },
      {
        id: 'skyhook_calibration', title: '08 - Skyhook Calibration', short: 'Mesa transfer and mast recovery', sector: 'mesa', difficulty: 8,
        description: 'Transfer from the tower line to the skyhook mast pad. Keep the mast to your side, bleed speed early and land with enough control authority for a narrow plateau.',
        reward: 1760, payloadMass: 0, timeLimit: 265, parTime: 176, kind: 'gate-course', prerequisite: 'tower_inspection',
        landingZones: ['skyhookPad'],
        routeLabel: 'Tower Service Pad -> Skyhook Mast Pad',
        engineeringFocus: ['Lateral correction', 'Mast clearance', 'Precise high-pad recovery'],
        recommendedModules: ['Vector thrust for side corrections', 'ControlSurface for smooth approach', 'Gyro to hold attitude near the mast'],
        hazards: ['Mast is beside the pad, not the target', 'Late braking can overshoot the plateau'],
        gates: [
          { x: 174, y: 22, z: 204, radius: 5.2 },
          { x: 212, y: 24, z: 206, radius: 5.0 },
          { x: 250, y: 20, z: 178, radius: 5.6 }
        ],
        objectives: ['Transfer across the mesa high line', 'Keep clear of the skyhook mast', 'Land on the Skyhook Mast Pad']
      },
      {
        id: 'east_depot_run', title: '09 - East Depot Freight', short: 'Medium cargo over a wider map', sector: 'depot', difficulty: 9,
        description: 'Carry the depot package past the weather-spire service road and into the east cargo apron. The spire marks the corridor; the gate line keeps you clear of the structure.',
        reward: 1960, payloadMass: 12, timeLimit: 300, parTime: 205, minFuelFraction: 0.28, minPayloadIntegrity: 0.74, kind: 'courier', prerequisite: 'skyhook_calibration',
        landingZones: ['eastDepot'],
        routeLabel: 'Launch Yard -> Weather Spire side pass -> East Cargo Depot',
        engineeringFocus: ['Forward efficiency', 'Cargo protection', 'Fuel reserve discipline'],
        recommendedModules: ['Fuel capacity for the wider map', 'Frame reinforcement around cargo', 'Wings/control surfaces for efficient cruise'],
        hazards: ['Weather spire is a landmark, not a target', 'Depot landing is wide but cargo integrity is checked'],
        gates: [
          { x: 44, y: 9, z: 10, radius: 5.8 },
          { x: 92, y: 13, z: 32, radius: 5.6 },
          { x: 140, y: 16, z: 4, radius: 5.4 },
          { x: 174, y: 17, z: -54, radius: 5.8 },
          { x: 220, y: 13, z: 20, radius: 5.6 },
          { x: 252, y: 10, z: 70, radius: 5.8 }
        ],
        objectives: ['Carry the 12 kg freight package', 'Pass beside the weather spire, not into it', 'Land with at least 28% fuel and 74% cargo integrity']
      },
      {
        id: 'frontier_gold_trial', title: '10 - Frontier Gold Trial', short: 'Final mixed-route certification', sector: 'frontier', difficulty: 10,
        description: 'Cross the full proving range with a certification package: yard departure, mesa climb, depot bend, frontier cruise and outer-pad recovery. A balanced aircraft will waste less fuel than a pure hover craft.',
        reward: 2750, payloadMass: 10, timeLimit: 430, parTime: 292, minFuelFraction: 0.30, minPayloadIntegrity: 0.86, kind: 'courier', prerequisite: 'east_depot_run',
        landingZones: ['frontierPad'],
        routeLabel: 'Launch Yard -> South Mesa -> Depot Corridor -> Frontier Relay',
        engineeringFocus: ['Whole-range navigation', 'Fuel-safe routing', 'High-integrity cargo delivery'],
        recommendedModules: ['Wings or efficient forward thrust', 'Extra Fuel for the long cruise', 'Cargo protection and stable landing gear'],
        hazards: ['Long route punishes inefficient hovering', 'Final pad is remote and mistakes cost fuel', 'Gold standard needs both cargo integrity and fuel reserve'],
        gates: [
          { x: 38, y: 10, z: 10, radius: 5.8 },
          { x: 86, y: 18, z: 120, radius: 5.4 },
          { x: 144, y: 28, z: 188, radius: 5.2 },
          { x: 214, y: 22, z: 96, radius: 5.2 },
          { x: 254, y: 16, z: 10, radius: 5.4 },
          { x: 284, y: 16, z: -110, radius: 5.4 },
          { x: 312, y: 12, z: -218, radius: 6.0 }
        ],
        objectives: ['Carry the 10 kg certification package across the full range', 'Pass all seven capstone gates in order', 'Land with at least 30% fuel and 86% cargo integrity']
      }
    ];

    const MISSION_MAP = TEST_RANGE.missionMap;
    const contractById = new Map(CONTRACTS.map(contract => [contract.id, contract]));
    if (contractById.size !== CONTRACTS.length) throw new Error('Contract catalog contains duplicate identifiers.');
    const knownSectorIds = new Set((MISSION_MAP?.sectors || []).map(sector => sector.id));
    for (const sector of MISSION_MAP?.sectors || []) {
      if (!sector.id || !sector.title || !Array.isArray(sector.padIds) || sector.padIds.length < 1) throw new Error('Every mission map sector requires id, title and padIds.');
      for (const padId of sector.padIds) {
        if (!TEST_RANGE.pads?.[padId]) throw new Error(`Mission map sector ${sector.id} references missing pad ${padId}.`);
      }
    }
    for (const contract of CONTRACTS) {
      if (!contract.id || !contract.title || !contract.description) throw new Error('Every contract requires id, title and description.');
      if (!contract.sector || !knownSectorIds.has(contract.sector)) throw new Error(`Contract ${contract.id} references missing mission map sector ${contract.sector}.`);
      if (!Number.isFinite(contract.difficulty) || contract.difficulty < 0) throw new Error(`Contract ${contract.id} has invalid difficulty.`);
      if (!contract.routeLabel || !Array.isArray(contract.engineeringFocus) || contract.engineeringFocus.length < 2) throw new Error(`Contract ${contract.id} needs routeLabel and engineeringFocus.`);
      if (!Array.isArray(contract.recommendedModules) || contract.recommendedModules.length < 1) throw new Error(`Contract ${contract.id} needs recommendedModules.`);
      if (!Array.isArray(contract.hazards) || contract.hazards.length < 1) throw new Error(`Contract ${contract.id} needs hazards.`);
      if (!Array.isArray(contract.objectives) || contract.objectives.length < 2) throw new Error(`Contract ${contract.id} needs at least two objectives.`);
      if (contract.prerequisite && !contractById.has(contract.prerequisite)) throw new Error(`Contract ${contract.id} depends on missing contract ${contract.prerequisite}.`);
      if (contract.kind === 'hover-return') {
        if (!Number.isFinite(contract.targetAltitude) || contract.targetAltitude <= 0) throw new Error(`Contract ${contract.id} needs a positive targetAltitude.`);
        if (!Number.isFinite(contract.holdSeconds) || contract.holdSeconds <= 0) throw new Error(`Contract ${contract.id} needs a positive holdSeconds.`);
      }
      if ((contract.kind === 'gate-course' || contract.kind === 'courier') && (!Array.isArray(contract.gates) || contract.gates.length < 2)) throw new Error(`Contract ${contract.id} needs a meaningful gate route.`);
      if (contract.minFuelFraction && (contract.minFuelFraction <= 0 || contract.minFuelFraction >= 1)) throw new Error(`Contract ${contract.id} has invalid minFuelFraction.`);
      if (contract.minPayloadIntegrity && (contract.minPayloadIntegrity <= 0 || contract.minPayloadIntegrity > 1)) throw new Error(`Contract ${contract.id} has invalid minPayloadIntegrity.`);
      for (const zoneId of contract.landingZones || []) {
        if (!TEST_RANGE.pads?.[zoneId]) throw new Error(`Contract ${contract.id} references missing landing zone ${zoneId}.`);
      }
      let previousGateX = Number.NEGATIVE_INFINITY;
      for (const gate of contract.gates || []) {
        if (![gate.x, gate.y, gate.z, gate.radius].every(Number.isFinite)) throw new Error(`Contract ${contract.id} has a non-finite gate definition.`);
        if (gate.radius <= 0) throw new Error(`Contract ${contract.id} has a non-positive gate radius.`);
        if (Math.abs(gate.x) > TEST_RANGE.bounds || Math.abs(gate.z) > TEST_RANGE.bounds || gate.y > TEST_RANGE.maxAltitude || gate.y < 0) throw new Error(`Contract ${contract.id} has a gate outside the test range.`);
        if (!gate.normal && gate.x < previousGateX) throw new Error(`Contract ${contract.id} has a default +X gate sequence that moves backwards.`);
        previousGateX = gate.x;
      }
    }
    if (!BLOCKS.Core) throw new Error('Block catalog requires a Core module.');

    const contractIds = CONTRACTS.map(contract => contract.id);
    function getContractById(id) { return contractById.get(id) || null; }
    function knownContractIds() { return new Set(contractIds); }

    return deepFreeze({ BLOCKS, CONTRACTS, MISSION_MAP, contractIds, getContractById, knownContractIds });
  });
})();
