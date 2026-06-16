(() => {
  'use strict';

  window.VAW.define('runtime.headless-physics-backend', ['runtime.physics-port'], PhysicsPort => {
    class Vec3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      copy(value) { return this.set(value.x, value.y, value.z); }
      clone() { return new Vec3(this.x, this.y, this.z); }
      add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; }
      sub(value) { this.x -= value.x; this.y -= value.y; this.z -= value.z; return this; }
      scale(scalar) { this.x *= scalar; this.y *= scalar; this.z *= scalar; return this; }
      lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
      length() { return Math.sqrt(this.lengthSquared()); }
      cross(value, target = new Vec3()) {
        return target.set(
          this.y * value.z - this.z * value.y,
          this.z * value.x - this.x * value.z,
          this.x * value.y - this.y * value.x
        );
      }
    }

    class Quaternion {
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
      copy(value) { return this.set(value.x, value.y, value.z, value.w); }
      normalize() {
        const length = Math.hypot(this.x, this.y, this.z, this.w) || 1;
        this.x /= length; this.y /= length; this.z /= length; this.w /= length;
        return this;
      }
    }

    function vec3(valueOrX = 0, y = 0, z = 0) {
      if (typeof valueOrX === 'object') {
        const value = PhysicsPort.normalizeVec3(valueOrX);
        return new Vec3(value.x, value.y, value.z);
      }
      return new Vec3(Number(valueOrX) || 0, Number(y) || 0, Number(z) || 0);
    }

    function rotateVector(quaternion, value, target = new Vec3()) {
      const x = value.x, y = value.y, z = value.z;
      const qx = quaternion.x, qy = quaternion.y, qz = quaternion.z, qw = quaternion.w;
      const ix = qw * x + qy * z - qz * y;
      const iy = qw * y + qz * x - qx * z;
      const iz = qw * z + qx * y - qy * x;
      const iw = -qx * x - qy * y - qz * z;
      return target.set(
        ix * qw + iw * -qx + iy * -qz - iz * -qy,
        iy * qw + iw * -qy + iz * -qx - ix * -qz,
        iz * qw + iw * -qz + ix * -qy - iy * -qx
      );
    }

    function inverseRotateVector(quaternion, value, target = new Vec3()) {
      return rotateVector({ x: -quaternion.x, y: -quaternion.y, z: -quaternion.z, w: quaternion.w }, value, target);
    }

    function createWorld(value = {}) {
      const descriptor = PhysicsPort.normalizeWorldDescriptor(value);
      return {
        gravity: vec3(descriptor.gravity),
        descriptor,
        bodies: [],
        time: 0,
        steps: 0
      };
    }

    function createBody(value = {}) {
      const descriptor = PhysicsPort.normalizeBodyDescriptor(value);
      return {
        type: descriptor.type,
        mass: descriptor.mass,
        invMass: descriptor.mass > 0 ? 1 / descriptor.mass : 0,
        linearDamping: descriptor.linearDamping,
        angularDamping: descriptor.angularDamping,
        allowSleep: descriptor.allowSleep,
        collisionFilterGroup: descriptor.collisionGroup,
        collisionFilterMask: descriptor.collisionMask,
        position: vec3(descriptor.position),
        quaternion: new Quaternion(
          descriptor.quaternion.x,
          descriptor.quaternion.y,
          descriptor.quaternion.z,
          descriptor.quaternion.w
        ),
        velocity: new Vec3(),
        angularVelocity: new Vec3(),
        force: new Vec3(),
        torque: new Vec3(),
        inertia: new Vec3(),
        invInertia: new Vec3(),
        colliders: [],
        listeners: new Set(),
        userData: descriptor.userData,
        removed: false
      };
    }

    function addBody(world, body) {
      if (!world || !body) throw new TypeError('World and body are required.');
      if (!world.bodies.includes(body)) world.bodies.push(body);
      body.removed = false;
      return body;
    }

    function removeBody(world, body) {
      if (!world || !body) return false;
      const index = world.bodies.indexOf(body);
      if (index < 0) return false;
      world.bodies.splice(index, 1);
      body.removed = true;
      return true;
    }

    function addBoxCollider(body, value = {}) {
      if (!body) throw new TypeError('Body is required.');
      const descriptor = PhysicsPort.normalizeBoxDescriptor(value);
      const shape = {
        kind: 'box',
        halfExtents: vec3(descriptor.halfExtents),
        offset: vec3(descriptor.offset),
        quaternion: new Quaternion(
          descriptor.quaternion.x,
          descriptor.quaternion.y,
          descriptor.quaternion.z,
          descriptor.quaternion.w
        )
      };
      body.colliders.push(shape);
      return shape;
    }

    function addPlaneCollider(body, value = {}) {
      if (!body) throw new TypeError('Body is required.');
      const descriptor = PhysicsPort.normalizePlaneDescriptor(value);
      const shape = {
        kind: 'plane',
        offset: vec3(descriptor.offset),
        quaternion: new Quaternion(
          descriptor.quaternion.x,
          descriptor.quaternion.y,
          descriptor.quaternion.z,
          descriptor.quaternion.w
        )
      };
      body.colliders.push(shape);
      return shape;
    }

    function removeCollider(body, shape) {
      if (!body || !shape) return false;
      const index = body.colliders.indexOf(shape);
      if (index < 0) return false;
      body.colliders.splice(index, 1);
      return true;
    }

    function shiftColliderOffsets(body, shiftValue) {
      if (!body) throw new TypeError('Body is required.');
      const shift = PhysicsPort.normalizeVec3(shiftValue);
      for (const collider of body.colliders) {
        collider.offset.x -= shift.x;
        collider.offset.y -= shift.y;
        collider.offset.z -= shift.z;
      }
    }

    function markBodyDirty() {}

    function setBodyTransform(body, value = {}) {
      if (!body) throw new TypeError('Body is required.');
      if (value.position) body.position.copy(PhysicsPort.normalizeVec3(value.position));
      if (value.quaternion) body.quaternion.copy(PhysicsPort.normalizeQuaternion(value.quaternion));
      return body;
    }

    function setBodyVelocity(body, value = {}) {
      if (!body) throw new TypeError('Body is required.');
      if (value.linear) body.velocity.copy(PhysicsPort.normalizeVec3(value.linear));
      if (value.angular) body.angularVelocity.copy(PhysicsPort.normalizeVec3(value.angular));
      return body;
    }

    function getBodyTransform(body) {
      if (!body) throw new TypeError('Body is required.');
      return Object.freeze({
        position: PhysicsPort.normalizeVec3(body.position),
        quaternion: PhysicsPort.normalizeQuaternion(body.quaternion)
      });
    }

    function getBodyLinearVelocity(body) {
      if (!body) throw new TypeError('Body is required.');
      return PhysicsPort.normalizeVec3(body.velocity);
    }

    function getBodyAngularVelocity(body) {
      if (!body) throw new TypeError('Body is required.');
      return PhysicsPort.normalizeVec3(body.angularVelocity);
    }

    function setBodyMassProperties(body, value = {}) {
      if (!body) throw new TypeError('Body is required.');
      const descriptor = PhysicsPort.normalizeMassProperties(value);
      const center = descriptor.centerOfMass;
      if (Math.hypot(center.x, center.y, center.z) > 1e-8) {
        throw new RangeError('Headless mass properties require colliders centered around local COM.');
      }
      body.mass = descriptor.mass;
      body.invMass = descriptor.mass > 0 ? 1 / descriptor.mass : 0;
      body.type = descriptor.mass > 0 ? PhysicsPort.BODY_TYPES.DYNAMIC : PhysicsPort.BODY_TYPES.STATIC;
      body.inertia.copy(descriptor.inertiaDiagonal);
      body.invInertia.set(
        descriptor.inertiaDiagonal.x > 0 ? 1 / descriptor.inertiaDiagonal.x : 0,
        descriptor.inertiaDiagonal.y > 0 ? 1 / descriptor.inertiaDiagonal.y : 0,
        descriptor.inertiaDiagonal.z > 0 ? 1 / descriptor.inertiaDiagonal.z : 0
      );
      return Object.freeze({
        mass: body.mass,
        inertiaDiagonal: Object.freeze({ x: body.inertia.x, y: body.inertia.y, z: body.inertia.z })
      });
    }

    function setBodyMass(body, mass) {
      return setBodyMassProperties(body, {
        mass,
        inertiaDiagonal: body.inertia
      }).mass;
    }

    function addCollisionListener(body, listener) {
      if (!body || typeof listener !== 'function') throw new TypeError('Body and listener are required.');
      body.listeners.add(listener);
      return () => body.listeners.delete(listener);
    }

    function applyForce(body, forceValue, worldPointValue) {
      if (!body) throw new TypeError('Body is required.');
      const force = vec3(forceValue);
      body.force.add(force);
      if (worldPointValue) {
        const r = vec3(worldPointValue).sub(body.position);
        body.torque.add(r.cross(force));
      }
    }

    function addTorque(body, torqueValue) {
      if (!body) throw new TypeError('Body is required.');
      body.torque.add(vec3(torqueValue));
    }

    function vectorToWorldFrame(body, vectorValue) {
      return rotateVector(body.quaternion, vec3(vectorValue));
    }

    function vectorToLocalFrame(body, vectorValue) {
      return inverseRotateVector(body.quaternion, vec3(vectorValue));
    }

    function pointToWorldFrame(body, pointValue) {
      return rotateVector(body.quaternion, vec3(pointValue)).add(body.position);
    }

    function pointToLocalFrame(body, pointValue) {
      if (!body) throw new TypeError('Body is required.');
      return inverseRotateVector(body.quaternion, vec3(pointValue).sub(body.position));
    }

    function getPointVelocity(body, localPointValue) {
      if (!body) throw new TypeError('Body is required.');
      const worldOffset = vectorToWorldFrame(body, localPointValue);
      return body.angularVelocity.cross(worldOffset).add(body.velocity);
    }

    function integrateQuaternion(body, dt) {
      const wx = body.angularVelocity.x;
      const wy = body.angularVelocity.y;
      const wz = body.angularVelocity.z;
      const qx = body.quaternion.x;
      const qy = body.quaternion.y;
      const qz = body.quaternion.z;
      const qw = body.quaternion.w;
      const halfDt = 0.5 * dt;
      body.quaternion.x += halfDt * (wx * qw + wy * qz - wz * qy);
      body.quaternion.y += halfDt * (wy * qw + wz * qx - wx * qz);
      body.quaternion.z += halfDt * (wz * qw + wx * qy - wy * qx);
      body.quaternion.w += halfDt * (-wx * qx - wy * qy - wz * qz);
      body.quaternion.normalize();
    }

    function step(world, dtValue) {
      if (!world) throw new TypeError('World is required.');
      const dt = Number(dtValue);
      if (!(dt > 0)) throw new RangeError('Physics step must be greater than zero.');
      for (const body of world.bodies) {
        if (!(body.mass > 0)) {
          body.force.set(0, 0, 0);
          body.torque.set(0, 0, 0);
          continue;
        }
        body.velocity.x += (world.gravity.x + body.force.x * body.invMass) * dt;
        body.velocity.y += (world.gravity.y + body.force.y * body.invMass) * dt;
        body.velocity.z += (world.gravity.z + body.force.z * body.invMass) * dt;
        const linearFactor = Math.exp(-body.linearDamping * dt);
        body.velocity.scale(linearFactor);
        body.position.x += body.velocity.x * dt;
        body.position.y += body.velocity.y * dt;
        body.position.z += body.velocity.z * dt;

        const localTorque = inverseRotateVector(body.quaternion, body.torque);
        const localAngularAcceleration = new Vec3(
          localTorque.x * body.invInertia.x,
          localTorque.y * body.invInertia.y,
          localTorque.z * body.invInertia.z
        );
        const worldAngularAcceleration = rotateVector(body.quaternion, localAngularAcceleration);
        body.angularVelocity.x += worldAngularAcceleration.x * dt;
        body.angularVelocity.y += worldAngularAcceleration.y * dt;
        body.angularVelocity.z += worldAngularAcceleration.z * dt;
        const angularFactor = Math.exp(-body.angularDamping * dt);
        body.angularVelocity.scale(angularFactor);
        integrateQuaternion(body, dt);

        body.force.set(0, 0, 0);
        body.torque.set(0, 0, 0);
      }
      world.time += dt;
      world.steps += 1;
    }

    function createConstraint(value = {}) {
      const descriptor = PhysicsPort.normalizeConstraintDescriptor(value);
      throw new Error(`Headless deterministic backend does not support ${descriptor.kind} constraints.`);
    }

    function addConstraint() {
      throw new Error('Headless deterministic backend does not support constraints.');
    }

    function removeConstraint() {
      return false;
    }

    function setConstraintControl() {
      throw new Error('Headless deterministic backend does not support constraint control.');
    }

    function getConstraintState() {
      throw new Error('Headless deterministic backend does not support constraint state.');
    }

    function create() {
      return Object.freeze(PhysicsPort.assertBackend({
        id: 'headless-deterministic',
        version: '1',
        capabilities: Object.freeze({ constraints: Object.freeze({ hinge: false }) }),
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
        getBodyTransform,
        getBodyLinearVelocity,
        getBodyAngularVelocity,
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
        pointToLocalFrame,
        getPointVelocity,
        createConstraint,
        addConstraint,
        removeConstraint,
        setConstraintControl,
        getConstraintState
      }));
    }

    return Object.freeze({ create });
  });
})();
