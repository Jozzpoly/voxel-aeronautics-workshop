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

    const MISSION_MAP = {
      title: 'Gate C Extended Proving Range',
      summary: 'A larger, less crowded proving range built around a launch yard, a northern ridge shelf, a southern tower line, an eastern depot and a long frontier relay corridor. The contract ladder is intentionally short: each mission should teach a new engineering lesson instead of repeating the same gate run.',
      sectors: [
        { id: 'yard', title: 'Launch Yard', short: 'Basic certification, pad recovery and short control lanes', padIds: ['startPad', 'finishPad'] },
        { id: 'ridge', title: 'North Ridge Survey Line', short: 'Off-axis navigation, drift control and ridge shelf recovery', padIds: ['northPad', 'ridgePad'] },
        { id: 'mesa', title: 'South Mesa Tower Line', short: 'Altitude discipline around the tower and skyhook pads', padIds: ['southPad', 'towerPad', 'skyhookPad'] },
        { id: 'depot', title: 'East Depot Freight Line', short: 'Fuel planning and payload routes around the weather spire', padIds: ['weatherSpirePad', 'eastDepot'] },
        { id: 'frontier', title: 'Frontier Relay Corridor', short: 'The longest current route, ending at the outer relay pad', padIds: ['frontierPad'] }
      ]
    };

    const CONTRACTS = [
      {
        id: 'sandbox', title: 'Sandbox Test', short: 'Free engineering flight', sector: 'yard', difficulty: 0,
        description: 'Use the full extended proving range without objectives, time limits, payload or rewards. Scout the distant pads, practice approaches and deliberately break strange prototypes here before risking a paid contract.',
        reward: 0, payloadMass: 0, timeLimit: 0, kind: 'sandbox', prerequisite: null,
        routeLabel: 'Full range free-flight',
        engineeringFocus: ['Explore the larger test range', 'Practice landing on distant pads', 'Tune stability assist and power settings'],
        recommendedModules: ['Any experimental layout'], hazards: ['No score pressure', 'Good place to learn camera and landing feel'],
        objectives: ['Experiment freely across the full range', 'Scout the distant pads and visual landmarks', 'Return to the workshop whenever ready']
      },
      {
        id: 'hover_license', title: '01 • Hover License', short: 'Basic hover, drift control and pad recovery', sector: 'yard', difficulty: 1,
        description: 'A short but strict certification flight. Climb out of the launch yard, stop the bouncing, level the craft and recover on either yard pad. This mission should make a simple VTOL feel good before the map starts asking for distance.',
        reward: 260, payloadMass: 0, timeLimit: 95, parTime: 50, kind: 'hover-return', prerequisite: null,
        targetAltitude: 8, holdSeconds: 3, landingZones: ['startPad', 'finishPad'],
        routeLabel: 'Launch Yard hover box → either yard pad',
        engineeringFocus: ['Static lift margin', 'Low-speed stability', 'Gentle touchdown control'],
        recommendedModules: ['Thrusters or balloons for clean lift', 'Gyro for easy leveling', 'Fuel reserve for repeated landing attempts'], hazards: ['Hard touchdown loses stars', 'Overpowered craft can bounce above the hover band'],
        objectives: ['Reach 8 m altitude without tumbling', 'Hold a stable hover for 3 seconds', 'Land gently on either marked yard pad']
      },
      {
        id: 'gate_course', title: '02 • Yard Control Course', short: 'A compact route with actual turns', sector: 'yard', difficulty: 2,
        description: 'A near-workshop handling course with a deliberate S-curve, a mild altitude change and a final alignment with the receiver pad. It is short enough for quick iteration, but it should reveal weak yaw control, poor forward thrust balance and unstable landing approaches.',
        reward: 540, payloadMass: 0, timeLimit: 155, parTime: 96, kind: 'gate-course', prerequisite: 'hover_license',
        landingZones: ['finishPad'],
        routeLabel: 'Launch Yard → S-curve control gates → Yard Receiver',
        engineeringFocus: ['Yaw authority', 'Forward thrust balance', 'Recovering from shallow turns'],
        recommendedModules: ['VectorThruster for turning authority', 'Gyro if the craft oscillates', 'Small wings/control surfaces for smoother forward flight'], hazards: ['Do not rush the second gate', 'Final gate points directly into the landing setup'],
        gates: [
          { x: 24, y: 8, z: 4, radius: 5.8 },
          { x: 48, y: 12, z: -14, radius: 5.4 },
          { x: 72, y: 10, z: 16, radius: 5.2 },
          { x: 92, y: 7, z: 0, radius: 5.8 }
        ],
        objectives: ['Pass all four yard gates in order', 'Avoid overcorrecting through the S-turn', 'Land on the receiver pad with the craft under control']
      },
      {
        id: 'courier', title: '03 • Ridge Mail Run', short: 'First meaningful cargo route', sector: 'ridge', difficulty: 3,
        description: 'A light instrument case must be flown out of the yard and delivered to the north survey pad. This is the first mission that rewards a craft that can travel, not just hover. Keep the cargo safe, keep some fuel in reserve and use the northbound gates as a readable approach line.',
        reward: 880, payloadMass: 7, timeLimit: 190, parTime: 122, minFuelFraction: 0.20, minPayloadIntegrity: 0.76, kind: 'courier', prerequisite: 'gate_course',
        landingZones: ['northPad'],
        routeLabel: 'Launch Yard → northern approach → North Survey Pad',
        engineeringFocus: ['Light cargo handling', 'Fuel reserve planning', 'Stable off-axis approach'],
        recommendedModules: ['Extra Fuel if you need more attempts', 'Frame around the payload if landings are rough', 'Forward thrust for the longer northbound leg'], hazards: ['Cargo damage matters now', 'North pad is far enough to expose inefficient builds'],
        gates: [
          { x: 30, y: 8, z: -10, radius: 5.8 },
          { x: 58, y: 12, z: -38, radius: 5.4 },
          { x: 82, y: 10, z: -76, radius: 5.6 }
        ],
        objectives: ['Carry the 7 kg instrument case', 'Pass the northbound delivery gates', 'Land with at least 20% fuel and 76% cargo integrity']
      },
      {
        id: 'heavy_lift', title: '04 • Heavy-Lift Qualification', short: 'Lift margin under real load', sector: 'yard', difficulty: 4,
        description: 'The workshop now checks whether the machine can lift a serious payload without relying on lucky bouncing. This is intentionally a build test more than a travel test: add lift, protect the suspended cargo, hold a controlled hover, then recover gently at the launch pad.',
        reward: 1080, payloadMass: 18, timeLimit: 145, parTime: 90, minPayloadIntegrity: 0.60, kind: 'hover-return', prerequisite: 'courier',
        targetAltitude: 14, holdSeconds: 4.5, landingZones: ['startPad'],
        routeLabel: 'Launch Yard heavy hover → launch-pad recovery',
        engineeringFocus: ['Payload lift margin', 'Vertical damping', 'Low-impact landing under load'],
        recommendedModules: ['Balloons or additional upward thrusters', 'Gyro to stop payload swing', 'Frame reinforcement near the core'], hazards: ['Too little lift fails before it becomes interesting', 'Too much thrust makes the landing bouncy'],
        objectives: ['Lift the 18 kg qualification payload', 'Reach 14 m and hold for 4.5 seconds', 'Recover on the launch pad with at least 60% cargo integrity']
      },
      {
        id: 'ridge_slalom', title: '05 • Ridge Slalom Survey', short: 'Longer off-axis handling route', sector: 'ridge', difficulty: 5,
        description: 'The first real map mission. The course climbs toward the northern shelf, bends across the ridge line and ends on a smaller recovery pad. Fewer gates, more intention: every marker should force the pilot to plan speed, turn radius and altitude instead of simply chasing circles.',
        reward: 1340, payloadMass: 0, timeLimit: 225, parTime: 145, kind: 'gate-course', prerequisite: 'heavy_lift',
        landingZones: ['ridgePad'],
        routeLabel: 'Launch Yard → North Ridge → Ridge Shelf',
        engineeringFocus: ['Sustained turn control', 'Altitude management', 'Small-pad recovery'],
        recommendedModules: ['ControlSurface or vector thrust for cleaner turns', 'Wing lift for efficient cruise', 'Moderate fuel reserve for retrying the final landing'], hazards: ['Final pad is smaller than the yard pads', 'Approach too fast and you overshoot the shelf'],
        gates: [
          { x: 34, y: 10, z: -18, radius: 5.3 },
          { x: 68, y: 16, z: -58, radius: 5.0 },
          { x: 104, y: 18, z: -96, radius: 4.8 },
          { x: 148, y: 12, z: -118, radius: 5.0 }
        ],
        objectives: ['Pass the ridge gates without diving below the shelf line', 'Keep enough control authority for the final turn', 'Land on the Ridge Shelf pad']
      },
      {
        id: 'tower_inspection', title: '06 • South Tower Inspection', short: 'High approach through the mesa line', sector: 'mesa', difficulty: 6,
        description: 'A taller inspection line through the southern mesa. The gates climb gradually, flatten near the tower, then ask for a planned descent. This gives the map a second personality: not just distance, but height management and a clean transition from climb to landing.',
        reward: 1520, payloadMass: 0, timeLimit: 240, parTime: 155, kind: 'gate-course', prerequisite: 'ridge_slalom',
        landingZones: ['towerPad'],
        routeLabel: 'Launch Yard → South Basin → Tower Service Pad',
        engineeringFocus: ['Climb rate', 'High-altitude control', 'Descent planning'],
        recommendedModules: ['Wings help hold altitude efficiently', 'Gyro helps when descending around the tower', 'Extra lift prevents stall-like falls near the last gate'], hazards: ['High gates tempt overclimb', 'Descent control matters more than raw speed'],
        gates: [
          { x: 28, y: 10, z: 24, radius: 5.6 },
          { x: 62, y: 18, z: 66, radius: 5.2 },
          { x: 94, y: 26, z: 112, radius: 5.0 },
          { x: 124, y: 20, z: 148, radius: 5.4 }
        ],
        objectives: ['Climb through the south tower line', 'Avoid entering the final gate too fast', 'Land beside the tower service pad']
      },
      {
        id: 'east_depot_run', title: '07 • East Depot Freight', short: 'Medium cargo over a wider map', sector: 'depot', difficulty: 7,
        description: 'The main freight contract of the current slice. A 12 kg depot package must pass the weather-spire corridor and reach the east cargo pad with a meaningful fuel reserve. The spire gate has been moved beside the landmark instead of through it, so the challenge is navigation and cargo discipline, not unfair collision geometry.',
        reward: 1780, payloadMass: 12, timeLimit: 270, parTime: 182, minFuelFraction: 0.28, minPayloadIntegrity: 0.74, kind: 'courier', prerequisite: 'tower_inspection',
        landingZones: ['eastDepot'],
        routeLabel: 'Launch Yard → Weather Spire side pass → East Cargo Depot',
        engineeringFocus: ['Forward efficiency', 'Cargo protection', 'Fuel reserve discipline'],
        recommendedModules: ['Fuel capacity for the wider map', 'Frame reinforcement around cargo', 'Wings/control surfaces for efficient cruise'], hazards: ['Weather spire is a landmark, not a gate target', 'Depot landing is wide but cargo integrity is checked'],
        gates: [
          { x: 36, y: 9, z: 8, radius: 5.8 },
          { x: 78, y: 13, z: 26, radius: 5.6 },
          { x: 122, y: 16, z: 10, radius: 5.4 },
          { x: 166, y: 17, z: -30, radius: 5.8 },
          { x: 198, y: 10, z: 48, radius: 5.8 }
        ],
        objectives: ['Carry the 12 kg freight package', 'Pass beside the weather spire, not into it', 'Land with at least 28% fuel and 74% cargo integrity']
      },
      {
        id: 'frontier_gold_trial', title: '08 • Frontier Gold Trial', short: 'Final mixed-route certification', sector: 'frontier', difficulty: 8,
        description: 'The capstone is no longer just “more gates.” It combines the whole range: yard departure, south-side climb, depot-side bend, long frontier cruise and a lonely outer-pad recovery. This should make players iterate on real aircraft identity: cargo hauler, winged cruiser, stable VTOL or some weird hybrid that actually works.',
        reward: 2500, payloadMass: 10, timeLimit: 400, parTime: 270, minFuelFraction: 0.30, minPayloadIntegrity: 0.86, kind: 'courier', prerequisite: 'east_depot_run',
        landingZones: ['frontierPad'],
        routeLabel: 'Launch Yard → South Mesa → Depot Corridor → Frontier Relay',
        engineeringFocus: ['Whole-range navigation', 'Fuel-safe routing', 'High-integrity cargo delivery'],
        recommendedModules: ['Wings or efficient forward thrust', 'Extra Fuel for the long cruise', 'Cargo protection and stable landing gear'], hazards: ['Long route punishes inefficient hovering', 'Final pad is remote and mistakes cost fuel', 'Gold standard needs both cargo integrity and fuel reserve'],
        gates: [
          { x: 32, y: 10, z: 10, radius: 5.8 },
          { x: 72, y: 18, z: 86, radius: 5.4 },
          { x: 118, y: 28, z: 142, radius: 5.2 },
          { x: 164, y: 22, z: 70, radius: 5.2 },
          { x: 206, y: 16, z: -28, radius: 5.4 },
          { x: 236, y: 12, z: -152, radius: 6.0 }
        ],
        objectives: ['Carry the 10 kg certification package across the full range', 'Pass all six capstone gates in order', 'Land with at least 30% fuel and 86% cargo integrity']
      }
    ];

    const contractById = new Map(CONTRACTS.map(contract => [contract.id, contract]));
    if (contractById.size !== CONTRACTS.length) throw new Error('Contract catalog contains duplicate identifiers.');
    const knownSectorIds = new Set(MISSION_MAP.sectors.map(sector => sector.id));
    for (const sector of MISSION_MAP.sectors) {
      for (const padId of sector.padIds || []) {
        if (!TEST_RANGE[padId]) throw new Error(`Mission map sector ${sector.id} references missing pad ${padId}.`);
      }
    }
    for (const contract of CONTRACTS) {
      if (!contract.id || !contract.title || !contract.description) throw new Error('Every contract requires id, title and description.');
      if (!contract.routeLabel || !Array.isArray(contract.engineeringFocus) || contract.engineeringFocus.length < 2) throw new Error(`Contract ${contract.id} needs routeLabel and engineeringFocus.`);
      if (!Array.isArray(contract.recommendedModules) || contract.recommendedModules.length < 1) throw new Error(`Contract ${contract.id} needs recommendedModules.`);
      if (!Array.isArray(contract.hazards) || contract.hazards.length < 1) throw new Error(`Contract ${contract.id} needs hazards.`);
      if (!Array.isArray(contract.objectives) || contract.objectives.length < 2) throw new Error(`Contract ${contract.id} needs at least two objectives.`);
      if (contract.prerequisite && !contractById.has(contract.prerequisite)) {
        throw new Error(`Contract ${contract.id} depends on missing contract ${contract.prerequisite}.`);
      }
      if (contract.sector && !knownSectorIds.has(contract.sector)) {
        throw new Error(`Contract ${contract.id} references missing mission map sector ${contract.sector}.`);
      }
      if (contract.kind === 'hover-return') {
        if (!Number.isFinite(contract.targetAltitude) || contract.targetAltitude <= 0) throw new Error(`Contract ${contract.id} needs a positive targetAltitude.`);
        if (!Number.isFinite(contract.holdSeconds) || contract.holdSeconds <= 0) throw new Error(`Contract ${contract.id} needs a positive holdSeconds.`);
      }
      if ((contract.kind === 'gate-course' || contract.kind === 'courier') && (!Array.isArray(contract.gates) || contract.gates.length < 2)) {
        throw new Error(`Contract ${contract.id} needs a meaningful gate route.`);
      }
      if (contract.minFuelFraction && (contract.minFuelFraction <= 0 || contract.minFuelFraction >= 1)) throw new Error(`Contract ${contract.id} has invalid minFuelFraction.`);
      if (contract.minPayloadIntegrity && (contract.minPayloadIntegrity <= 0 || contract.minPayloadIntegrity > 1)) throw new Error(`Contract ${contract.id} has invalid minPayloadIntegrity.`);
      for (const zoneId of contract.landingZones || []) {
        if (!TEST_RANGE[zoneId]) throw new Error(`Contract ${contract.id} references missing landing zone ${zoneId}.`);
      }
      let previousGateX = Number.NEGATIVE_INFINITY;
      for (const gate of contract.gates || []) {
        if (![gate.x, gate.y, gate.z, gate.radius].every(Number.isFinite)) {
          throw new Error(`Contract ${contract.id} has a non-finite gate definition.`);
        }
        if (gate.radius <= 0) throw new Error(`Contract ${contract.id} has a non-positive gate radius.`);
        if (Math.abs(gate.x) > TEST_RANGE.bounds || Math.abs(gate.z) > TEST_RANGE.bounds || gate.y > TEST_RANGE.maxAltitude || gate.y < 0) {
          throw new Error(`Contract ${contract.id} has a gate outside the test range.`);
        }
        if (!gate.normal && gate.x < previousGateX) {
          throw new Error(`Contract ${contract.id} has a default +X gate sequence that moves backwards.`);
        }
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
