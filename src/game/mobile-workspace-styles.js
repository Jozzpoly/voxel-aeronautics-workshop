'use strict';

(function registerMobileWorkspaceStyles(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-workspace-styles.js.');
  root.VAW.define('game.mobile-workspace-styles', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileWorkspaceStylesModule() {
  const READY_PROPERTY = '--vaw-mobile-workspace-css-ready';
  const LINK_ID = 'vaw-mobile-workspace-styles';
  const DEFAULT_HREF = 'styles.mobile.css';

  function normalizeHref(value) {
    const href = String(value || '').trim();
    return href || DEFAULT_HREF;
  }

  function isReady(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    if (!windowLike?.getComputedStyle || !documentLike?.documentElement) return false;
    try {
      return windowLike.getComputedStyle(documentLike.documentElement)
        .getPropertyValue(READY_PROPERTY)
        .trim() === '1';
    } catch (_) {
      return false;
    }
  }

  function ensure(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    if (isReady({ window: windowLike, document: documentLike })) {
      return Object.freeze({ status: 'embedded', element: null });
    }
    if (!documentLike?.getElementById || !documentLike?.createElement || !documentLike?.head?.appendChild) {
      return Object.freeze({ status: 'unavailable', element: null });
    }

    const existing = documentLike.getElementById(LINK_ID);
    if (existing) return Object.freeze({ status: 'existing-link', element: existing });

    try {
      const link = documentLike.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      link.href = normalizeHref(options.href);
      if (link.dataset) link.dataset.vawMobileWorkspaceStyles = 'true';
      documentLike.head.appendChild(link);
      return Object.freeze({ status: 'linked', element: link });
    } catch (error) {
      try { options.onError?.(error); } catch (_) {}
      return Object.freeze({ status: 'failed', element: null });
    }
  }

  return Object.freeze({
    READY_PROPERTY,
    LINK_ID,
    DEFAULT_HREF,
    normalizeHref,
    isReady,
    ensure
  });
});
