(() => {
  'use strict';

  window.VAW.define('game.workspace-controller', ['foundation.config', 'foundation.input-profile', 'foundation.ui-workspace'], (Config, InputProfile, UIWorkspace) => {
    const { UI_SAVE_VERSION, UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS } = Config;

    function create({ state: STATE, document: documentRef = window.document, window: windowRef = window, storage = window.localStorage, showStatus = () => {} } = {}) {
      if (!STATE?.uiWorkspace || !STATE?.input) throw new TypeError('Workspace controller requires application state.');
      const document = documentRef;
      const hostWindow = windowRef;
      let workspaceSaveTimer = null;

      function readFirstStoredJSON(primaryKey, legacyKeys = []) {
        for (const key of [primaryKey, ...legacyKeys]) {
          try {
            const raw = storage.getItem(key);
            if (raw) return JSON.parse(raw);
          } catch (error) {
            console.warn(`Stored preferences ${key} could not be read:`, error);
          }
        }
        return null;
      }

      function loadUIPreferences() {
        const parsed = readFirstStoredJSON(UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS);
        if (!parsed) return;
        STATE.input.profile = InputProfile.normalize(parsed.inputProfile);
        STATE.uiWorkspace = UIWorkspace.normalize(parsed.workspace);
        if (typeof parsed.contractPanelCollapsed === 'boolean' && !parsed.workspace) {
          STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, 'contracts', { open: !parsed.contractPanelCollapsed });
        }
        STATE.contractPanelCollapsed = !STATE.uiWorkspace.panels.contracts.open;
      }

      function saveUIPreferences() {
        try {
          storage.setItem(UI_SAVE_KEY, JSON.stringify({
            version: UI_SAVE_VERSION,
            inputProfile: STATE.input.profile,
            workspace: STATE.uiWorkspace
          }));
        } catch (error) {
          console.warn('UI preferences could not be written:', error);
        }
      }

      function scheduleWorkspaceSave() {
        if (workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
        workspaceSaveTimer = setTimeout(() => {
          workspaceSaveTimer = null;
          saveUIPreferences();
        }, 180);
      }

      function flushPendingSave() {
        if (workspaceSaveTimer) {
          clearTimeout(workspaceSaveTimer);
          workspaceSaveTimer = null;
        }
        saveUIPreferences();
      }

      function panelElement(panelId) {
        return document.querySelector(`[data-workspace-panel="${panelId}"]`);
      }

      function panelAvailableInCurrentMode(panelId) {
        if (panelId === 'build' || panelId === 'contracts') return STATE.mode === 'BUILD';
        return true;
      }

      function panelVisibleInCurrentMode(panelId) {
        return !STATE.uiCollapsed && panelAvailableInCurrentMode(panelId);
      }

      function workspaceTopInset() {
        const toolbar = document.getElementById('workspace-toolbar');
        if (!toolbar || toolbar.hidden) return 60;
        const rect = toolbar.getBoundingClientRect();
        return Math.max(60, Math.ceil(rect.bottom + 8));
      }

      function applyWorkspaceLayout() {
        const viewportWidth = Math.max(320, hostWindow.innerWidth || 1280);
        const viewportHeight = Math.max(320, hostWindow.innerHeight || 720);
        const zIndexByPanel = new Map(STATE.uiWorkspace.zOrder.map((id, index) => [id, 35 + index]));
        const frontPanelId = UIWorkspace.topPanel(STATE.uiWorkspace, panelId => panelVisibleInCurrentMode(panelId));
        for (const panelId of UIWorkspace.PANEL_IDS) {
          const element = /** @type {HTMLElement|null} */ (panelElement(panelId));
          const panel = STATE.uiWorkspace.panels[panelId];
          if (!element || !panel) continue;
          const available = panelAvailableInCurrentMode(panelId);
          const visible = panel.open && panelVisibleInCurrentMode(panelId);
          element.hidden = !visible;
          element.setAttribute('aria-hidden', String(!visible));
          element.classList.toggle('workspace-panel-minimized', panel.minimized);
          element.classList.toggle('workspace-panel-front', visible && panelId === frontPanelId);
          element.style.zIndex = String(zIndexByPanel.get(panelId) || 35);
          if (visible) {
            const rect = UIWorkspace.fitPanelRect(panel, { width: viewportWidth, height: viewportHeight }, { panelId, topInset: workspaceTopInset() });
            element.style.width = `${rect.width}px`;
            element.style.height = panel.minimized ? 'auto' : `${rect.height}px`;
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
          } else {
            element.style.removeProperty('width');
            element.style.removeProperty('height');
            element.style.removeProperty('left');
            element.style.removeProperty('top');
          }
          document.querySelectorAll(`[data-panel-toggle="${panelId}"]`).forEach(rawButton => {
            const button = /** @type {HTMLButtonElement} */ (rawButton);
            button.classList.toggle('active', panel.open && available);
            button.classList.toggle('workspace-tab-unavailable', !available);
            button.disabled = !available;
            button.setAttribute('aria-pressed', String(panel.open && available));
            button.setAttribute('aria-disabled', String(!available));
          });
        }
        STATE.contractPanelCollapsed = !STATE.uiWorkspace.panels.contracts.open;
      }

      function focusWorkspacePanel(panelId, persist = false) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId)) return;
        if (STATE.uiWorkspace.zOrder.at(-1) === panelId) return;
        STATE.uiWorkspace = UIWorkspace.focusPanel(STATE.uiWorkspace, panelId);
        applyWorkspaceLayout();
        if (persist) scheduleWorkspaceSave();
      }

      function updateWorkspacePanel(panelId, patch, persist = true, focus = false) {
        STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, patch);
        if (focus) STATE.uiWorkspace = UIWorkspace.focusPanel(STATE.uiWorkspace, panelId);
        applyWorkspaceLayout();
        if (persist) scheduleWorkspaceSave();
      }

      function setWorkspacePanelOpen(panelId, open, persist = true) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId)) return;
        updateWorkspacePanel(panelId, { open: Boolean(open), minimized: false }, persist, Boolean(open));
      }

      function syncContractPanelVisibility() { applyWorkspaceLayout(); }
      function setContractPanelCollapsed(collapsed, persist = true) { setWorkspacePanelOpen('contracts', !Boolean(collapsed), persist); }
      function toggleContractPanel() {
        if (STATE.mode !== 'BUILD' || STATE.uiCollapsed) return;
        setWorkspacePanelOpen('contracts', !STATE.uiWorkspace.panels.contracts.open);
      }

      function closeTopmostWorkspacePanel() {
        const panelId = UIWorkspace.topPanel(STATE.uiWorkspace, id => panelVisibleInCurrentMode(id));
        if (!panelId) return false;
        setWorkspacePanelOpen(panelId, false);
        return true;
      }

      function resetWorkspaceLayout() {
        STATE.uiWorkspace = UIWorkspace.createDefault();
        applyWorkspaceLayout();
        saveUIPreferences();
        showStatus('WORKSPACE RESET', 1100);
      }

      function bindWorkspacePanels() {
        document.querySelectorAll('[data-panel-toggle]').forEach(button => {
          button.addEventListener('click', () => {
            const panelId = button.getAttribute('data-panel-toggle');
            if (!panelId || !panelAvailableInCurrentMode(panelId)) return;
            setWorkspacePanelOpen(panelId, !STATE.uiWorkspace.panels[panelId]?.open);
          });
        });
        document.querySelectorAll('[data-panel-close]').forEach(button => {
          button.addEventListener('click', () => setWorkspacePanelOpen(button.getAttribute('data-panel-close'), false));
        });
        document.querySelectorAll('[data-panel-minimize]').forEach(button => {
          button.addEventListener('click', () => {
            const panelId = button.getAttribute('data-panel-minimize');
            updateWorkspacePanel(panelId, { minimized: !STATE.uiWorkspace.panels[panelId]?.minimized }, true, true);
          });
        });
        document.getElementById('btn-workspace-reset')?.addEventListener('click', resetWorkspaceLayout);
        document.querySelectorAll('[data-panel-scroll]').forEach(region => {
          region.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
        });

        document.querySelectorAll('[data-workspace-panel]').forEach(rawElement => {
          const element = /** @type {HTMLElement} */ (rawElement);
          const panelId = element.getAttribute('data-workspace-panel');
          if (!panelId) return;
          element.addEventListener('pointerdown', () => focusWorkspacePanel(panelId), { capture: true });
          element.addEventListener('focusin', () => focusWorkspacePanel(panelId));
        });

        document.querySelectorAll('.workspace-panel-handle').forEach(handle => {
          const element = /** @type {HTMLElement|null} */ (handle.closest('[data-workspace-panel]'));
          const panelId = element?.getAttribute('data-workspace-panel');
          if (!element || !panelId) return;
          handle.addEventListener('dblclick', event => {
            if (event.target.closest('button')) return;
            updateWorkspacePanel(panelId, { minimized: !STATE.uiWorkspace.panels[panelId]?.minimized }, true, true);
          });
          handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button')) return;
            event.preventDefault();
            focusWorkspacePanel(panelId);
            const startX = event.clientX;
            const startY = event.clientY;
            const rect = element.getBoundingClientRect();
            try { handle.setPointerCapture(event.pointerId); } catch (_) {}
            const move = moveEvent => {
              const fitted = UIWorkspace.fitPanelRect({
                ...STATE.uiWorkspace.panels[panelId],
                x: rect.left + moveEvent.clientX - startX,
                y: rect.top + moveEvent.clientY - startY,
                width: rect.width,
                height: rect.height,
                minimized: false
              }, { width: hostWindow.innerWidth || 1280, height: hostWindow.innerHeight || 720 }, { panelId, topInset: workspaceTopInset() });
              element.style.left = `${fitted.left}px`;
              element.style.top = `${fitted.top}px`;
            };
            const end = () => {
              handle.removeEventListener('pointermove', move);
              handle.removeEventListener('pointerup', end);
              handle.removeEventListener('pointercancel', end);
              const finalRect = element.getBoundingClientRect();
              updateWorkspacePanel(panelId, { x: finalRect.left, y: finalRect.top, width: finalRect.width, height: finalRect.height });
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', end);
            handle.addEventListener('pointercancel', end);
          });
        });

        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(entries => {
            let changed = false;
            for (const entry of entries) {
              const element = entry.target;
              const panelId = element.getAttribute('data-workspace-panel');
              if (!panelId || element.hidden || STATE.uiWorkspace.panels[panelId]?.minimized) continue;
              const rect = element.getBoundingClientRect();
              const panel = STATE.uiWorkspace.panels[panelId];
              if (Math.abs(panel.width - rect.width) < 0.5 && Math.abs(panel.height - rect.height) < 0.5) continue;
              STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, { width: rect.width, height: rect.height });
              changed = true;
            }
            if (changed) scheduleWorkspaceSave();
          });
          document.querySelectorAll('[data-workspace-panel]').forEach(panel => observer.observe(panel));
        }
      }

      return Object.freeze({
        readFirstStoredJSON, loadUIPreferences, saveUIPreferences, scheduleWorkspaceSave, flushPendingSave,
        panelElement, panelAvailableInCurrentMode, panelVisibleInCurrentMode, workspaceTopInset,
        applyWorkspaceLayout, focusWorkspacePanel, updateWorkspacePanel, setWorkspacePanelOpen,
        syncContractPanelVisibility, setContractPanelCollapsed, toggleContractPanel,
        closeTopmostWorkspacePanel, resetWorkspaceLayout, bindWorkspacePanels
      });
    }

    return Object.freeze({ create });
  });
})();
