(function (global) {
  'use strict';

  const ViewerApi = global.VAW_MINIMAL_GLTF_VIEWER;
  const FitApi = global.VAW_FIT_CAMERA;
  const THREE = global.THREE;

  const STUDIO_PREVIEW_PROFILE = Object.freeze({
    id: 'studio-preview',
    source: 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js',
    scene: Object.freeze({ background: 0x07111f, fog: null }),
    renderer: Object.freeze({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      pixelRatioCap: 1,
      outputColorSpace: 'srgb',
      shadowMap: Object.freeze({ enabled: false })
    })
  });

  function parseParams() {
    const params = new URLSearchParams(global.location.search);
    return {
      manifestUrl: params.get('manifest') || '',
      blockType: params.get('block') || 'Balloon',
      width: Math.max(64, Number(params.get('width')) || 640),
      height: Math.max(64, Number(params.get('height')) || 480),
      settleFrames: Math.max(1, Number(params.get('settleFrames')) || 3)
    };
  }

  function joinUrl(baseUrl, relativePath) {
    const base = new URL(baseUrl, global.location.href);
    return new URL(relativePath, base).toString();
  }

  function dirnameUrl(url) {
    const parsed = new URL(url, global.location.href);
    const parts = parsed.pathname.split('/');
    parts.pop();
    parsed.pathname = parts.join('/') + '/';
    return parsed.toString();
  }

  function findAsset(manifest, blockType) {
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    return assets.find(asset => (asset?.bindings?.blockTypes || []).includes(blockType)) || null;
  }

  function vec3(vector) {
    return { x: vector.x, y: vector.y, z: vector.z };
  }

  function waitFrames(count) {
    return new Promise(resolve => {
      let remaining = count;
      function tick() {
        remaining -= 1;
        if (remaining <= 0) resolve();
        else global.requestAnimationFrame(tick);
      }
      global.requestAnimationFrame(tick);
    });
  }

  async function loadModel(modelUrl) {
    const loader = new THREE.GLTFLoader();
    return await new Promise((resolve, reject) => {
      loader.load(modelUrl, gltf => resolve(gltf.scene || gltf.scenes?.[0] || null), undefined, reject);
    });
  }

  function applyMaterialPolicy(viewer, policy = {}) {
    if (policy.pixelated) viewer.applyPixelMode(true);
    if (policy.doubleSided === 'force' || policy.doubleSided === true) viewer.forceDoubleSided(true);
    if (policy.doubleSided === 'never' || policy.doubleSided === false) viewer.forceDoubleSided(false);
  }

  function buildReport({ params, manifest, asset, modelUrl, viewer, bounds, fit }) {
    const target = viewer.controls?.target || bounds.center;
    return {
      visualParityCapture: 'M4L',
      surface: 'studio',
      status: 'ok',
      blockType: params.blockType,
      assetId: asset.assetId || null,
      packRoot: dirnameUrl(params.manifestUrl),
      manifestPath: params.manifestUrl,
      modelPath: asset.model?.path || null,
      modelUrl,
      rendererProfile: STUDIO_PREVIEW_PROFILE,
      viewport: {
        width: params.width,
        height: params.height,
        pixelRatio: viewer.renderer?.getPixelRatio?.() || 1
      },
      camera: {
        fov: viewer.camera?.fov || 50,
        position: vec3(viewer.camera.position),
        target: vec3(target),
        near: viewer.camera?.near || null,
        far: viewer.camera?.far || null
      },
      bounds: bounds.valid ? {
        center: vec3(bounds.center),
        size: vec3(bounds.size),
        maxDim: bounds.maxDim
      } : null,
      fit,
      materialPolicy: asset.materialPolicy || {},
      frameCount: viewer.frameCount,
      capturedAt: new Date().toISOString()
    };
  }

  async function boot() {
    const params = parseParams();
    if (!params.manifestUrl) throw new Error('manifest query parameter is required.');

    const viewerElement = global.document.getElementById('viewer');
    viewerElement.style.width = `${params.width}px`;
    viewerElement.style.height = `${params.height}px`;

    const manifest = await fetch(params.manifestUrl, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`manifest fetch failed: ${response.status}`);
      return response.json();
    });
    const asset = findAsset(manifest, params.blockType);
    if (!asset) throw new Error(`no asset bound to block type ${params.blockType}`);
    if (!asset.model?.path) throw new Error(`asset ${asset.assetId || '(unknown)'} is missing model.path`);

    const modelUrl = joinUrl(params.manifestUrl, asset.model.path);
    const viewer = new ViewerApi.MinimalGltfViewer({
      element: viewerElement,
      pixelRatioCap: STUDIO_PREVIEW_PROFILE.renderer.pixelRatioCap
    });
    if (viewer.webglError) throw viewer.webglError;

    const root = await loadModel(modelUrl);
    if (!root) throw new Error(`model load returned empty root: ${modelUrl}`);
    viewer.setModel(root);
    applyMaterialPolicy(viewer, asset.materialPolicy);
    const fit = viewer.resetCamera();
    viewer.updateHelpers({ grid: false, axes: false, bounds: false });
    await waitFrames(params.settleFrames);
    viewer.renderer.render(viewer.scene, viewer.camera);

    const bounds = FitApi.computeObjectBounds(viewer.root, THREE);
    const report = buildReport({ params, manifest, asset, modelUrl, viewer, bounds, fit });

    global.__VAW_STUDIO_CAPTURE__ = Object.freeze({
      ready: true,
      report,
      capturePngDataUrl() {
        viewer.renderer.render(viewer.scene, viewer.camera);
        return viewer.renderer.domElement.toDataURL('image/png');
      }
    });
  }

  boot().catch(error => {
    global.__VAW_STUDIO_CAPTURE__ = Object.freeze({
      ready: false,
      error: String(error?.message || error)
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);