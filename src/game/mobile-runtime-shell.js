'use strict';

(function registerMobileRuntimeShell(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mobile-device-profile.js'));
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-runtime-shell.js.');
  root.VAW.define('game.mobile-runtime-shell', ['game.mobile-device-profile'], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileRuntimeShellModule(DeviceProfile) {
  function setViewportVariables(profile, documentLike) {
    const root = documentLike?.documentElement;
    if (!root?.style) return;
    root.style.setProperty('--vaw-viewport-width', `${Math.max(0, profile.width)}px`);
    root.style.setProperty('--vaw-viewport-height', `${Math.max(0, profile.height)}px`);
  }

  function setBlockerVisibility(blocker, visible, state) {
    if (!blocker) return;
    blocker.hidden = !visible;
    blocker.style?.setProperty?.('display', visible ? 'flex' : 'none');
    blocker.setAttribute?.('aria-hidden', visible ? 'false' : 'true');
    blocker.dataset.mobileAdapter = state;
  }

  function syncBlocker(profile, blocker) {
    setBlockerVisibility(blocker, false, profile.mobilePresentation ? 'ready' : 'desktop');
  }

  function showFailure(blocker, error) {
    if (!blocker) return;
    setBlockerVisibility(blocker, true, 'failed');
    const strong = blocker.querySelector?.('strong');
    const span = blocker.querySelector?.('span');
    if (strong) strong.textContent = 'Touch controls failed to initialize';
    if (span) span.textContent = `Desktop controls remain available. ${error?.message || error || ''}`.trim();
  }

  function create(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const blocker = options.blocker || documentLike?.getElementById?.('desktop-required') || null;
    const profileListeners = new Set();
    let observer = null;
    let unsubscribeObserver = null;
    let initialized = false;

    function apply(profile) {
      if (!profile) throw new Error('Mobile runtime shell received an empty device profile.');
      DeviceProfile.applyDocumentProfile(profile, documentLike);
      setViewportVariables(profile, documentLike);
      syncBlocker(profile, blocker);
      options.onProfileChanged?.(profile);
      for (const listener of [...profileListeners]) listener(profile);
      return profile;
    }

    function initialize() {
      if (initialized) return observer?.current?.() || null;
      try {
        observer = DeviceProfile.createObserver({
          window: windowLike,
          document: documentLike,
          storage: options.storage || windowLike?.localStorage || null
        });
        unsubscribeObserver = observer.subscribe(apply);
        const profile = apply(observer.current());
        initialized = true;
        return profile;
      } catch (error) {
        unsubscribeObserver?.();
        unsubscribeObserver = null;
        observer?.destroy?.();
        observer = null;
        initialized = false;
        showFailure(blocker, error);
        options.onError?.(error);
        return null;
      }
    }

    function subscribe(listener, subscribeOptions = {}) {
      if (typeof listener !== 'function') return () => {};
      profileListeners.add(listener);
      const profile = observer?.current?.() || null;
      if (subscribeOptions.emitCurrent !== false && profile) listener(profile);
      return () => profileListeners.delete(listener);
    }

    function destroy() {
      unsubscribeObserver?.();
      unsubscribeObserver = null;
      observer?.destroy?.();
      observer = null;
      profileListeners.clear();
      initialized = false;
    }

    return Object.freeze({
      initialize,
      destroy,
      subscribe,
      current: () => observer?.current?.() || null,
      refresh: () => observer?.refresh?.(),
      setOverride: value => observer?.setOverride?.(value) || null,
      initialized: () => initialized
    });
  }

  return Object.freeze({ setViewportVariables, setBlockerVisibility, syncBlocker, showFailure, create });
});
