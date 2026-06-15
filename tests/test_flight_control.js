const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });
for (const relative of ['src/foundation/kernel.js', 'src/foundation/config.js', 'src/foundation/orientation.js', 'src/foundation/control_frame.js', 'src/foundation/input_profile.js', 'src/foundation/flight_control.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}
const FlightControl = global.VAW.require('foundation.flight-control');

assert.strictEqual(FlightControl.actionForInput('a', 'KeyA'), 'yaw+', 'A must command left yaw.');
assert.strictEqual(FlightControl.actionForInput('d', 'KeyD'), 'yaw-', 'D must command right yaw.');
assert.strictEqual(FlightControl.actionForInput('w', 'KeyW'), 'surge+');
assert.strictEqual(FlightControl.actionForInput('s', 'KeyS'), 'surge-');
assert.strictEqual(FlightControl.actionForInput(' ', 'Space'), 'lift+');
assert.strictEqual(FlightControl.actionForInput('Control', 'ControlLeft'), 'lift-');
assert.strictEqual(FlightControl.actionForInput('ArrowUp', 'ArrowUp'), 'pitch+');
assert.strictEqual(FlightControl.actionForInput('z', 'KeyZ'), 'sway-');
assert.strictEqual(FlightControl.actionForInput('c', 'KeyC'), 'sway+');

const profile = global.VAW.require('foundation.input-profile').createDefault();
const pilot = FlightControl.pilotFromActions(new Set(['yaw+', 'surge+', 'lift-', 'roll-', 'sway+']), profile);
assert.deepStrictEqual(pilot, { pitch: 0, yaw: 1, roll: -1, surge: 1, sway: 1, lift: -1 });
assert(Object.isFrozen(pilot));
const pitched = FlightControl.pilotFromActions(new Set(['pitch+']), profile);
assert.strictEqual(pitched.pitch, -1, 'Default profile fixes the legacy inverted pitch direction.');
const customProfile = global.VAW.require('foundation.input-profile').updateAxis(profile, 'pitch', { invert: false, sensitivity: 0.5 });
assert.strictEqual(FlightControl.pilotFromActions(new Set(['pitch+']), customProfile).pitch, 0.5);
const defaultFrame = global.VAW.require('foundation.control-frame').fromCore(null);
assert.deepStrictEqual(FlightControl.pilotToBodyFrame({ pitch: 1, yaw: 0, roll: 0, surge: 0, sway: 0, lift: 0 }, defaultFrame), { pitch: 1, yaw: 0, roll: 0, surge: 0, lift: 0, sway: 0 });


const ControlFrame = global.VAW.require('foundation.control-frame');
const Orientation = global.VAW.require('foundation.orientation');
const sideOrientation = Orientation.findOrientationId(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
const sideFrame = ControlFrame.fromCore({ key: '0,0,0', grid: [0,0,0], orientation: sideOrientation });
assert.deepStrictEqual(
  FlightControl.pilotToBodyFrame({ pitch: 0, yaw: 0, roll: 0, surge: 1, sway: 0, lift: 0 }, sideFrame),
  { pitch: 0, yaw: 0, roll: 0, surge: 0, lift: 0, sway: 1 },
  'Forward intent must follow the oriented Command Core.'
);

const close = (a, b) => Math.abs(a - b) < 1e-9;

// Passive thrust exists only on local +Y engines.
assert(close(FlightControl.neutralCommand([0, 1, 0], 0.7), 0.7), 'Upward engines receive passive vertical thrust.');
assert(close(FlightControl.neutralCommand([1, 0, 0], 0.7), 0), 'Horizontal engines idle without a pilot request.');
assert(close(FlightControl.neutralCommand([0, -1, 0], 0.7), 0), 'Downward engines idle without a downward request.');
assert(close(FlightControl.neutralCommand([0, 1, 0], 0), 0));

// Direct input is independent from the passive-thrust slider.
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: 0 }, 0.5), 0.5));
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: 1 }, 0.5), 1), 'Space must be able to command full upward thrust.');
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: -1 }, 0.7), 0), 'Left Ctrl must reduce passive upward thrust instead of activating it.');
assert(close(FlightControl.applyTranslationMix([0, -1, 0], { lift: -1 }, 0), 1), 'Left Ctrl must activate downward-facing engines from idle.');
assert(close(FlightControl.applyTranslationMix([0, -1, 0], { lift: 1 }, 0), 0), 'Space must not activate downward-facing engines.');
assert(close(FlightControl.applyTranslationMix([1, 0, 0], { surge: 1 }, 0), 1), 'W must command full forward thrust even when passive thrust is zero.');
assert(close(FlightControl.applyTranslationMix([-1, 0, 0], { surge: 1 }, 0), 0));
const diagonal = FlightControl.applyTranslationMix([1, 0, 0], { surge: 1, lift: 1 }, 0);
assert(diagonal > 0 && diagonal < 1, 'Combined translation must be normalized and remain bounded.');

console.log(JSON.stringify({
  yawDirection: 'ok',
  sixAxisBindings: 'ok',
  pilotAggregation: 'ok',
  passiveThrustIndependentFromPilotAuthority: 'ok',
  downwardThrusterDirection: 'ok'
}, null, 2));
