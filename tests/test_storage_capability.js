'use strict';

const assert = require('assert');
const StorageCapability = require('../src/game/storage_capability.js');

function createNativeStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); }
  };
}

const native = createNativeStorage();
const persistent = StorageCapability.from(native, { kind: 'test-storage', persistent: true });
assert.strictEqual(persistent.kind, 'test-storage');
assert.strictEqual(persistent.persistent, true);
persistent.setItem('answer', 42);
assert.strictEqual(persistent.getItem('answer'), '42');
assert.strictEqual(persistent.length, 1);
assert.strictEqual(persistent.key(0), 'answer');

const throwingWindow = {};
Object.defineProperty(throwingWindow, 'localStorage', {
  configurable: true,
  get() { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); }
});
const fallback = StorageCapability.forWindow(throwingWindow);
assert.strictEqual(fallback.kind, 'memory');
assert.strictEqual(fallback.persistent, false);
fallback.setItem('session', 'alive');
assert.strictEqual(fallback.getItem('session'), 'alive');
assert.strictEqual(StorageCapability.forWindow(throwingWindow), fallback, 'Window capability must be stable for the process lifetime.');

const unstable = createNativeStorage();
unstable.getItem = () => { throw new Error('storage revoked'); };
const degradable = StorageCapability.from(unstable, { persistent: true });
assert.strictEqual(degradable.getItem('missing'), null);
assert.strictEqual(degradable.kind, 'memory');
assert.strictEqual(degradable.persistent, false);
degradable.setItem('after-revoke', 'works');
assert.strictEqual(degradable.getItem('after-revoke'), 'works');

degradable.removeItem('after-revoke');
assert.strictEqual(degradable.getItem('after-revoke'), null);

console.log({ storageCapability: 'ok' });
