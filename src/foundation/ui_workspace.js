(() => {
  'use strict';

  window.VAW.define('foundation.ui-workspace', [], () => {
    const WORKSPACE_VERSION = 1;
    const PANEL_IDS = Object.freeze(['build', 'contracts', 'telemetry', 'controls']);
    const DEFAULT_PANELS = Object.freeze({
      build: Object.freeze({ open: true, minimized: false, x: 16, y: 64, width: 384, height: 690 }),
      contracts: Object.freeze({ open: false, minimized: false, x: 416, y: 64, width: 336, height: 620 }),
      telemetry: Object.freeze({ open: true, minimized: false, x: -352, y: 64, width: 336, height: 690 }),
      controls: Object.freeze({ open: false, minimized: false, x: -720, y: 64, width: 352, height: 620 })
    });

    function clampNumber(value, fallback, min, max) {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
    }

    function normalizePanel(raw, fallback) {
      return Object.freeze({
        open: typeof raw?.open === 'boolean' ? raw.open : fallback.open,
        minimized: typeof raw?.minimized === 'boolean' ? raw.minimized : fallback.minimized,
        x: clampNumber(raw?.x, fallback.x, -10000, 10000),
        y: clampNumber(raw?.y, fallback.y, 0, 10000),
        width: clampNumber(raw?.width, fallback.width, 260, 1000),
        height: clampNumber(raw?.height, fallback.height, 120, 1400)
      });
    }

    function normalize(raw) {
      const panels = {};
      for (const id of PANEL_IDS) panels[id] = normalizePanel(raw?.panels?.[id], DEFAULT_PANELS[id]);
      return Object.freeze({ version: WORKSPACE_VERSION, panels: Object.freeze(panels) });
    }

    function createDefault() { return normalize(null); }

    function updatePanel(workspace, id, patch) {
      if (!PANEL_IDS.includes(id)) return normalize(workspace);
      const normalized = normalize(workspace);
      return normalize({
        panels: {
          ...normalized.panels,
          [id]: { ...normalized.panels[id], ...(patch || {}) }
        }
      });
    }

    return Object.freeze({ WORKSPACE_VERSION, PANEL_IDS, DEFAULT_PANELS, createDefault, normalize, updatePanel });
  });
})();
