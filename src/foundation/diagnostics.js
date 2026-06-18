(() => {
  'use strict';

  window.VAW.define('foundation.diagnostics', [], () => {
    const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2 });

    function cleanNumber(value) {
      return Object.is(value, -0) ? 0 : value;
    }

    const MAX_DETAIL_DEPTH = 64;
    const MAX_DETAIL_NODES = 10000;

    function canonicalValue(value, state = null, depth = 0) {
      const context = state || { seen: new WeakSet(), remaining: MAX_DETAIL_NODES };
      if (depth >= MAX_DETAIL_DEPTH) return '[MaxDepth]';
      if (context.remaining <= 0) return '[Truncated]';
      context.remaining -= 1;
      if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number') return Number.isFinite(value) ? cleanNumber(value) : String(value);
      if (typeof value !== 'object') return String(value);
      if (context.seen.has(value)) return '[Circular]';
      context.seen.add(value);
      if (Array.isArray(value)) {
        const result = [];
        for (const item of value) {
          if (context.remaining <= 0) { result.push('[Truncated]'); break; }
          result.push(canonicalValue(item, context, depth + 1));
        }
        return Object.freeze(result);
      }
      const result = {};
      for (const key of Object.keys(value).sort()) {
        if (context.remaining <= 0) { result['[Truncated]'] = true; break; }
        result[key] = canonicalValue(value[key], context, depth + 1);
      }
      return Object.freeze(result);
    }

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
        details: canonicalValue(details && typeof details === 'object' ? details : {})
      });
    }

    function stableStringify(value) { return JSON.stringify(canonicalValue(value)); }

    function compare(a, b) {
      return (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        || a.code.localeCompare(b.code)
        || stableStringify(a.entities).localeCompare(stableStringify(b.entities))
        || stableStringify(a.details).localeCompare(stableStringify(b.details));
    }

    function canonicalize(values) {
      const unique = new Map();
      for (const value of Array.isArray(values) ? values : []) {
        const diagnostic = value?.code ? create(value.code, value.severity, value.entities, value.details) : create(String(value || 'unknown-diagnostic'));
        const key = stableStringify(diagnostic);
        if (!unique.has(key)) unique.set(key, diagnostic);
      }
      return Object.freeze([...unique.values()].sort(compare));
    }

    function codes(values, severity = null) {
      return Object.freeze(canonicalize(values)
        .filter(value => severity == null || value.severity === severity)
        .map(value => value.code));
    }

    function ready(values) {
      return !canonicalize(values).some(value => value.severity === 'error');
    }

    return Object.freeze({ SEVERITY_ORDER, MAX_DETAIL_DEPTH, MAX_DETAIL_NODES, canonicalValue, stableStringify, create, compare, canonicalize, codes, ready });
  });
})();
