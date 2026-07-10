'use strict';

(function registerMobileFlightControls(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mobile-command-port.js'));
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-flight-controls.js.');
  root.VAW.define('game.mobile-flight-controls', ['game.mobile-command-port'], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileFlightControlsModule(DefaultCommandPort) {
  const ROOT_ID = 'vaw-mobile-flight-input';
  const STYLE_ID = 'vaw-mobile-flight-input-style';
  const DEADZONE = 0.28;
  const STICK_ACTIONS = Object.freeze({
    left: Object.freeze({ xNegative: 'sway-', xPositive: 'sway+', yNegative: 'surge+', yPositive: 'surge-' }),
    right: Object.freeze({ xNegative: 'yaw+', xPositive: 'yaw-', yNegative: 'pitch+', yPositive: 'pitch-' })
  });
  const HOLD_ACTIONS = Object.freeze([
    Object.freeze({ action: 'heave+', label: 'LIFT +' }),
    Object.freeze({ action: 'heave-', label: 'LIFT −' }),
    Object.freeze({ action: 'roll-', label: 'ROLL L' }),
    Object.freeze({ action: 'roll+', label: 'ROLL R' })
  ]);

  const CSS = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 74;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
#${ROOT_ID}[hidden] { display: none !important; }
#${ROOT_ID} .vaw-flight-stick {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom) + 72px);
  width: clamp(104px, 28vw, 140px);
  aspect-ratio: 1;
  border: 1px solid rgba(100, 116, 139, 0.94);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(30, 41, 59, 0.62) 0 30%, rgba(2, 6, 23, 0.9) 72%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.13), 0 8px 24px rgba(2, 6, 23, 0.42);
  backdrop-filter: blur(8px);
  touch-action: none;
  pointer-events: auto;
}
#${ROOT_ID} .vaw-flight-stick[data-stick="left"] { left: calc(env(safe-area-inset-left) + 8px); }
#${ROOT_ID} .vaw-flight-stick[data-stick="right"] { right: calc(env(safe-area-inset-right) + 8px); }
#${ROOT_ID} .vaw-flight-stick::before,
#${ROOT_ID} .vaw-flight-stick::after {
  content: '';
  position: absolute;
  background: rgba(148, 163, 184, 0.22);
  pointer-events: none;
}
#${ROOT_ID} .vaw-flight-stick::before { left: 50%; top: 12%; bottom: 12%; width: 1px; }
#${ROOT_ID} .vaw-flight-stick::after { top: 50%; left: 12%; right: 12%; height: 1px; }
#${ROOT_ID} .vaw-flight-stick-label {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  color: #94a3b8;
  font: 700 9px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.08em;
  pointer-events: none;
}
#${ROOT_ID} .vaw-flight-stick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 42%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(103, 232, 249, 0.9);
  border-radius: 50%;
  background: rgba(8, 145, 178, 0.76);
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.28);
  pointer-events: none;
}
#${ROOT_ID} .vaw-flight-actions {
  position: absolute;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 76px);
  width: 126px;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  pointer-events: none;
}
#${ROOT_ID} .vaw-flight-action {
  min-width: 56px;
  min-height: 48px;
  padding: 6px 4px;
  border: 1px solid rgba(100, 116, 139, 0.94);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  font: 700 10px/1 ui-sans-serif, system-ui, sans-serif;
  touch-action: none;
  pointer-events: auto;
}
#${ROOT_ID} .vaw-flight-action[data-active="true"] {
  border-color: #22d3ee;
  background: rgba(8, 145, 178, 0.92);
  color: #ecfeff;
}
@media (orientation: landscape) and (max-height: 560px) {
  #${ROOT_ID} .vaw-flight-stick {
    bottom: calc(env(safe-area-inset-bottom) + 62px);
    width: clamp(100px, 25vh, 126px);
  }
  #${ROOT_ID} .vaw-flight-actions {
    bottom: calc(env(safe-area-inset-bottom) + 64px);
  }
}
`;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function create(options = {}) {
    const windowLike = options.window || (typeof window !== 'undefined' ? window : null);
    const documentLike = options.document || windowLike?.document || null;
    const mobileContext = options.mobileContext;
    const commandPort = options.commandPort || DefaultCommandPort;
    if (!documentLike?.createElement || !documentLike?.body || !documentLike?.documentElement) {
      throw new TypeError('Mobile flight controls require a browser document.');
    }
    if (!windowLike?.addEventListener || !documentLike?.addEventListener) {
      throw new TypeError('Mobile flight controls require window and document event targets.');
    }
    if (!mobileContext || typeof mobileContext.currentProfile !== 'function') {
      throw new TypeError('Mobile flight controls require mobileContext.currentProfile().');
    }
    if (!commandPort || typeof commandPort.current !== 'function' || typeof commandPort.subscribe !== 'function' || typeof commandPort.subscribeActivity !== 'function') {
      throw new TypeError('Mobile flight controls require a mobile command port with activity subscriptions.');
    }

    const deadzone = Number(options.deadzone ?? DEADZONE);
    if (!Number.isFinite(deadzone) || deadzone < 0 || deadzone >= 1) {
      throw new RangeError('Mobile flight control deadzone must be finite in [0, 1).');
    }

    let root = null;
    let style = null;
    let actionsRoot = null;
    let started = false;
    let destroyed = false;
    let active = false;
    let unsubscribeProfile = null;
    let unsubscribeCommands = null;
    let unsubscribeActivity = null;
    const stickElements = new Map();
    const stickKnobs = new Map();
    const stickPointers = new Map();
    const holdButtons = new Map();
    const holdPointers = new Map();
    const ownerActions = new Map();
    const actionOwners = new Map();

    function reportError(error, phase) {
      try { options.onError?.(error, { phase }); }
      catch (reportingError) { console.error('[mobile-flight-controls] error reporter failed.', reportingError, error); }
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

    function prevent(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
    }

    function safeCapture(element, pointerId) {
      try { element?.setPointerCapture?.(pointerId); } catch (_) {}
    }

    function safeRelease(element, pointerId) {
      try {
        if (!element?.hasPointerCapture || element.hasPointerCapture(pointerId)) element?.releasePointerCapture?.(pointerId);
      } catch (_) {}
    }

    function currentSession() {
      if (!commandPort.current()) return null;
      try { return commandPort.session.snapshot(); }
      catch (error) {
        reportError(error, 'session-snapshot');
        return null;
      }
    }

    function command(action, activeValue) {
      if (!commandPort.current()) return false;
      try { return Boolean(commandPort.flight.setAction(action, activeValue)); }
      catch (error) {
        reportError(error, 'set-action');
        return false;
      }
    }

    function syncDiagnostics() {
      if (!root) return;
      root.dataset.activeActions = [...actionOwners.keys()].sort().join(',');
      try { options.onChanged?.(snapshot()); }
      catch (error) { reportError(error, 'changed-callback'); }
    }

    function setOwnerActions(owner, requestedActions) {
      const next = new Set(requestedActions);
      const previous = ownerActions.get(owner) || new Set();

      for (const action of previous) {
        if (next.has(action)) continue;
        const owners = actionOwners.get(action);
        owners?.delete(owner);
        if (!owners?.size) {
          actionOwners.delete(action);
          command(action, false);
        }
      }

      for (const action of next) {
        if (previous.has(action)) continue;
        let owners = actionOwners.get(action);
        if (!owners) {
          owners = new Set();
          actionOwners.set(action, owners);
        }
        const wasInactive = owners.size === 0;
        owners.add(owner);
        if (wasInactive) command(action, true);
      }

      if (next.size) ownerActions.set(owner, next);
      else ownerActions.delete(owner);
      syncDiagnostics();
    }

    function resetStickVisual(kind) {
      const knob = stickKnobs.get(kind);
      if (knob?.style) knob.style.transform = 'translate(-50%, -50%)';
    }

    function releaseStick(kind, reason = 'release') {
      const record = stickPointers.get(kind);
      if (!record) return false;
      stickPointers.delete(kind);
      safeRelease(record.element, record.pointerId);
      setOwnerActions(`stick:${kind}`, []);
      resetStickVisual(kind);
      try { options.onPointerReleased?.({ kind, reason, pointerId: record.pointerId }); }
      catch (error) { reportError(error, 'pointer-release-callback'); }
      return true;
    }

    function stickActions(kind, normalizedX, normalizedY) {
      const mapping = STICK_ACTIONS[kind];
      const result = [];
      if (normalizedX <= -deadzone) result.push(mapping.xNegative);
      else if (normalizedX >= deadzone) result.push(mapping.xPositive);
      if (normalizedY <= -deadzone) result.push(mapping.yNegative);
      else if (normalizedY >= deadzone) result.push(mapping.yPositive);
      return result;
    }

    function updateStick(kind, event) {
      const record = stickPointers.get(kind);
      if (!record || Number(event.pointerId) !== record.pointerId) return false;
      const rect = record.element.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
      const normalizedX = clamp((Number(event.clientX) - (rect.left + rect.width / 2)) / radius, -1, 1);
      const normalizedY = clamp((Number(event.clientY) - (rect.top + rect.height / 2)) / radius, -1, 1);
      const travel = radius * 0.52;
      const knob = stickKnobs.get(kind);
      if (knob?.style) knob.style.transform = `translate(calc(-50% + ${normalizedX * travel}px), calc(-50% + ${normalizedY * travel}px))`;
      setOwnerActions(`stick:${kind}`, stickActions(kind, normalizedX, normalizedY));
      prevent(event);
      return true;
    }

    function beginStick(kind, event) {
      if (!active || stickPointers.has(kind)) return false;
      const pointerId = Number(event.pointerId);
      if (!Number.isFinite(pointerId)) return false;
      const element = stickElements.get(kind);
      stickPointers.set(kind, { pointerId, element });
      safeCapture(element, pointerId);
      updateStick(kind, event);
      prevent(event);
      return true;
    }

    function beginHold(action, event) {
      if (!active || holdPointers.has(action)) return false;
      const pointerId = Number(event.pointerId);
      if (!Number.isFinite(pointerId)) return false;
      const element = holdButtons.get(action);
      holdPointers.set(action, { pointerId, element });
      element.dataset.active = 'true';
      safeCapture(element, pointerId);
      setOwnerActions(`hold:${action}`, [action]);
      prevent(event);
      return true;
    }

    function releaseHold(action, event, reason = 'release') {
      const record = holdPointers.get(action);
      if (!record || (event && Number(event.pointerId) !== record.pointerId)) return false;
      holdPointers.delete(action);
      safeRelease(record.element, record.pointerId);
      if (record.element?.dataset) record.element.dataset.active = 'false';
      setOwnerActions(`hold:${action}`, []);
      try { options.onPointerReleased?.({ action, reason, pointerId: record.pointerId }); }
      catch (error) { reportError(error, 'pointer-release-callback'); }
      return true;
    }

    function clearAll(reason = 'cancel') {
      const hadInput = ownerActions.size > 0 || stickPointers.size > 0 || holdPointers.size > 0;
      for (const kind of [...stickPointers.keys()]) releaseStick(kind, reason);
      for (const action of [...holdPointers.keys()]) releaseHold(action, null, reason);
      ownerActions.clear();
      actionOwners.clear();
      if (commandPort.current()) {
        try { commandPort.flight.clearActions(); }
        catch (error) { reportError(error, 'clear-actions'); }
      }
      syncDiagnostics();
      if (hadInput) {
        try { options.onCancel?.({ reason }); }
        catch (error) { reportError(error, 'cancel-callback'); }
      }
      return hadInput;
    }

    function createStick(kind, label) {
      const element = documentLike.createElement('div');
      element.className = 'vaw-flight-stick';
      element.dataset.stick = kind;
      element.dataset.control = `${kind}-stick`;
      element.setAttribute('role', 'application');
      element.setAttribute('aria-label', label);
      const knob = documentLike.createElement('div');
      knob.className = 'vaw-flight-stick-knob';
      const caption = documentLike.createElement('span');
      caption.className = 'vaw-flight-stick-label';
      caption.textContent = label;
      element.appendChild(knob);
      element.appendChild(caption);
      stickElements.set(kind, element);
      stickKnobs.set(kind, knob);
      element.addEventListener('pointerdown', event => beginStick(kind, event));
      element.addEventListener('pointermove', event => updateStick(kind, event));
      element.addEventListener('pointerup', event => releaseStick(kind, 'pointerup') && prevent(event));
      element.addEventListener('pointercancel', event => releaseStick(kind, 'pointercancel') && prevent(event));
      element.addEventListener('lostpointercapture', event => releaseStick(kind, 'lostpointercapture') && prevent(event));
      return element;
    }

    function createHoldButton(definition) {
      const element = documentLike.createElement('button');
      element.type = 'button';
      element.className = 'vaw-flight-action';
      element.dataset.action = definition.action;
      element.dataset.active = 'false';
      element.textContent = definition.label;
      element.setAttribute('aria-label', definition.label);
      holdButtons.set(definition.action, element);
      element.addEventListener('pointerdown', event => beginHold(definition.action, event));
      element.addEventListener('pointerup', event => releaseHold(definition.action, event, 'pointerup') && prevent(event));
      element.addEventListener('pointercancel', event => releaseHold(definition.action, event, 'pointercancel') && prevent(event));
      element.addEventListener('lostpointercapture', event => releaseHold(definition.action, event, 'lostpointercapture') && prevent(event));
      return element;
    }

    function ensureDom() {
      if (root) return root;
      ensureStyle();
      root = documentLike.createElement('div');
      root.id = ROOT_ID;
      root.hidden = true;
      root.dataset.activeActions = '';
      root.setAttribute('aria-label', 'Mobile flight controls');
      root.appendChild(createStick('left', 'MOVE'));
      root.appendChild(createStick('right', 'LOOK'));
      actionsRoot = documentLike.createElement('div');
      actionsRoot.className = 'vaw-flight-actions';
      for (const definition of HOLD_ACTIONS) actionsRoot.appendChild(createHoldButton(definition));
      root.appendChild(actionsRoot);
      documentLike.body.appendChild(root);
      return root;
    }

    function shouldBeActive() {
      const profile = mobileContext.currentProfile?.();
      const session = currentSession();
      return Boolean(profile?.mobilePresentation && commandPort.current() && session?.mode === 'FLIGHT');
    }

    function refresh() {
      ensureDom();
      const nextActive = shouldBeActive();
      if (!nextActive && active) clearAll('deactivate');
      active = nextActive;
      root.hidden = !active;
      root.dataset.active = String(active);
      syncDiagnostics();
      return snapshot();
    }

    function handleActivity(activity) {
      if (activity?.section === 'session') refresh();
    }

    function handleBlur() {
      clearAll('window-blur');
    }

    function handleOrientationChange() {
      clearAll('orientation-change');
      refresh();
    }

    function handleVisibility() {
      if (documentLike.hidden) clearAll('document-hidden');
    }

    function snapshot() {
      return Object.freeze({
        active,
        activeActions: Object.freeze([...actionOwners.keys()].sort()),
        leftPointerId: stickPointers.get('left')?.pointerId ?? null,
        rightPointerId: stickPointers.get('right')?.pointerId ?? null,
        holdPointerIds: Object.freeze(Object.fromEntries([...holdPointers].map(([action, record]) => [action, record.pointerId]))),
        started,
        destroyed
      });
    }

    function start() {
      if (destroyed) throw new Error('Destroyed mobile flight controls cannot be restarted.');
      if (started) return false;
      started = true;
      ensureDom();
      if (typeof mobileContext.subscribe === 'function') unsubscribeProfile = mobileContext.subscribe(() => refresh());
      unsubscribeCommands = commandPort.subscribe(() => refresh());
      unsubscribeActivity = commandPort.subscribeActivity(handleActivity);
      windowLike.addEventListener('blur', handleBlur);
      windowLike.addEventListener('orientationchange', handleOrientationChange);
      documentLike.addEventListener('visibilitychange', handleVisibility);
      refresh();
      return true;
    }

    function destroy() {
      if (destroyed) return false;
      clearAll('destroy');
      destroyed = true;
      started = false;
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      unsubscribeCommands?.();
      unsubscribeCommands = null;
      unsubscribeActivity?.();
      unsubscribeActivity = null;
      windowLike.removeEventListener('blur', handleBlur);
      windowLike.removeEventListener('orientationchange', handleOrientationChange);
      documentLike.removeEventListener('visibilitychange', handleVisibility);
      root?.remove?.();
      root = null;
      style?.remove?.();
      style = null;
      active = false;
      return true;
    }

    return Object.freeze({
      start,
      destroy,
      refresh,
      clearAll,
      snapshot,
      root: () => root
    });
  }

  return Object.freeze({ create, ROOT_ID, STYLE_ID, DEADZONE, STICK_ACTIONS, HOLD_ACTIONS, CSS });
});
