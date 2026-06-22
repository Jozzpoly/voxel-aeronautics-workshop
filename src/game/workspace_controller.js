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

      function currentLayoutId() { return UIWorkspace.layoutForMode(STATE.mode); }
      function currentPanels() { return UIWorkspace.panelsForLayout(STATE.uiWorkspace, currentLayoutId()); }
      function currentZOrder() { return UIWorkspace.zOrderForLayout(STATE.uiWorkspace, currentLayoutId()); }
      function buildPanels() { return UIWorkspace.panelsForLayout(STATE.uiWorkspace, 'build'); }

      const CAMERA_MODES = Object.freeze(['static', 'follow-position', 'follow-body']);
      function normalizeCameraMode(value) { return CAMERA_MODES.includes(value) ? value : 'follow-position'; }
      function normalizeCameraFollowStrength(value) {
        const numeric = Number(value);
        return Math.max(0.02, Math.min(0.35, Number.isFinite(numeric) ? numeric : 0.08));
      }
      function normalizeCameraPreferences(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        return Object.freeze({
          mode: normalizeCameraMode(source.mode),
          followStrength: normalizeCameraFollowStrength(source.followStrength)
        });
      }
      function applyCameraPreferences(value) {
        if (!STATE.camera) return;
        const camera = normalizeCameraPreferences(value || STATE.camera);
        STATE.camera.mode = camera.mode;
        STATE.camera.followStrength = camera.followStrength;
      }

      function loadUIPreferences() {
        const parsed = readFirstStoredJSON(UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS);
        if (!parsed) return;
        STATE.input.profile = InputProfile.normalize(parsed.inputProfile);
        const storedVersion = Number(parsed.version) || 0;
        STATE.uiWorkspace = parsed.workspace && storedVersion >= 8
          ? UIWorkspace.normalize(parsed.workspace)
          : UIWorkspace.createDefault();
        if (typeof parsed.contractPanelCollapsed === 'boolean' && !parsed.workspace) {
          STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, 'contracts', { open: !parsed.contractPanelCollapsed }, { layoutId: 'build' });
        }
        applyCameraPreferences(parsed.camera);
        STATE.contractPanelCollapsed = !buildPanels().contracts.open;
      }

      function saveUIPreferences() {
        try {
          const payload = {
            version: UI_SAVE_VERSION,
            inputProfile: STATE.input.profile,
            workspace: STATE.uiWorkspace
          };
          if (STATE.camera) payload.camera = normalizeCameraPreferences(STATE.camera);
          storage.setItem(UI_SAVE_KEY, JSON.stringify(payload));
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
        if (panelId === 'build' || panelId === 'contracts' || panelId === 'parts') return STATE.mode === 'BUILD';
        if (panelId === 'mission') return STATE.mode === 'FLIGHT';
        return true;
      }

      function panelVisibleInCurrentMode(panelId) {
        return !STATE.uiCollapsed && panelAvailableInCurrentMode(panelId);
      }

      function workspaceTopInset() {
        const toolbar = document.getElementById('workspace-toolbar');
        const actions = document.getElementById('mode-actions');
        const layoutActions = document.getElementById('workspace-layout-actions');
        let bottom = 52;
        for (const element of [toolbar, actions, layoutActions]) {
          if (!element || element.hidden) continue;
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          bottom = Math.max(bottom, rect.bottom);
        }
        return Math.max(60, Math.ceil(bottom + 8));
      }

      function workspaceEdgeTopInset() {
        return 8;
      }

      function setStyle(element, name, value) {
        if (typeof element.style.setProperty === 'function') element.style.setProperty(name, value);
        else element.style[name] = value;
      }

      function removeStyle(element, name) {
        if (typeof element.style.removeProperty === 'function') element.style.removeProperty(name);
        else delete element.style[name];
      }

      function setDockPreview(placement = '') {
        const layer = document.getElementById('ui-layer');
        if (!layer) return;
        layer.classList.toggle('workbench-docking-active', Boolean(placement));
        for (const value of UIWorkspace.PLACEMENTS) {
          if (value === 'floating') continue;
          layer.classList.toggle(`workbench-dock-preview-${value.replace('dock-', '')}`, placement === value);
        }
      }

      function dockPlacementFromPointer(event) {
        const width = Math.max(320, hostWindow.innerWidth || 1280);
        const height = Math.max(320, hostWindow.innerHeight || 720);
        if (event.clientY >= height - 132) return 'dock-bottom';
        if (event.clientX <= 148) return 'dock-left';
        if (event.clientX >= width - 148) return 'dock-right';
        return 'floating';
      }

      function isHorizontalDockPlacement(placement) {
        return placement === 'dock-bottom';
      }

      function bottomDockReserve(panels, topInset = workspaceTopInset()) {
        const viewport = { width: hostWindow.innerWidth || 1280, height: hostWindow.innerHeight || 720 };
        let reserve = 16;
        for (const panelId of UIWorkspace.PANEL_IDS) {
          const panel = panels[panelId];
          if (!panel || panel.placement !== 'dock-bottom') continue;
          if (!panel.open || !panelVisibleInCurrentMode(panelId)) continue;
          if (panel.minimized) {
            reserve = Math.max(reserve, 64);
            continue;
          }
          const rect = UIWorkspace.fitPanelRect(panel, viewport, { panelId, topInset });
          reserve = Math.max(reserve, Math.ceil(rect.height + 24));
        }
        return reserve;
      }

      function computeSideDockRects(panels, viewport, topInset, bottomInset) {
        const result = Object.create(null);
        const gap = 8;
        const availableHeight = Math.max(96, viewport.height - topInset - bottomInset);
        const zOrderIndex = new Map(currentZOrder().map((id, index) => [id, index]));
        for (const placement of ['dock-left', 'dock-right']) {
          const entries = UIWorkspace.PANEL_IDS
            .filter(panelId => {
              const panel = panels[panelId];
              return panel && panel.open && panelVisibleInCurrentMode(panelId) && panel.placement === placement;
            })
            .sort((leftId, rightId) => {
              const leftPanel = panels[leftId];
              const rightPanel = panels[rightId];
              return (leftPanel.y - rightPanel.y) || ((zOrderIndex.get(leftId) || 0) - (zOrderIndex.get(rightId) || 0));
            });
          if (!entries.length) continue;

          const measured = entries.map(panelId => {
            const panel = panels[panelId];
            const rect = UIWorkspace.fitPanelRect(panel, viewport, { panelId, topInset, bottomInset });
            const visibleHeight = panel.minimized ? 48 : rect.height;
            return { panelId, rect, visibleHeight };
          });
          const totalGaps = gap * Math.max(0, measured.length - 1);
          const requestedHeight = measured.reduce((sum, entry) => sum + entry.visibleHeight, 0);
          const scale = requestedHeight + totalGaps > availableHeight
            ? Math.max(0.1, (availableHeight - totalGaps) / Math.max(1, requestedHeight))
            : 1;
          let cursor = topInset;
          for (const entry of measured) {
            const panel = panels[entry.panelId];
            const minHeight = panel.minimized ? 48 : 96;
            const height = Math.max(minHeight, Math.floor(entry.visibleHeight * scale));
            const maxTop = Math.max(topInset, viewport.height - height - bottomInset);
            const top = Math.min(cursor, maxTop);
            result[entry.panelId] = Object.freeze({
              left: entry.rect.left,
              top,
              width: entry.rect.width,
              height
            });
            cursor = top + height + gap;
          }
        }
        return Object.freeze(result);
      }

      function applyWorkspaceLayout() {
        const layoutId = currentLayoutId();
        const panels = currentPanels();
        const viewport = { width: hostWindow.innerWidth || 1280, height: hostWindow.innerHeight || 720 };
        const zIndexByPanel = new Map(currentZOrder().map((id, index) => [id, 35 + index]));
        const frontPanelId = UIWorkspace.topPanel(STATE.uiWorkspace, panelId => panelVisibleInCurrentMode(panelId), { layoutId });
        const reservedTop = workspaceTopInset();
        const edgeTop = workspaceEdgeTopInset();
        const reservedBottom = bottomDockReserve(panels, edgeTop);
        const sideDockRects = computeSideDockRects(panels, viewport, edgeTop, reservedBottom);
        const fullBottomDock = UIWorkspace.PANEL_IDS.some(panelId => {
          const panel = panels[panelId];
          return panel && panel.open && panelVisibleInCurrentMode(panelId) && panel.placement === 'dock-bottom' && panel.dockSpan === 'full';
        });
        const layer = document.getElementById('ui-layer');
        if (layer) {
          layer.setAttribute('data-workbench-layout', layoutId);
          layer.classList.toggle('workbench-bottom-dock-active', reservedBottom > 16);
          layer.classList.toggle('workbench-bottom-dock-full', fullBottomDock);
          setStyle(layer, '--workbench-top-reserve', `${reservedTop}px`);
          setStyle(layer, '--workbench-edge-top', `${edgeTop}px`);
          setStyle(layer, '--workbench-bottom-reserve', `${reservedBottom}px`);
        }
        for (const panelId of UIWorkspace.PANEL_IDS) {
          const element = /** @type {HTMLElement|null} */ (panelElement(panelId));
          const panel = panels[panelId];
          if (!element || !panel) continue;
          const available = panelAvailableInCurrentMode(panelId);
          const visible = panel.open && panelVisibleInCurrentMode(panelId);
          const placement = UIWorkspace.PLACEMENTS.includes(panel.placement) ? panel.placement : 'floating';
          const fullDock = panel.dockSpan === 'full';
          element.hidden = !visible;
          element.setAttribute('aria-hidden', String(!visible));
          element.dataset.placement = placement;
          element.dataset.dockSpan = panel.dockSpan || 'compact';
          element.classList.toggle('workspace-panel-minimized', panel.minimized);
          element.classList.toggle('workspace-panel-front', visible && panelId === frontPanelId);
          element.classList.toggle('workspace-panel-floating', placement === 'floating');
          element.classList.toggle('workspace-panel-docked', placement !== 'floating');
          element.classList.toggle('workspace-panel-dock-full', fullDock);
          element.classList.toggle('workspace-panel-dock-compact', !fullDock);
          for (const value of UIWorkspace.PLACEMENTS) element.classList.toggle(`workspace-panel-${value}`, placement === value);
          element.style.zIndex = String(zIndexByPanel.get(panelId) || 35);
          if (visible) {
            const bottomInset = (placement === 'dock-left' || placement === 'dock-right' || placement === 'floating') ? reservedBottom : 8;
            const panelTopInset = (placement === 'dock-left' || placement === 'dock-right') ? edgeTop : reservedTop;
            const rect = sideDockRects[panelId] || UIWorkspace.fitPanelRect(panel, viewport, { panelId, topInset: panelTopInset, bottomInset });
            setStyle(element, '--workspace-panel-width', `${rect.width}px`);
            setStyle(element, '--workspace-panel-height', panel.minimized ? 'auto' : `${rect.height}px`);
            element.style.width = `${rect.width}px`;
            element.style.height = panel.minimized ? 'auto' : `${rect.height}px`;
            if (placement === 'floating') {
              element.style.left = `${rect.left}px`;
              element.style.top = `${rect.top}px`;
            } else if (placement === 'dock-left' || placement === 'dock-right') {
              element.style.top = `${rect.top}px`;
              removeStyle(element, 'left');
            } else {
              removeStyle(element, 'left');
              removeStyle(element, 'top');
            }
          } else {
            for (const key of ['width', 'height', 'left', 'top', '--workspace-panel-width', '--workspace-panel-height']) removeStyle(element, key);
          }
          document.querySelectorAll(`[data-panel-toggle="${panelId}"]`).forEach(rawButton => {
            const button = /** @type {HTMLButtonElement} */ (rawButton);
            button.classList.toggle('active', panel.open && available);
            button.classList.toggle('workspace-tab-unavailable', !available);
            button.disabled = !available;
            button.setAttribute('aria-pressed', String(panel.open && available));
            button.setAttribute('aria-expanded', String(panel.open && available));
            button.setAttribute('aria-disabled', String(!available));
          });
          document.querySelectorAll(`[data-panel-span-toggle="${panelId}"]`).forEach(rawButton => {
            const button = /** @type {HTMLButtonElement} */ (rawButton);
            const active = isHorizontalDockPlacement(placement) && panel.dockSpan === 'full';
            button.classList.toggle('active', active);
            button.textContent = active ? 'FULL' : 'FIT';
            button.setAttribute('aria-pressed', String(active));
            button.setAttribute('aria-label', active ? 'Use compact parts hotbar width' : 'Use full-width parts hotbar');
            button.setAttribute('title', active ? 'Use compact parts hotbar width' : 'Use full-width parts hotbar');
          });
          document.querySelectorAll(`[data-panel-minimize="${panelId}"]`).forEach(rawButton => {
            const button = /** @type {HTMLButtonElement} */ (rawButton);
            const minimized = Boolean(panel.minimized);
            button.textContent = minimized ? '+' : '-';
            button.setAttribute('aria-expanded', String(!minimized));
            button.setAttribute('aria-label', minimized ? `Expand ${panelId} panel` : `Collapse ${panelId} panel`);
            button.setAttribute('title', minimized ? 'Expand panel' : 'Collapse panel');
          });
        }
        STATE.contractPanelCollapsed = !buildPanels().contracts.open;
      }

      function focusWorkspacePanel(panelId, persist = false) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId)) return;
        const layoutId = currentLayoutId();
        if (currentZOrder().at(-1) === panelId) return;
        STATE.uiWorkspace = UIWorkspace.focusPanel(STATE.uiWorkspace, panelId, { layoutId });
        applyWorkspaceLayout();
        if (persist) scheduleWorkspaceSave();
      }

      function updateWorkspacePanel(panelId, patch, persist = true, focus = false) {
        const layoutId = currentLayoutId();
        STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, patch, { layoutId });
        if (focus) STATE.uiWorkspace = UIWorkspace.focusPanel(STATE.uiWorkspace, panelId, { layoutId });
        applyWorkspaceLayout();
        if (persist) scheduleWorkspaceSave();
      }

      function setWorkspacePanelOpen(panelId, open, persist = true) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId)) return;
        updateWorkspacePanel(panelId, { open: Boolean(open), minimized: false }, persist, Boolean(open));
      }

      function setWorkspacePanelPlacement(panelId, placement, persist = true) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId) || !UIWorkspace.PLACEMENTS.includes(placement)) return;
        updateWorkspacePanel(panelId, { placement, minimized: false }, persist, true);
      }

      function togglePanelDockSpan(panelId, persist = true) {
        if (!UIWorkspace.PANEL_IDS.includes(panelId)) return;
        const panel = currentPanels()[panelId];
        if (!panel) return;
        const placement = isHorizontalDockPlacement(panel.placement) ? panel.placement : 'dock-bottom';
        const nextDockSpan = panel.dockSpan === 'full' ? 'compact' : 'full';
        updateWorkspacePanel(panelId, { placement, dockSpan: nextDockSpan, minimized: false }, persist, true);
        showStatus(`BOTTOM HOTBAR ${nextDockSpan === 'full' ? 'FULL' : 'FIT'}`, 1100);
      }

      function syncContractPanelVisibility() { applyWorkspaceLayout(); }
      function setContractPanelCollapsed(collapsed, persist = true) { setWorkspacePanelOpen('contracts', !Boolean(collapsed), persist); }
      function toggleContractPanel() {
        if (STATE.mode !== 'BUILD' || STATE.uiCollapsed) return;
        setWorkspacePanelOpen('contracts', !currentPanels().contracts.open);
      }

      function closeTopmostWorkspacePanel() {
        const layoutId = currentLayoutId();
        const panelId = UIWorkspace.topPanel(STATE.uiWorkspace, id => panelVisibleInCurrentMode(id), { layoutId });
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

      function applyWorkspacePreset(presetId = 'beginner') {
        STATE.uiWorkspace = UIWorkspace.applyPreset(STATE.uiWorkspace, presetId);
        applyWorkspaceLayout();
        saveUIPreferences();
        showStatus(presetId === 'flight' ? 'FLIGHT HUD PRESET' : 'BUILD WORKBENCH PRESET', 1100);
      }

      function handlePanelWheel(event) {
        const region = event.currentTarget;
        const panelId = region?.getAttribute?.('data-panel-scroll');
        const panel = panelId ? currentPanels()[panelId] : null;
        const panelElement = region?.closest?.('[data-workspace-panel]');
        const placement = panel?.placement || panelElement?.dataset?.placement;
        const horizontalDock = Boolean(isHorizontalDockPlacement(placement) && region.scrollWidth > region.clientWidth);
        if (horizontalDock) {
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (delta) {
            const before = region.scrollLeft;
            region.scrollLeft += delta;
            if (region.scrollLeft !== before) event.preventDefault();
          }
        }
        event.stopPropagation();
      }

      function bindWorkspacePanels() {
        document.querySelectorAll('[data-panel-toggle]').forEach(button => {
          button.addEventListener('click', () => {
            const panelId = button.getAttribute('data-panel-toggle');
            if (!panelId || !panelAvailableInCurrentMode(panelId)) return;
            setWorkspacePanelOpen(panelId, !currentPanels()[panelId]?.open);
          });
        });
        document.querySelectorAll('[data-panel-close]').forEach(button => {
          button.addEventListener('click', () => setWorkspacePanelOpen(button.getAttribute('data-panel-close'), false));
        });
        document.querySelectorAll('[data-panel-minimize]').forEach(button => {
          button.addEventListener('click', () => {
            const panelId = button.getAttribute('data-panel-minimize');
            updateWorkspacePanel(panelId, { minimized: !currentPanels()[panelId]?.minimized }, true, true);
          });
        });
        document.querySelectorAll('[data-panel-span-toggle]').forEach(button => {
          button.addEventListener('click', () => togglePanelDockSpan(button.getAttribute('data-panel-span-toggle')));
        });
        document.querySelectorAll('[data-workspace-preset]').forEach(button => {
          button.addEventListener('click', () => applyWorkspacePreset(button.getAttribute('data-workspace-preset') || 'beginner'));
        });
        document.getElementById('btn-workspace-reset')?.addEventListener('click', resetWorkspaceLayout);
        document.querySelectorAll('[data-panel-scroll]').forEach(region => {
          region.addEventListener('wheel', handlePanelWheel, { passive: false });
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
            updateWorkspacePanel(panelId, { minimized: !currentPanels()[panelId]?.minimized }, true, true);
          });
          handle.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            if (currentPanels()[panelId]?.minimized) updateWorkspacePanel(panelId, { minimized: false }, true, true);
          });
          handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button')) return;
            if (currentPanels()[panelId]?.minimized) return;
            event.preventDefault();
            focusWorkspacePanel(panelId);
            const startX = event.clientX;
            const startY = event.clientY;
            const rect = element.getBoundingClientRect();
            let lastEvent = event;
            STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, {
              placement: 'floating',
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
              minimized: false
            }, { layoutId: currentLayoutId() });
            applyWorkspaceLayout();
            try { handle.setPointerCapture(event.pointerId); } catch (_) {}
            const move = moveEvent => {
              lastEvent = moveEvent;
              const fitted = UIWorkspace.fitPanelRect({
                ...currentPanels()[panelId],
                x: rect.left + moveEvent.clientX - startX,
                y: rect.top + moveEvent.clientY - startY,
                width: rect.width,
                height: rect.height,
                minimized: false
              }, { width: hostWindow.innerWidth || 1280, height: hostWindow.innerHeight || 720 }, { panelId, topInset: workspaceTopInset() });
              element.style.left = `${fitted.left}px`;
              element.style.top = `${fitted.top}px`;
              setDockPreview(dockPlacementFromPointer(moveEvent));
            };
            const end = () => {
              handle.removeEventListener('pointermove', move);
              handle.removeEventListener('pointerup', end);
              handle.removeEventListener('pointercancel', end);
              const finalRect = element.getBoundingClientRect();
              updateWorkspacePanel(panelId, {
                placement: dockPlacementFromPointer(lastEvent),
                x: finalRect.left,
                y: finalRect.top,
                width: finalRect.width,
                height: finalRect.height
              });
              setDockPreview('');
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
              const panel = currentPanels()[panelId];
              if (!panelId || !panel || element.hidden || panel.minimized) continue;
              const rect = element.getBoundingClientRect();
              if (Math.abs(panel.width - rect.width) < 0.5 && Math.abs(panel.height - rect.height) < 0.5) continue;
              STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, { width: rect.width, height: rect.height }, { layoutId: currentLayoutId() });
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
        setWorkspacePanelPlacement, togglePanelDockSpan, syncContractPanelVisibility, setContractPanelCollapsed, toggleContractPanel,
        closeTopmostWorkspacePanel, resetWorkspaceLayout, applyWorkspacePreset, bindWorkspacePanels
      });
    }

    return Object.freeze({ create });
  });
})();
