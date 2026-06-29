(function (global) {
  'use strict';

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function safeSegment(name, index) {
    const raw = String(name || `node_${index}`).trim() || `node_${index}`;
    return raw.replace(/\//g, '_');
  }

  function collectNodePathRecords(gltfJson = {}) {
    const nodes = Array.isArray(gltfJson.nodes) ? gltfJson.nodes : [];
    const childSet = new Set();
    for (const node of nodes) for (const child of node.children || []) childSet.add(child);
    const roots = nodes.map((_, index) => index).filter(index => !childSet.has(index));
    const startIndexes = roots.length ? roots : nodes.map((_, index) => index);
    const records = [];
    const visited = new Set();

    function walk(index, parentPath, depth = 0) {
      if (!nodes[index]) return;
      const segment = safeSegment(nodes[index].name, index);
      const path = `${parentPath}/${segment}`;
      records.push({ index, name: nodes[index].name || `node_${index}`, path, normalizedPath: path.toLowerCase(), depth });
      if (visited.has(index)) return;
      visited.add(index);
      for (const child of nodes[index].children || []) walk(child, path, depth + 1);
    }

    for (const index of startIndexes) walk(index, '');
    return records;
  }

  function materialName(gltfJson, materialIndex) {
    const material = (gltfJson.materials || [])[materialIndex] || {};
    return String(material.name || `material_${materialIndex}`);
  }

  function alphaMode(gltfJson, materialIndex) {
    return String(((gltfJson.materials || [])[materialIndex] || {}).alphaMode || 'OPAQUE').toUpperCase();
  }

  function isFireLike(text) {
    return /fire|flame|glow/i.test(String(text || ''));
  }

  function descendantNodeIndexes(gltfJson, rootIndexes) {
    const nodes = Array.isArray(gltfJson.nodes) ? gltfJson.nodes : [];
    const out = new Set();
    function walk(index) {
      if (!nodes[index] || out.has(index)) return;
      out.add(index);
      for (const child of nodes[index].children || []) walk(child);
    }
    for (const index of rootIndexes) walk(index);
    return out;
  }

  function resolveNodeSelectors(gltfJson, selectors = []) {
    const records = collectNodePathRecords(gltfJson);
    const byPath = new Map();
    const byName = new Map();
    for (const record of records) {
      byPath.set(record.normalizedPath, record);
      byPath.set(record.normalizedPath.replace(/^\//, ''), record);
      const nameKey = String(record.name || '').toLowerCase();
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(record);
    }
    const matched = [];
    const missing = [];
    for (const selector of selectors || []) {
      const raw = String(selector || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const pathMatch = byPath.get(key);
      if (pathMatch) {
        matched.push(pathMatch);
        continue;
      }
      const nameMatches = byName.get(key) || [];
      if (nameMatches.length === 1) matched.push(nameMatches[0]);
      else missing.push(raw);
    }
    return { matched, missing, records };
  }

  function suggestFireNodePaths(gltfJson = {}) {
    return collectNodePathRecords(gltfJson)
      .filter(record => isFireLike(record.name) || isFireLike(record.path))
      .map(record => record.path);
  }

  function materialUsage(gltfJson = {}) {
    const nodes = Array.isArray(gltfJson.nodes) ? gltfJson.nodes : [];
    const meshes = Array.isArray(gltfJson.meshes) ? gltfJson.meshes : [];
    const records = collectNodePathRecords(gltfJson);
    const recordByIndex = new Map(records.map(record => [record.index, record]));
    const usage = new Map();

    nodes.forEach((node, nodeIndex) => {
      if (!Number.isInteger(node.mesh) || !meshes[node.mesh]) return;
      const mesh = meshes[node.mesh];
      for (const primitive of mesh.primitives || []) {
        const materialIndex = Number.isInteger(primitive.material) ? primitive.material : -1;
        if (!usage.has(materialIndex)) {
          usage.set(materialIndex, {
            materialIndex,
            materialName: materialIndex >= 0 ? materialName(gltfJson, materialIndex) : '(default material)',
            alphaMode: materialIndex >= 0 ? alphaMode(gltfJson, materialIndex) : 'OPAQUE',
            nodeIndexes: new Set(),
            nodePaths: new Set(),
            fireLikeCount: 0,
            otherCount: 0,
            primitiveCount: 0,
          });
        }
        const row = usage.get(materialIndex);
        const record = recordByIndex.get(nodeIndex);
        const label = record?.path || node.name || `node_${nodeIndex}`;
        row.nodeIndexes.add(nodeIndex);
        row.nodePaths.add(label);
        row.primitiveCount += 1;
        if (isFireLike(label)) row.fireLikeCount += 1;
        else row.otherCount += 1;
      }
    });

    return [...usage.values()].map(row => ({
      ...row,
      nodeIndexes: [...row.nodeIndexes],
      nodePaths: [...row.nodePaths],
      sharedFireAndBody: row.fireLikeCount > 0 && row.otherCount > 0,
    }));
  }

  function sharedAlphaMaterialWarnings(gltfJson = {}) {
    return materialUsage(gltfJson)
      .filter(row => row.sharedFireAndBody && ['MASK', 'BLEND'].includes(row.alphaMode))
      .map(row => ({
        code: 'material.sharedFireAndBody',
        materialName: row.materialName,
        alphaMode: row.alphaMode,
        message: `${row.materialName} uses ${row.alphaMode} and is shared by fire/glow nodes plus opaque body/nozzle nodes.`,
      }));
  }

  function uniqueMaterialName(gltfJson, baseName) {
    const used = new Set((gltfJson.materials || []).map(material => String(material.name || '').toLowerCase()).filter(Boolean));
    let name = baseName;
    let suffix = 2;
    while (used.has(name.toLowerCase())) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    return name;
  }

  function normalizeMaterialNames(gltfJson = {}) {
    const next = cloneJson(gltfJson);
    next.materials = Array.isArray(next.materials) ? next.materials : [];
    let changed = false;
    next.materials.forEach((material, index) => {
      if (String(material.name || '').trim()) return;
      material.name = `material_${index}`;
      changed = true;
    });
    return { gltfJson: next, changed };
  }

  function splitNodeMaterialsForBlend(gltfJson = {}, selectors = [], options = {}) {
    const normalized = normalizeMaterialNames(gltfJson);
    const next = normalized.gltfJson;
    next.materials = Array.isArray(next.materials) ? next.materials : [];
    const nodes = Array.isArray(next.nodes) ? next.nodes : [];
    const meshes = Array.isArray(next.meshes) ? next.meshes : [];
    const resolved = resolveNodeSelectors(next, selectors);
    const selectedIndexes = descendantNodeIndexes(next, resolved.matched.map(record => record.index));
    const duplicatedByOriginal = new Map();
    const newMaterialNames = [];
    const sourceMaterialNames = [];
    let patchedPrimitiveCount = 0;

    function duplicateMaterial(originalIndex) {
      if (duplicatedByOriginal.has(originalIndex)) return duplicatedByOriginal.get(originalIndex);
      const sourceMaterial = originalIndex >= 0 ? cloneJson(next.materials[originalIndex] || {}) : {};
      const sourceName = originalIndex >= 0 ? materialName(next, originalIndex) : 'default_material';
      const nextName = uniqueMaterialName(next, `${sourceName}__fire_blend`);
      const cloned = {
        ...sourceMaterial,
        name: nextName,
        alphaMode: 'BLEND',
        doubleSided: options.doubleSided !== false ? true : sourceMaterial.doubleSided,
      };
      delete cloned.alphaCutoff;
      const nextIndex = next.materials.push(cloned) - 1;
      duplicatedByOriginal.set(originalIndex, nextIndex);
      newMaterialNames.push(nextName);
      sourceMaterialNames.push(sourceName);
      return nextIndex;
    }

    for (const nodeIndex of selectedIndexes) {
      const node = nodes[nodeIndex];
      if (!node || !Number.isInteger(node.mesh) || !meshes[node.mesh]) continue;
      for (const primitive of meshes[node.mesh].primitives || []) {
        const originalIndex = Number.isInteger(primitive.material) ? primitive.material : -1;
        primitive.material = duplicateMaterial(originalIndex);
        patchedPrimitiveCount += 1;
      }
    }

    return {
      gltfJson: next,
      changed: normalized.changed || patchedPrimitiveCount > 0,
      normalizedMaterialNames: normalized.changed,
      patchedPrimitiveCount,
      patchedNodePaths: resolved.matched.map(record => record.path),
      missingSelectors: resolved.missing,
      newMaterialNames,
      sourceMaterialNames: [...new Set(sourceMaterialNames)],
    };
  }

  const api = {
    collectNodePathRecords,
    materialUsage,
    normalizeMaterialNames,
    sharedAlphaMaterialWarnings,
    suggestFireNodePaths,
    splitNodeMaterialsForBlend,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_GLTF_MATERIAL_TOOLS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
