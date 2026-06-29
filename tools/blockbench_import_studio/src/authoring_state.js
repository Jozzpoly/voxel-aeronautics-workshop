(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VAW_STUDIO_AUTHORING_STATE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const NODE_ALIASES = Object.freeze(['visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot']);
  const OPTIONAL_NODE_ALIASES = Object.freeze(['flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot']);

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function nodeValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function emptyNodeFields({ keepVisualRoot = '' } = {}) {
    return {
      visualRoot: nodeValue(keepVisualRoot),
      flame: null,
      flameGlow: null,
      gimbalAssembly: null,
      controlFlapPivot: null,
    };
  }

  function normalizeNodeFields(nodes = {}) {
    const source = nodes && typeof nodes === 'object' ? nodes : {};
    const normalized = {};
    for (const alias of NODE_ALIASES) normalized[alias] = nodeValue(source[alias]);
    return normalized;
  }

  function clearOptionalNodeFields(nodes = {}) {
    const normalized = normalizeNodeFields(nodes);
    for (const alias of OPTIONAL_NODE_ALIASES) normalized[alias] = null;
    return normalized;
  }

  function applyNodeFields(asset, nodes = {}, { preserveEmpty = false } = {}) {
    if (!asset || typeof asset !== 'object') return asset;
    const normalized = normalizeNodeFields(nodes);
    asset.bindings = asset.bindings || {};
    asset.bindings.nodes = asset.bindings.nodes || {};

    if (normalized.visualRoot || !preserveEmpty || Object.prototype.hasOwnProperty.call(nodes, 'visualRoot')) {
      asset.bindings.nodes.visualRoot = normalized.visualRoot;
    }
    for (const alias of OPTIONAL_NODE_ALIASES) {
      asset.bindings.nodes[alias] = normalized[alias];
    }
    return asset;
  }

  function stripRigStateForDefault(snapshot = {}) {
    const next = cloneJson(snapshot) || {};
    next.nodes = emptyNodeFields();
    next.fireSplit = { enabled: false, nodes: [] };
    return next;
  }

  function preferenceSnapshotForBlock(prefs = {}, blockType = '', { includeDefaults = false } = {}) {
    const normalizedBlockType = String(blockType || '').trim();
    const byBlock = prefs && typeof prefs.byBlock === 'object' ? prefs.byBlock : {};
    if (normalizedBlockType && byBlock[normalizedBlockType]) {
      return cloneJson(byBlock[normalizedBlockType]);
    }
    if (includeDefaults && prefs && typeof prefs.defaults === 'object') {
      return stripRigStateForDefault(prefs.defaults);
    }
    return null;
  }

  return Object.freeze({
    NODE_ALIASES,
    OPTIONAL_NODE_ALIASES,
    applyNodeFields,
    clearOptionalNodeFields,
    emptyNodeFields,
    normalizeNodeFields,
    preferenceSnapshotForBlock,
    stripRigStateForDefault,
  });
});
