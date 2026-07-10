'use strict';

const assert = require('assert');
const DeviceProfile = require('../src/game/mobile-device-profile.js');

function run() {
  const phone = DeviceProfile.classify({
    width: 412,
    height: 915,
    maxTouchPoints: 5,
    coarsePointer: true,
    hoverNone: true,
    override: 'auto'
  });
  assert.equal(phone.mobilePresentation, true);
  assert.equal(phone.phoneViewport, true);
  assert.equal(phone.orientation, 'portrait');

  const desktop = DeviceProfile.classify({
    width: 1920,
    height: 1080,
    maxTouchPoints: 0,
    coarsePointer: false,
    hoverNone: false,
    override: 'auto'
  });
  assert.equal(desktop.mobilePresentation, false);
  assert.equal(desktop.desktopPresentation, true);

  const touchLaptop = DeviceProfile.classify({
    width: 1920,
    height: 1080,
    maxTouchPoints: 10,
    coarsePointer: false,
    hoverNone: false,
    override: 'auto'
  });
  assert.equal(touchLaptop.mobilePresentation, false, 'touch support alone must not force mobile layout on a wide hover-capable computer');

  assert.equal(DeviceProfile.classify({ width: 1920, height: 1080, override: 'mobile' }).mobilePresentation, true);
  assert.equal(DeviceProfile.classify({ width: 390, height: 844, maxTouchPoints: 5, coarsePointer: true, hoverNone: true, override: 'desktop' }).mobilePresentation, false);

  const storage = new Map();
  const adapter = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  };
  assert.equal(DeviceProfile.writeOverride(adapter, 'MOBILE'), 'mobile');
  assert.equal(DeviceProfile.readOverride(adapter), 'mobile');
  assert.equal(DeviceProfile.writeOverride(adapter, 'invalid'), 'auto');

  const classes = new Set();
  const root = {
    dataset: {},
    classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } }
  };
  DeviceProfile.applyDocumentProfile(phone, { documentElement: root });
  assert.equal(root.dataset.vawPresentation, 'mobile');
  assert.equal(root.dataset.vawViewport, 'phone');
  assert(classes.has('vaw-mobile-presentation'));
  assert(classes.has('vaw-touch-capable'));

  console.log('OK mobile device profile');
}

run();
