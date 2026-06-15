(() => {
  'use strict';

  if (window.VAW) throw new Error('Voxel Aeronautics kernel was loaded more than once.');

  const definitions = new Map();
  const instances = new Map();
  const resolving = [];

  function assertModuleName(name) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) {
      throw new TypeError(`Invalid module name: ${String(name)}`);
    }
  }

  function define(name, dependencies, factory) {
    assertModuleName(name);
    if (definitions.has(name)) throw new Error(`Module already defined: ${name}`);
    if (!Array.isArray(dependencies) || dependencies.some(dep => typeof dep !== 'string')) {
      throw new TypeError(`Module ${name} dependencies must be an array of names.`);
    }
    if (typeof factory !== 'function') throw new TypeError(`Module ${name} factory must be a function.`);
    definitions.set(name, Object.freeze({ dependencies: Object.freeze([...dependencies]), factory }));
  }

  function requireModule(name) {
    assertModuleName(name);
    if (instances.has(name)) return instances.get(name);
    const definition = definitions.get(name);
    if (!definition) throw new Error(`Unknown module: ${name}`);
    if (resolving.includes(name)) {
      throw new Error(`Circular module dependency: ${[...resolving, name].join(' -> ')}`);
    }

    resolving.push(name);
    try {
      const dependencies = definition.dependencies.map(requireModule);
      const value = definition.factory(...dependencies);
      if (value === undefined) throw new Error(`Module ${name} returned undefined.`);
      const instance = value && typeof value === 'object' ? Object.freeze(value) : value;
      instances.set(name, instance);
      return instance;
    } finally {
      resolving.pop();
    }
  }

  function inspect() {
    return Object.freeze({
      defined: Object.freeze([...definitions.keys()]),
      initialized: Object.freeze([...instances.keys()])
    });
  }

  Object.defineProperty(window, 'VAW', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: Object.freeze({ define, require: requireModule, inspect })
  });
})();
