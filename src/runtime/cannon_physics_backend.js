(() => {
  'use strict';

  window.VAW.define('runtime.cannon-physics-backend', ['runtime.physics-port'], PhysicsPort => {
    function create(CANNON) {
      if (!CANNON || typeof CANNON !== 'object') throw new Error('Cannon.js is unavailable.');
      const required = ['World', 'Body', 'Box', 'Plane', 'Vec3', 'Quaternion'];
      const missing = required.filter(name => typeof CANNON[name] !== 'function');
      if (missing.length) throw new Error(`Cannon.js is missing capabilities: ${missing.join(', ')}`);

      const constraintsByWorld = new WeakMap();

      function vec3(x = 0, y = 0, z = 0) {
        if (x && typeof x === 'object') return new CANNON.Vec3(Number(x.x) || 0, Number(x.y) || 0, Number(x.z) || 0);
        return new CANNON.Vec3(Number(x) || 0, Number(y) || 0, Number(z) || 0);
      }

      function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
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
        constraintsByWorld.set(world, new Set());
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
          type: descriptor.mass > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC,
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
        const constraints = constraintsByWorld.get(world);
        if (constraints && [...constraints].some(constraint => constraint.bodyA === body || constraint.bodyB === body)) {
          throw new Error('Cannot remove a body while an active constraint still references it.');
        }
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


      function syncBodyType(body, mass) {
        body.type = mass > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC;
        if (mass > 0 && typeof body.wakeUp === 'function') body.wakeUp();
      }

      function setBodyMassProperties(body, value = {}) {
        if (!body) throw new TypeError('Body is required.');
        const descriptor = PhysicsPort.normalizeMassProperties(value);
        const center = descriptor.centerOfMass;
        if (Math.hypot(center.x, center.y, center.z) > 1e-8) {
          throw new RangeError('Cannon mass properties require colliders to be centered around local COM before assignment.');
        }
        body.mass = descriptor.mass;
        body.invMass = descriptor.mass > 0 ? 1 / descriptor.mass : 0;
        syncBodyType(body, descriptor.mass);
        const inertia = descriptor.inertiaDiagonal;
        const hasExplicitInertia = inertia.x > 0 || inertia.y > 0 || inertia.z > 0;
        if (!hasExplicitInertia) {
          if (typeof body.updateMassProperties === 'function') body.updateMassProperties();
          if (typeof body.updateSolveMassProperties === 'function') body.updateSolveMassProperties();
        } else {
          if (!body.inertia || !body.invInertia) throw new Error('Cannon body does not expose diagonal inertia fields.');
          body.inertia.set(inertia.x, inertia.y, inertia.z);
          body.invInertia.set(
            inertia.x > 0 && !body.fixedRotation ? 1 / inertia.x : 0,
            inertia.y > 0 && !body.fixedRotation ? 1 / inertia.y : 0,
            inertia.z > 0 && !body.fixedRotation ? 1 / inertia.z : 0
          );
          if (typeof body.updateInertiaWorld === 'function') body.updateInertiaWorld(true);
          if (typeof body.updateSolveMassProperties === 'function') body.updateSolveMassProperties();
        }
        markBodyDirty(body);
        return Object.freeze({
          mass: body.mass,
          inertiaDiagonal: Object.freeze({ x: body.inertia?.x || 0, y: body.inertia?.y || 0, z: body.inertia?.z || 0 })
        });
      }

      function setBodyMass(body, mass) {
        if (!body) throw new TypeError('Body is required.');
        body.mass = Math.max(0, Number(mass) || 0);
        syncBodyType(body, body.mass);
        if (typeof body.updateMassProperties === 'function') body.updateMassProperties();
        if (typeof body.updateSolveMassProperties === 'function') body.updateSolveMassProperties();
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


      function constraintSet(world) {
        const set = constraintsByWorld.get(world);
        if (!set) throw new TypeError('World was not created by this Cannon backend.');
        return set;
      }

      function worldAxis(body, localAxis, target = vec3()) {
        body.vectorToWorldFrame(vec3(localAxis), target);
        if (target.norm2() <= 1e-16) throw new RangeError('Hinge axis became degenerate.');
        target.normalize();
        return target;
      }

      function chooseReference(bodyA, bodyB, axisA) {
        const axis = worldAxis(bodyA, axisA);
        const tangentA = vec3();
        const tangentB = vec3();
        axis.tangents(tangentA, tangentB);
        const localA = bodyA.vectorToLocalFrame(tangentA);
        const localB = bodyB.vectorToLocalFrame(tangentA);
        return { localA: localA.clone(), localB: localB.clone() };
      }

      function rawHingeAngle(constraint) {
        const axis = worldAxis(constraint.bodyA, constraint.descriptor.axisA);
        const referenceA = constraint.bodyA.vectorToWorldFrame(constraint.referenceA);
        const referenceB = constraint.bodyB.vectorToWorldFrame(constraint.referenceB);
        const axisProjection = vec3();
        axis.scale(referenceA.dot(axis), axisProjection);
        referenceA.vsub(axisProjection, referenceA);
        axis.scale(referenceB.dot(axis), axisProjection);
        referenceB.vsub(axisProjection, referenceB);
        if (referenceA.norm2() <= 1e-16 || referenceB.norm2() <= 1e-16) {
          throw new RangeError('Hinge reference vector became degenerate.');
        }
        referenceA.normalize();
        referenceB.normalize();
        const cross = vec3();
        referenceA.cross(referenceB, cross);
        return Math.atan2(axis.dot(cross), clamp(referenceA.dot(referenceB), -1, 1));
      }

      function sampleConstraint(constraint) {
        const rawAngle = rawHingeAngle(constraint);
        if (!constraint.sampled) {
          constraint.lastRawAngle = rawAngle;
          constraint.angle = 0;
          constraint.sampled = true;
        } else {
          let delta = rawAngle - constraint.lastRawAngle;
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          constraint.angle += delta;
          constraint.lastRawAngle = rawAngle;
        }
        const axis = worldAxis(constraint.bodyA, constraint.descriptor.axisA);
        const relativeAngularVelocity = vec3();
        constraint.bodyB.angularVelocity.vsub(constraint.bodyA.angularVelocity, relativeAngularVelocity);
        constraint.angularVelocity = relativeAngularVelocity.dot(axis);
        return constraint;
      }

      function controlTarget(constraint) {
        sampleConstraint(constraint);
        const control = constraint.control;
        const limits = constraint.descriptor.limits;
        let targetSpeed = 0;
        let maxTorque = 0;

        if (control.mode === PhysicsPort.CONSTRAINT_MODES.MOTOR) {
          targetSpeed = clamp(control.targetSpeed, -control.maxSpeed, control.maxSpeed);
          maxTorque = control.maxTorque;
        } else if (control.mode === PhysicsPort.CONSTRAINT_MODES.SERVO) {
          const targetAngle = limits
            ? clamp(control.targetAngle, limits.minAngle, limits.maxAngle)
            : control.targetAngle;
          const error = targetAngle - constraint.angle;
          targetSpeed = clamp(
            error * control.positionGain - constraint.angularVelocity * control.velocityDamping,
            -control.maxSpeed,
            control.maxSpeed
          );
          maxTorque = control.maxTorque;
        } else if (constraint.descriptor.frictionTorque > 0) {
          targetSpeed = 0;
          maxTorque = constraint.descriptor.frictionTorque;
        }

        if (limits) {
          const below = constraint.angle < limits.minAngle;
          const above = constraint.angle > limits.maxAngle;
          const nearLower = constraint.angle <= limits.minAngle + limits.tolerance;
          const nearUpper = constraint.angle >= limits.maxAngle - limits.tolerance;
          if (below || (nearLower && (targetSpeed < 0 || constraint.angularVelocity < 0))) {
            const error = limits.minAngle - constraint.angle;
            const correction = clamp(
              error * limits.positionGain - constraint.angularVelocity * limits.velocityDamping,
              0,
              limits.maxSpeed
            );
            targetSpeed = Math.max(targetSpeed, correction);
            maxTorque = Math.max(maxTorque, limits.maxTorque);
          }
          if (above || (nearUpper && (targetSpeed > 0 || constraint.angularVelocity > 0))) {
            const error = limits.maxAngle - constraint.angle;
            const correction = clamp(
              error * limits.positionGain - constraint.angularVelocity * limits.velocityDamping,
              -limits.maxSpeed,
              0
            );
            targetSpeed = Math.min(targetSpeed, correction);
            maxTorque = Math.max(maxTorque, limits.maxTorque);
          }
        }

        return { targetSpeed, maxTorque };
      }

      function applyConstraintControl(constraint) {
        if (!constraint || constraint.removed) return;
        const { targetSpeed, maxTorque } = controlTarget(constraint);
        constraint.appliedTargetSpeed = targetSpeed;
        constraint.appliedMaxTorque = maxTorque;
        if (maxTorque > 0) {
          constraint.native.enableMotor();
          constraint.native.setMotorSpeed(-targetSpeed);
          constraint.native.setMotorMaxForce(maxTorque);
          constraint.bodyA.wakeUp?.();
          constraint.bodyB.wakeUp?.();
        } else {
          constraint.native.disableMotor();
        }
      }

      function createConstraint(value = {}) {
        if (typeof CANNON.HingeConstraint !== 'function') {
          throw new Error('This Cannon build does not provide HingeConstraint.');
        }
        const descriptor = PhysicsPort.normalizeConstraintDescriptor(value);
        const axisAWorld = worldAxis(descriptor.bodyA, descriptor.axisA);
        const axisBWorld = worldAxis(descriptor.bodyB, descriptor.axisB);
        if (axisAWorld.dot(axisBWorld) < 0.999) {
          throw new RangeError('Hinge axes must point in the same world direction at construction time.');
        }
        const pivotAWorld = descriptor.bodyA.pointToWorldFrame(vec3(descriptor.pivotA));
        const pivotBWorld = descriptor.bodyB.pointToWorldFrame(vec3(descriptor.pivotB));
        if (pivotAWorld.distanceTo(pivotBWorld) > 0.05) {
          throw new RangeError('Hinge pivots must coincide in world space at construction time.');
        }
        const reference = chooseReference(descriptor.bodyA, descriptor.bodyB, descriptor.axisA);
        const native = new CANNON.HingeConstraint(descriptor.bodyA, descriptor.bodyB, {
          pivotA: vec3(descriptor.pivotA),
          pivotB: vec3(descriptor.pivotB),
          axisA: vec3(descriptor.axisA),
          axisB: vec3(descriptor.axisB),
          maxForce: descriptor.maxForce
        });
        native.collideConnected = descriptor.collideConnected;
        const constraint = {
          kind: descriptor.kind,
          native,
          bodyA: descriptor.bodyA,
          bodyB: descriptor.bodyB,
          descriptor,
          control: descriptor.control,
          referenceA: reference.localA,
          referenceB: reference.localB,
          sampled: false,
          lastRawAngle: 0,
          angle: 0,
          angularVelocity: 0,
          appliedTargetSpeed: 0,
          appliedMaxTorque: 0,
          world: null,
          added: false,
          removed: false
        };
        sampleConstraint(constraint);
        return constraint;
      }

      function addConstraint(world, constraint) {
        if (!world || !constraint?.native) throw new TypeError('World and constraint are required.');
        const registered = constraintSet(world);
        if (constraint.removed) throw new Error('Removed constraint cannot be added again.');
        if (constraint.added) {
          if (constraint.world !== world) throw new Error('Constraint already belongs to another world.');
          return constraint;
        }
        if (!world.bodies.includes(constraint.bodyA) || !world.bodies.includes(constraint.bodyB)) {
          throw new Error('Both constraint bodies must be added to the target world first.');
        }
        world.addConstraint(constraint.native);
        registered.add(constraint);
        constraint.world = world;
        constraint.added = true;
        return constraint;
      }

      function removeConstraint(world, constraint) {
        if (!world || !constraint?.native || constraint.removed || !constraint.added) return false;
        if (constraint.world !== world) return false;
        // Disable first so a backend exception cannot leave our registry claiming removal
        // after the native constraint has already been detached from the world.
        constraint.native.disableMotor();
        world.removeConstraint(constraint.native);
        constraintSet(world).delete(constraint);
        constraint.world = null;
        constraint.added = false;
        constraint.removed = true;
        return true;
      }

      function setConstraintControl(constraint, value = {}) {
        if (!constraint || constraint.removed) throw new Error('Active constraint is required.');
        constraint.control = PhysicsPort.normalizeConstraintControl(value);
        return constraint.control;
      }

      function getConstraintState(constraint) {
        if (!constraint || constraint.removed) throw new Error('Active constraint is required.');
        sampleConstraint(constraint);
        const limits = constraint.descriptor.limits;
        return Object.freeze({
          kind: constraint.kind,
          angle: constraint.angle,
          angularVelocity: constraint.angularVelocity,
          mode: constraint.control.mode,
          targetSpeed: constraint.control.targetSpeed,
          targetAngle: constraint.control.targetAngle,
          appliedTargetSpeed: constraint.appliedTargetSpeed,
          appliedMaxTorque: constraint.appliedMaxTorque,
          atLowerLimit: Boolean(limits && constraint.angle <= limits.minAngle + limits.tolerance),
          atUpperLimit: Boolean(limits && constraint.angle >= limits.maxAngle - limits.tolerance),
          collideConnected: constraint.descriptor.collideConnected,
          added: constraint.added
        });
      }

      function step(world, dt) {
        if (!world) throw new TypeError('World is required.');
        const fixedDt = Number(dt);
        if (!(fixedDt > 0)) throw new RangeError('Physics step must be greater than zero.');
        for (const constraint of constraintSet(world)) applyConstraintControl(constraint);
        world.step(fixedDt);
        for (const constraint of constraintSet(world)) sampleConstraint(constraint);
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

      function getPointVelocity(body, localPoint) {
        if (!body) throw new TypeError('Body is required.');
        const worldOffset = vectorToWorldFrame(body, localPoint);
        const rotational = vec3();
        const result = vec3();
        body.angularVelocity.cross(worldOffset, rotational);
        body.velocity.vadd(rotational, result);
        return result;
      }

      const backend = {
        id: 'cannon',
        version: String(CANNON.version || '0.6.x/unknown'),
        capabilities: Object.freeze({ constraints: Object.freeze({ hinge: typeof CANNON.HingeConstraint === 'function' }) }),
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
        setBodyMassProperties,
        markBodyDirty,
        addCollisionListener,
        applyForce,
        addTorque,
        vectorToWorldFrame,
        vectorToLocalFrame,
        pointToWorldFrame,
        getPointVelocity,
        createConstraint,
        addConstraint,
        removeConstraint,
        setConstraintControl,
        getConstraintState
      };
      return Object.freeze(PhysicsPort.assertBackend(backend));
    }

    return Object.freeze({ create });
  });
})();
