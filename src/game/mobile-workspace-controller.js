'use strict';

(function registerMobileWorkspaceController(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-workspace-controller.js.');
  root.VAW.define('game.mobile-workspace-controller', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileWorkspaceControllerModule() {
  const LARGE_PANELS = Object.freeze(['build', 'contracts', 'telemetry', 'mission', 'controls']);
  const BUILD_PANELS = Object.freeze([...LARGE_PANELS, 'parts']);
  const FLIGHT_PANELS = Object.freeze(['telemetry', 'mission', 'controls']);
  const PANEL_IDS = Object.freeze({
    parts: 'parts-hotbar',
    build: 'build-panel',
    contracts: 'contract-panel',
    telemetry: 'telemetry-panel',
    mission: 'mission-hud',
    controls: 'controls-panel'
  });

  function create(options = {}) {
    const documentLike = options.document || (typeof document !== 'undefined' ? document : null);
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const mobileContext = options.mobileContext;
    const MutationObserverClass = options.MutationObserver || windowLike?.MutationObserver || null;
    if (!documentLike?.getElementById) throw new TypeError('Mobile workspace controller requires a document.');
    if (!mobileContext || typeof mobileContext.currentProfile !== 'function') {
      throw new TypeError('Mobile workspace controller requires mobileContext.currentProfile().');
    }

    const uiLayer = documentLike.getElementById('ui-layer');
    const toolbar = documentLike.getElementById('workspace-toolbar');
    const modeElement = documentLike.getElementById('ui-mode');
    if (!uiLayer || !toolbar || !modeElement) {
      throw new Error('Mobile workspace controller requires #ui-layer, #workspace-toolbar and #ui-mode.');
    }

    const panels = new Map();
    const buttons = new Map();
    for (const [name, id] of Object.entries(PANEL_IDS)) {
      const panel = documentLike.getElementById(id);
      if (panel) panels.set(name, panel);
    }
    for (const button of documentLike.querySelectorAll?.('#workspace-toolbar [data-panel-toggle]') || []) {
      const name = String(button.dataset?.panelToggle || '');
      if (PANEL_IDS[name]) buttons.set(name, button);
    }

    const originals = {
      uiLayer: {
        workspace: uiLayer.dataset?.vawMobileWorkspace,
        mode: uiLayer.dataset?.vawMobileMode,
        activePanel: uiLayer.dataset?.vawMobileActivePanel,
        partsOpen: uiLayer.dataset?.vawMobilePartsOpen
      },
      panels: new Map(),
      buttons: new Map()
    };
    for (const [name, panel] of panels) {
      originals.panels.set(name, {
        inert: Boolean(panel.inert),
        ariaHidden: panel.getAttribute?.('aria-hidden')
      });
    }
    for (const [name, button] of buttons) {
      originals.buttons.set(name, {
        ariaExpanded: button.getAttribute?.('aria-expanded'),
        ariaDisabled: button.getAttribute?.('aria-disabled')
      });
    }

    let active = false;
    let bound = false;
    let destroyed = false;
    let mode = normalizeMode(modeElement.textContent);
    let activePanel = defaultPanelForMode(mode);
    let partsOpen = mode === 'BUILD';
    let unsubscribeProfile = null;
    let modeObserver = null;

    function normalizeMode(value) {
      return String(value || '').trim().toUpperCase().includes('FLIGHT') ? 'FLIGHT' : 'BUILD';
    }

    function availablePanelsForMode(value) {
      return value === 'FLIGHT' ? FLIGHT_PANELS : BUILD_PANELS;
    }

    function defaultPanelForMode(value) {
      return value === 'FLIGHT' ? 'telemetry' : 'build';
    }

    function snapshot() {
      return Object.freeze({
        active,
        mode,
        activePanel,
        partsOpen,
        availablePanels: Object.freeze([...availablePanelsForMode(mode)]),
        bound
      });
    }

    function emitChanged() {
      try { options.onChanged?.(snapshot()); }
      catch (error) { options.onError?.(error, { phase: 'changed-callback' }); }
    }

    function setOptionalAttribute(element, name, value) {
      if (!element?.setAttribute) return;
      if (value == null) element.removeAttribute?.(name);
      else element.setAttribute(name, value);
    }

    function deleteDataset(element, key) {
      if (element?.dataset) delete element.dataset[key];
    }

    function restoreDataset(element, key, value) {
      if (value == null) deleteDataset(element, key);
      else element.dataset[key] = value;
    }

    function restorePresentation() {
      restoreDataset(uiLayer, 'vawMobileWorkspace', originals.uiLayer.workspace);
      restoreDataset(uiLayer, 'vawMobileMode', originals.uiLayer.mode);
      restoreDataset(uiLayer, 'vawMobileActivePanel', originals.uiLayer.activePanel);
      restoreDataset(uiLayer, 'vawMobilePartsOpen', originals.uiLayer.partsOpen);

      for (const [name, panel] of panels) {
        deleteDataset(panel, 'vawMobileSheet');
        deleteDataset(panel, 'vawMobileActive');
        deleteDataset(panel, 'vawMobileTray');
        deleteDataset(panel, 'vawMobileOpen');
        deleteDataset(panel, 'vawMobileAvailable');
        const original = originals.panels.get(name);
        panel.inert = Boolean(original?.inert);
        setOptionalAttribute(panel, 'aria-hidden', original?.ariaHidden);
      }

      for (const [name, button] of buttons) {
        deleteDataset(button, 'vawMobileSelected');
        deleteDataset(button, 'vawMobileAvailable');
        const original = originals.buttons.get(name);
        setOptionalAttribute(button, 'aria-expanded', original?.ariaExpanded);
        setOptionalAttribute(button, 'aria-disabled', original?.ariaDisabled);
      }
    }

    function applyPresentation() {
      if (!active) {
        restorePresentation();
        emitChanged();
        return;
      }

      const available = new Set(availablePanelsForMode(mode));
      const effectivePartsOpen = available.has('parts') && partsOpen;
      uiLayer.dataset.vawMobileWorkspace = 'active';
      uiLayer.dataset.vawMobileMode = mode.toLowerCase();
      uiLayer.dataset.vawMobileActivePanel = activePanel || 'none';
      uiLayer.dataset.vawMobilePartsOpen = String(effectivePartsOpen);

      for (const name of LARGE_PANELS) {
        const panel = panels.get(name);
        if (!panel) continue;
        const isAvailable = available.has(name);
        const isSelected = isAvailable && activePanel === name;
        panel.dataset.vawMobileSheet = 'true';
        panel.dataset.vawMobileAvailable = String(isAvailable);
        panel.dataset.vawMobileActive = String(isSelected);
        panel.inert = !isSelected;
        setOptionalAttribute(panel, 'aria-hidden', String(!isSelected));
      }

      const partsPanel = panels.get('parts');
      if (partsPanel) {
        const isAvailable = available.has('parts');
        const isOpen = isAvailable && partsOpen;
        partsPanel.dataset.vawMobileTray = 'true';
        partsPanel.dataset.vawMobileAvailable = String(isAvailable);
        partsPanel.dataset.vawMobileOpen = String(isOpen);
        partsPanel.inert = !isOpen;
        setOptionalAttribute(partsPanel, 'aria-hidden', String(!isOpen));
      }

      for (const [name, button] of buttons) {
        const isAvailable = available.has(name);
        const isSelected = name === 'parts'
          ? isAvailable && partsOpen
          : isAvailable && activePanel === name;
        button.dataset.vawMobileAvailable = String(isAvailable);
        button.dataset.vawMobileSelected = String(isSelected);
        setOptionalAttribute(button, 'aria-expanded', String(isSelected));
        setOptionalAttribute(button, 'aria-disabled', String(!isAvailable));
      }

      emitChanged();
    }

    function resetForMode(nextMode) {
      mode = nextMode;
      activePanel = defaultPanelForMode(mode);
      partsOpen = mode === 'BUILD';
    }

    function refresh() {
      const nextMode = normalizeMode(modeElement.textContent);
      if (nextMode !== mode) resetForMode(nextMode);
      const nextActive = Boolean(mobileContext.currentProfile()?.mobilePresentation);
      if (nextActive && !active) {
        active = true;
        resetForMode(nextMode);
      } else if (!nextActive && active) {
        active = false;
      }
      applyPresentation();
      return snapshot();
    }

    function handleProfile(profile) {
      const nextActive = Boolean(profile?.mobilePresentation);
      const nextMode = normalizeMode(modeElement.textContent);
      if (nextMode !== mode) resetForMode(nextMode);
      if (nextActive && !active) {
        active = true;
        resetForMode(nextMode);
      } else if (!nextActive && active) {
        active = false;
      }
      applyPresentation();
    }

    function handleToolbarClick(event) {
      if (!active) return;
      const button = event?.target?.closest?.('[data-panel-toggle]');
      if (!button || !toolbar.contains(button)) return;
      const name = String(button.dataset?.panelToggle || '');
      if (!PANEL_IDS[name]) return;

      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();

      const available = new Set(availablePanelsForMode(mode));
      if (!available.has(name)) return;
      if (name === 'parts') {
        partsOpen = !partsOpen;
      } else {
        activePanel = activePanel === name ? null : name;
      }
      applyPresentation();
    }

    function setActivePanel(name) {
      if (name !== null && !LARGE_PANELS.includes(name)) return false;
      if (name !== null && !availablePanelsForMode(mode).includes(name)) return false;
      if (activePanel === name) return false;
      activePanel = name;
      applyPresentation();
      return true;
    }

    function setPartsOpen(value) {
      const next = Boolean(value) && availablePanelsForMode(mode).includes('parts');
      if (partsOpen === next) return false;
      partsOpen = next;
      applyPresentation();
      return true;
    }

    function bind() {
      if (destroyed) throw new Error('Destroyed mobile workspace controller cannot be rebound.');
      if (bound) return false;
      toolbar.addEventListener('click', handleToolbarClick, true);
      if (typeof mobileContext.subscribe === 'function') {
        unsubscribeProfile = mobileContext.subscribe(handleProfile);
      } else {
        refresh();
      }
      if (MutationObserverClass) {
        modeObserver = new MutationObserverClass(() => refresh());
        modeObserver.observe(modeElement, { childList: true, characterData: true, subtree: true });
      }
      bound = true;
      applyPresentation();
      return true;
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      bound = false;
      toolbar.removeEventListener('click', handleToolbarClick, true);
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      modeObserver?.disconnect?.();
      modeObserver = null;
      active = false;
      restorePresentation();
      emitChanged();
      return true;
    }

    return Object.freeze({
      bind,
      destroy,
      refresh,
      setActivePanel,
      setPartsOpen,
      snapshot,
      active: () => active
    });
  }

  return Object.freeze({
    create,
    LARGE_PANELS,
    BUILD_PANELS,
    FLIGHT_PANELS,
    PANEL_IDS
  });
});
