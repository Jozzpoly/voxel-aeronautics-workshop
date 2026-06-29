(function (global, factory) {
  const api = factory(global.THREE || null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_TEXTURE_REPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (THREE) {
  'use strict';

  const TEXTURE_SLOTS = [
    ['map', 'baseColorTexture'], ['emissiveMap', 'emissiveTexture'], ['normalMap', 'normalTexture'],
    ['roughnessMap', 'metallicRoughnessTexture'], ['metalnessMap', 'metallicRoughnessTexture'],
    ['aoMap', 'occlusionTexture'], ['alphaMap', 'alphaTexture']
  ];

  function textureName(texture) {
    if (!texture) return '';
    if (texture.name) return texture.name;
    if (texture.source && texture.source.data && texture.source.data.src) return texture.source.data.src.split('/').pop();
    if (texture.image && texture.image.src) return texture.image.src.split('/').pop();
    return texture.uuid || '(texture)';
  }

  function imageStatus(gltfJson, bundle, basePath) {
    return (gltfJson.images || []).map((image, index) => {
      let resolved = null;
      if (image.uri && bundle && typeof bundle.resolveRecord === 'function') resolved = bundle.resolveRecord(image.uri, basePath);
      const status = image.uri ? (resolved ? resolved.status : 'unknown') : (Number.isInteger(image.bufferView) ? 'embedded-bufferView' : 'missing-uri');
      return {
        index,
        name: image.name || `image_${index}`,
        uri: image.uri || '',
        mimeType: image.mimeType || '',
        bufferView: Number.isInteger(image.bufferView) ? image.bufferView : null,
        status,
        path: resolved && resolved.record ? resolved.record.normalizedPath : null,
        candidates: resolved ? resolved.candidates || [] : [],
        reason: resolved ? resolved.reason || null : null,
      };
    });
  }

  function materialStatus(gltfJson, imageRows) {
    return (gltfJson.materials || []).map((material, index) => {
      const slots = [];
      const pbr = material.pbrMetallicRoughness || {};
      const slotDefs = [
        ['baseColorTexture', pbr.baseColorTexture],
        ['metallicRoughnessTexture', pbr.metallicRoughnessTexture],
        ['normalTexture', material.normalTexture],
        ['occlusionTexture', material.occlusionTexture],
        ['emissiveTexture', material.emissiveTexture],
      ];
      for (const [slot, ref] of slotDefs) {
        if (!ref || !Number.isInteger(ref.index)) continue;
        const texture = (gltfJson.textures || [])[ref.index] || {};
        const imageIndex = Number.isInteger(texture.source) ? texture.source : null;
        const image = imageIndex !== null ? imageRows[imageIndex] : null;
        slots.push({ slot, textureIndex: ref.index, texCoord: ref.texCoord || 0, imageIndex, imageUri: image ? image.uri : '', imageStatus: image ? image.status : 'missing-image-source' });
      }
      const baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
      const emissiveFactor = material.emissiveFactor || [0, 0, 0];
      return {
        index,
        name: material.name || `material_${index}`,
        alphaMode: material.alphaMode || 'OPAQUE',
        alphaCutoff: material.alphaCutoff ?? null,
        doubleSided: Boolean(material.doubleSided),
        baseColorFactor,
        emissiveFactor,
        hasEmissiveFactor: Array.isArray(emissiveFactor) && emissiveFactor.some(value => value > 0),
        hasTransparencySignal: (material.alphaMode && material.alphaMode !== 'OPAQUE') || (Array.isArray(baseColorFactor) && baseColorFactor.length > 3 && baseColorFactor[3] < 1),
        slots,
      };
    });
  }

  function collectRuntimeMeshes(root) {
    const rows = [];
    if (!root || typeof root.traverse !== 'function') return rows;
    root.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry || {};
      const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
      const runtimeSlots = materials.flatMap(material => TEXTURE_SLOTS.filter(([runtimeSlot]) => material && material[runtimeSlot]).map(([runtimeSlot, gltfSlot]) => ({ runtimeSlot, gltfSlot, textureName: textureName(material[runtimeSlot]) })));
      rows.push({
        name: object.name || '(mesh)',
        visible: object.visible !== false,
        vertexCount: geometry.attributes && geometry.attributes.position ? geometry.attributes.position.count : 0,
        triangleCount: geometry.index ? Math.floor(geometry.index.count / 3) : (geometry.attributes && geometry.attributes.position ? Math.floor(geometry.attributes.position.count / 3) : 0),
        hasUv0: Boolean(geometry.attributes && geometry.attributes.uv),
        hasUv1: Boolean(geometry.attributes && geometry.attributes.uv2),
        materialNames: materials.map(material => material.name || material.type || '(material)'),
        materialTypes: materials.map(material => material.type || '(material)'),
        textureSlots: runtimeSlots,
        warningCodes: [
          runtimeSlots.length && !(geometry.attributes && geometry.attributes.uv) ? 'mesh.texturedWithoutUv0' : '',
          object.visible === false ? 'mesh.hidden' : '',
          !(geometry.attributes && geometry.attributes.position) ? 'mesh.noPositions' : '',
        ].filter(Boolean),
      });
    });
    return rows;
  }

  function buildDiagnostics(images, materials, meshes) {
    const diagnostics = [];
    for (const image of images) {
      if (['missing', 'ambiguous', 'missing-uri', 'missing-image-source'].includes(image.status)) {
        diagnostics.push({ severity: image.status === 'ambiguous' ? 'error' : 'warning', code: `texture.image.${image.status}`, message: `${image.name}: ${image.uri || '(no uri)'} is ${image.status}.` });
      }
      if (image.status === 'found' && !image.path) diagnostics.push({ severity: 'warning', code: 'texture.image.foundWithoutPath', message: `${image.name}: resolver marked image as found but no path was reported.` });
    }
    for (const material of materials) {
      if (!material.slots.length) diagnostics.push({ severity: 'info', code: 'material.untextured', message: `${material.name}: no glTF texture slots.` });
      if (material.hasTransparencySignal && !material.doubleSided) diagnostics.push({ severity: 'info', code: 'material.transparentSingleSided', message: `${material.name}: transparent/alpha material is single-sided; diagnostic double-sided may help.` });
    }
    for (const mesh of meshes) {
      for (const code of mesh.warningCodes || []) diagnostics.push({ severity: code === 'mesh.noPositions' ? 'error' : 'warning', code, message: `${mesh.name}: ${code}` });
    }
    return diagnostics;
  }

  function analyzeTextures({ gltfJson = {}, gltfScene = null, bundle = null, basePath = '' } = {}) {
    const images = imageStatus(gltfJson, bundle, basePath);
    const materials = materialStatus(gltfJson, images);
    const meshes = collectRuntimeMeshes(gltfScene);
    const missingImages = images.filter(image => image.status === 'missing' || image.status === 'ambiguous' || image.status === 'missing-uri' || image.status === 'missing-image-source');
    const texturedMaterials = materials.filter(material => material.slots.length > 0);
    const diagnostics = buildDiagnostics(images, materials, meshes);
    return {
      schemaVersion: 2,
      ok: diagnostics.filter(item => item.severity === 'error').length === 0 && missingImages.length === 0,
      summary: {
        imageCount: images.length,
        textureCount: (gltfJson.textures || []).length,
        materialCount: materials.length,
        runtimeMeshCount: meshes.length,
        texturedMaterialCount: texturedMaterials.length,
        missingOrAmbiguousImageCount: missingImages.length,
        diagnosticCount: diagnostics.length,
        warningCount: diagnostics.filter(item => item.severity === 'warning').length,
        errorCount: diagnostics.filter(item => item.severity === 'error').length,
      },
      images,
      materials,
      meshes,
      diagnostics,
      missingImages,
    };
  }

  function applyPixelMode(root, enabled) {
    if (!root || typeof root.traverse !== 'function' || !THREE) return;
    root.traverse(object => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
      for (const material of materials) {
        for (const [runtimeSlot] of TEXTURE_SLOTS) {
          const texture = material[runtimeSlot];
          if (!texture) continue;
          texture.magFilter = enabled ? THREE.NearestFilter : THREE.LinearFilter;
          texture.minFilter = enabled ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
          texture.generateMipmaps = !enabled;
          texture.needsUpdate = true;
        }
      }
    });
  }

  function forceDoubleSided(root, enabled) {
    if (!root || typeof root.traverse !== 'function' || !THREE) return;
    root.traverse(object => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
      for (const material of materials) {
        if (!material) continue;
        if (material.__vawOriginalSide === undefined) material.__vawOriginalSide = material.side;
        material.side = enabled ? THREE.DoubleSide : material.__vawOriginalSide;
        material.needsUpdate = true;
      }
    });
  }

  function makeCheckerMaterial() {
    if (!THREE) return null;
    const size = 8;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const on = ((x >> 1) + (y >> 1)) % 2 === 0;
        data[index] = on ? 255 : 30;
        data[index + 1] = on ? 50 : 220;
        data[index + 2] = on ? 220 : 50;
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: texture, name: 'VAW diagnostic checker override' });
  }

  return Object.freeze({ analyzeTextures, applyPixelMode, forceDoubleSided, makeCheckerMaterial, buildDiagnostics });
});
