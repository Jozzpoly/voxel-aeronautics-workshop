(function (global, factory) {
  const api = factory(global.THREE || null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_VIEWPORT_CONTROLS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (THREE) {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function createControlState(options = {}) {
    return {
      target: options.target || { x: 0, y: 0, z: 0 },
      distance: options.distance || 6,
      theta: options.theta || Math.PI * 0.25,
      phi: options.phi || Math.PI * 0.32,
      minDistance: options.minDistance || 0.02,
      maxDistance: options.maxDistance || 100000,
      stats: { rotateEvents: 0, panEvents: 0, zoomEvents: 0, ignoredLeftRight: 0 },
    };
  }

  function classifyPointerButton(button, shiftKey) {
    if (button === 1 && shiftKey) return 'pan';
    if (button === 1) return 'rotate';
    if (button === 0 || button === 2) return 'ignore';
    return 'ignore';
  }

  class ViewportControls {
    constructor(camera, domElement, options = {}) {
      if (!THREE) throw new Error('ViewportControls require global THREE in the browser.');
      this.camera = camera;
      this.domElement = domElement;
      this.enabled = true;
      this.state = createControlState(options);
      this.target = new THREE.Vector3(0, 0, 0);
      this.dragMode = null;
      this.pointerId = null;
      this.last = { x: 0, y: 0 };
      this.rotateSpeed = options.rotateSpeed || 0.0075;
      this.panSpeed = options.panSpeed || 0.0016;
      this.zoomSpeed = options.zoomSpeed || 0.0012;
      this.stats = this.state.stats;
      this._bind();
      this.syncFromCamera();
    }

    _bind() {
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onWheel = this.onWheel.bind(this);
      this.domElement.addEventListener('pointerdown', this.onPointerDown);
      this.domElement.addEventListener('pointermove', this.onPointerMove);
      this.domElement.addEventListener('pointerup', this.onPointerUp);
      this.domElement.addEventListener('pointercancel', this.onPointerUp);
      this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
      this.domElement.addEventListener('contextmenu', event => {
        // PPM is intentionally left for future model interactions. Do not bind camera to it.
        if (this.dragMode === 'rotate' || this.dragMode === 'pan') event.preventDefault();
      });
    }

    dispose() {
      this.domElement.removeEventListener('pointerdown', this.onPointerDown);
      this.domElement.removeEventListener('pointermove', this.onPointerMove);
      this.domElement.removeEventListener('pointerup', this.onPointerUp);
      this.domElement.removeEventListener('pointercancel', this.onPointerUp);
      this.domElement.removeEventListener('wheel', this.onWheel);
    }

    setTarget(value) {
      this.target.copy(value);
      this.syncFromCamera();
      this.update();
    }

    syncFromCamera() {
      if (!this.camera || !this.target) return;
      const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      this.state.distance = clamp(spherical.radius || this.state.distance || 6, this.state.minDistance, this.state.maxDistance);
      this.state.theta = spherical.theta;
      this.state.phi = spherical.phi;
    }

    update() {
      this.state.phi = clamp(this.state.phi, 0.01, Math.PI - 0.01);
      this.state.distance = clamp(this.state.distance, this.state.minDistance, this.state.maxDistance);
      const spherical = new THREE.Spherical(this.state.distance, this.state.phi, this.state.theta);
      const offset = new THREE.Vector3().setFromSpherical(spherical);
      this.camera.position.copy(this.target).add(offset);
      this.camera.lookAt(this.target);
    }

    onPointerDown(event) {
      if (!this.enabled) return;
      const mode = classifyPointerButton(event.button, event.shiftKey);
      if (mode === 'ignore') {
        this.stats.ignoredLeftRight += 1;
        return;
      }
      this.dragMode = mode;
      this.pointerId = event.pointerId;
      this.last.x = event.clientX;
      this.last.y = event.clientY;
      this.domElement.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }

    onPointerMove(event) {
      if (!this.enabled || event.pointerId !== this.pointerId || !this.dragMode) return;
      const dx = event.clientX - this.last.x;
      const dy = event.clientY - this.last.y;
      this.last.x = event.clientX;
      this.last.y = event.clientY;
      if (this.dragMode === 'rotate') {
        this.state.theta -= dx * this.rotateSpeed;
        this.state.phi -= dy * this.rotateSpeed;
        this.stats.rotateEvents += 1;
        this.update();
      } else if (this.dragMode === 'pan') {
        const distance = Math.max(this.state.distance, 0.001);
        const rect = this.domElement.getBoundingClientRect ? this.domElement.getBoundingClientRect() : { height: 720 };
        const scale = distance * this.panSpeed * Math.max(1, (this.camera.fov || 50) / 50) * Math.max(0.5, rect.height / 720);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        this.target.addScaledVector(right, -dx * scale);
        this.target.addScaledVector(up, dy * scale);
        this.stats.panEvents += 1;
        this.update();
      }
      event.preventDefault();
    }

    onPointerUp(event) {
      if (event.pointerId === this.pointerId) {
        this.domElement.releasePointerCapture?.(event.pointerId);
        this.dragMode = null;
        this.pointerId = null;
      }
    }

    onWheel(event) {
      if (!this.enabled) return;
      const factor = Math.exp(event.deltaY * this.zoomSpeed);
      this.state.distance = clamp(this.state.distance * factor, this.state.minDistance, this.state.maxDistance);
      this.stats.zoomEvents += 1;
      this.update();
      event.preventDefault();
    }
  }

  return Object.freeze({ ViewportControls, createControlState, classifyPointerButton });
});
