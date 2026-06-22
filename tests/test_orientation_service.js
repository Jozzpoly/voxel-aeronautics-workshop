const assert = require('assert');
const { FOUNDATION_SOURCES, load } = require('./load_runtime');
load([...FOUNDATION_SOURCES, 'src/game/orientation_service.js'], { stubs: true });

const OrientationService = VAW.require('game.orientation-service').create({ THREE });
const core = OrientationService.semanticOrientationReadout('Core', 0);
assert.strictEqual(core.axisLabel, 'Forward');
assert(core.axis.startsWith('Forward '));
assert(core.up.startsWith('Up '));

const thruster = OrientationService.semanticOrientationReadout('Thruster', 0);
assert.strictEqual(thruster.axisLabel, 'Thrust');
assert.strictEqual(thruster.up, 'N/A');

const wing = OrientationService.semanticOrientationReadout('Wing', 0);
assert.strictEqual(wing.axisLabel, 'Chord');
assert.strictEqual(wing.upLabel, 'Lift normal');

const control = OrientationService.semanticOrientationReadout('ControlSurface', 0, 'yaw', -1);
assert.strictEqual(control.axisLabel, 'Chord');
assert.strictEqual(control.upLabel, 'Lift normal');
assert(control.hint.includes('YAW'));
assert(control.hint.includes('NEGATIVE'));

const hull = OrientationService.semanticOrientationReadout('Hull', 0);
assert.strictEqual(hull.axis, 'N/A');
assert.strictEqual(hull.hint, 'No orientation used');

console.log({ orientationSemantics: 'ok' });
