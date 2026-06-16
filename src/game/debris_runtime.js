(() => {
  'use strict';

  window.VAW.define('game.debris-runtime', [], () => {
    function create({
      Physics, world, scene, disposeObjectTree, maxLifetime = 18, collisionGroup = 1, collisionMask = -1
    } = {}) {
      if (!Physics || !world || !scene || typeof disposeObjectTree !== 'function') {
        throw new TypeError('DebrisRuntime requires Physics, world, scene, and disposeObjectTree.');
      }

      function spawn({ visual, mass, worldPosition, worldVelocity, angularVelocity, worldQuaternion, sourceBodyId }) {
        if (!visual) throw new TypeError('Debris visual is required.');
        let body = null;
        let bodyAdded = false;
        try {
          body = Physics.createBody({
            mass: Math.max(0.15, Number(mass) || 0),
            linearDamping: 0.025,
            angularDamping: 0.04,
            allowSleep: true,
            collisionGroup,
            collisionMask,
            position: worldPosition,
            quaternion: worldQuaternion,
            userData: { debris: true }
          });
          Physics.addBoxCollider(body, { halfExtents: { x: 0.47, y: 0.47, z: 0.47 } });
          Physics.setBodyVelocity(body, { linear: worldVelocity, angular: angularVelocity });
          const added = Physics.addBody(world, body);
          if (added === false) throw new Error('Physics backend rejected debris body registration.');
          bodyAdded = true;

          scene.add(visual);
          visual.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
          visual.quaternion.set(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w);
          return {
            body,
            visual,
            age: 0,
            sourceBodyId: sourceBodyId == null ? null : String(sourceBodyId),
            bodyDisposed: false,
            visualDisposed: false
          };
        } catch (error) {
          if (bodyAdded) {
            try { Physics.removeBody(world, body); }
            catch (cleanupError) {
              Object.defineProperty(error, 'cleanupError', { value: cleanupError, configurable: true });
            }
          }
          throw error;
        }
      }

      function update(entry, dt) {
        entry.age += Math.max(0, Number(dt) || 0);
        const transform = Physics.getBodyTransform(entry.body);
        entry.visual.position.set(transform.position.x, transform.position.y, transform.position.z);
        entry.visual.quaternion.set(
          transform.quaternion.x,
          transform.quaternion.y,
          transform.quaternion.z,
          transform.quaternion.w
        );
        return entry.age > maxLifetime || transform.position.y < -20;
      }

      function dispose(entry) {
        if (!entry || typeof entry !== 'object') return false;
        if (!entry.bodyDisposed) {
          const removed = Physics.removeBody(world, entry.body);
          if (removed === false) throw new Error('Physics backend rejected debris body cleanup.');
          entry.bodyDisposed = true;
        }
        if (!entry.visualDisposed) {
          scene.remove(entry.visual);
          disposeObjectTree(entry.visual);
          entry.visualDisposed = true;
        }
        return true;
      }

      return Object.freeze({ spawn, update, dispose });
    }

    return Object.freeze({ create });
  });
})();
