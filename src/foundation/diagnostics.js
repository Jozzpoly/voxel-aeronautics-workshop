(() => {
  'use strict';

  window.VAW.define('foundation.diagnostics', [], () => {
    const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2 });

    function canonicalEntity(entity) {
      if (!entity || typeof entity !== 'object') return null;
      const kind = typeof entity.kind === 'string' ? entity.kind.trim() : '';
      const id = typeof entity.id === 'string' ? entity.id.trim() : '';
      if (!kind || !id) return null;
      return Object.freeze({ kind, id });
    }

    function create(code, severity = 'error', entities = [], details = {}) {
      const normalizedCode = typeof code === 'string' ? code.trim() : '';
      if (!normalizedCode) throw new TypeError('Diagnostic code must be a non-empty string.');
      if (!(severity in SEVERITY_ORDER)) throw new TypeError(`Unsupported diagnostic severity: ${String(severity)}`);
      const normalizedEntities = (Array.isArray(entities) ? entities : [])
        .map(canonicalEntity)
        .filter(Boolean)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
      return Object.freeze({
        code: normalizedCode,
        severity,
        entities: Object.freeze(normalizedEntities),
        details: Object.freeze({ ...(details && typeof details === 'object' ? details : {}) })
      });
    }

    function compare(a, b) {
      return (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        || a.code.localeCompare(b.code)
        || JSON.stringify(a.entities).localeCompare(JSON.stringify(b.entities))
        || JSON.stringify(a.details).localeCompare(JSON.stringify(b.details));
    }

    function canonicalize(values) {
      const unique = new Map();
      for (const value of Array.isArray(values) ? values : []) {
        const diagnostic = value?.code ? value : create(String(value || 'unknown-diagnostic'));
        const key = JSON.stringify(diagnostic);
        if (!unique.has(key)) unique.set(key, diagnostic);
      }
      return Object.freeze([...unique.values()].sort(compare));
    }

    function codes(values, severity = null) {
      return Object.freeze([...new Set(canonicalize(values)
        .filter(item => severity == null || item.severity === severity)
        .map(item => item.code))]);
    }

    function ready(values) {
      return !canonicalize(values).some(item => item.severity === 'error');
    }

    return Object.freeze({ SEVERITY_ORDER, create, canonicalize, codes, ready });
  });
})();
