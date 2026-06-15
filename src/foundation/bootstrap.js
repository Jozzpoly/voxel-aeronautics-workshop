(() => {
  'use strict';

  if (!window.THREE || !window.CANNON) {
    throw new Error('Required Three.js or Cannon.js library is unavailable.');
  }

  const requiredCapabilities = [
    ['THREE.Vector3', window.THREE.Vector3],
    ['THREE.Quaternion', window.THREE.Quaternion],
    ['THREE.Matrix4', window.THREE.Matrix4],
    ['THREE.WebGLRenderer', window.THREE.WebGLRenderer],
    ['CANNON.World', window.CANNON.World],
    ['CANNON.Body', window.CANNON.Body],
    ['CANNON.Box', window.CANNON.Box],
    ['CANNON.Plane', window.CANNON.Plane],
    ['CANNON.Vec3', window.CANNON.Vec3]
  ];
  const missingCapabilities = requiredCapabilities.filter(([, value]) => typeof value !== 'function').map(([name]) => name);
  if (missingCapabilities.length) {
    throw new Error(`Physics/rendering libraries are incomplete: ${missingCapabilities.join(', ')}`);
  }

  const Config = window.VAW.require('foundation.config');
  const Catalog = window.VAW.require('foundation.catalog');
  const Orientation = window.VAW.require('foundation.orientation');
  const Blueprint = window.VAW.require('foundation.blueprint');
  const CraftModel = window.VAW.require('foundation.craft-model');
  const CraftHistory = window.VAW.require('foundation.craft-history');
  const State = window.VAW.require('foundation.state');

  const Capabilities = Object.freeze({
    threeRevision: String(window.THREE.REVISION || 'unknown'),
    cannonVersion: String(window.CANNON.version || '0.6.x/unknown'),
    webglRenderer: true,
    physicsBackend: 'cannon'
  });
  const runtime = Object.freeze({ Config, Catalog, Orientation, Blueprint, CraftModel, CraftHistory, State, Capabilities });
  Object.defineProperty(window, 'VAW_RUNTIME', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: runtime
  });
})();
