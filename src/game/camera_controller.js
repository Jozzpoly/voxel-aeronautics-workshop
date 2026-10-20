(() => {
  'use strict';

  window.VAW.define('game.camera-controller', [], () => {
    const CAMERA_MODES = Object.freeze(['static', 'follow-position', 'follow-body']);
    const CAMERA_MODE_LABELS = Object.freeze({
      static: 'STATIC',
      'follow-position': 'FOLLOW POS',
      'follow-body': 'FOLLOW BODY'
    });

    function create({
      state: STATE,
      camera,
      THREE,
      document: documentRef = window.document,
      saveUIPreferences = () => {},
      showStatus = () => {},
      primaryFlightBodyId = () => null,
      primaryFlightTransform = () => null
    } = {}) {
      if (!STATE?.camera) throw new TypeError('Camera controller requires application camera state.');
      if (!camera || !THREE) throw new TypeError('Camera controller requires Three.js camera dependencies.');
      const document = documentRef;

      function normalizeCameraMode(value) { return CAMERA_MODES.includes(value) ? value : 'follow-position'; }
      function normalizeCameraFollowStrength(value) {
        const numeric = Number(value);
        return THREE.MathUtils.clamp(Number.isFinite(numeric) ? numeric : 0.08, 0.02, 0.35);
      }
      function cameraPitchLimit() { return Math.PI / 2 - 0.045; }
      function clampCameraPitch(value) { return THREE.MathUtils.clamp(Number(value) || 0, -cameraPitchLimit(), cameraPitchLimit()); }
      function normalizeCameraState() {
        STATE.camera.mode = normalizeCameraMode(STATE.camera.mode);
        STATE.camera.followStrength = normalizeCameraFollowStrength(STATE.camera.followStrength);
        STATE.camera.pitch = clampCameraPitch(STATE.camera.pitch);
        if (!STATE.camera.targetOffset) STATE.camera.targetOffset = new THREE.Vector3(0, 0, 0);
        return STATE.camera;
      }

      function applyCameraOrbit() {
        normalizeCameraState();
        const pitch = STATE.camera.pitch;
        const radius = STATE.camera.distance;
        const offset = new THREE.Vector3(
          radius * Math.cos(pitch) * Math.cos(STATE.camera.yaw),
          radius * Math.sin(pitch),
          radius * Math.cos(pitch) * Math.sin(STATE.camera.yaw)
        );
        if (STATE.mode === 'FLIGHT' && STATE.camera.mode === 'follow-body' && primaryFlightBodyId()) {
          const transform = primaryFlightTransform();
          if (transform?.quaternion) {
            offset.applyQuaternion(new THREE.Quaternion(
              transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w
            ));
          }
        }
        camera.position.copy(STATE.camera.target).add(offset);
        camera.lookAt(STATE.camera.target);
      }

      function syncCameraControls() {
        normalizeCameraState();
        const mode = document.getElementById('camera-mode');
        const follow = document.getElementById('camera-follow-strength');
        const followValue = document.getElementById('ui-camera-follow-strength');
        const followRow = document.getElementById('camera-follow-row');
        const help = document.getElementById('ui-camera-mode-help');
        if (mode) mode.value = STATE.camera.mode;
        if (follow) follow.value = String(Math.round(STATE.camera.followStrength * 100));
        if (followValue) followValue.textContent = `${Math.round(STATE.camera.followStrength * 100)}%`;
        if (followRow) followRow.hidden = STATE.camera.mode === 'static';
        if (help) {
          help.textContent = STATE.camera.mode === 'static'
            ? 'Static camera keeps the current target until you pan or reset. Shift+middle drag pans.'
            : `${CAMERA_MODE_LABELS[STATE.camera.mode]} • Shift+middle drag keeps a manual target offset.`;
        }
      }

      function setCameraMode(value, persist = true) {
        STATE.camera.mode = normalizeCameraMode(value);
        syncCameraControls();
        if (persist) saveUIPreferences();
        showStatus(`CAMERA ${CAMERA_MODE_LABELS[STATE.camera.mode]}`, 900);
      }

      function setCameraFollowStrength(value, persist = true) {
        STATE.camera.followStrength = normalizeCameraFollowStrength(value);
        syncCameraControls();
        if (persist) saveUIPreferences();
      }

      function resetCamera() {
        normalizeCameraState();
        STATE.camera.target.copy(STATE.camera.defaultTarget);
        STATE.camera.targetOffset.set(0, 0, 0);
        STATE.camera.yaw = STATE.camera.defaultYaw;
        STATE.camera.pitch = STATE.camera.defaultPitch;
        STATE.camera.distance = STATE.camera.defaultDistance;
        if (STATE.mode === 'FLIGHT' && primaryFlightBodyId()) {
          const transform = primaryFlightTransform();
          STATE.camera.target.set(transform.position.x, transform.position.y, transform.position.z);
        }
        syncCameraControls();
        applyCameraOrbit();
      }

      function frameWorkshopObject(object) {
        // The authored block's x/y/z can be local to a nested assembly space.
        // Use its rendered world transform, including imported visual bounds.
        if (STATE.mode !== 'BUILD' || !object || !THREE.Box3 || !THREE.Sphere) return false;
        // Force all assembly-space ancestors up to date before deriving world bounds.
        // A newly edited nested frame may not have been rendered yet.
        object.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(object);
        if (bounds.isEmpty()) return false;
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const center = sphere.center;
        const radius = sphere.radius;
        if (![center.x, center.y, center.z, radius].every(Number.isFinite)) return false;
        const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov || 60) / 2;
        const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.2, camera.aspect || 1));
        const narrowHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
        if (!Number.isFinite(narrowHalfFov) || narrowHalfFov <= 0) return false;
        const framedDistance = radius / Math.sin(narrowHalfFov) * 1.35;
        STATE.camera.target.copy(center);
        STATE.camera.targetOffset.set(0, 0, 0);
        STATE.camera.distance = THREE.MathUtils.clamp(framedDistance, 6, 160);
        applyCameraOrbit();
        showStatus('FRAME SELECTED PART', 1000);
        return true;
      }

      function panCameraTargetByPixels(dx, dy) {
        normalizeCameraState();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const viewForward = STATE.camera.target.clone().sub(camera.position).normalize();
        let right = viewForward.clone().cross(worldUp);
        if (right.lengthSq() < 1e-8) right = new THREE.Vector3(Math.cos(STATE.camera.yaw + Math.PI / 2), 0, Math.sin(STATE.camera.yaw + Math.PI / 2));
        right.normalize();
        const up = right.clone().cross(viewForward).normalize();
        const scale = Math.max(0.008, STATE.camera.distance * 0.0022);
        const delta = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale));
        STATE.camera.target.add(delta);
        if (STATE.mode === 'FLIGHT' && STATE.camera.mode !== 'static') STATE.camera.targetOffset.add(delta);
      }

      function fitCameraToFlightTarget() {
        normalizeCameraState();
        if (STATE.mode !== 'FLIGHT' || !primaryFlightBodyId() || STATE.camera.mode === 'static') return;
        const transform = primaryFlightTransform();
        const target = new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z).add(STATE.camera.targetOffset);
        STATE.camera.target.lerp(target, STATE.camera.followStrength);
      }

      return Object.freeze({
        CAMERA_MODES,
        normalizeCameraMode,
        normalizeCameraFollowStrength,
        clampCameraPitch,
        normalizeCameraState,
        applyCameraOrbit,
        syncCameraControls,
        setCameraMode,
        setCameraFollowStrength,
        resetCamera,
        frameWorkshopObject,
        panCameraTargetByPixels,
        fitCameraToFlightTarget
      });
    }

    return Object.freeze({ create, CAMERA_MODES });
  });
})();
