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
      title: 'Gate C Proving Range',
      summary: 'A chained workshop test range with certification pads, survey lines, freight routes and a frontier relay corridor.',
      sectors: [
        { id: 'yard', title: 'Launch Yard', short: 'Certification, recovery and basic control', padIds: ['startPad', 'finishPad'] },
        { id: 'north', title: 'North Survey Line', short: 'Crosswind-style gates and ridge recovery', padIds: ['northPad', 'ridgePad'] },
        { id: 'south', title: 'South Tower Line', short: 'High-altitude handling around the tower pad', padIds: ['southPad', 'towerPad'] },
        { id: 'frontier', title: 'Frontier Freight Line', short: 'Long payload runs to the outer depot', padIds: ['eastDepot', 'frontierPad'] }
      ]
    };

    const CONTRACTS = [
      {
        id: 'sandbox', title: 'Sandbox Test', short: 'Free engineering flight', sector: 'yard', difficulty: 0,
        description: 'Use the complete test range without objectives, time limits, payload or rewards.',
        reward: 0, payloadMass: 0, timeLimit: 0, kind: 'sandbox', prerequisite: null,
        objectives: ['Experiment freely', 'Return to the workshop whenever ready']
      },
      {
        id: 'hover_license', title: '01 • Hover License', short: 'Altitude and safe recovery', sector: 'yard', difficulty: 1,
        description: 'Prove that the craft can climb under its own power, hold altitude and recover safely on either marked test pad.',
        reward: 220, payloadMass: 0, timeLimit: 90, parTime: 45, kind: 'hover-return', prerequisite: null,
        targetAltitude: 8, holdSeconds: 3, landingZones: ['startPad', 'finishPad'],
        objectives: ['Reach 8 m altitude', 'Hold altitude for 3 seconds', 'Land on either marked test pad']
      },
      {
        id: 'gate_course', title: '02 • Control Course', short: 'Three-dimensional handling', sector: 'yard', difficulty: 2,
        description: 'Fly through the marked gates in order and settle on the remote landing pad. Stable control matters more than raw speed.',
        reward: 420, payloadMass: 0, timeLimit: 130, parTime: 75, kind: 'gate-course', prerequisite: 'hover_license',
        landingZones: ['finishPad'],
        gates: [
          { x: 22, y: 8, z: 0, radius: 5 },
          { x: 44, y: 12, z: 10, radius: 5 },
          { x: 66, y: 8, z: 0, radius: 5 }
        ],
        objectives: ['Pass all three gates in order', 'Land on the remote pad']
      },
      {
        id: 'courier', title: '03 • Workshop Courier', short: 'Payload and fuel discipline', sector: 'yard', difficulty: 3,
        description: 'Carry a 10 kg instrument crate through the route and deliver it with at least 25% fuel remaining.',
        reward: 680, payloadMass: 10, timeLimit: 150, parTime: 95, minFuelFraction: 0.25, minPayloadIntegrity: 0.65, kind: 'courier', prerequisite: 'gate_course',
        landingZones: ['finishPad'],
        gates: [
          { x: 28, y: 7, z: -8, radius: 5.5 },
          { x: 58, y: 10, z: 8, radius: 5.5 }
        ],
        objectives: ['Carry the 10 kg payload', 'Pass both delivery gates', 'Land with at least 25% fuel and 65% cargo integrity']
      },
      {
        id: 'heavy_lift', title: '04 • Heavy-Lift Trial', short: 'Lift a serious payload', sector: 'yard', difficulty: 4,
        description: 'A reinforced 20 kg test payload is attached to the command core. Climb to 12 m, hold, then recover at the launch pad.',
        reward: 900, payloadMass: 20, timeLimit: 120, parTime: 70, minPayloadIntegrity: 0.50, kind: 'hover-return', prerequisite: 'courier',
        targetAltitude: 12, holdSeconds: 4, landingZones: ['startPad'],
        objectives: ['Lift the 20 kg payload', 'Reach 12 m and hold for 4 seconds', 'Land with at least 50% cargo integrity']
      },
      {
        id: 'precision_return', title: '05 • Precision Return', short: 'Tight launch-pad recovery', sector: 'yard', difficulty: 4,
        description: 'Repeat the hover certification with a longer hold and a stricter single-pad recovery target at the launch yard.',
        reward: 560, payloadMass: 0, timeLimit: 95, parTime: 55, kind: 'hover-return', prerequisite: 'heavy_lift',
        targetAltitude: 10, holdSeconds: 5, landingZones: ['startPad'],
        objectives: ['Reach 10 m altitude', 'Hold a stable hover for 5 seconds', 'Settle back on the launch pad']
      },
      {
        id: 'north_survey', title: '06 • North Survey', short: 'First off-axis route', sector: 'north', difficulty: 5,
        description: 'Leave the launch yard and fly a shallow northern survey line to the new north recovery pad.',
        reward: 760, payloadMass: 0, timeLimit: 145, parTime: 90, kind: 'gate-course', prerequisite: 'precision_return',
        landingZones: ['northPad'],
        gates: [
          { x: 24, y: 8, z: -12, radius: 5.2 },
          { x: 48, y: 12, z: -28, radius: 5.2 },
          { x: 58, y: 10, z: -48, radius: 5.2 }
        ],
        objectives: ['Pass the three north survey gates', 'Land on the north pad']
      },
      {
        id: 'ridge_slalom', title: '07 • Ridge Slalom', short: 'Four-gate ridge handling', sector: 'north', difficulty: 6,
        description: 'Thread the craft through a longer ridge course where turns and altitude discipline matter more than straight-line speed.',
        reward: 980, payloadMass: 0, timeLimit: 170, parTime: 105, kind: 'gate-course', prerequisite: 'north_survey',
        landingZones: ['ridgePad'],
        gates: [
          { x: 32, y: 10, z: -18, radius: 4.8 },
          { x: 62, y: 15, z: -42, radius: 4.8 },
          { x: 92, y: 12, z: -28, radius: 4.8 },
          { x: 118, y: 10, z: -34, radius: 4.8 }
        ],
        objectives: ['Pass all four ridge gates in order', 'Recover on the ridge pad']
      },
      {
        id: 'southern_tower', title: '08 • Southern Tower', short: 'High approach and recovery', sector: 'south', difficulty: 6,
        description: 'Climb into the southern tower line, pass the elevated markers and land beside the tower pad.',
        reward: 900, payloadMass: 0, timeLimit: 160, parTime: 100, kind: 'gate-course', prerequisite: 'ridge_slalom',
        landingZones: ['towerPad'],
        gates: [
          { x: 20, y: 9, z: 20, radius: 5.0 },
          { x: 34, y: 18, z: 46, radius: 5.0 },
          { x: 42, y: 22, z: 84, radius: 5.2 }
        ],
        objectives: ['Pass the elevated south gates', 'Land on the tower pad']
      },
      {
        id: 'fragile_instruments', title: '09 • Fragile Instruments', short: 'Careful cargo delivery', sector: 'north', difficulty: 7,
        description: 'Carry a delicate 8 kg instrument package to the north pad. The cargo must arrive in excellent condition.',
        reward: 1050, payloadMass: 8, timeLimit: 145, parTime: 92, minFuelFraction: 0.20, minPayloadIntegrity: 0.82, kind: 'courier', prerequisite: 'southern_tower',
        landingZones: ['northPad'],
        gates: [
          { x: 28, y: 9, z: -8, radius: 5.0 },
          { x: 50, y: 11, z: -34, radius: 5.0 }
        ],
        objectives: ['Carry the fragile 8 kg package', 'Avoid hard impacts', 'Deliver with at least 82% cargo integrity']
      },
      {
        id: 'endurance_loop', title: '10 • Endurance Loop', short: 'Long route, home recovery', sector: 'south', difficulty: 8,
        description: 'Fly a wide loop through the range and return to the launch yard with enough fuel and structure to be certified.',
        reward: 1180, payloadMass: 0, timeLimit: 230, parTime: 150, minFuelFraction: 0.18, kind: 'gate-course', prerequisite: 'fragile_instruments',
        landingZones: ['startPad'],
        gates: [
          { x: 22, y: 9, z: 18, radius: 5.5 },
          { x: 58, y: 15, z: 52, radius: 5.5 },
          { x: 96, y: 14, z: 18, radius: 5.5 },
          { x: 122, y: 10, z: -18, radius: 5.5 }
        ],
        objectives: ['Pass all four loop gates', 'Return and settle on the launch pad', 'Keep a useful fuel reserve']
      },
      {
        id: 'east_depot_run', title: '11 • East Depot Run', short: 'Medium payload freight', sector: 'frontier', difficulty: 9,
        description: 'Deliver a 15 kg depot package through the eastern corridor and land at the freight pad with fuel to spare.',
        reward: 1350, payloadMass: 15, timeLimit: 190, parTime: 122, minFuelFraction: 0.28, minPayloadIntegrity: 0.72, kind: 'courier', prerequisite: 'endurance_loop',
        landingZones: ['eastDepot'],
        gates: [
          { x: 38, y: 8, z: 12, radius: 5.5 },
          { x: 78, y: 11, z: 25, radius: 5.5 },
          { x: 118, y: 9, z: 32, radius: 5.5 }
        ],
        objectives: ['Carry the 15 kg depot package', 'Pass the eastern corridor gates', 'Land with at least 28% fuel and 72% cargo integrity']
      },
      {
        id: 'frontier_relay', title: '12 • Frontier Relay', short: 'Outer-range navigation', sector: 'frontier', difficulty: 10,
        description: 'Navigate the longest gate chain in the current range and prove the craft can reach the frontier pad safely.',
        reward: 1550, payloadMass: 0, timeLimit: 220, parTime: 140, kind: 'gate-course', prerequisite: 'east_depot_run',
        landingZones: ['frontierPad'],
        gates: [
          { x: 44, y: 13, z: -16, radius: 5.4 },
          { x: 86, y: 20, z: -44, radius: 5.4 },
          { x: 126, y: 15, z: -62, radius: 5.4 },
          { x: 166, y: 12, z: -72, radius: 5.6 }
        ],
        objectives: ['Pass all four frontier relay gates', 'Land on the frontier pad']
      },
      {
        id: 'heavy_frontier_lift', title: '13 • Heavy Frontier Lift', short: 'Heavy cargo over distance', sector: 'frontier', difficulty: 11,
        description: 'Move a 24 kg reinforced cargo pod to the frontier pad. This demands lift margin, fuel planning and gentle touchdown.',
        reward: 1900, payloadMass: 24, timeLimit: 240, parTime: 160, minFuelFraction: 0.22, minPayloadIntegrity: 0.55, kind: 'courier', prerequisite: 'frontier_relay',
        landingZones: ['frontierPad'],
        gates: [
          { x: 34, y: 8, z: -10, radius: 6.0 },
          { x: 92, y: 10, z: -38, radius: 6.0 },
          { x: 146, y: 8, z: -66, radius: 6.0 }
        ],
        objectives: ['Carry the 24 kg cargo pod', 'Pass the heavy-lift corridor gates', 'Deliver with at least 55% cargo integrity']
      },
      {
        id: 'gold_range_trial', title: '14 • Gold Range Trial', short: 'Full-range certification', sector: 'frontier', difficulty: 12,
        description: 'A final full-range trial combining payload discipline, fuel reserve, precise gates and a return to the workshop remote pad.',
        reward: 2400, payloadMass: 12, timeLimit: 210, parTime: 135, minFuelFraction: 0.35, minPayloadIntegrity: 0.90, kind: 'courier', prerequisite: 'heavy_frontier_lift',
        landingZones: ['finishPad'],
        gates: [
          { x: 30, y: 10, z: 0, radius: 5.0 },
          { x: 58, y: 16, z: -34, radius: 5.0 },
          { x: 94, y: 16, z: 34, radius: 5.0 },
          { x: 132, y: 12, z: 0, radius: 5.0 }
        ],
        objectives: ['Carry the 12 kg certification package', 'Pass all four gold trial gates', 'Land with 35% fuel and 90% cargo integrity']
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
      if (contract.prerequisite && !contractById.has(contract.prerequisite)) {
        throw new Error(`Contract ${contract.id} depends on missing contract ${contract.prerequisite}.`);
      }
      if (contract.sector && !knownSectorIds.has(contract.sector)) {
        throw new Error(`Contract ${contract.id} references missing mission map sector ${contract.sector}.`);
      }
      for (const zoneId of contract.landingZones || []) {
        if (!TEST_RANGE[zoneId]) throw new Error(`Contract ${contract.id} references missing landing zone ${zoneId}.`);
      }
      for (const gate of contract.gates || []) {
        if (![gate.x, gate.y, gate.z, gate.radius].every(Number.isFinite)) {
          throw new Error(`Contract ${contract.id} has a non-finite gate definition.`);
        }
        if (Math.abs(gate.x) > TEST_RANGE.bounds || Math.abs(gate.z) > TEST_RANGE.bounds || gate.y > TEST_RANGE.maxAltitude) {
          throw new Error(`Contract ${contract.id} has a gate outside the test range.`);
        }
      }
    }
    if (!BLOCKS.Core) throw new Error('Block catalog requires a Core module.');

    const contractIds = CONTRACTS.map(contract => contract.id);
    function getContractById(id) { return contractById.get(id) || null; }
    function knownContractIds() { return new Set(contractIds); }

    return deepFreeze({ BLOCKS, CONTRACTS, MISSION_MAP, contractIds, getContractById, knownContractIds });
  });
})();
