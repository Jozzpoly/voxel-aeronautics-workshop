(() => {
  'use strict';

  window.VAW.define('foundation.ui-workspace', [], () => {
    const WORKSPACE_VERSION = 4;
    const PANEL_IDS = Object.freeze(['build', 'parts', 'contracts', 'telemetry', 'controls', 'mission']);
    const LAYOUT_IDS = Object.freeze(['build', 'flight']);
    const PLACEMENTS = Object.freeze(['floating', 'dock-left', 'dock-right', 'dock-bottom']);
    const DOCK_SPANS = Object.freeze(['compact', 'full']);
    const DEFAULT_Z_ORDER = Object.freeze(['build', 'contracts', 'controls', 'mission', 'telemetry', 'parts']);
    const FLIGHT_Z_ORDER = Object.freeze(['controls', 'contracts', 'build', 'parts', 'telemetry', 'mission']);
    const DEFAULT_BUILD_PANELS = Object.freeze({
      build: Object.freeze({ open: true, minimized: false, placement: 'dock-left', x: 16, y: 8, width: 384, height: 690 }),
      parts: Object.freeze({ open: true, minimized: false, placement: 'dock-bottom', dockSpan: 'full', x: 260, y: 580, width: 760, height: 104 }),
      contracts: Object.freeze({ open: false, minimized: false, placement: 'floating', x: 416, y: 68, width: 336, height: 620 }),
      telemetry: Object.freeze({ open: true, minimized: false, placement: 'dock-right', x: -352, y: 8, width: 336, height: 690 }),
      controls: Object.freeze({ open: false, minimized: false, placement: 'floating', x: -720, y: 68, width: 352, height: 620 }),
      mission: Object.freeze({ open: false, minimized: false, placement: 'dock-right', x: -352, y: 8, width: 336, height: 220 })
    });
    const DEFAULT_FLIGHT_PANELS = Object.freeze({
      build: Object.freeze({ open: false, minimized: false, placement: 'dock-left', x: 16, y: 8, width: 360, height: 640 }),
      parts: Object.freeze({ open: false, minimized: false, placement: 'dock-bottom', dockSpan: 'full', x: 260, y: 580, width: 760, height: 104 }),
      contracts: Object.freeze({ open: false, minimized: false, placement: 'floating', x: 416, y: 68, width: 336, height: 620 }),
      telemetry: Object.freeze({ open: true, minimized: false, placement: 'dock-right', x: -352, y: 244, width: 336, height: 320 }),
      controls: Object.freeze({ open: false, minimized: false, placement: 'floating', x: -720, y: 68, width: 352, height: 620 }),
      mission: Object.freeze({ open: true, minimized: false, placement: 'dock-right', x: -352, y: 8, width: 336, height: 220 })
    });
    const DEFAULT_LAYOUTS = Object.freeze({
      build: Object.freeze({ panels: DEFAULT_BUILD_PANELS, zOrder: DEFAULT_Z_ORDER }),
      flight: Object.freeze({ panels: DEFAULT_FLIGHT_PANELS, zOrder: FLIGHT_Z_ORDER })
    });
    const PRESET_IDS = Object.freeze(['beginner', 'flight']);

    function clampNumber(value, fallback, min, max) {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
    }

    function normalizePlacement(value, fallback = 'floating') {
      if (value === 'dock-top') return 'dock-bottom';
      return PLACEMENTS.includes(value) ? value : fallback;
    }

    function normalizeDockSpan(value, fallback = 'compact') {
      return DOCK_SPANS.includes(value) ? value : fallback;
    }

    function normalizeLayoutId(value) {
      return LAYOUT_IDS.includes(value) ? value : 'build';
    }

    function layoutForMode(mode) {
      return mode === 'FLIGHT' ? 'flight' : 'build';
    }

    function normalizePanel(raw, fallback, preserveGeometry = true) {
      const source = raw && typeof raw === 'object' ? raw : {};
      return Object.freeze({
        open: typeof source.open === 'boolean' ? source.open : fallback.open,
        minimized: typeof source.minimized === 'boolean' ? source.minimized : fallback.minimized,
        placement: preserveGeometry ? normalizePlacement(source.placement, fallback.placement) : fallback.placement,
        dockSpan: preserveGeometry ? normalizeDockSpan(source.dockSpan, fallback.dockSpan || 'compact') : (fallback.dockSpan || 'compact'),
        x: preserveGeometry ? clampNumber(source.x, fallback.x, -10000, 10000) : fallback.x,
        y: preserveGeometry ? clampNumber(source.y, fallback.y, 0, 10000) : fallback.y,
        width: preserveGeometry ? clampNumber(source.width, fallback.width, 260, 1000) : fallback.width,
        height: preserveGeometry ? clampNumber(source.height, fallback.height, 96, 1400) : fallback.height
      });
    }

    function normalizeZOrder(raw, fallback = DEFAULT_Z_ORDER) {
      const source = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const order = [];
      for (const id of source) {
        if (!PANEL_IDS.includes(id) || seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
      for (const id of fallback) {
        if (seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
      for (const id of PANEL_IDS) {
        if (seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
      return Object.freeze(order);
    }

    function normalizeLayout(raw, fallback, preserveGeometry = true) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const panels = {};
      for (const id of PANEL_IDS) panels[id] = normalizePanel(source.panels?.[id], fallback.panels[id], preserveGeometry);
      return Object.freeze({
        panels: Object.freeze(panels),
        zOrder: normalizeZOrder(source.zOrder, fallback.zOrder)
      });
    }

    function normalize(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const sourceVersion = Number(source.version) || 0;
      const preserveGeometry = sourceVersion >= 2 && sourceVersion <= WORKSPACE_VERSION;
      const hasLayouts = sourceVersion >= 4 && source.layouts && typeof source.layouts === 'object';
      const buildLayout = hasLayouts
        ? normalizeLayout(source.layouts.build, DEFAULT_LAYOUTS.build, preserveGeometry)
        : normalizeLayout({ panels: source.panels, zOrder: source.zOrder }, DEFAULT_LAYOUTS.build, preserveGeometry);
      const flightLayout = normalizeLayout(hasLayouts ? source.layouts.flight : null, DEFAULT_LAYOUTS.flight, preserveGeometry);
      const layouts = Object.freeze({ build: buildLayout, flight: flightLayout });
      return Object.freeze({
        version: WORKSPACE_VERSION,
        activePreset: PRESET_IDS.includes(source.activePreset) ? source.activePreset : 'beginner',
        layouts,
        panels: buildLayout.panels,
        zOrder: buildLayout.zOrder
      });
    }

    function createDefault() { return normalize({ version: WORKSPACE_VERSION, layouts: DEFAULT_LAYOUTS, activePreset: 'beginner' }); }

    function applyPreset(workspace, presetId = 'beginner') {
      const normalized = normalize(workspace);
      if (presetId === 'flight') {
        return normalize({
          version: WORKSPACE_VERSION,
          activePreset: 'flight',
          layouts: { ...normalized.layouts, flight: DEFAULT_LAYOUTS.flight }
        });
      }
      return normalize({
        version: WORKSPACE_VERSION,
        activePreset: 'beginner',
        layouts: { ...normalized.layouts, build: DEFAULT_LAYOUTS.build }
      });
    }

    function panelsForLayout(workspace, layoutId = 'build') {
      return normalize(workspace).layouts[normalizeLayoutId(layoutId)].panels;
    }

    function zOrderForLayout(workspace, layoutId = 'build') {
      return normalize(workspace).layouts[normalizeLayoutId(layoutId)].zOrder;
    }

    function updatePanel(workspace, id, patch, options = {}) {
      if (!PANEL_IDS.includes(id)) return normalize(workspace);
      const normalized = normalize(workspace);
      const layoutId = normalizeLayoutId(options.layoutId);
      const layout = normalized.layouts[layoutId];
      return normalize({
        version: WORKSPACE_VERSION,
        activePreset: normalized.activePreset,
        layouts: {
          ...normalized.layouts,
          [layoutId]: {
            panels: { ...layout.panels, [id]: { ...layout.panels[id], ...(patch || {}) } },
            zOrder: layout.zOrder
          }
        }
      });
    }

    function focusPanel(workspace, id, options = {}) {
      const normalized = normalize(workspace);
      if (!PANEL_IDS.includes(id)) return normalized;
      const layoutId = normalizeLayoutId(options.layoutId);
      const layout = normalized.layouts[layoutId];
      return normalize({
        version: WORKSPACE_VERSION,
        activePreset: normalized.activePreset,
        layouts: {
          ...normalized.layouts,
          [layoutId]: {
            panels: layout.panels,
            zOrder: [...layout.zOrder.filter(panelId => panelId !== id), id]
          }
        }
      });
    }

    function topPanel(workspace, predicate = () => true, options = {}) {
      const normalized = normalize(workspace);
      const layout = normalized.layouts[normalizeLayoutId(options.layoutId)];
      for (let index = layout.zOrder.length - 1; index >= 0; index -= 1) {
        const id = layout.zOrder[index];
        const panel = layout.panels[id];
        if (panel.open && predicate(id, panel)) return id;
      }
      return null;
    }

    function fitPanelRect(panelValue, viewportValue = {}, options = {}) {
      const panelId = PANEL_IDS.includes(options.panelId) ? options.panelId : 'build';
      const panel = normalizePanel(panelValue, DEFAULT_BUILD_PANELS[panelId], true);
      const viewportWidth = Math.max(320, clampNumber(viewportValue.width, 1280, 1, 100000));
      const viewportHeight = Math.max(320, clampNumber(viewportValue.height, 720, 1, 100000));
      const gap = clampNumber(options.gap, 8, 0, 64);
      const topInset = clampNumber(options.topInset, 60, 0, viewportHeight - gap);
      const bottomInset = clampNumber(options.bottomInset, gap, 0, Math.max(gap, viewportHeight - topInset));
      const minimizedHeight = clampNumber(options.minimizedHeight, 48, 24, 160);
      const fullHorizontalDock = panel.dockSpan === 'full' && panel.placement === 'dock-bottom';
      const width = fullHorizontalDock
        ? Math.max(260, viewportWidth - gap * 2)
        : Math.min(panel.width, Math.max(260, viewportWidth - gap * 2));
      const height = Math.min(panel.height, Math.max(96, viewportHeight - topInset - bottomInset));
      const requestedLeft = panel.x < 0 ? viewportWidth - width + panel.x : panel.x;
      const visibleHeight = panel.minimized ? minimizedHeight : height;
      const maxLeft = Math.max(gap, viewportWidth - width - gap);
      const maxTop = Math.max(topInset, viewportHeight - visibleHeight - bottomInset);
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
      LAYOUT_IDS,
      PLACEMENTS,
      DOCK_SPANS,
      PRESET_IDS,
      DEFAULT_Z_ORDER,
      DEFAULT_PANELS: DEFAULT_BUILD_PANELS,
      DEFAULT_LAYOUTS,
      createDefault,
      applyPreset,
      normalize,
      panelsForLayout,
      zOrderForLayout,
      layoutForMode,
      updatePanel,
      focusPanel,
      topPanel,
      fitPanelRect
    });
  });
})();
