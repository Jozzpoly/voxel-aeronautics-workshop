(() => {
  'use strict';

  window.VAW.define('foundation.ui-workspace', [], () => {
    const WORKSPACE_VERSION = 3;
    const PANEL_IDS = Object.freeze(['build', 'contracts', 'telemetry', 'controls']);
    const DEFAULT_Z_ORDER = Object.freeze(['build', 'contracts', 'controls', 'telemetry']);
    const DEFAULT_PANELS = Object.freeze({
      build: Object.freeze({ open: true, minimized: false, x: 16, y: 68, width: 384, height: 690 }),
      contracts: Object.freeze({ open: false, minimized: false, x: 416, y: 68, width: 336, height: 620 }),
      telemetry: Object.freeze({ open: true, minimized: false, x: -352, y: 68, width: 336, height: 690 }),
      controls: Object.freeze({ open: false, minimized: false, x: -720, y: 68, width: 352, height: 620 })
    });

    function clampNumber(value, fallback, min, max) {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
    }

    function normalizePanel(raw, fallback, preserveGeometry = true) {
      const source = raw && typeof raw === 'object' ? raw : {};
      return Object.freeze({
        open: typeof source.open === 'boolean' ? source.open : fallback.open,
        minimized: typeof source.minimized === 'boolean' ? source.minimized : fallback.minimized,
        x: preserveGeometry ? clampNumber(source.x, fallback.x, -10000, 10000) : fallback.x,
        y: preserveGeometry ? clampNumber(source.y, fallback.y, 0, 10000) : fallback.y,
        width: preserveGeometry ? clampNumber(source.width, fallback.width, 260, 1000) : fallback.width,
        height: preserveGeometry ? clampNumber(source.height, fallback.height, 160, 1400) : fallback.height
      });
    }

    function normalizeZOrder(raw) {
      const source = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const order = [];
      for (const id of source) {
        if (!PANEL_IDS.includes(id) || seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
      for (const id of DEFAULT_Z_ORDER) {
        if (seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
      return Object.freeze(order);
    }

    function normalize(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const sourceVersion = Number(source.version) || 0;
      const preserveGeometry = sourceVersion >= 2 && sourceVersion <= WORKSPACE_VERSION;
      const panels = {};
      for (const id of PANEL_IDS) {
        panels[id] = normalizePanel(source.panels?.[id], DEFAULT_PANELS[id], preserveGeometry);
      }
      return Object.freeze({
        version: WORKSPACE_VERSION,
        panels: Object.freeze(panels),
        zOrder: normalizeZOrder(source.zOrder)
      });
    }

    function createDefault() { return normalize({ version: WORKSPACE_VERSION, zOrder: DEFAULT_Z_ORDER }); }

    function updatePanel(workspace, id, patch) {
      if (!PANEL_IDS.includes(id)) return normalize(workspace);
      const normalized = normalize(workspace);
      return normalize({
        version: WORKSPACE_VERSION,
        panels: {
          ...normalized.panels,
          [id]: { ...normalized.panels[id], ...(patch || {}) }
        },
        zOrder: normalized.zOrder
      });
    }

    function focusPanel(workspace, id) {
      const normalized = normalize(workspace);
      if (!PANEL_IDS.includes(id)) return normalized;
      return normalize({
        version: WORKSPACE_VERSION,
        panels: normalized.panels,
        zOrder: [...normalized.zOrder.filter(panelId => panelId !== id), id]
      });
    }

    function topPanel(workspace, predicate = () => true) {
      const normalized = normalize(workspace);
      for (let index = normalized.zOrder.length - 1; index >= 0; index -= 1) {
        const id = normalized.zOrder[index];
        const panel = normalized.panels[id];
        if (panel.open && predicate(id, panel)) return id;
      }
      return null;
    }

    function fitPanelRect(panelValue, viewportValue = {}, options = {}) {
      const panelId = PANEL_IDS.includes(options.panelId) ? options.panelId : 'build';
      const panel = normalizePanel(panelValue, DEFAULT_PANELS[panelId], true);
      const viewportWidth = Math.max(320, clampNumber(viewportValue.width, 1280, 1, 100000));
      const viewportHeight = Math.max(320, clampNumber(viewportValue.height, 720, 1, 100000));
      const gap = clampNumber(options.gap, 8, 0, 64);
      const topInset = clampNumber(options.topInset, 60, 0, viewportHeight - gap);
      const minimizedHeight = clampNumber(options.minimizedHeight, 48, 24, 160);
      const width = Math.min(panel.width, Math.max(260, viewportWidth - gap * 2));
      const height = Math.min(panel.height, Math.max(160, viewportHeight - topInset - gap));
      const requestedLeft = panel.x < 0 ? viewportWidth - width + panel.x : panel.x;
      const visibleHeight = panel.minimized ? minimizedHeight : height;
      const maxLeft = Math.max(gap, viewportWidth - width - gap);
      const maxTop = Math.max(topInset, viewportHeight - visibleHeight - gap);
      return Object.freeze({
        left: clampNumber(requestedLeft, gap, gap, maxLeft),
        top: clampNumber(panel.y, topInset, topInset, maxTop),
        width,
        height
      });
    }

    return Object.freeze({
      WORKSPACE_VERSION,
      PANEL_IDS,
      DEFAULT_Z_ORDER,
      DEFAULT_PANELS,
      createDefault,
      normalize,
      updatePanel,
      focusPanel,
      topPanel,
      fitPanelRect
    });
  });
})();
