(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_LAYOUT_MANAGER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'vaw.importStudio.workbenchLayout.v1';
  const DEFAULT_LAYOUT = Object.freeze({ leftWidth: 360, rightWidth: 410, bottomHeight: 150, leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false });

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function getDefaultLayout() { return { ...DEFAULT_LAYOUT }; }

  function sanitizeLayout(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      leftWidth: clamp(Number(input.leftWidth) || DEFAULT_LAYOUT.leftWidth, 240, 720),
      rightWidth: clamp(Number(input.rightWidth) || DEFAULT_LAYOUT.rightWidth, 280, 760),
      bottomHeight: clamp(Number(input.bottomHeight) || DEFAULT_LAYOUT.bottomHeight, 72, 360),
      leftCollapsed: Boolean(input.leftCollapsed),
      rightCollapsed: Boolean(input.rightCollapsed),
      bottomCollapsed: Boolean(input.bottomCollapsed),
    };
  }

  function loadLayout(storage = globalThis.localStorage) {
    try {
      const raw = storage && storage.getItem ? storage.getItem(STORAGE_KEY) : null;
      return sanitizeLayout(raw ? JSON.parse(raw) : DEFAULT_LAYOUT);
    } catch {
      return getDefaultLayout();
    }
  }

  function saveLayout(layout, storage = globalThis.localStorage) {
    try { storage && storage.setItem && storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeLayout(layout))); }
    catch { /* localStorage may be disabled; layout should still work for this session. */ }
  }

  function applyLayout(root, layout) {
    if (!root) return;
    const clean = sanitizeLayout(layout);
    root.style.setProperty('--left-width', `${clean.leftCollapsed ? 0 : clean.leftWidth}px`);
    root.style.setProperty('--right-width', `${clean.rightCollapsed ? 0 : clean.rightWidth}px`);
    root.style.setProperty('--bottom-height', `${clean.bottomCollapsed ? 0 : clean.bottomHeight}px`);
    root.classList.toggle('left-collapsed', clean.leftCollapsed);
    root.classList.toggle('right-collapsed', clean.rightCollapsed);
    root.classList.toggle('bottom-collapsed', clean.bottomCollapsed);
  }

  function createWorkbenchLayout({ root, onResize = null, storage = globalThis.localStorage } = {}) {
    const layoutRoot = root || document.querySelector('.layout');
    let layout = loadLayout(storage);
    applyLayout(layoutRoot, layout);

    function commit(next, persist = true) {
      layout = sanitizeLayout({ ...layout, ...next });
      applyLayout(layoutRoot, layout);
      if (persist) saveLayout(layout, storage);
      if (typeof onResize === 'function') requestAnimationFrame(() => onResize(layout));
      return layout;
    }

    function reset() { return commit(getDefaultLayout()); }
    function toggle(which) {
      if (which === 'left') return commit({ leftCollapsed: !layout.leftCollapsed });
      if (which === 'right') return commit({ rightCollapsed: !layout.rightCollapsed });
      if (which === 'bottom') return commit({ bottomCollapsed: !layout.bottomCollapsed });
      return layout;
    }

    function bindDrag(handle, kind) {
      if (!handle) return;
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const start = { ...layout };
        handle.setPointerCapture?.(event.pointerId);
        handle.classList.add('dragging');
        function move(moveEvent) {
          if (kind === 'left') commit({ leftCollapsed: false, leftWidth: start.leftWidth + (moveEvent.clientX - startX) }, false);
          if (kind === 'right') commit({ rightCollapsed: false, rightWidth: start.rightWidth - (moveEvent.clientX - startX) }, false);
          if (kind === 'bottom') commit({ bottomCollapsed: false, bottomHeight: start.bottomHeight - (moveEvent.clientY - startY) }, false);
          moveEvent.preventDefault();
        }
        function up(upEvent) {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          handle.releasePointerCapture?.(upEvent.pointerId);
          handle.classList.remove('dragging');
          commit(layout, true);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up, { once: true });
        event.preventDefault();
      });
    }

    bindDrag(document.getElementById('left-splitter'), 'left');
    bindDrag(document.getElementById('right-splitter'), 'right');
    bindDrag(document.getElementById('bottom-splitter'), 'bottom');
    document.getElementById('reset-layout')?.addEventListener('click', reset);
    document.getElementById('toggle-left-panel')?.addEventListener('click', () => toggle('left'));
    document.getElementById('toggle-right-panel')?.addEventListener('click', () => toggle('right'));
    document.getElementById('toggle-bottom-panel')?.addEventListener('click', () => toggle('bottom'));

    return Object.freeze({ get layout() { return { ...layout }; }, commit, reset, toggle });
  }

  return Object.freeze({ STORAGE_KEY, DEFAULT_LAYOUT, getDefaultLayout, sanitizeLayout, loadLayout, saveLayout, applyLayout, createWorkbenchLayout });
});
