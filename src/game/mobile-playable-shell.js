'use strict';

(function registerMobilePlayableShell(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mobile-command-port.js'));
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-playable-shell.js.');
  root.VAW.define('game.mobile-playable-shell', ['game.mobile-command-port'], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobilePlayableShellModule(DefaultCommandPort) {
  const ROOT_ID = 'vaw-mobile-playable-shell';
  const STYLE_ID = 'vaw-mobile-playable-style';
  const ACTIVE_DATASET_KEY = 'vawPlayableMobile';
  const INTERACTION_MODES = Object.freeze(['place', 'remove']);

  const CSS = `
html[data-vaw-playable-mobile="active"] #ui-layer { display: none !important; }
html[data-vaw-playable-mobile="active"],
html[data-vaw-playable-mobile="active"] body {
  width: 100%;
  max-width: 100%;
  height: var(--vaw-viewport-height, 100dvh);
  overflow: hidden;
  overscroll-behavior: none;
}
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #f8fafc;
}
#${ROOT_ID}[hidden] { display: none !important; }
#${ROOT_ID} button {
  min-width: 48px;
  min-height: 48px;
  border: 1px solid rgba(100, 116, 139, 0.9);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em;
  touch-action: manipulation;
  pointer-events: auto;
}
#${ROOT_ID} button:disabled { opacity: 0.42; }
#${ROOT_ID} button[data-active="true"] {
  border-color: #22d3ee;
  background: rgba(8, 145, 178, 0.9);
  color: #ecfeff;
}
#${ROOT_ID} .vaw-mobile-topbar {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 8px);
  left: calc(env(safe-area-inset-left) + 8px);
  right: calc(env(safe-area-inset-right) + 8px);
  display: flex;
  align-items: stretch;
  gap: 6px;
  pointer-events: none;
}
#${ROOT_ID} .vaw-mobile-status {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid rgba(71, 85, 105, 0.88);
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.9);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}
#${ROOT_ID} .vaw-mobile-status strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
#${ROOT_ID} .vaw-mobile-status span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #94a3b8;
  font-size: 10px;
  margin-top: 3px;
}
#${ROOT_ID} .vaw-mobile-build-controls {
  position: absolute;
  left: calc(env(safe-area-inset-left) + 8px);
  right: calc(env(safe-area-inset-right) + 8px);
  bottom: calc(env(safe-area-inset-bottom) + 8px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
#${ROOT_ID} .vaw-mobile-action-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(48px, 1fr));
  gap: 6px;
  pointer-events: none;
}
#${ROOT_ID} .vaw-mobile-parts {
  display: flex;
  gap: 6px;
  padding: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  border: 1px solid rgba(71, 85, 105, 0.88);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.9);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
}
#${ROOT_ID} .vaw-mobile-parts::-webkit-scrollbar { display: none; }
#${ROOT_ID} .vaw-mobile-part {
  flex: 0 0 112px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  text-align: left;
}
#${ROOT_ID} .vaw-mobile-part-swatch {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 5px;
}
#${ROOT_ID} .vaw-mobile-part-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#${ROOT_ID} .vaw-mobile-flight-controls {
  position: absolute;
  left: calc(env(safe-area-inset-left) + 8px);
  right: calc(env(safe-area-inset-right) + 8px);
  bottom: calc(env(safe-area-inset-bottom) + 8px);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  pointer-events: none;
}
@media (orientation: landscape) and (max-height: 560px) {
  #${ROOT_ID} .vaw-mobile-build-controls {
    left: auto;
    width: min(58vw, 640px);
  }
  #${ROOT_ID} .vaw-mobile-part { flex-basis: 104px; }
}
`;

  function create(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const mobileContext = options.mobileContext;
    const commandPort = options.commandPort || DefaultCommandPort;
    if (!documentLike?.createElement || !documentLike?.body || !documentLike?.documentElement) {
      throw new TypeError('Mobile playable shell requires a browser document.');
    }
    if (!mobileContext || typeof mobileContext.currentProfile !== 'function') {
      throw new TypeError('Mobile playable shell requires mobileContext.currentProfile().');
    }
    if (!commandPort || typeof commandPort.current !== 'function' || typeof commandPort.subscribe !== 'function') {
      throw new TypeError('Mobile playable shell requires a mobile command port.');
    }

    let started = false;
    let destroyed = false;
    let active = false;
    let interactionMode = 'place';
    let root = null;
    let style = null;
    let statusTitle = null;
    let statusDetail = null;
    let buildControls = null;
    let flightControls = null;
    let partsRail = null;
    let placeButton = null;
    let removeButton = null;
    let undoButton = null;
    let redoButton = null;
    let launchButton = null;
    let unsubscribeProfile = null;
    let unsubscribeCommands = null;
    let lastSnapshot = null;

    function currentProfile() {
      return mobileContext.currentProfile?.() || null;
    }

    function currentCommands() {
      return commandPort.current?.() || null;
    }

    function safeSnapshot() {
      if (!currentCommands()) return null;
      try { return commandPort.session.snapshot(); }
      catch (error) {
        options.onError?.(error, { phase: 'session-snapshot' });
        return null;
      }
    }

    function button(label, action, className = '') {
      const element = documentLike.createElement('button');
      element.type = 'button';
      element.textContent = label;
      if (className) element.className = className;
      element.addEventListener('click', action);
      return element;
    }

    function ensureStyle() {
      style = documentLike.getElementById?.(STYLE_ID) || null;
      if (style) return style;
      style = documentLike.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (documentLike.head || documentLike.body).appendChild(style);
      return style;
    }

    function setStatus(title, detail) {
      if (statusTitle) statusTitle.textContent = String(title || 'VAW MOBILE');
      if (statusDetail) statusDetail.textContent = String(detail || '');
    }

    function runCommand(action, phase) {
      try {
        const result = action();
        refresh();
        return result;
      } catch (error) {
        setStatus('ACTION FAILED', error?.message || String(error));
        options.onError?.(error, { phase });
        return false;
      }
    }

    function selectPart(partId) {
      return runCommand(() => commandPort.build.selectPart(partId), 'select-part');
    }

    function setInteractionMode(value) {
      const next = INTERACTION_MODES.includes(value) ? value : 'place';
      if (interactionMode === next) return false;
      interactionMode = next;
      refresh();
      return true;
    }

    function buildPartButtons() {
      if (!partsRail) return;
      partsRail.replaceChildren?.();
      if (!currentCommands()) return;
      let catalog = [];
      try { catalog = commandPort.build.catalog(); }
      catch (error) {
        options.onError?.(error, { phase: 'catalog' });
        return;
      }
      for (const part of catalog) {
        const partButton = button('', () => selectPart(part.id), 'vaw-mobile-part');
        partButton.dataset.partId = part.id;
        partButton.setAttribute('aria-label', `Select ${part.label}`);
        const swatch = documentLike.createElement('span');
        swatch.className = 'vaw-mobile-part-swatch';
        swatch.style.background = part.color;
        const label = documentLike.createElement('span');
        label.className = 'vaw-mobile-part-label';
        label.textContent = part.label;
        partButton.appendChild(swatch);
        partButton.appendChild(label);
        partsRail.appendChild(partButton);
      }
    }

    function ensureDom() {
      if (root) return root;
      ensureStyle();
      root = documentLike.createElement('div');
      root.id = ROOT_ID;
      root.hidden = true;
      root.setAttribute('aria-label', 'Mobile game controls');

      const topbar = documentLike.createElement('div');
      topbar.className = 'vaw-mobile-topbar';
      const status = documentLike.createElement('div');
      status.className = 'vaw-mobile-status';
      statusTitle = documentLike.createElement('strong');
      statusDetail = documentLike.createElement('span');
      status.appendChild(statusTitle);
      status.appendChild(statusDetail);
      topbar.appendChild(status);
      undoButton = button('UNDO', () => runCommand(() => commandPort.build.undo(), 'undo'));
      redoButton = button('REDO', () => runCommand(() => commandPort.build.redo(), 'redo'));
      launchButton = button('LAUNCH', () => runCommand(() => commandPort.session.launch(), 'launch'));
      topbar.appendChild(undoButton);
      topbar.appendChild(redoButton);
      topbar.appendChild(launchButton);
      root.appendChild(topbar);

      buildControls = documentLike.createElement('div');
      buildControls.className = 'vaw-mobile-build-controls';
      const actionRow = documentLike.createElement('div');
      actionRow.className = 'vaw-mobile-action-row';
      placeButton = button('PLACE', () => setInteractionMode('place'));
      removeButton = button('REMOVE', () => setInteractionMode('remove'));
      actionRow.appendChild(placeButton);
      actionRow.appendChild(removeButton);
      actionRow.appendChild(button('ROTATE −', () => runCommand(() => commandPort.build.rotate(-1), 'rotate-left')));
      actionRow.appendChild(button('ROTATE +', () => runCommand(() => commandPort.build.rotate(1), 'rotate-right')));
      actionRow.appendChild(button('UNDO', () => runCommand(() => commandPort.build.undo(), 'undo')));
      actionRow.appendChild(button('REDO', () => runCommand(() => commandPort.build.redo(), 'redo')));
      buildControls.appendChild(actionRow);
      partsRail = documentLike.createElement('div');
      partsRail.className = 'vaw-mobile-parts';
      partsRail.setAttribute('role', 'listbox');
      partsRail.setAttribute('aria-label', 'Build parts');
      buildControls.appendChild(partsRail);
      root.appendChild(buildControls);

      flightControls = documentLike.createElement('div');
      flightControls.className = 'vaw-mobile-flight-controls';
      flightControls.appendChild(button('RETURN TO WORKSHOP', () => runCommand(() => commandPort.session.returnToWorkshop(), 'return-to-workshop')));
      flightControls.appendChild(button('SAFE RESET', () => runCommand(() => commandPort.session.reset(), 'safe-reset')));
      root.appendChild(flightControls);

      documentLike.body.appendChild(root);
      return root;
    }

    function syncPartSelection(selectedPart) {
      if (!partsRail) return;
      for (const element of partsRail.children || []) {
        const selected = element.dataset?.partId === selectedPart;
        element.dataset.active = String(selected);
        element.setAttribute?.('aria-selected', String(selected));
      }
    }

    function refresh() {
      ensureDom();
      active = Boolean(currentProfile()?.mobilePresentation);
      root.hidden = !active;
      if (active) documentLike.documentElement.dataset[ACTIVE_DATASET_KEY] = 'active';
      else delete documentLike.documentElement.dataset[ACTIVE_DATASET_KEY];

      lastSnapshot = safeSnapshot();
      const ready = Boolean(lastSnapshot);
      const mode = lastSnapshot?.mode || 'UNAVAILABLE';
      const inBuild = active && ready && mode === 'BUILD';
      const inFlight = active && ready && mode === 'FLIGHT';
      buildControls.hidden = !inBuild;
      flightControls.hidden = !inFlight;
      undoButton.hidden = !inBuild;
      redoButton.hidden = !inBuild;
      launchButton.hidden = !inBuild;
      launchButton.disabled = !inBuild || Number(lastSnapshot?.craftSize || 0) < 1;
      placeButton.dataset.active = String(interactionMode === 'place');
      removeButton.dataset.active = String(interactionMode === 'remove');

      if (!ready) {
        setStatus('MOBILE CONTROLS', 'Waiting for game composition…');
      } else if (inBuild) {
        setStatus(
          interactionMode === 'place' ? `PLACE • ${lastSnapshot.selectedPart}` : 'REMOVE MODE',
          `${lastSnapshot.craftSize} part${lastSnapshot.craftSize === 1 ? '' : 's'} • drag to orbit • pinch to zoom`
        );
      } else if (inFlight) {
        setStatus('FLIGHT', 'Touch flight controls are the next vertical slice');
      } else {
        setStatus(mode, 'Mobile controls unavailable in this mode');
      }
      syncPartSelection(lastSnapshot?.selectedPart);
      return snapshot();
    }

    function tapEnabled() {
      const state = lastSnapshot || safeSnapshot();
      return Boolean(active && currentCommands() && state?.mode === 'BUILD' && INTERACTION_MODES.includes(interactionMode));
    }

    function handleCanvasTap(sample = {}) {
      if (!tapEnabled()) return false;
      const x = Number(sample.x);
      const y = Number(sample.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      const action = interactionMode === 'remove'
        ? () => commandPort.build.removeAtScreen(x, y)
        : () => commandPort.build.placeAtScreen(x, y);
      const result = runCommand(action, interactionMode === 'remove' ? 'remove-tap' : 'place-tap');
      if (result && windowLike?.navigator?.vibrate) {
        try { windowLike.navigator.vibrate(interactionMode === 'remove' ? 18 : 10); } catch (_) {}
      }
      return Boolean(result);
    }

    function snapshot() {
      return Object.freeze({
        active,
        ready: Boolean(currentCommands()),
        interactionMode,
        session: lastSnapshot ? Object.freeze({ ...lastSnapshot }) : null,
        started,
        destroyed
      });
    }

    function start() {
      if (destroyed) throw new Error('Destroyed mobile playable shell cannot be restarted.');
      if (started) return false;
      started = true;
      ensureDom();
      if (typeof mobileContext.subscribe === 'function') {
        unsubscribeProfile = mobileContext.subscribe(() => refresh());
      }
      unsubscribeCommands = commandPort.subscribe(() => {
        buildPartButtons();
        refresh();
      });
      buildPartButtons();
      refresh();
      return true;
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      started = false;
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      unsubscribeCommands?.();
      unsubscribeCommands = null;
      delete documentLike.documentElement.dataset[ACTIVE_DATASET_KEY];
      root?.remove?.();
      root = null;
      style?.remove?.();
      style = null;
      active = false;
      lastSnapshot = null;
      return true;
    }

    return Object.freeze({
      start,
      destroy,
      refresh,
      tapEnabled,
      handleCanvasTap,
      setInteractionMode,
      snapshot,
      root: () => root
    });
  }

  return Object.freeze({
    create,
    ROOT_ID,
    STYLE_ID,
    ACTIVE_DATASET_KEY,
    INTERACTION_MODES,
    CSS
  });
});
