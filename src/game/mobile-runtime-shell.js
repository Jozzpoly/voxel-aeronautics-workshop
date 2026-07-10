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

  function syncBlocker(profile, blocker) {
    if (!blocker) return;
    if (profile.mobilePresentation) {
      blocker.hidden = true;
      blocker.setAttribute?.('aria-hidden', 'true');
      blocker.dataset.mobileAdapter = 'ready';
    } else {
      blocker.hidden = true;
      blocker.setAttribute?.('aria-hidden', 'true');
      blocker.dataset.mobileAdapter = 'desktop';
    }
  }

  function showFailure(blocker, error) {
    if (!blocker) return;
    blocker.hidden = false;
    blocker.setAttribute?.('aria-hidden', 'false');
    blocker.dataset.mobileAdapter = 'failed';
    const strong = blocker.querySelector?.('strong');
    const span = blocker.querySelector?.('span');
    if (strong) strong.textContent = 'Touch controls failed to initialize';
    if (span) span.textContent = `Desktop controls remain available. ${error?.message || error || ''}`.trim();
  }

  function create(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const blocker = options.blocker || documentLike?.getElementById?.('desktop-required') || null;
    let observer = null;
    let unsubscribe = null;
    let initialized = false;

    function apply(profile) {
      DeviceProfile.applyDocumentProfile(profile, documentLike);
      setViewportVariables(profile, documentLike);
      syncBlocker(profile, blocker);
      options.onProfileChanged?.(profile);
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
        unsubscribe = observer.subscribe(apply);
        initialized = true;
        return apply(observer.current());
      } catch (error) {
        showFailure(blocker, error);
        options.onError?.(error);
        return null;
      }
    }

    function destroy() {
      unsubscribe?.();
      unsubscribe = null;
      observer?.destroy?.();
      observer = null;
      initialized = false;
    }

    return Object.freeze({
      initialize,
      destroy,
      current: () => observer?.current?.() || null,
      refresh: () => observer?.refresh?.(),
      setOverride: value => observer?.setOverride?.(value) || null,
      initialized: () => initialized
    });
  }

  return Object.freeze({ setViewportVariables, syncBlocker, showFailure, create });
});
