(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_FILE_BUNDLE_RESOLVER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ktx2', 'basis']);
  const MODEL_EXTENSIONS = new Set(['gltf', 'glb']);

  function safeDecode(value) {
    try { return decodeURIComponent(String(value || '')); }
    catch { return String(value || ''); }
  }

  function stripQueryHash(value) {
    return String(value || '').split('#')[0].split('?')[0];
  }

  function normalizePath(value) {
    const raw = safeDecode(stripQueryHash(value)).replace(/\\/g, '/').trim();
    const parts = [];
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return parts.join('/');
  }

  function basename(value) {
    const path = normalizePath(value);
    return path.split('/').pop() || '';
  }

  function dirname(value) {
    const path = normalizePath(value);
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }

  function extension(value) {
    const name = basename(value);
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
  }

  function joinPath(base, relative) {
    const b = normalizePath(base);
    const r = safeDecode(String(relative || '')).replace(/\\/g, '/');
    return normalizePath(b ? `${b}/${r}` : r);
  }

  function isDataUri(uri) { return /^data:/i.test(String(uri || '')); }
  function isAbsoluteUri(uri) { return /^[a-z][a-z0-9+.-]*:/i.test(String(uri || '')) && !isDataUri(uri); }

  function summarizeUri(uri, { limit = 96 } = {}) {
    const raw = String(uri || '');
    if (!raw) return '';
    if (isDataUri(raw)) {
      const comma = raw.indexOf(',');
      const header = comma >= 0 ? raw.slice(0, comma) : raw.slice(0, Math.min(raw.length, limit));
      return `${header},… (${raw.length} chars)`;
    }
    if (raw.length > limit) return `${raw.slice(0, limit)}… (${raw.length} chars)`;
    return raw;
  }

  async function fileText(file) { return await file.text(); }
  async function fileArrayBuffer(file) { return await file.arrayBuffer(); }

  async function readEntryRecursive(entry, prefix = '') {
    if (!entry) return [];
    if (entry.isFile) {
      return await new Promise((resolve, reject) => {
        entry.file(file => {
          Object.defineProperty(file, '__vawRelativePath', { value: normalizePath(`${prefix}${entry.name}`), configurable: true });
          resolve([file]);
        }, reject);
      });
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const output = [];
      let batch = [];
      do {
        batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of batch) output.push(...await readEntryRecursive(child, `${prefix}${entry.name}/`));
      } while (batch.length > 0);
      return output;
    }
    return [];
  }

  async function filesFromDataTransfer(dataTransfer) {
    const items = dataTransfer && dataTransfer.items ? [...dataTransfer.items] : [];
    if (items.length && items.some(item => item.webkitGetAsEntry)) {
      const files = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        files.push(...await readEntryRecursive(entry));
      }
      if (files.length) return files;
    }
    return [...(dataTransfer && dataTransfer.files || [])];
  }

  function makeFileRecord(file) {
    const sourcePath = file.__vawRelativePath || file.webkitRelativePath || file.relativePath || file.name;
    const normalizedPath = normalizePath(sourcePath || file.name);
    return Object.freeze({
      file,
      name: file.name,
      path: sourcePath || file.name,
      normalizedPath,
      basename: basename(normalizedPath),
      dirname: dirname(normalizedPath),
      extension: extension(normalizedPath),
      size: Number(file.size) || 0,
      type: file.type || '',
    });
  }

  function createBundle(filesLike) {
    const records = [...filesLike].filter(Boolean).map(makeFileRecord);
    const byPath = new Map();
    const byLowerPath = new Map();
    const byBasename = new Map();
    const objectUrls = new Map();
    const diagnostics = [];

    for (const record of records) {
      if (byPath.has(record.normalizedPath)) diagnostics.push({ severity: 'warning', code: 'duplicatePath', path: record.normalizedPath });
      byPath.set(record.normalizedPath, record);
      byLowerPath.set(record.normalizedPath.toLowerCase(), record);
      const baseKey = record.basename.toLowerCase();
      if (!byBasename.has(baseKey)) byBasename.set(baseKey, []);
      byBasename.get(baseKey).push(record);
    }

    const gltfFiles = records.filter(record => record.extension === 'gltf');
    const glbFiles = records.filter(record => record.extension === 'glb');
    const sidecarFiles = records.filter(record => /\.vaw\.json$/i.test(record.basename) || /(^|\/)(VAW_VISUAL_ASSET_PACK_V1|visual_asset_pack_v1|visual_asset_manifest)(\.manifest)?\.json$/i.test(record.normalizedPath));
    const mainModel = gltfFiles[0] || glbFiles[0] || null;

    function objectURLFor(record) {
      if (!record) return null;
      if (!objectUrls.has(record.normalizedPath)) objectUrls.set(record.normalizedPath, URL.createObjectURL(record.file));
      return objectUrls.get(record.normalizedPath);
    }

    function revokeObjectURLs() {
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
    }

    function candidateUris(uri, basePath = '') {
      const raw = stripQueryHash(String(uri || ''));
      const decoded = safeDecode(raw).replace(/\\/g, '/');
      const normalizedBase = normalizePath(basePath);
      const candidates = [];
      for (const value of [raw, decoded, normalizePath(raw), normalizePath(decoded)]) {
        if (!value) continue;
        if (normalizedBase) candidates.push(joinPath(normalizedBase, value));
        candidates.push(normalizePath(value));
      }

      // GLTFLoader may send blob:http://host/<object-url>/<relative-uri>. The original
      // path is usually recoverable as a suffix or at least by basename.
      const blobClean = decoded
        .replace(/^blob:null\//i, '')
        .replace(/^blob:https?:\/\/[^/]+\//i, '')
        .replace(/^blob:[^/]+\//i, '');
      if (blobClean !== decoded) {
        candidates.push(normalizePath(blobClean));
        if (normalizedBase) candidates.push(joinPath(normalizedBase, blobClean));
      }

      return [...new Set(candidates.filter(Boolean))];
    }

    function resolveRecord(uri, basePath = '') {
      const raw = String(uri || '');
      if (!raw) return { status: 'missing', uri: raw, basePath, record: null, candidates: [], reason: 'empty-uri' };
      if (isDataUri(raw)) return { status: 'embedded', uri: raw, basePath, record: null, candidates: [], reason: 'data-uri' };
      if (isAbsoluteUri(raw) && !/^blob:/i.test(raw)) return { status: 'external', uri: raw, basePath, record: null, candidates: [], reason: 'absolute-uri' };

      const pathCandidates = candidateUris(raw, basePath);
      for (const candidate of pathCandidates) {
        if (byPath.has(candidate)) return { status: 'found', uri: raw, basePath, record: byPath.get(candidate), resolvedPath: candidate, strategy: 'exact-relative', candidates: [candidate] };
        const lower = candidate.toLowerCase();
        if (byLowerPath.has(lower)) {
          const record = byLowerPath.get(lower);
          return { status: 'found', uri: raw, basePath, record, resolvedPath: record.normalizedPath, strategy: 'case-insensitive-path', candidates: [candidate] };
        }
      }

      const suffixMatches = [];
      for (const candidate of pathCandidates) {
        const normalizedCandidate = normalizePath(candidate).toLowerCase();
        if (!normalizedCandidate) continue;
        for (const record of records) {
          if (record.normalizedPath.toLowerCase().endsWith(normalizedCandidate)) suffixMatches.push(record);
        }
      }
      const uniqueSuffixMatches = [...new Map(suffixMatches.map(item => [item.normalizedPath, item])).values()];
      if (uniqueSuffixMatches.length === 1) {
        const record = uniqueSuffixMatches[0];
        return { status: 'found', uri: raw, basePath, record, resolvedPath: record.normalizedPath, strategy: 'suffix-fallback', candidates: [record.normalizedPath], warning: true };
      }
      if (uniqueSuffixMatches.length > 1) {
        return { status: 'ambiguous', uri: raw, basePath, record: null, candidates: uniqueSuffixMatches.map(item => item.normalizedPath), reason: 'suffix-ambiguous' };
      }

      const base = basename(raw).toLowerCase();
      const basenameCandidates = byBasename.get(base) || [];
      if (basenameCandidates.length === 1) {
        const record = basenameCandidates[0];
        return { status: 'found', uri: raw, basePath, record, resolvedPath: record.normalizedPath, strategy: 'unique-basename-fallback', candidates: [record.normalizedPath], warning: true };
      }
      if (basenameCandidates.length > 1) {
        return { status: 'ambiguous', uri: raw, basePath, record: null, candidates: basenameCandidates.map(item => item.normalizedPath), reason: 'duplicate-basename' };
      }
      return { status: 'missing', uri: raw, basePath, record: null, candidates: pathCandidates, reason: 'not-found' };
    }

    function resolveObjectURL(uri, basePath = '') {
      const resolved = resolveRecord(uri, basePath);
      return resolved.record ? objectURLFor(resolved.record) : null;
    }

    function dependencyReport(gltfJson, basePath = '') {
      const items = [];
      const add = (kind, uri, index, extra = {}) => {
        const resolved = resolveRecord(uri, basePath);
        items.push({
          kind,
          uri: uri || '',
          displayUri: summarizeUri(uri),
          index,
          status: resolved.status,
          path: resolved.record ? resolved.record.normalizedPath : null,
          resolvedPath: resolved.resolvedPath || null,
          size: resolved.record ? resolved.record.size : 0,
          strategy: resolved.strategy || null,
          warning: Boolean(resolved.warning),
          reason: resolved.reason || null,
          candidates: resolved.candidates || [],
          ...extra,
        });
      };
      const addEmbedded = (kind, index, reason, extra = {}) => {
        const label = kind === 'image'
          ? `(embedded image bufferView #${extra.bufferView ?? index}${extra.mimeType ? ` · ${extra.mimeType}` : ''})`
          : `(embedded ${kind} #${index})`;
        items.push({
          kind,
          uri: '',
          displayUri: label,
          index,
          status: 'embedded',
          path: null,
          resolvedPath: null,
          size: 0,
          strategy: null,
          warning: false,
          reason,
          candidates: [],
          ...extra,
        });
      };

      (gltfJson.buffers || []).forEach((buffer, index) => {
        if (buffer.uri) add('buffer', buffer.uri, index, { byteLength: buffer.byteLength || 0 });
        else addEmbedded('buffer', index, 'glb-or-bufferView-embedded', { byteLength: buffer.byteLength || 0 });
      });
      (gltfJson.images || []).forEach((image, index) => {
        if (image.uri) add('image', image.uri, index, { mimeType: image.mimeType || '', bufferView: Number.isInteger(image.bufferView) ? image.bufferView : null });
        else if (Number.isInteger(image.bufferView)) addEmbedded('image', index, 'image-bufferView', { mimeType: image.mimeType || '', bufferView: image.bufferView });
        else add('image', image.uri, index, { mimeType: image.mimeType || '', bufferView: null });
      });
      return items;
    }

    return Object.freeze({
      records: Object.freeze(records), diagnostics: Object.freeze(diagnostics),
      mainModel, gltfFiles: Object.freeze(gltfFiles), glbFiles: Object.freeze(glbFiles), sidecarFiles: Object.freeze(sidecarFiles),
      imageFiles: Object.freeze(records.filter(record => IMAGE_EXTENSIONS.has(record.extension))),
      modelFiles: Object.freeze(records.filter(record => MODEL_EXTENSIONS.has(record.extension))),
      resolveRecord, resolveObjectURL, objectURLFor, revokeObjectURLs, dependencyReport,
      fileText, fileArrayBuffer,
    });
  }

  return Object.freeze({ normalizePath, basename, dirname, extension, joinPath, isDataUri, summarizeUri, createBundle, filesFromDataTransfer, fileText, fileArrayBuffer });
});
