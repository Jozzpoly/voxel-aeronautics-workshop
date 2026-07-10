'use strict';

(function registerMobileDeviceProfile(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./storage_capability.js'));
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-device-profile.js.');
  root.VAW.define('game.mobile-device-profile', ['game.storage-capability'], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileDeviceProfileModule(StorageCapability) {
  const OVERRIDE_KEY = 'vaw.mobile.presentationOverride';
  const VALID_OVERRIDES = new Set(['auto', 'mobile', 'desktop']);

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function normalizeOverride(value) {
    const normalized = String(value || 'auto').toLowerCase();
    return VALID_OVERRIDES.has(normalized) ? normalized : 'auto';
  }

  function readOverride(storage) {
    try { return normalizeOverride(storage?.getItem?.(OVERRIDE_KEY)); }
    catch (_) { return 'auto'; }
  }

  function writeOverride(storage, value) {
    const normalized = normalizeOverride(value);
    try { storage?.setItem?.(OVERRIDE_KEY, normalized); } catch (_) {}
    return normalized;
  }

  function classify(input = {}) {
    const width = Math.max(0, finite(input.width));
    const height = Math.max(0, finite(input.height));
    const shortestSide = Math.min(width || Infinity, height || Infinity);
    const coarsePointer = Boolean(input.coarsePointer);
    const hoverNone = Boolean(input.hoverNone);
    const maxTouchPoints = Math.max(0, finite(input.maxTouchPoints));
    const touchCapable = maxTouchPoints > 0 || coarsePointer;
    const compactViewport = width > 0 && height > 0 && (shortestSide <= 760 || width <= 900);
    const phoneViewport = width > 0 && height > 0 && shortestSide <= 560;
    const orientation = width >= height ? 'landscape' : 'portrait';
    const override = normalizeOverride(input.override);
    const autoMobile = touchCapable && (compactViewport || hoverNone);
    const mobilePresentation = override === 'mobile' || (override === 'auto' && autoMobile);

    return Object.freeze({
      width, height,
      shortestSide: Number.isFinite(shortestSide) ? shortestSide : 0,
      orientation, coarsePointer, hoverNone, maxTouchPoints,
      touchCapable, compactViewport, phoneViewport, override,
      mobilePresentation,
      desktopPresentation: !mobilePresentation
    });
  }

  function detect(environment = {}) {
    const windowLike = environment.window || (typeof window !== 'undefined' ? window : null);
    const navigatorLike = environment.navigator || windowLike?.navigator || null;
    const storage = Object.prototype.hasOwnProperty.call(environment, 'storage')
      ? StorageCapability.from(environment.storage, { persistent: true })
      : StorageCapability.forWindow(windowLike);
    const matchMedia = environment.matchMedia || windowLike?.matchMedia?.bind(windowLike);
    const viewport = windowLike?.visualViewport;
    const mediaMatches = query => {
      try { return Boolean(matchMedia?.(query)?.matches); } catch (_) { return false; }
    };
    return classify({
      width: finite(environment.width, viewport?.width || windowLike?.innerWidth || 0),
      height: finite(environment.height, viewport?.height || windowLike?.innerHeight || 0),
      maxTouchPoints: environment.maxTouchPoints ?? navigatorLike?.maxTouchPoints ?? 0,
      coarsePointer: environment.coarsePointer ?? mediaMatches('(pointer: coarse)'),
      hoverNone: environment.hoverNone ?? mediaMatches('(hover: none)'),
      override: environment.override ?? readOverride(storage)
    });
  }

  function applyDocumentProfile(profile, documentLike) {
    const root = documentLike?.documentElement;
    if (!root) return profile;
    root.dataset.vawPresentation = profile.mobilePresentation ? 'mobile' : 'desktop';
    root.dataset.vawTouch = profile.touchCapable ? 'capable' : 'none';
    root.dataset.vawViewport = profile.phoneViewport ? 'phone' : (profile.compactViewport ? 'compact' : 'wide');
    root.dataset.vawOrientation = profile.orientation;
    root.classList?.toggle?.('vaw-mobile-presentation', profile.mobilePresentation);
    root.classList?.toggle?.('vaw-touch-capable', profile.touchCapable);
    return profile;
  }

  function createObserver(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const storage = Object.prototype.hasOwnProperty.call(options, 'storage')
      ? StorageCapability.from(options.storage, { persistent: true })
      : StorageCapability.forWindow(windowLike);
    const listeners = new Set();
    let profile = applyDocumentProfile(detect({ window: windowLike, storage }), documentLike);
    let scheduled = false;

    const emit = () => {
      scheduled = false;
      const next = applyDocumentProfile(detect({ window: windowLike, storage }), documentLike);
      const changed = JSON.stringify(next) !== JSON.stringify(profile);
      profile = next;
      if (changed) for (const listener of listeners) listener(profile);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      const raf = windowLike?.requestAnimationFrame || (callback => setTimeout(callback, 0));
      raf(emit);
    };

    windowLike?.addEventListener?.('resize', schedule, { passive: true });
    windowLike?.addEventListener?.('orientationchange', schedule, { passive: true });
    windowLike?.visualViewport?.addEventListener?.('resize', schedule, { passive: true });

    return Object.freeze({
      current: () => profile,
      refresh: emit,
      subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setOverride(value) {
        writeOverride(storage, value);
        emit();
        return profile;
      },
      destroy() {
        listeners.clear();
        windowLike?.removeEventListener?.('resize', schedule);
        windowLike?.removeEventListener?.('orientationchange', schedule);
        windowLike?.visualViewport?.removeEventListener?.('resize', schedule);
      }
    });
  }

  return Object.freeze({
    OVERRIDE_KEY,
    VALID_OVERRIDES: Object.freeze([...VALID_OVERRIDES]),
    normalizeOverride, readOverride, writeOverride,
    classify, detect, applyDocumentProfile, createObserver
  });
});
