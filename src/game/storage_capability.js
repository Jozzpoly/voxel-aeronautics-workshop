'use strict';

(function registerStorageCapability(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before storage_capability.js.');
  root.VAW.define('game.storage-capability', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStorageCapabilityModule() {
  const CAPABILITY_ID = 'vaw-storage-capability-v1';
  const windowCapabilities = new WeakMap();
  let detachedCapability = null;

  function createMemoryStorage() {
    const values = new Map();
    return Object.freeze({
      get length() { return values.size; },
      key(index) { return [...values.keys()][Number(index)] ?? null; },
      getItem(key) {
        const normalized = String(key);
        return values.has(normalized) ? values.get(normalized) : null;
      },
      setItem(key, value) { values.set(String(key), String(value)); },
      removeItem(key) { values.delete(String(key)); },
      clear() { values.clear(); }
    });
  }

  function isStorageLike(value) {
    return Boolean(value)
      && typeof value.getItem === 'function'
      && typeof value.setItem === 'function';
  }

  function create(storage = null, options = {}) {
    if (storage?.capabilityId === CAPABILITY_ID) return storage;
    const memory = createMemoryStorage();
    let active = isStorageLike(storage) ? storage : memory;
    let persistent = active !== memory && options.persistent !== false;
    let kind = persistent ? String(options.kind || 'local-storage') : 'memory';

    function degrade() {
      active = memory;
      persistent = false;
      kind = 'memory';
    }

    function invoke(method, args, fallback) {
      try {
        const operation = active?.[method];
        if (typeof operation !== 'function') throw new TypeError(`Storage method ${method} is unavailable.`);
        return operation.apply(active, args);
      } catch (_) {
        if (active !== memory) {
          degrade();
          return memory[method](...args);
        }
        return fallback;
      }
    }

    const capability = {
      capabilityId: CAPABILITY_ID,
      get kind() { return kind; },
      get persistent() { return persistent; },
      get storage() { return capability; },
      get length() {
        try { return Number(active.length) || 0; }
        catch (_) { degrade(); return memory.length; }
      },
      key(index) { return invoke('key', [index], null); },
      getItem(key) { return invoke('getItem', [key], null); },
      setItem(key, value) { invoke('setItem', [key, value], undefined); },
      removeItem(key) { invoke('removeItem', [key], undefined); },
      clear() { invoke('clear', [], undefined); }
    };
    return Object.freeze(capability);
  }

  function forWindow(windowLike) {
    const cacheable = Boolean(windowLike) && (typeof windowLike === 'object' || typeof windowLike === 'function');
    if (cacheable && windowCapabilities.has(windowLike)) return windowCapabilities.get(windowLike);
    if (!cacheable && detachedCapability) return detachedCapability;

    let nativeStorage = null;
    try { nativeStorage = windowLike?.localStorage || null; }
    catch (_) { nativeStorage = null; }
    const capability = create(nativeStorage, { kind: 'local-storage', persistent: Boolean(nativeStorage) });
    if (cacheable) windowCapabilities.set(windowLike, capability);
    else detachedCapability = capability;
    return capability;
  }

  function from(storage, options = {}) {
    return storage?.capabilityId === CAPABILITY_ID
      ? storage
      : create(storage, { kind: options.kind || 'provided-storage', persistent: options.persistent !== false });
  }

  return Object.freeze({ CAPABILITY_ID, createMemoryStorage, create, from, forWindow });
});
