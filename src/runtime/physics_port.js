(() => {
  'use strict';

  window.VAW.define('runtime.physics-port', [], () => {
    const BODY_TYPES = Object.freeze({ STATIC: 'static', DYNAMIC: 'dynamic' });
    const SHAPE_TYPES = Object.freeze({ BOX: 'box', PLANE: 'plane' });
    const CONSTRAINT_TYPES = Object.freeze({ HINGE: 'hinge' });
    const CONSTRAINT_MODES = Object.freeze({ FREE: 'free', MOTOR: 'motor', SERVO: 'servo' });

    const REQUIRED_BACKEND_METHODS = Object.freeze([
      'createWorld', 'createBody', 'addBody', 'removeBody', 'step',
      'addBoxCollider', 'addPlaneCollider', 'removeCollider', 'shiftColliderOffsets',
      'vec3', 'getBodyTransform', 'getBodyLinearVelocity', 'getBodyAngularVelocity',
      'setBodyTransform', 'setBodyVelocity', 'setBodyMass', 'setBodyMassProperties',
      'markBodyDirty', 'addCollisionListener',
      'applyForce', 'addTorque',
      'vectorToWorldFrame', 'vectorToLocalFrame', 'pointToWorldFrame', 'pointToLocalFrame', 'getPointVelocity',
      'createConstraint', 'addConstraint', 'removeConstraint',
      'setConstraintControl', 'getConstraintState'
    ]);

    function finiteNumber(value, fallback = 0) {
      return Number.isFinite(value) ? Number(value) : fallback;
    }

    function requiredFiniteNumber(value, label) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`);
      return numeric;
    }

    function positiveNumber(value, fallback = 0) {
      return Math.max(0, finiteNumber(value, fallback));
    }

    function requiredPositiveNumber(value, label, fallback) {
      const numeric = value == null ? fallback : requiredFiniteNumber(value, label);
      if (!(numeric > 0)) throw new RangeError(`${label} must be greater than zero.`);
      return numeric;
    }

    function requiredNonNegativeNumber(value, label, fallback) {
      const numeric = value == null ? fallback : requiredFiniteNumber(value, label);
      if (numeric < 0) throw new RangeError(`${label} cannot be negative.`);
      return numeric;
    }

    function normalizeVec3(value, fallback = Object.freeze({ x: 0, y: 0, z: 0 })) {
      const source = value && typeof value === 'object' ? value : fallback;
      return Object.freeze({
        x: finiteNumber(source.x, fallback.x || 0),
        y: finiteNumber(source.y, fallback.y || 0),
        z: finiteNumber(source.z, fallback.z || 0)
      });
    }

    function normalizeRequiredVec3(value, label) {
      const source = Array.isArray(value)
        ? { x: value[0], y: value[1], z: value[2] }
        : value;
      if (!source || typeof source !== 'object') throw new TypeError(`${label} must be a 3D vector.`);
      return Object.freeze({
        x: requiredFiniteNumber(source.x, `${label}.x`),
        y: requiredFiniteNumber(source.y, `${label}.y`),
        z: requiredFiniteNumber(source.z, `${label}.z`)
      });
    }

    function normalizeUnitVec3(value, label, fallback) {
      const vector = value == null ? normalizeRequiredVec3(fallback, label) : normalizeRequiredVec3(value, label);
      const length = Math.hypot(vector.x, vector.y, vector.z);
      if (!(length > 1e-8)) throw new RangeError(`${label} must have non-zero length.`);
      return Object.freeze({ x: vector.x / length, y: vector.y / length, z: vector.z / length });
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

    function normalizeConstraintLimits(value) {
      if (value == null) return null;
      if (typeof value !== 'object') throw new TypeError('Hinge limits must be an object or null.');
      const minAngle = requiredFiniteNumber(value.minAngle, 'Hinge limits.minAngle');
      const maxAngle = requiredFiniteNumber(value.maxAngle, 'Hinge limits.maxAngle');
      if (!(minAngle < maxAngle)) throw new RangeError('Hinge limits require minAngle < maxAngle.');
      return Object.freeze({
        minAngle,
        maxAngle,
        tolerance: requiredNonNegativeNumber(value.tolerance, 'Hinge limits.tolerance', 0.01),
        maxTorque: requiredPositiveNumber(value.maxTorque, 'Hinge limits.maxTorque', 80),
        maxSpeed: requiredPositiveNumber(value.maxSpeed, 'Hinge limits.maxSpeed', 5),
        positionGain: requiredPositiveNumber(value.positionGain, 'Hinge limits.positionGain', 16),
        velocityDamping: requiredNonNegativeNumber(value.velocityDamping, 'Hinge limits.velocityDamping', 1.5)
      });
    }

    function normalizeConstraintControl(value = {}) {
      const descriptor = value && typeof value === 'object' ? value : {};
      const requestedMode = descriptor.mode == null ? CONSTRAINT_MODES.FREE : descriptor.mode;
      if (!Object.values(CONSTRAINT_MODES).includes(requestedMode)) {
        throw new Error(`Unsupported hinge control mode: ${String(requestedMode)}`);
      }
      const mode = requestedMode;
      return Object.freeze({
        mode,
        targetSpeed: descriptor.targetSpeed == null ? 0 : requiredFiniteNumber(descriptor.targetSpeed, 'Hinge control.targetSpeed'),
        targetAngle: descriptor.targetAngle == null ? 0 : requiredFiniteNumber(descriptor.targetAngle, 'Hinge control.targetAngle'),
        maxTorque: requiredNonNegativeNumber(descriptor.maxTorque, 'Hinge control.maxTorque', 30),
        maxSpeed: requiredPositiveNumber(descriptor.maxSpeed, 'Hinge control.maxSpeed', 2),
        positionGain: requiredPositiveNumber(descriptor.positionGain, 'Hinge control.positionGain', 4),
        velocityDamping: requiredNonNegativeNumber(descriptor.velocityDamping, 'Hinge control.velocityDamping', 0.5)
      });
    }

    function normalizeConstraintPlan(value = {}) {
      if (!value || typeof value !== 'object') throw new TypeError('Constraint plan must be an object.');
      if (value.kind !== CONSTRAINT_TYPES.HINGE) {
        throw new Error(`Unsupported constraint kind: ${String(value.kind)}`);
      }
      return Object.freeze({
        kind: CONSTRAINT_TYPES.HINGE,
        pivotA: normalizeRequiredVec3(value.pivotA ?? { x: 0, y: 0, z: 0 }, 'Hinge pivotA'),
        pivotB: normalizeRequiredVec3(value.pivotB ?? { x: 0, y: 0, z: 0 }, 'Hinge pivotB'),
        axisA: normalizeUnitVec3(value.axisA, 'Hinge axisA', { x: 1, y: 0, z: 0 }),
        axisB: normalizeUnitVec3(value.axisB, 'Hinge axisB', { x: 1, y: 0, z: 0 }),
        collideConnected: value.collideConnected === true,
        maxForce: requiredPositiveNumber(value.maxForce, 'Hinge maxForce', 1e6),
        frictionTorque: requiredNonNegativeNumber(value.frictionTorque, 'Hinge frictionTorque', 0),
        limits: normalizeConstraintLimits(value.limits),
        control: normalizeConstraintControl(value.control)
      });
    }

    function normalizeConstraintDescriptor(value = {}) {
      const plan = normalizeConstraintPlan(value);
      if (!value.bodyA || !value.bodyB) throw new TypeError('Hinge constraint requires bodyA and bodyB.');
      if (value.bodyA === value.bodyB) throw new RangeError('Hinge constraint cannot connect a body to itself.');
      return Object.freeze({ ...plan, bodyA: value.bodyA, bodyB: value.bodyB });
    }

    function normalizeCollisionEvent(value = {}) {
      const event = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        otherBody: event.otherBody || null,
        impactSpeed: positiveNumber(event.impactSpeed, 0),
        relativePoint: event.relativePoint ? normalizeVec3(event.relativePoint) : null
      });
    }

    function supportsConstraint(backend, kind) {
      return backend?.capabilities?.constraints?.[kind] === true;
    }

    function assertBackend(backend) {
      if (!backend || typeof backend !== 'object') throw new TypeError('Physics backend must be an object.');
      const missing = REQUIRED_BACKEND_METHODS.filter(name => typeof backend[name] !== 'function');
      if (missing.length) throw new TypeError(`Physics backend is missing methods: ${missing.join(', ')}`);
      if (!backend.id || typeof backend.id !== 'string') throw new TypeError('Physics backend must expose a string id.');
      if (!backend.capabilities || typeof backend.capabilities !== 'object') {
        throw new TypeError('Physics backend must expose capabilities.');
      }
      return backend;
    }

    return Object.freeze({
      BODY_TYPES,
      SHAPE_TYPES,
      CONSTRAINT_TYPES,
      CONSTRAINT_MODES,
      REQUIRED_BACKEND_METHODS,
      normalizeVec3,
      normalizeQuaternion,
      normalizeWorldDescriptor,
      normalizeBodyDescriptor,
      normalizeMassProperties,
      normalizeBoxDescriptor,
      normalizePlaneDescriptor,
      normalizeConstraintLimits,
      normalizeConstraintControl,
      normalizeConstraintPlan,
      normalizeConstraintDescriptor,
      normalizeCollisionEvent,
      supportsConstraint,
      assertBackend
    });
  });
})();
