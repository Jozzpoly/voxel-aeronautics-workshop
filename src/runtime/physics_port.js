(() => {
  'use strict';

  window.VAW.define('runtime.physics-port', [], () => {
    const BODY_TYPES = Object.freeze({ STATIC: 'static', DYNAMIC: 'dynamic' });
    const SHAPE_TYPES = Object.freeze({ BOX: 'box', PLANE: 'plane' });

    const REQUIRED_BACKEND_METHODS = Object.freeze([
      'createWorld', 'createBody', 'addBody', 'removeBody', 'step',
      'addBoxCollider', 'addPlaneCollider', 'removeCollider', 'shiftColliderOffsets',
      'vec3', 'setBodyTransform', 'setBodyVelocity', 'setBodyMass', 'setBodyMassProperties',
      'markBodyDirty', 'addCollisionListener',
      'applyForce', 'addTorque',
      'vectorToWorldFrame', 'vectorToLocalFrame', 'pointToWorldFrame', 'getPointVelocity'
    ]);

    function finiteNumber(value, fallback = 0) {
      return Number.isFinite(value) ? Number(value) : fallback;
    }

    function positiveNumber(value, fallback = 0) {
      return Math.max(0, finiteNumber(value, fallback));
    }

    function normalizeVec3(value, fallback = Object.freeze({ x: 0, y: 0, z: 0 })) {
      const source = value && typeof value === 'object' ? value : fallback;
      return Object.freeze({
        x: finiteNumber(source.x, fallback.x || 0),
        y: finiteNumber(source.y, fallback.y || 0),
        z: finiteNumber(source.z, fallback.z || 0)
      });
    }

    function normalizeQuaternion(value) {
      const source = value && typeof value === 'object' ? value : {};
      let x = finiteNumber(source.x, 0);
      let y = finiteNumber(source.y, 0);
      let z = finiteNumber(source.z, 0);
      let w = finiteNumber(source.w, 1);
      const length = Math.hypot(x, y, z, w) || 1;
      x /= length; y /= length; z /= length; w /= length;
      return Object.freeze({ x, y, z, w });
    }

    function normalizeWorldDescriptor(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      const broadphase = descriptor.broadphase === 'naive' ? 'naive' : 'sap';
      return Object.freeze({
        gravity: normalizeVec3(descriptor.gravity, { x: 0, y: -9.81, z: 0 }),
        broadphase,
        solverIterations: Math.max(1, Math.floor(finiteNumber(descriptor.solverIterations, 10))),
        solverTolerance: positiveNumber(descriptor.solverTolerance, 0.0001),
        allowSleep: descriptor.allowSleep !== false
      });
    }

    function normalizeBodyDescriptor(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      const mass = positiveNumber(descriptor.mass, 0);
      return Object.freeze({
        type: descriptor.type === BODY_TYPES.DYNAMIC || mass > 0 ? BODY_TYPES.DYNAMIC : BODY_TYPES.STATIC,
        mass,
        linearDamping: positiveNumber(descriptor.linearDamping, 0),
        angularDamping: positiveNumber(descriptor.angularDamping, 0),
        allowSleep: descriptor.allowSleep !== false,
        collisionGroup: Number.isInteger(descriptor.collisionGroup) ? descriptor.collisionGroup : 1,
        collisionMask: Number.isInteger(descriptor.collisionMask) ? descriptor.collisionMask : -1,
        position: normalizeVec3(descriptor.position),
        quaternion: normalizeQuaternion(descriptor.quaternion),
        userData: descriptor.userData && typeof descriptor.userData === 'object' ? descriptor.userData : null
      });
    }

    function normalizeBoxDescriptor(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      const halfExtents = normalizeVec3(descriptor.halfExtents, { x: 0.5, y: 0.5, z: 0.5 });
      if (halfExtents.x <= 0 || halfExtents.y <= 0 || halfExtents.z <= 0) {
        throw new RangeError('Box collider half extents must be greater than zero.');
      }
      return Object.freeze({
        type: SHAPE_TYPES.BOX,
        halfExtents,
        offset: normalizeVec3(descriptor.offset),
        quaternion: normalizeQuaternion(descriptor.quaternion)
      });
    }

    function normalizePlaneDescriptor(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        type: SHAPE_TYPES.PLANE,
        offset: normalizeVec3(descriptor.offset),
        quaternion: normalizeQuaternion(descriptor.quaternion)
      });
    }


    function normalizeMassProperties(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      const inertia = normalizeVec3(descriptor.inertiaDiagonal, { x: 0, y: 0, z: 0 });
      return Object.freeze({
        mass: positiveNumber(descriptor.mass, 0),
        centerOfMass: normalizeVec3(descriptor.centerOfMass),
        inertiaDiagonal: Object.freeze({
          x: positiveNumber(inertia.x, 0),
          y: positiveNumber(inertia.y, 0),
          z: positiveNumber(inertia.z, 0)
        })
      });
    }

    function normalizeCollisionEvent(value = {}) {
      const event = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        otherBody: event.otherBody || null,
        impactSpeed: positiveNumber(event.impactSpeed, 0),
        relativePoint: event.relativePoint ? normalizeVec3(event.relativePoint) : null
      });
    }

    function assertBackend(backend) {
      if (!backend || typeof backend !== 'object') throw new TypeError('Physics backend must be an object.');
      const missing = REQUIRED_BACKEND_METHODS.filter(name => typeof backend[name] !== 'function');
      if (missing.length) throw new TypeError(`Physics backend is missing methods: ${missing.join(', ')}`);
      if (!backend.id || typeof backend.id !== 'string') throw new TypeError('Physics backend must expose a string id.');
      return backend;
    }

    return Object.freeze({
      BODY_TYPES,
      SHAPE_TYPES,
      REQUIRED_BACKEND_METHODS,
      normalizeVec3,
      normalizeQuaternion,
      normalizeWorldDescriptor,
      normalizeBodyDescriptor,
      normalizeMassProperties,
      normalizeBoxDescriptor,
      normalizePlaneDescriptor,
      normalizeCollisionEvent,
      assertBackend
    });
  });
})();
