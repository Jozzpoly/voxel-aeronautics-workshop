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
      summary: 'A larger, less crowded proving range built around a launch yard, a northern ridge shelf, a southern tower line, an eastern depot and a long frontier relay corridor.',
      sectors: [
        { id: 'yard', title: 'Launch Yard', short: 'Basic certification, pad recovery and short control lanes', padIds: ['startPad', 'finishPad'] },
        { id: 'ridge', title: 'North Ridge Survey Line', short: 'Off-axis navigation, drift control and ridge shelf recovery', padIds: ['northPad', 'ridgePad'] },
        { id: 'mesa', title: 'South Mesa Tower Line', short: 'Altitude discipline around the tower and skyhook pads', padIds: ['southPad', 'towerPad', 'skyhookPad'] },
        { id: 'depot', title: 'East Depot Freight Line', short: 'Fuel planning and payload routes through the weather spire', padIds: ['weatherSpirePad', 'eastDepot'] },
        { id: 'frontier', title: 'Frontier Relay Corridor', short: 'The longest current route, ending at the outer relay pad', padIds: ['frontierPad'] }
      ]
    };

    const CONTRACTS = [
      {
        id: 'sandbox', title: 'Sandbox Test', short: 'Free engineering flight', sector: 'yard', difficulty: 0,
        description: 'Use the full extended proving range without objectives, time limits, payload or rewards. This is now the best place to scout pads, learn the larger map and test unusual airframes before taking a real contract.',
        reward: 0, payloadMass: 0, timeLimit: 0, kind: 'sandbox', prerequisite: null,
        routeLabel: 'Full range free-flight',
        engineeringFocus: ['Explore the larger test range', 'Practice landing on distant pads', 'Tune stability assist and power settings'],
        objectives: ['Experiment freely', 'Scout the distant pads and corridors', 'Return to the workshop whenever ready']
      },
      {
        id: 'hover_license', title: '01 • Hover License', short: 'Basic hover, drift control and pad recovery', sector: 'yard', difficulty: 1,
        description: 'A short but strict certification flight. Climb out of the launch yard, keep the craft level instead of bouncing, then recover on either clearly marked yard pad. This contract is intentionally simple, but it teaches the landing rules that every later route depends on.',
        reward: 260, payloadMass: 0, timeLimit: 95, parTime: 50, kind: 'hover-return', prerequisite: null,
        targetAltitude: 8, holdSeconds: 3, landingZones: ['startPad', 'finishPad'],
        routeLabel: 'Launch Yard hover box → either yard pad',
        engineeringFocus: ['Static lift margin', 'Low-speed stability', 'Gentle touchdown control'],
        objectives: ['Reach 8 m altitude without tumbling', 'Hold a stable hover for 3 seconds', 'Land on either marked yard pad']
      },
      {
        id: 'gate_course', title: '02 • Yard Control Course', short: 'A compact route with actual turns', sector: 'yard', difficulty: 2,
        description: 'The old control course was too short and too similar to later missions. This version stays near the workshop but adds a deliberate S-curve, a mild altitude change and a final alignment with the receiver pad. It should reveal weak yaw control before the player reaches the larger map.',
        reward: 520, payloadMass: 0, timeLimit: 150, parTime: 92, kind: 'gate-course', prerequisite: 'hover_license',
        landingZones: ['finishPad'],
        routeLabel: 'Launch Yard → S-curve control gates → Yard Receiver',
        engineeringFocus: ['Yaw authority', 'Forward thrust balance', 'Recovering from shallow turns'],
        gates: [
          { x: 24, y: 8, z: 4, radius: 5.8 },
          { x: 48, y: 12, z: -14, radius: 5.4 },
          { x: 72, y: 10, z: 16, radius: 5.2 },
          { x: 92, y: 7, z: 0, radius: 5.8 }
        ],
        objectives: ['Pass all four yard gates in order', 'Avoid overcorrecting through the S-turn', 'Land on the receiver pad']
      },
      {
        id: 'courier', title: '03 • Ridge Mail Run', short: 'First meaningful cargo route', sector: 'ridge', difficulty: 3,
        description: 'A light instrument case must be flown out of the yard and delivered to the north survey pad. The route is longer than the early course and moves off the main runway, so the craft needs enough forward authority, fuel discipline and cargo-safe landing behavior.',
        reward: 880, payloadMass: 9, timeLimit: 180, parTime: 112, minFuelFraction: 0.22, minPayloadIntegrity: 0.75, kind: 'courier', prerequisite: 'gate_course',
        landingZones: ['northPad'],
        routeLabel: 'Launch Yard → weather approach → North Survey Pad',
        engineeringFocus: ['Light cargo handling', 'Fuel reserve planning', 'Stable off-axis approach'],
        gates: [
          { x: 30, y: 8, z: -10, radius: 5.8 },
          { x: 58, y: 12, z: -38, radius: 5.4 },
          { x: 82, y: 10, z: -76, radius: 5.6 }
        ],
        objectives: ['Carry the 9 kg instrument case', 'Pass the northbound delivery gates', 'Land with at least 22% fuel and 75% cargo integrity']
      },
      {
        id: 'heavy_lift', title: '04 • Heavy-Lift Qualification', short: 'Lift margin under real load', sector: 'yard', difficulty: 4,
        description: 'Before the range opens fully, the workshop checks whether the machine can lift a serious payload without relying on lucky bouncing. The craft must climb, hold a controlled hover with the cargo mounted below the core, then recover gently at the launch pad.',
        reward: 1050, payloadMass: 22, timeLimit: 135, parTime: 82, minPayloadIntegrity: 0.58, kind: 'hover-return', prerequisite: 'courier',
        targetAltitude: 14, holdSeconds: 4.5, landingZones: ['startPad'],
        routeLabel: 'Launch Yard heavy hover → launch-pad recovery',
        engineeringFocus: ['Payload lift margin', 'Vertical damping', 'Low-impact landing under load'],
        objectives: ['Lift the 22 kg qualification payload', 'Reach 14 m and hold for 4.5 seconds', 'Recover on the launch pad with at least 58% cargo integrity']
      },
      {
        id: 'ridge_slalom', title: '05 • Ridge Slalom Survey', short: 'Longer off-axis handling route', sector: 'ridge', difficulty: 5,
        description: 'This is the first real map mission. The course climbs toward the northern shelf, threads around the ridge line, then asks for a small-pad recovery. It has fewer gates than the previous bloated ladder, but each gate is placed to test turn planning and altitude discipline.',
        reward: 1320, payloadMass: 0, timeLimit: 215, parTime: 135, kind: 'gate-course', prerequisite: 'heavy_lift',
        landingZones: ['ridgePad'],
        routeLabel: 'Launch Yard → North Ridge → Ridge Shelf',
        engineeringFocus: ['Sustained turn control', 'Altitude management', 'Small-pad recovery'],
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
        description: 'A taller, more scenic inspection line through the southern mesa. The gates climb gradually toward the tower pad and then flatten into a precise landing approach. This mission gives the expanded map a second personality: not just distance, but height and controlled descent.',
        reward: 1500, payloadMass: 0, timeLimit: 230, parTime: 145, kind: 'gate-course', prerequisite: 'ridge_slalom',
        landingZones: ['towerPad'],
        routeLabel: 'Launch Yard → South Basin → Tower Service Pad',
        engineeringFocus: ['Climb rate', 'High-altitude control', 'Descent planning'],
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
        description: 'The main freight contract of the current slice. A 16 kg depot package must pass the weather spire and reach the east cargo pad with a meaningful fuel reserve. This should force the player to build something more capable than a pure hover brick.',
        reward: 1780, payloadMass: 16, timeLimit: 255, parTime: 168, minFuelFraction: 0.30, minPayloadIntegrity: 0.72, kind: 'courier', prerequisite: 'tower_inspection',
        landingZones: ['eastDepot'],
        routeLabel: 'Launch Yard → Weather Spire → East Cargo Depot',
        engineeringFocus: ['Forward efficiency', 'Cargo protection', 'Fuel reserve discipline'],
        gates: [
          { x: 36, y: 9, z: 8, radius: 5.8 },
          { x: 78, y: 13, z: 26, radius: 5.6 },
          { x: 122, y: 16, z: 10, radius: 5.4 },
          { x: 166, y: 14, z: -12, radius: 5.4 },
          { x: 198, y: 10, z: 48, radius: 5.8 }
        ],
        objectives: ['Carry the 16 kg freight package', 'Pass the weather-spire delivery corridor', 'Land with at least 30% fuel and 72% cargo integrity']
      },
      {
        id: 'frontier_gold_trial', title: '08 • Frontier Gold Trial', short: 'Final mixed-route certification', sector: 'frontier', difficulty: 8,
        description: 'The final contract is no longer just “more gates.” It combines everything: long-range planning, a high south-side climb, a route bend back through the depot corridor, then a lonely recovery at the frontier relay pad. It is fewer missions worth of content compressed into one proper capstone.',
        reward: 2450, payloadMass: 14, timeLimit: 380, parTime: 250, minFuelFraction: 0.32, minPayloadIntegrity: 0.88, kind: 'courier', prerequisite: 'east_depot_run',
        landingZones: ['frontierPad'],
        routeLabel: 'Launch Yard → South Mesa → Depot Corridor → Frontier Relay',
        engineeringFocus: ['Whole-range navigation', 'Fuel-safe routing', 'High-integrity cargo delivery'],
        gates: [
          { x: 32, y: 10, z: 10, radius: 5.8 },
          { x: 72, y: 18, z: 86, radius: 5.4 },
          { x: 118, y: 28, z: 142, radius: 5.2 },
          { x: 164, y: 22, z: 70, radius: 5.2 },
          { x: 206, y: 16, z: -28, radius: 5.4 },
          { x: 236, y: 12, z: -152, radius: 6.0 }
        ],
        objectives: ['Carry the 14 kg certification package across the full range', 'Pass all six capstone gates in order', 'Land with at least 32% fuel and 88% cargo integrity']
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
