(() => {
  'use strict';

  window.VAW.define('runtime.cannon-physics-backend', ['runtime.physics-port'], PhysicsPort => {
    function create(CANNON) {
      if (!CANNON || typeof CANNON !== 'object') throw new Error('Cannon.js is unavailable.');
      const required = ['World', 'Body', 'Box', 'Plane', 'Vec3', 'Quaternion'];
      const missing = required.filter(name => typeof CANNON[name] !== 'function');
      if (missing.length) throw new Error(`Cannon.js is missing capabilities: ${missing.join(', ')}`);

      function vec3(x = 0, y = 0, z = 0) {
        if (x && typeof x === 'object') return new CANNON.Vec3(Number(x.x) || 0, Number(x.y) || 0, Number(x.z) || 0);
        return new CANNON.Vec3(Number(x) || 0, Number(y) || 0, Number(z) || 0);
      }

      function createWorld(value = {}) {
        const descriptor = PhysicsPort.normalizeWorldDescriptor(value);
        const world = new CANNON.World();
        world.gravity.set(descriptor.gravity.x, descriptor.gravity.y, descriptor.gravity.z);
        if (descriptor.broadphase === 'sap' && typeof CANNON.SAPBroadphase === 'function') {
          world.broadphase = new CANNON.SAPBroadphase(world);
        } else if (typeof CANNON.NaiveBroadphase === 'function') {
          world.broadphase = new CANNON.NaiveBroadphase();
        }
        world.solver.iterations = descriptor.solverIterations;
        world.solver.tolerance = descriptor.solverTolerance;
        world.allowSleep = descriptor.allowSleep;
        return world;
      }

      function setBodyTransform(body, value = {}) {
        if (!body) throw new TypeError('Body is required.');
        if (value.position) {
          const position = PhysicsPort.normalizeVec3(value.position);
          body.position.set(position.x, position.y, position.z);
        }
        if (value.quaternion) {
          const quaternion = PhysicsPort.normalizeQuaternion(value.quaternion);
          body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        }
        if (value.axisAngle) {
          const axis = PhysicsPort.normalizeVec3(value.axisAngle.axis, { x: 1, y: 0, z: 0 });
          const angle = Number.isFinite(value.axisAngle.angle) ? value.axisAngle.angle : 0;
          body.quaternion.setFromAxisAngle(vec3(axis), angle);
        }
        markBodyDirty(body);
        return body;
      }

      function setBodyVelocity(body, value = {}) {
        if (!body) throw new TypeError('Body is required.');
        if (value.linear) {
          const linear = PhysicsPort.normalizeVec3(value.linear);
          body.velocity.set(linear.x, linear.y, linear.z);
        }
        if (value.angular) {
          const angular = PhysicsPort.normalizeVec3(value.angular);
          body.angularVelocity.set(angular.x, angular.y, angular.z);
        }
        return body;
      }

      function createBody(value = {}) {
        const descriptor = PhysicsPort.normalizeBodyDescriptor(value);
        const body = new CANNON.Body({
          mass: descriptor.mass,
          linearDamping: descriptor.linearDamping,
          angularDamping: descriptor.angularDamping,
          allowSleep: descriptor.allowSleep
        });
        body.collisionFilterGroup = descriptor.collisionGroup;
        body.collisionFilterMask = descriptor.collisionMask;
        body.userData = descriptor.userData;
        setBodyTransform(body, descriptor);
        return body;
      }

      function addBody(world, body) {
        if (!world || !body) throw new TypeError('World and body are required.');
        world.addBody(body);
        return body;
      }

      function removeBody(world, body) {
        if (!world || !body) return false;
        world.removeBody(body);
        return true;
      }

      function addBoxCollider(body, value = {}) {
        if (!body) throw new TypeError('Body is required.');
        const descriptor = PhysicsPort.normalizeBoxDescriptor(value);
        const shape = new CANNON.Box(vec3(descriptor.halfExtents));
        const offset = vec3(descriptor.offset);
        const orientation = descriptor.quaternion;
        if (orientation.x || orientation.y || orientation.z || orientation.w !== 1) {
          const quaternion = new CANNON.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
          body.addShape(shape, offset, quaternion);
        } else {
          body.addShape(shape, offset);
        }
        markBodyDirty(body);
        return shape;
      }

      function addPlaneCollider(body, value = {}) {
        if (!body) throw new TypeError('Body is required.');
        const descriptor = PhysicsPort.normalizePlaneDescriptor(value);
        const shape = new CANNON.Plane();
        const offset = vec3(descriptor.offset);
        const orientation = descriptor.quaternion;
        if (orientation.x || orientation.y || orientation.z || orientation.w !== 1) {
          const quaternion = new CANNON.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
          body.addShape(shape, offset, quaternion);
        } else {
          body.addShape(shape, offset);
        }
        markBodyDirty(body);
        return shape;
      }

      function removeCollider(body, shape) {
        if (!body || !shape) return false;
        if (typeof body.removeShape === 'function') body.removeShape(shape);
        else {
          const index = body.shapes.indexOf(shape);
          if (index < 0) return false;
          body.shapes.splice(index, 1);
          body.shapeOffsets.splice(index, 1);
          body.shapeOrientations.splice(index, 1);
        }
        markBodyDirty(body);
        return true;
      }


      function shiftColliderOffsets(body, shiftValue) {
        if (!body) throw new TypeError('Body is required.');
        const shift = PhysicsPort.normalizeVec3(shiftValue);
        for (const offset of body.shapeOffsets || []) {
          offset.x -= shift.x;
          offset.y -= shift.y;
          offset.z -= shift.z;
        }
        markBodyDirty(body);
      }

      function markBodyDirty(body) {
        if (!body) return;
        if (typeof body.updateBoundingRadius === 'function') body.updateBoundingRadius();
        body.aabbNeedsUpdate = true;
      }

      function setBodyMass(body, mass) {
        if (!body) throw new TypeError('Body is required.');
        body.mass = Math.max(0, Number(mass) || 0);
        if (typeof body.updateMassProperties === 'function') body.updateMassProperties();
        markBodyDirty(body);
        return body.mass;
      }

      function addCollisionListener(body, listener) {
        if (!body || typeof listener !== 'function') throw new TypeError('Body and listener are required.');
        const wrapped = nativeEvent => {
          const contact = nativeEvent?.contact || null;
          let impactSpeed = 0;
          if (contact && typeof contact.getImpactVelocityAlongNormal === 'function') {
            impactSpeed = Math.abs(Number(contact.getImpactVelocityAlongNormal()) || 0);
          }
          let relativePoint = null;
          if (contact) {
            const nativePoint = contact.bi === body ? contact.ri : contact.rj;
            if (nativePoint) relativePoint = { x: nativePoint.x, y: nativePoint.y, z: nativePoint.z };
          }
          listener(PhysicsPort.normalizeCollisionEvent({
            otherBody: nativeEvent?.body || null,
            impactSpeed,
            relativePoint
          }));
        };
        body.addEventListener('collide', wrapped);
        return () => {
          if (typeof body.removeEventListener === 'function') body.removeEventListener('collide', wrapped);
        };
      }

      function step(world, dt) {
        if (!world) throw new TypeError('World is required.');
        const fixedDt = Number(dt);
        if (!(fixedDt > 0)) throw new RangeError('Physics step must be greater than zero.');
        world.step(fixedDt);
      }

      function applyForce(body, force, worldPoint) {
        if (!body) throw new TypeError('Body is required.');
        body.applyForce(vec3(force), worldPoint ? vec3(worldPoint) : body.position);
      }

      function addTorque(body, torque) {
        if (!body) throw new TypeError('Body is required.');
        body.torque.vadd(vec3(torque), body.torque);
      }

      function vectorToWorldFrame(body, vector) {
        return body.vectorToWorldFrame(vec3(vector));
      }

      function vectorToLocalFrame(body, vector) {
        return body.vectorToLocalFrame(vec3(vector));
      }

      function pointToWorldFrame(body, point) {
        return body.pointToWorldFrame(vec3(point));
      }

      const backend = {
        id: 'cannon',
        version: String(CANNON.version || '0.6.x/unknown'),
        createWorld,
        createBody,
        addBody,
        removeBody,
        step,
        addBoxCollider,
        addPlaneCollider,
        removeCollider,
        shiftColliderOffsets,
        vec3,
        setBodyTransform,
        setBodyVelocity,
        setBodyMass,
        markBodyDirty,
        addCollisionListener,
        applyForce,
        addTorque,
        vectorToWorldFrame,
        vectorToLocalFrame,
        pointToWorldFrame
      };
      return Object.freeze(PhysicsPort.assertBackend(backend));
    }

    return Object.freeze({ create });
  });
})();
