(function (global, factory) {
  const api = factory(global.THREE || null, global.VAW_VIEWPORT_CONTROLS || null, global.VAW_FIT_CAMERA || null, global.VAW_TEXTURE_REPORT || null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_MINIMAL_GLTF_VIEWER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (THREE, ControlsApi, FitApi, TextureApi) {
  'use strict';

  class MinimalGltfViewer {
    constructor({ element, statusCallback = null, animationCallback = null, pixelRatioCap = 2 } = {}) {
      if (!THREE) throw new Error('THREE is required.');
      if (!element) throw new Error('Viewer element is required.');
      this.element = element;
      this.statusCallback = statusCallback;
      this.animationCallback = animationCallback;
      this.pixelRatioCap = pixelRatioCap;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.root = null;
      this.helperRoot = null;
      this.clock = null;
      this.mixer = null;
      this.activeAction = null;
      this.activeClip = null;
      this.animationSpeed = 1;
      this.animationPaused = false;
      this.loopAnimation = true;
      this.frameId = null;
      this.frameCount = 0;
      this.lastFrameAt = 0;
      this.lastBounds = null;
      this.webglError = null;
      this.init();
    }

    init() {
      if (this.scene) return;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x07111f);
      this.camera = new THREE.PerspectiveCamera(50, 1, 0.001, 100000);
      this.camera.position.set(4, 3, 6);
      this.clock = new THREE.Clock();
      this.helperRoot = new THREE.Group();
      this.helperRoot.name = 'VAWViewerHelpers';
      this.scene.add(this.helperRoot);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2b44, 1.35));
      const key = new THREE.DirectionalLight(0xffffff, 1.75);
      key.position.set(6, 8, 5);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x9edcff, 0.6);
      rim.position.set(-4, 3, -6);
      this.scene.add(rim);

      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
        if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        else if ('outputEncoding' in this.renderer && THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.element.innerHTML = '';
        this.element.appendChild(this.renderer.domElement);
        this.renderer.domElement.tabIndex = 0;
        this.controls = new ControlsApi.ViewportControls(this.camera, this.renderer.domElement);
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.startRenderLoop();
        this.report('renderer.ok', 'WebGL renderer ready.');
      } catch (error) {
        this.webglError = error;
        this.element.innerHTML = `<div class="viewer-error"><strong>Renderer WebGL niedostępny.</strong><br>Import/diagnostyka mogą działać, ale podgląd 3D wymaga WebGL.<br><small>${escapeHtml(error.message || String(error))}</small></div>`;
        this.report('renderer.fail', error.message || String(error));
      }
    }

    startRenderLoop() {
      if (this.frameId || !this.renderer) return;
      const tick = () => {
        this.frameId = requestAnimationFrame(tick);
        const dt = this.clock ? this.clock.getDelta() : 0;
        if (this.mixer && !this.animationPaused) this.mixer.update(dt * this.animationSpeed);
        if (this.activeClip) this.reportAnimationFrame();
        this.frameCount += 1;
        this.lastFrameAt = performance.now();
        this.renderer.render(this.scene, this.camera);
      };
      this.frameId = requestAnimationFrame(tick);
    }

    stopRenderLoop() {
      if (this.frameId) cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    resize() {
      if (!this.renderer || !this.camera) return;
      const rect = this.element.getBoundingClientRect();
      const width = Math.max(1, rect.width || this.element.clientWidth || 640);
      const height = Math.max(1, rect.height || this.element.clientHeight || 420);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    clearModel() {
      if (this.mixer) {
        this.mixer.stopAllAction();
        if (this.root) this.mixer.uncacheRoot(this.root);
      }
      this.mixer = null;
      this.activeAction = null;
      this.activeClip = null;
      this.animationPaused = false;
      if (this.root) {
        this.scene.remove(this.root);
        this.root.traverse(object => {
          if (object.geometry) object.geometry.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
          for (const material of materials) {
            for (const value of Object.values(material)) if (value && value.isTexture) value.dispose?.();
            material.dispose?.();
          }
        });
      }
      this.root = null;
      this.lastBounds = null;
      this.clearHelpers();
      // Critical recovery rule: do not cancel the render loop during import reset.
      this.startRenderLoop();
    }

    setModel(root) {
      this.clearModel();
      this.root = root;
      this.root.name = this.root.name || 'ImportedModelRoot';
      this.root.visible = true;
      this.scene.add(this.root);
      this.resetCamera();
      this.startRenderLoop();
    }

    fit() {
      if (!this.root) return null;
      const bounds = FitApi.computeObjectBounds(this.root, THREE);
      if (!bounds.valid) {
        this.report('fit.invalidBounds', bounds.reason || 'invalid bounds');
        return null;
      }
      this.lastBounds = bounds;
      const result = FitApi.frameCameraToBounds(this.camera, this.controls, bounds, { margin: 1.75 }, THREE);
      this.resize();
      this.updateHelpers({ grid: true, axes: true, bounds: false });
      this.report('fit.ok', `frame keeps orientation · center=${fmtVec(bounds.center)} size=${fmtVec(bounds.size)} distance=${result.distance.toFixed(3)}`);
      return result;
    }

    resetCamera() {
      if (!this.root) return null;
      const bounds = FitApi.computeObjectBounds(this.root, THREE);
      if (!bounds.valid) {
        this.report('reset.invalidBounds', bounds.reason || 'invalid bounds');
        return null;
      }
      this.lastBounds = bounds;
      const result = FitApi.fitCameraToBounds(this.camera, this.controls, bounds, { margin: 1.75 }, THREE);
      this.resize();
      this.updateHelpers({ grid: true, axes: true, bounds: false });
      this.report('reset.ok', `default orientation · center=${fmtVec(bounds.center)} size=${fmtVec(bounds.size)} distance=${result.distance.toFixed(3)}`);
      return result;
    }

    clearHelpers() {
      if (!this.helperRoot) return;
      while (this.helperRoot.children.length) {
        const child = this.helperRoot.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    }

    updateHelpers({ grid = true, axes = true, bounds = false } = {}) {
      if (!this.helperRoot) return;
      this.clearHelpers();
      const center = this.lastBounds && this.lastBounds.valid ? this.lastBounds.center : new THREE.Vector3();
      const maxDim = this.lastBounds && this.lastBounds.valid ? Math.max(this.lastBounds.maxDim, 1) : 8;
      if (grid) {
        const helper = new THREE.GridHelper(maxDim * 3, 12, 0x496c9a, 0x233f5c);
        helper.position.set(center.x, this.lastBounds?.box?.min?.y || 0, center.z);
        this.helperRoot.add(helper);
      }
      if (axes) {
        const helper = new THREE.AxesHelper(maxDim * 0.65);
        helper.position.copy(center);
        this.helperRoot.add(helper);
      }
      if (this.root && THREE.BoxGeometry && THREE.MeshBasicMaterial) {
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, wireframe: true, depthWrite: false })
        );
        proxy.name = 'VAWBlockProxyPreview_1x1x1';
        this.helperRoot.add(proxy);
      }
      if (bounds && this.root) this.helperRoot.add(new THREE.BoxHelper(this.root, 0x3eeeff));
    }

    applyPixelMode(enabled) { TextureApi.applyPixelMode(this.root, enabled); }
    forceDoubleSided(enabled) { TextureApi.forceDoubleSided(this.root, enabled); }

    playAnimation(clip, options = {}) {
      if (!clip || !this.root) return false;
      if (!this.mixer) this.mixer = new THREE.AnimationMixer(this.root);
      if (this.activeAction) this.activeAction.stop();
      this.activeClip = clip;
      this.animationSpeed = Number.isFinite(Number(options.speed)) ? Number(options.speed) : this.animationSpeed;
      this.loopAnimation = options.loop !== undefined ? Boolean(options.loop) : this.loopAnimation;
      this.animationPaused = false;
      this.activeAction = this.mixer.clipAction(clip);
      if (typeof this.activeAction.setLoop === 'function') {
        this.activeAction.setLoop(this.loopAnimation ? THREE.LoopRepeat : THREE.LoopOnce, this.loopAnimation ? Infinity : 1);
      }
      this.activeAction.clampWhenFinished = !this.loopAnimation;
      this.activeAction.enabled = true;
      this.activeAction.paused = false;
      this.activeAction.reset().play();
      this.reportAnimationFrame();
      return true;
    }

    pauseAnimation(paused = true) {
      this.animationPaused = Boolean(paused);
      if (this.activeAction) this.activeAction.paused = this.animationPaused;
      this.reportAnimationFrame();
      return this.animationPaused;
    }

    setAnimationSpeed(speed = 1) {
      const value = Number(speed);
      this.animationSpeed = Number.isFinite(value) && value > 0 ? value : 1;
      return this.animationSpeed;
    }

    setAnimationTime(seconds = 0) {
      if (!this.mixer || !this.activeClip) return false;
      const duration = Math.max(0.001, Number(this.activeClip.duration) || 0.001);
      const time = Math.max(0, Math.min(Number(seconds) || 0, duration));
      this.mixer.setTime(time);
      this.reportAnimationFrame();
      return true;
    }

    getAnimationFacts() {
      const duration = this.activeClip && Number.isFinite(this.activeClip.duration) ? Math.max(0, this.activeClip.duration) : 0;
      const rawTime = this.activeAction && Number.isFinite(this.activeAction.time) ? this.activeAction.time : 0;
      const currentTime = duration > 0 ? Math.max(0, Math.min(rawTime, duration)) : 0;
      return {
        activeClip: this.activeClip ? (this.activeClip.name || '(unnamed)') : null,
        duration,
        currentTime,
        speed: this.animationSpeed,
        paused: this.animationPaused,
        loop: this.loopAnimation,
      };
    }

    reportAnimationFrame() {
      if (typeof this.animationCallback === 'function') this.animationCallback(this.getAnimationFacts());
    }

    stopAnimation() {
      if (this.activeAction) this.activeAction.stop();
      this.activeAction = null;
      this.activeClip = null;
      this.animationPaused = false;
      this.reportAnimationFrame();
    }

    report(code, message) { if (this.statusCallback) this.statusCallback({ code, message }); }
  }

  function fmtVec(vector) {
    return `${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  return Object.freeze({ MinimalGltfViewer });
});
