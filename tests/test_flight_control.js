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
const InputProfile = global.VAW.require('foundation.input-profile');
const FlightControl = global.VAW.require('foundation.flight-control');
const profile = InputProfile.createDefault();

assert.strictEqual(profile.version, 3, 'Input profile must persist guided power-control bindings.');
assert.strictEqual(FlightControl.actionForInput('KeyA', profile), 'yaw+', 'A must command left yaw.');
assert.strictEqual(FlightControl.actionForInput('KeyD', profile), 'yaw-', 'D must command right yaw.');
assert.strictEqual(FlightControl.actionForInput('KeyW', profile), 'surge+');
assert.strictEqual(FlightControl.actionForInput('KeyS', profile), 'surge-');
assert.strictEqual(FlightControl.actionForInput('Space', profile), 'lift+');
assert.strictEqual(FlightControl.actionForInput('ControlLeft', profile), 'lift-', 'Left Ctrl remains the requested default descent binding.');
assert.strictEqual(FlightControl.actionForInput('ShiftLeft', profile), null, 'Shift is not a default flight binding and cannot trigger Sticky Keys through repeated descent taps.');
assert.deepStrictEqual(FlightControl.adjustmentForInput('Minus', profile), { target: 'thrusterPower', direction: -1 });
assert.deepStrictEqual(FlightControl.adjustmentForInput('Equal', profile), { target: 'thrusterPower', direction: 1 });
assert.deepStrictEqual(FlightControl.adjustmentForInput('Comma', profile), { target: 'balloonPower', direction: -1 });
assert.deepStrictEqual(FlightControl.adjustmentForInput('Period', profile), { target: 'balloonPower', direction: 1 });
assert.strictEqual(FlightControl.adjustmentForInput('PageUp', profile), null, 'Browser tab-navigation keys must not control the craft by default.');
assert.strictEqual(FlightControl.actionForInput('ArrowUp', profile), 'pitch+');
assert.strictEqual(FlightControl.actionForInput('KeyZ', profile), 'sway-');
assert.strictEqual(FlightControl.actionForInput('KeyC', profile), 'sway+');
assert(FlightControl.keyboardLockCodes(profile).includes('KeyW'));
assert(FlightControl.keyboardLockCodes(profile).includes('ControlLeft'));
assert(FlightControl.keyboardLockCodes(profile).includes('Minus'));
assert(FlightControl.keyboardLockCodes(profile).includes('Equal'));

const rebound = InputProfile.updateBinding(profile, 'lift-', 0, 'KeyX');
assert.strictEqual(FlightControl.actionForInput('KeyX', rebound), 'lift-');
assert.strictEqual(FlightControl.actionForInput('ControlLeft', rebound), null);
const reassigned = InputProfile.updateBinding(rebound, 'surge+', 0, 'KeyX');
assert.strictEqual(FlightControl.actionForInput('KeyX', reassigned), 'surge+', 'Assigning an occupied key must move it to the new action.');
assert.strictEqual(reassigned.bindings['lift-'].includes('KeyX'), false);
const migrated = InputProfile.normalize({ version: 1, axes: profile.axes });
assert.strictEqual(FlightControl.actionForInput('ControlLeft', migrated), 'lift-', 'Profiles without bindings must migrate to current defaults.');
assert.deepStrictEqual(FlightControl.adjustmentForInput('Minus', migrated), { target: 'thrusterPower', direction: -1 });
const legacyV2Bindings = Object.fromEntries(Object.entries(profile.bindings).filter(([action]) => !action.startsWith('thrusterPower')));
const migratedV2 = InputProfile.normalize({ version: 2, axes: profile.axes, bindings: legacyV2Bindings });
assert.deepStrictEqual(FlightControl.adjustmentForInput('Equal', migratedV2), { target: 'thrusterPower', direction: 1 }, 'Version 2 profiles must receive the new passive-thrust defaults when those keys are free.');
const legacyCustomBindings = { ...legacyV2Bindings, 'balloonPower-': ['Minus'] };
const migratedCustomV2 = InputProfile.normalize({ version: 2, axes: profile.axes, bindings: legacyCustomBindings });
assert.deepStrictEqual(FlightControl.adjustmentForInput('Minus', migratedCustomV2), { target: 'balloonPower', direction: -1 }, 'A new v3 default must not steal a physical code explicitly claimed by a v2 profile.');
assert.strictEqual(migratedCustomV2.bindings['thrusterPower-'].length, 0, 'The conflicting new action should remain unbound rather than overwrite a legacy choice.');
assert(InputProfile.bindingWarnings(profile).some(message => message.includes('Flight Focus')), 'Ctrl default must carry a precise browser-chord warning.');

const pilot = FlightControl.pilotFromActions(new Set(['yaw+', 'surge+', 'lift-', 'roll-', 'sway+']), profile);
assert.deepStrictEqual(pilot, { pitch: 0, yaw: 1, roll: -1, surge: 1, sway: 1, lift: -1 });
assert(Object.isFrozen(pilot));
const pitched = FlightControl.pilotFromActions(new Set(['pitch+']), profile);
assert.strictEqual(pitched.pitch, -1, 'Default profile fixes the legacy inverted pitch direction.');
const customProfile = InputProfile.updateAxis(profile, 'pitch', { invert: false, sensitivity: 0.5 });
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
assert(close(FlightControl.neutralCommand([0, 1, 0], 0.7), 0.7));
assert(close(FlightControl.neutralCommand([1, 0, 0], 0.7), 0));
assert(close(FlightControl.neutralCommand([0, -1, 0], 0.7), 0));
assert(close(FlightControl.neutralCommand([0, 1, 0], 0), 0));
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: 0 }, 0.5), 0.5));
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: 1 }, 0.5), 1));
assert(close(FlightControl.applyTranslationMix([0, 1, 0], { lift: -1 }, 0.7), 0), 'Descent must reduce passive upward thrust.');
assert(close(FlightControl.applyTranslationMix([0, -1, 0], { lift: -1 }, 0), 1), 'Descent must activate downward-facing engines.');
assert(close(FlightControl.applyTranslationMix([0, -1, 0], { lift: 1 }, 0), 0));
assert(close(FlightControl.applyTranslationMix([1, 0, 0], { surge: 1 }, 0), 1));
assert(close(FlightControl.applyTranslationMix([-1, 0, 0], { surge: 1 }, 0), 0));
const diagonal = FlightControl.applyTranslationMix([1, 0, 0], { surge: 1, lift: 1 }, 0);
assert(diagonal > 0 && diagonal < 1);

console.log(JSON.stringify({
  yawDirection: 'ok',
  versionedRebindableBindings: 'ok',
  rebindablePassiveAndBalloonPower: 'ok',
  ctrlDefaultWithFlightFocusWarning: 'ok',
  keyboardLockCodeSet: 'ok',
  pilotAggregation: 'ok',
  passiveThrustIndependentFromPilotAuthority: 'ok',
  downwardThrusterDirection: 'ok'
}, null, 2));
