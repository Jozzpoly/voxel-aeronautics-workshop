const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/kernel.js'), 'utf8'), { filename: 'kernel.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'src/foundation/aerostatics.js'), 'utf8'), { filename: 'aerostatics.js' });

const Aerostatics = global.VAW.require('foundation.aerostatics');
const policy = Aerostatics.normalizePolicy({ scaleHeight: 72, minimumEfficiency: 0.06, gravity: 9.81, verticalDampingRate: 0.52, maxDampingWeightRatio: 0.10, minimumDampingActivation: 0.08 });
assert.strictEqual(Aerostatics.liftEfficiencyAtAltitude(0, policy), 1);
assert(Aerostatics.liftEfficiencyAtAltitude(20, policy) < 1);
assert(Aerostatics.liftEfficiencyAtAltitude(60, policy) < Aerostatics.liftEfficiencyAtAltitude(20, policy));

const seaLevelRequired = Aerostatics.requiredPowerForHover({ weight: 500, passiveLift: 100, maxSeaLevelLift: 800, altitude: 0 }, policy);
assert(Math.abs(seaLevelRequired - 0.5) < 1e-9);
const highRequired = Aerostatics.requiredPowerForHover({ weight: 500, passiveLift: 100, maxSeaLevelLift: 800, altitude: 30 }, policy);
assert(highRequired > seaLevelRequired, 'Hover power must rise with altitude.');
const equilibrium = Aerostatics.equilibriumAltitude({ weight: 500, passiveLift: 100, maxSeaLevelLift: 800, power: 0.75 }, policy);
assert(Number.isFinite(equilibrium) && equilibrium > 0);
const efficiencyAtEquilibrium = Aerostatics.liftEfficiencyAtAltitude(equilibrium, policy);
assert(Math.abs(800 * 0.75 * efficiencyAtEquilibrium + 100 - 500) < 1e-6);
assert.strictEqual(Aerostatics.equilibriumAltitude({ weight: 500, passiveLift: 100, maxSeaLevelLift: 800, power: 0.4 }, policy), null);

assert.strictEqual(Aerostatics.equilibriumAltitude({ weight: 500, passiveLift: 100, maxSeaLevelLift: 800, power: 0.5 }, policy), 0);
const noFiniteCeiling = Aerostatics.equilibriumAltitude({ weight: 100, passiveLift: 0, maxSeaLevelLift: 2000, power: 1 }, policy);
assert.strictEqual(noFiniteCeiling, Number.POSITIVE_INFINITY, 'Minimum-efficiency floor can imply continued climb.');


const upwardDamping = Aerostatics.verticalDampingForce({ mass: 100, verticalSpeed: 2, commandedLift: 981, weight: 981 }, policy);
const downwardDamping = Aerostatics.verticalDampingForce({ mass: 100, verticalSpeed: -2, commandedLift: 981, weight: 981 }, policy);
assert(upwardDamping < 0 && downwardDamping > 0, 'Aerostatic damping must oppose vertical motion.');
assert(Math.abs(upwardDamping) <= 98.1 + 1e-9, 'Damping must remain capped to a small fraction of weight.');
assert.strictEqual(Aerostatics.verticalDampingForce({ mass: 100, verticalSpeed: 2, commandedLift: 0, weight: 981 }, policy), 0, 'Balloons at zero effective lift must not create hidden damping.');
assert.strictEqual(Aerostatics.verticalDampingForce({ mass: 100, verticalSpeed: 0, commandedLift: 981, weight: 981 }, policy), 0);

console.log(JSON.stringify({ altitudeFalloff: 'ok', neutralPower: 'ok', equilibriumHeight: 'ok', mildVerticalDamping: 'ok' }, null, 2));
