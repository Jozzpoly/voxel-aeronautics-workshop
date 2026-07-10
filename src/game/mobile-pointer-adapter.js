'use strict';

(function registerMobilePointerAdapter(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-pointer-adapter.js.');
  root.VAW.define('game.mobile-pointer-adapter', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobilePointerAdapterModule() {
  function requireMethod(value, name) {
    if (typeof value !== 'function') throw new TypeError(`${name} must be a function.`);
    return value;
  }

  function create(options = {}) {
    const surface = options.surface;
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const controller = options.controller;
    if (!surface?.addEventListener || !surface?.removeEventListener) {
      throw new TypeError('Mobile pointer adapter requires an event surface.');
    }
    if (!windowLike?.addEventListener || !documentLike?.addEventListener) {
      throw new TypeError('Mobile pointer adapter requires window and document event targets.');
    }
    requireMethod(controller?.pointerDown, 'controller.pointerDown');
    requireMethod(controller?.pointerMove, 'controller.pointerMove');
    requireMethod(controller?.pointerUp, 'controller.pointerUp');
    requireMethod(controller?.cancelAll, 'controller.cancelAll');

    const enabledPolicy = typeof options.enabled === 'function' ? options.enabled : () => true;
    const resolveOwner = typeof options.resolveOwner === 'function' ? options.resolveOwner : () => 'canvas';
    let manualEnabled = true;
    let bound = false;
    const listeners = [];

    function isEnabled() {
      return manualEnabled && Boolean(enabledPolicy());
    }

    function isTouch(event) {
      return event?.pointerType === 'touch';
    }

    function sample(event, includeOwner = false) {
      const normalized = {
        pointerId: Number(event.pointerId),
        x: Number(event.clientX),
        y: Number(event.clientY)
      };
      if (includeOwner) normalized.owner = resolveOwner(event);
      return normalized;
    }

    function prevent(event) {
      event?.preventDefault?.();
    }

    function safelyCapture(pointerId) {
      try { surface.setPointerCapture?.(pointerId); } catch (_) {}
    }

    function safelyRelease(pointerId) {
      try {
        if (!surface.hasPointerCapture || surface.hasPointerCapture(pointerId)) surface.releasePointerCapture?.(pointerId);
      } catch (_) {}
    }

    function handlePointerDown(event) {
      if (!isTouch(event)) return;
      if (!isEnabled()) {
        controller.cancelAll('disabled');
        return;
      }
      const accepted = controller.pointerDown(sample(event, true));
      if (!accepted) return;
      safelyCapture(event.pointerId);
      prevent(event);
    }

    function handlePointerMove(event) {
      if (!isTouch(event)) return;
      if (!isEnabled()) {
        controller.cancelAll('disabled');
        return;
      }
      if (controller.pointerMove(sample(event))) prevent(event);
    }

    function handlePointerUp(event) {
      if (!isTouch(event)) return;
      if (!isEnabled()) {
        controller.cancelAll('disabled');
        safelyRelease(event.pointerId);
        return;
      }
      if (controller.pointerUp(sample(event))) prevent(event);
      safelyRelease(event.pointerId);
    }

    function handlePointerCancel(event) {
      if (!isTouch(event)) return;
      controller.cancelAll('pointercancel');
      safelyRelease(event.pointerId);
      prevent(event);
    }

    function handleLostPointerCapture(event) {
      if (!isTouch(event)) return;
      controller.cancelAll('lostpointercapture');
    }

    function handleWindowBlur() {
      controller.cancelAll('window-blur');
    }

    function handleVisibilityChange() {
      if (documentLike.hidden) controller.cancelAll('document-hidden');
    }

    function listen(target, name, callback, optionsValue) {
      target.addEventListener(name, callback, optionsValue);
      listeners.push([target, name, callback, optionsValue]);
    }

    function bind() {
      if (bound) return false;
      listen(surface, 'pointerdown', handlePointerDown, { passive: false });
      listen(surface, 'pointermove', handlePointerMove, { passive: false });
      listen(surface, 'pointerup', handlePointerUp, { passive: false });
      listen(surface, 'pointercancel', handlePointerCancel, { passive: false });
      listen(surface, 'lostpointercapture', handleLostPointerCapture, false);
      listen(windowLike, 'blur', handleWindowBlur, false);
      listen(documentLike, 'visibilitychange', handleVisibilityChange, false);
      bound = true;
      return true;
    }

    function setEnabled(value) {
      const next = Boolean(value);
      if (manualEnabled === next) return manualEnabled;
      manualEnabled = next;
      if (!manualEnabled) controller.cancelAll('disabled');
      return manualEnabled;
    }

    function destroy() {
      if (!bound) return false;
      controller.cancelAll('destroy');
      for (const [target, name, callback, optionsValue] of listeners.splice(0)) {
        target.removeEventListener(name, callback, optionsValue);
      }
      bound = false;
      return true;
    }

    return Object.freeze({
      bind,
      destroy,
      setEnabled,
      enabled: isEnabled,
      bound: () => bound
    });
  }

  return Object.freeze({ create });
});
