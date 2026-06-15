(() => {
  'use strict';

  window.VAW.define('foundation.catalog', ['foundation.config'], config => {
    const { deepFreeze } = config;

    const BLOCKS = {
      Core:     { mass: 6.0, color: 0x9f7aea, desc: 'Command anchor and flight computer.', orientationMode: 'none', dragArea: 0.18, durability: 260, structural: 2.5 },
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
        id: 'sandbox', title: 'Sandbox Test', short: 'Free engineering flight',
        description: 'Use the complete test range without objectives, time limits, payload or rewards.',
        reward: 0, payloadMass: 0, timeLimit: 0, kind: 'sandbox', prerequisite: null,
        objectives: ['Experiment freely', 'Return to the workshop whenever ready']
      },
      {
        id: 'hover_license', title: '01 • Hover License', short: 'Altitude and safe recovery',
        description: 'Prove that the craft can climb under its own power, hold altitude and return without destroying the airframe.',
        reward: 220, payloadMass: 0, timeLimit: 90, parTime: 45, kind: 'hover-return', prerequisite: null,
        targetAltitude: 8, holdSeconds: 3,
        objectives: ['Reach 8 m altitude', 'Hold altitude for 3 seconds', 'Land on the launch pad']
      },
      {
        id: 'gate_course', title: '02 • Control Course', short: 'Three-dimensional handling',
        description: 'Fly through the marked gates in order and settle on the remote landing pad. Stable control matters more than raw speed.',
        reward: 420, payloadMass: 0, timeLimit: 130, parTime: 75, kind: 'gate-course', prerequisite: 'hover_license',
        gates: [
          { x: 22, y: 8, z: 0, radius: 5 },
          { x: 44, y: 12, z: 10, radius: 5 },
          { x: 66, y: 8, z: 0, radius: 5 }
        ],
        objectives: ['Pass all three gates in order', 'Land on the remote pad']
      },
      {
        id: 'courier', title: '03 • Workshop Courier', short: 'Payload and fuel discipline',
        description: 'Carry a 10 kg instrument crate through the route and deliver it with at least 25% fuel remaining.',
        reward: 680, payloadMass: 10, timeLimit: 150, parTime: 95, minFuelFraction: 0.25, minPayloadIntegrity: 0.65, kind: 'courier', prerequisite: 'gate_course',
        gates: [
          { x: 28, y: 7, z: -8, radius: 5.5 },
          { x: 58, y: 10, z: 8, radius: 5.5 }
        ],
        objectives: ['Carry the 10 kg payload', 'Pass both delivery gates', 'Land with at least 25% fuel and 65% cargo integrity']
      },
      {
        id: 'heavy_lift', title: '04 • Heavy-Lift Trial', short: 'Lift a serious payload',
        description: 'A reinforced 20 kg test payload is attached to the command core. Climb to 12 m, hold, then recover at the launch pad.',
        reward: 900, payloadMass: 20, timeLimit: 120, parTime: 70, minPayloadIntegrity: 0.50, kind: 'hover-return', prerequisite: 'courier',
        targetAltitude: 12, holdSeconds: 4,
        objectives: ['Lift the 20 kg payload', 'Reach 12 m and hold for 4 seconds', 'Land with at least 50% cargo integrity']
      }
    ];

    const contractById = new Map(CONTRACTS.map(contract => [contract.id, contract]));
    if (contractById.size !== CONTRACTS.length) throw new Error('Contract catalog contains duplicate identifiers.');
    for (const contract of CONTRACTS) {
      if (contract.prerequisite && !contractById.has(contract.prerequisite)) {
        throw new Error(`Contract ${contract.id} depends on missing contract ${contract.prerequisite}.`);
      }
    }
    if (!BLOCKS.Core) throw new Error('Block catalog requires a Core module.');

    const contractIds = CONTRACTS.map(contract => contract.id);
    function getContractById(id) { return contractById.get(id) || null; }
    function knownContractIds() { return new Set(contractIds); }

    return deepFreeze({ BLOCKS, CONTRACTS, contractIds, getContractById, knownContractIds });
  });
})();
