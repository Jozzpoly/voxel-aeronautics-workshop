(() => {
  'use strict';

  window.VAW.define('game.input-settings-controller', [
    'foundation.input-profile', 'foundation.flight-control', 'foundation.craft-compiler', 'foundation.control-frame'
  ], (InputProfile, FlightControl, CraftCompiler, ControlFrame) => {
    function create({
      state: STATE, craft: CRAFT, document: documentRef = window.document,
      navigator: navigatorRef = window.navigator, showStatus = () => {},
      recomputePilotAxes = () => {}, clearControlActions = () => {},
      saveUIPreferences = () => {}, syncPowerControlReadouts = () => {}
    } = {}) {
      if (!STATE?.input || !CRAFT) throw new TypeError('Input settings controller requires state and CraftModel.');
      const document = documentRef;
      const navigator = navigatorRef;
      let pendingBindingCapture = null;
      let keyboardLockActive = false;

      function isEditableElement(element) {
        let current = element && typeof element === 'object' ? element : null;
        while (current) {
          const tagName = String(current.tagName || '').toUpperCase();
          if ((tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') && !current.disabled) return true;
          if (current.isContentEditable === true) return true;
          const contentEditable = typeof current.getAttribute === 'function' ? current.getAttribute('contenteditable') : null;
          if (contentEditable != null && String(contentEditable).toLowerCase() !== 'false') return true;
          current = current.parentElement || null;
        }
        return false;
      }

      function isEditableInteractionActive(eventTarget, activeElement = document.activeElement) {
        return isEditableElement(eventTarget) || isEditableElement(activeElement);
      }

      function releaseEditableInteraction(element = document.activeElement) {
        if (!isEditableElement(element) || typeof element.blur !== 'function') return false;
        element.blur();
        return true;
      }

      function axisLabelFromArray(vector) {
        const values = Array.isArray(vector) ? vector : [0, 0, 0];
        let best = 0;
        for (let index = 1; index < values.length; index += 1) {
          if (Math.abs(values[index]) > Math.abs(values[best])) best = index;
        }
        const labels = ['X', 'Y', 'Z'];
        return `${values[best] >= 0 ? '+' : '-'}${labels[best]}`;
      }

      function syncControlFrameReadout() {
        const compiled = STATE.flight.compiled || CraftCompiler.compile(CRAFT);
        const frame = compiled.controlFrame || ControlFrame.fromCore(null);
        const readout = document.getElementById('ui-control-frame');
        if (readout) readout.textContent = `Forward ${axisLabelFromArray(frame.forward)} • Up ${axisLabelFromArray(frame.up)} • Right ${axisLabelFromArray(frame.right)}`;
      }

      function flightFocusSupported() {
        return Boolean(document.documentElement?.requestFullscreen && navigator.keyboard?.lock);
      }

      function syncFlightFocusStatus(message = '') {
        const status = document.getElementById('ui-flight-focus-status');
        const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-flight-focus'));
        const active = Boolean(document.fullscreenElement && keyboardLockActive);
        const usesCtrl = InputProfile.allBoundCodes(STATE.input.profile).some(code => code === 'ControlLeft' || code === 'ControlRight');
        if (status) {
          status.classList.toggle('active', active);
          status.textContent = message || (active
            ? 'Flight Focus active • game bindings override supported browser shortcuts'
            : (flightFocusSupported()
              ? (usesCtrl ? 'Browser mode • use Flight Focus before combining Ctrl with W/A/S/D' : 'Browser mode • current bindings do not require Ctrl capture')
              : (usesCtrl ? 'Flight Focus unavailable here • rebind Ctrl for conflict-free multi-axis flight' : 'Flight Focus unavailable here • current bindings remain usable')));
        }
        if (button) {
          button.disabled = !flightFocusSupported();
          button.textContent = active ? 'EXIT FOCUS' : 'FLIGHT FOCUS';
        }
      }

      async function refreshKeyboardLock() {
        if (!keyboardLockActive || !document.fullscreenElement || !navigator.keyboard?.lock) return;
        try {
          await navigator.keyboard.lock(FlightControl.keyboardLockCodes(STATE.input.profile));
        } catch (error) {
          keyboardLockActive = false;
          console.warn('Keyboard lock refresh failed:', error);
          syncFlightFocusStatus('Keyboard capture failed • browser shortcuts may still win');
        }
      }

      async function toggleFlightFocus() {
        if (document.fullscreenElement) {
          try { navigator.keyboard?.unlock?.(); } catch (_) {}
          keyboardLockActive = false;
          await document.exitFullscreen?.();
          syncFlightFocusStatus();
          return;
        }
        if (!flightFocusSupported()) {
          syncFlightFocusStatus('Flight Focus is not supported in this browser or context');
          return;
        }
        try {
          await document.documentElement.requestFullscreen();
          await navigator.keyboard.lock(FlightControl.keyboardLockCodes(STATE.input.profile));
          keyboardLockActive = true;
          syncFlightFocusStatus();
          showStatus('FLIGHT FOCUS ACTIVE', 1200);
        } catch (error) {
          keyboardLockActive = false;
          console.warn('Flight Focus could not be enabled:', error);
          syncFlightFocusStatus('Flight Focus was denied • use HTTPS/localhost and allow keyboard lock');
        }
      }

      function renderBindingControls() {
        const list = document.getElementById('input-binding-list');
        if (!list) return;
        list.innerHTML = '';
        const profile = InputProfile.normalize(STATE.input.profile);
        for (const action of InputProfile.BINDABLE_ACTIONS) {
          const row = document.createElement('div');
          row.className = 'input-binding-row';
          const label = document.createElement('strong');
          label.textContent = InputProfile.ACTION_LABELS[action] || action;
          row.appendChild(label);
          for (let slot = 0; slot < InputProfile.BINDING_SLOTS; slot += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'binding-key';
            button.dataset.bindingAction = action;
            button.dataset.bindingSlot = String(slot);
            const code = profile.bindings[action][slot] || '';
            button.textContent = InputProfile.formatCode(code);
            button.title = code || 'Unbound';
            if (pendingBindingCapture?.action === action && pendingBindingCapture?.slot === slot) {
              button.classList.add('capturing');
              button.textContent = 'Press a key…';
            }
            button.addEventListener('click', () => {
              pendingBindingCapture = { action, slot };
              clearControlActions();
              renderBindingControls();
            });
            row.appendChild(button);
          }
          list.appendChild(row);
        }
        const warning = document.getElementById('ui-binding-warning');
        const warnings = InputProfile.bindingWarnings(profile);
        if (warning) warning.textContent = warnings.join(' ');
        syncFlightFocusStatus();
      }

      function syncInputProfileUI() {
        STATE.input.profile = InputProfile.normalize(STATE.input.profile);
        for (const axis of InputProfile.AXES) {
          const settings = STATE.input.profile.axes[axis];
          const invert = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-invert-${axis}`));
          const sensitivity = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-sensitivity-${axis}`));
          const value = document.getElementById(`input-sensitivity-${axis}-value`);
          if (invert) invert.checked = settings.invert;
          if (sensitivity) sensitivity.value = String(Math.round(settings.sensitivity * 100));
          if (value) value.textContent = `${settings.sensitivity.toFixed(2)}×`;
        }
        renderBindingControls();
        syncControlFrameReadout();
      }

      function updateInputAxis(axis, patch) {
        STATE.input.profile = InputProfile.updateAxis(STATE.input.profile, axis, patch);
        recomputePilotAxes();
        syncInputProfileUI();
        saveUIPreferences();
      }

      function commitBindingCapture(event) {
        if (!pendingBindingCapture) return false;
        event.preventDefault();
        event.stopPropagation?.();
        const capture = pendingBindingCapture;
        pendingBindingCapture = null;
        if (event.code !== 'Escape') {
          STATE.input.profile = (event.code === 'Backspace' || event.code === 'Delete')
            ? InputProfile.clearBinding(STATE.input.profile, capture.action, capture.slot)
            : InputProfile.updateBinding(STATE.input.profile, capture.action, capture.slot, event.code);
          recomputePilotAxes();
          saveUIPreferences();
          refreshKeyboardLock();
        }
        renderBindingControls();
        syncPowerControlReadouts();
        return true;
      }

      function handleFullscreenChange() {
        if (!document.fullscreenElement) {
          try { navigator.keyboard?.unlock?.(); } catch (_) {}
          keyboardLockActive = false;
          clearControlActions();
        }
        syncFlightFocusStatus();
      }

      function bindInputProfileControls() {
        for (const axis of InputProfile.AXES) {
          const invert = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-invert-${axis}`));
          const sensitivity = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-sensitivity-${axis}`));
          invert?.addEventListener('change', () => updateInputAxis(axis, { invert: invert.checked }));
          sensitivity?.addEventListener('input', () => updateInputAxis(axis, { sensitivity: Number(sensitivity.value) / 100 }));
        }
        document.getElementById('btn-input-profile-reset')?.addEventListener('click', () => {
          STATE.input.profile = InputProfile.createDefault();
          pendingBindingCapture = null;
          recomputePilotAxes();
          syncInputProfileUI();
          syncPowerControlReadouts();
          saveUIPreferences();
          refreshKeyboardLock();
          showStatus('CONTROL PROFILE RESET', 1100);
        });
        document.getElementById('btn-flight-focus')?.addEventListener('click', toggleFlightFocus);
        syncInputProfileUI();
      }

      return Object.freeze({
        axisLabelFromArray, syncControlFrameReadout, flightFocusSupported, syncFlightFocusStatus,
        refreshKeyboardLock, toggleFlightFocus, renderBindingControls, syncInputProfileUI,
        updateInputAxis, commitBindingCapture, handleFullscreenChange, bindInputProfileControls,
        isEditableInteractionActive, releaseEditableInteraction
      });
    }

    return Object.freeze({ create });
  });
})();
