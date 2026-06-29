(() => {
  'use strict';

  window.VAW.define('game.visual-asset-dev-controls', [], () => {
    function create({ visualAssetLoader, visualAssetRegistry, blockTypes = null, showStatus = () => {}, logger = console, document = null, window = null, buttonId = 'btn-reload-visual-assets', debugButtonId = 'btn-visual-debug-toggle' } = {}) {
      if (!visualAssetLoader?.reloadInstalledPacks) throw new TypeError('Visual asset dev controls require a visual asset loader.');
      const types = Array.isArray(blockTypes) ? Object.freeze(Array.from(blockTypes)) : undefined;
      let debugVisualsVisible = Boolean(visualAssetLoader.debugVisualsVisible?.());
      let broadcastChannel = null;
      let disposed = false;
      const ownerToken = {};
      const removers = [];
      function rememberListener(target, type, handler) {
        target?.addEventListener?.(type, handler);
        if (target?.removeEventListener) removers.push(() => target.removeEventListener(type, handler));
      }
      function canUseBroadcastChannel(targetWindow) {
        if (!targetWindow || typeof targetWindow.BroadcastChannel !== 'function') return false;
        return !(targetWindow === globalThis && typeof process !== 'undefined' && process.versions?.node);
      }
      function diagnostics() {
        return Object.freeze({
          coverage: visualAssetLoader.coverage(types),
          loader: visualAssetLoader.diagnostics(),
          registry: visualAssetRegistry?.diagnostics?.() || Object.freeze([])
        });
      }
      async function reload() {
        if (disposed) return null;
        showStatus('RELOADING VISUAL ASSETS', 1400);
        try {
          const result = await visualAssetLoader.reloadInstalledPacks();
          const active = visualAssetLoader.coverage(types).filter(item => item.assetId);
          logger?.info?.('VAW visual assets reloaded', { result, active, diagnostics: diagnostics() });
          showStatus(`VISUALS RELOADED: ${active.length} BLOCK TYPES`, 2200);
          return result;
        } catch (error) {
          logger?.warn?.('Visual asset reload failed; procedural fallback remains active.', error);
          showStatus('VISUAL RELOAD FALLBACK ACTIVE', 2200);
          return null;
        }
      }
      function updateDebugButton(button = document?.getElementById?.(debugButtonId)) {
        if (!button) return;
        button.textContent = debugVisualsVisible ? 'VISUAL DEBUG ON' : 'VISUAL DEBUG OFF';
        button.setAttribute?.('aria-pressed', debugVisualsVisible ? 'true' : 'false');
        button.title = debugVisualsVisible
          ? 'Hide renderer-only visual debug hit proxies'
          : 'Show renderer-only visual debug hit proxies';
      }
      function setDebugVisualsVisible(enabled) {
        if (disposed) return debugVisualsVisible;
        debugVisualsVisible = Boolean(visualAssetLoader.setDebugVisualsVisible?.(enabled));
        updateDebugButton();
        showStatus(debugVisualsVisible ? 'VISUAL DEBUG ON' : 'VISUAL DEBUG OFF', 1200);
        return debugVisualsVisible;
      }
      const reloadButton = document?.getElementById?.(buttonId);
      if (reloadButton) rememberListener(reloadButton, 'click', () => { reload(); });
      const debugButton = document?.getElementById?.(debugButtonId);
      if (debugButton) rememberListener(debugButton, 'click', () => { setDebugVisualsVisible(!debugVisualsVisible); });
      updateDebugButton(debugButton);
      if (window) {
        const debugApi = Object.freeze({
          setVisible: setDebugVisualsVisible,
          visible: () => debugVisualsVisible,
          owner: ownerToken
        });
        window.VAW_VISUAL_ASSET_DIAGNOSTICS = diagnostics;
        window.VAW_VISUAL_ASSET_DEBUG = debugApi;
        if (canUseBroadcastChannel(window)) {
          try {
            broadcastChannel = new window.BroadcastChannel('vaw-visual-assets');
            broadcastChannel.unref?.();
            rememberListener(broadcastChannel, 'message', event => {
              const data = event?.data || {};
              if (data.type !== 'visual-block-installed' && data.type !== 'visual-assets-updated') return;
              logger?.info?.('VAW visual asset install event received', data);
              reload();
            });
          } catch (error) {
            logger?.warn?.('Visual asset BroadcastChannel unavailable; manual reload remains available.', error);
          }
        }
        rememberListener(window, 'keydown', event => {
          if (event.repeat || !event.shiftKey) return;
          if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
          const key = String(event.key || '').toLowerCase();
          if (key === 'v') {
            event.preventDefault();
            reload();
          }
          if (key === 'd') {
            event.preventDefault();
            setDebugVisualsVisible(!debugVisualsVisible);
          }
        });
      }
      function dispose() {
        if (disposed) return;
        disposed = true;
        while (removers.length) {
          try { removers.pop()(); } catch (_) { /* Dev controls cleanup must never block the game. */ }
        }
        try { broadcastChannel?.close?.(); } catch (_) { /* BroadcastChannel cleanup is best-effort. */ }
        broadcastChannel = null;
        if (window?.VAW_VISUAL_ASSET_DIAGNOSTICS === diagnostics) delete window.VAW_VISUAL_ASSET_DIAGNOSTICS;
        if (window?.VAW_VISUAL_ASSET_DEBUG?.owner === ownerToken) delete window.VAW_VISUAL_ASSET_DEBUG;
      }
      return Object.freeze({ diagnostics, reload, setDebugVisualsVisible, dispose, broadcastChannel });
    }
    return Object.freeze({ create });
  });
})();
