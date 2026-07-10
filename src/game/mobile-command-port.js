'use strict';

(function registerMobileCommandPort(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-command-port.js.');
  root.VAW.define('game.mobile-command-port', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileCommandPortModule() {
  const REQUIRED_METHODS = Object.freeze({
    build: Object.freeze([
      'catalog',
      'selectPart',
      'placeAtScreen',
      'removeAtScreen',
      'rotate',
      'setDirection',
      'undo',
      'redo'
    ]),
    session: Object.freeze([
      'snapshot',
      'launch',
      'returnToWorkshop',
      'reset'
    ]),
    flight: Object.freeze([
      'setAction',
      'clearActions'
    ])
  });
  const READ_ONLY_CALLS = new Set(['build.catalog', 'session.snapshot']);

  let implementation = null;
  const listeners = new Set();
  const activityListeners = new Set();

  function notifyListeners(collection, value, label) {
    for (const listener of [...collection]) {
      try { listener(value); }
      catch (error) { console.error(`[mobile-command-port] ${label} listener failed.`, error); }
    }
  }

  function validateSection(value, section) {
    if (!value || typeof value !== 'object') {
      throw new TypeError(`Mobile command port requires a ${section} section.`);
    }
    for (const method of REQUIRED_METHODS[section]) {
      if (typeof value[method] !== 'function') {
        throw new TypeError(`Mobile command port requires ${section}.${method}().`);
      }
    }
    return value;
  }

  function validate(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      throw new TypeError('Mobile command implementation must be an object.');
    }
    return Object.freeze({
      build: validateSection(candidate.build, 'build'),
      session: validateSection(candidate.session, 'session'),
      flight: validateSection(candidate.flight, 'flight')
    });
  }

  function notifyRegistration() {
    notifyListeners(listeners, implementation, 'registration');
  }

  function register(candidate) {
    if (implementation) throw new Error('Mobile command port is already registered.');
    implementation = validate(candidate);
    notifyRegistration();
    return implementation;
  }

  function unregister(candidate) {
    if (!implementation || (candidate && candidate !== implementation)) return false;
    implementation = null;
    notifyRegistration();
    return true;
  }

  function current() {
    return implementation;
  }

  function requireCurrent() {
    if (!implementation) throw new Error('Mobile command port is not registered.');
    return implementation;
  }

  function subscribe(listener, options = {}) {
    if (typeof listener !== 'function') throw new TypeError('Mobile command listener must be a function.');
    listeners.add(listener);
    if (options.emitCurrent !== false) listener(implementation);
    return () => listeners.delete(listener);
  }

  function subscribeActivity(listener) {
    if (typeof listener !== 'function') throw new TypeError('Mobile command activity listener must be a function.');
    activityListeners.add(listener);
    return () => activityListeners.delete(listener);
  }

  function call(section, method, ...args) {
    const result = requireCurrent()[section][method](...args);
    if (!READ_ONLY_CALLS.has(`${section}.${method}`)) {
      const activity = Object.freeze({
        section,
        method,
        args: Object.freeze([...args]),
        result
      });
      notifyListeners(activityListeners, activity, 'activity');
    }
    return result;
  }

  const build = Object.freeze({
    catalog: () => call('build', 'catalog'),
    selectPart: partId => call('build', 'selectPart', partId),
    placeAtScreen: (x, y) => call('build', 'placeAtScreen', x, y),
    removeAtScreen: (x, y) => call('build', 'removeAtScreen', x, y),
    rotate: direction => call('build', 'rotate', direction),
    setDirection: direction => call('build', 'setDirection', direction),
    undo: () => call('build', 'undo'),
    redo: () => call('build', 'redo')
  });

  const session = Object.freeze({
    snapshot: () => call('session', 'snapshot'),
    launch: () => call('session', 'launch'),
    returnToWorkshop: () => call('session', 'returnToWorkshop'),
    reset: () => call('session', 'reset')
  });

  const flight = Object.freeze({
    setAction: (action, active) => call('flight', 'setAction', action, active),
    clearActions: () => call('flight', 'clearActions')
  });

  return Object.freeze({
    REQUIRED_METHODS,
    register,
    unregister,
    current,
    requireCurrent,
    subscribe,
    subscribeActivity,
    build,
    session,
    flight
  });
});
