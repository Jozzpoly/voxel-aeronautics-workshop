(() => {
  'use strict';

  window.VAW.define('game.blueprint-controller', ['foundation.config', 'foundation.blueprint'], (Config, Blueprint) => {
    const { SAVE_VERSION, SAVE_KEY, SAVE_BACKUP_KEY, LEGACY_SAVE_KEYS, IMPORT_POLICY } = Config;

    function create({
      state: STATE, craft: CRAFT, document: documentRef = window.document,
      storage = window.localStorage, defaultOrientation,
      markers = {}, callbacks = {}
    } = {}) {
      if (!STATE?.history || !CRAFT?.toDocument) throw new TypeError('Blueprint controller requires state and CraftModel.');
      const document = documentRef;
      const { comSphere, axesHelper } = markers;
      const {
        cleanupFlightState, updateTelemetry, updateGhost, updateControlConfigurationUI,
        syncHudVisibility, resetToEmptyCraft, updateHUD, showStatus, setMechanicalAuthoring = () => {}
      } = callbacks;
      const DEFAULT_ORIENTATION = defaultOrientation;
      const localStorage = storage;

      function collectBlueprint() {
        return CRAFT.toDocument({
          selectedBlock: STATE.selectedBlock,
          selectedOrientation: STATE.orientation,
          symmetry: STATE.symmetry,
          thrusterPower: STATE.thrusterPower,
          balloonPower: STATE.balloonPower,
          stabilityAssist: STATE.stabilityAssist,
          controlAxis: STATE.controlAxis,
          controlSign: STATE.controlSign
        });
      }

      function cloneBlueprint(data = collectBlueprint()) { return Blueprint.clone(data); }

      function blueprintSignature(data) { return Blueprint.signature(data); }

      function updateHistoryButtons() {
        const undoButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-undo'));
        const redoButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-redo'));
        if (undoButton) undoButton.disabled = !STATE.history.canUndo || STATE.mode !== 'BUILD';
        if (redoButton) redoButton.disabled = !STATE.history.canRedo || STATE.mode !== 'BUILD';
      }

      function commitHistory(previousBlueprint) {
        if (!previousBlueprint) return;
        const committed = STATE.history.commit(previousBlueprint, collectBlueprint());
        if (!committed) return;
        updateHistoryButtons();
        updateControlConfigurationUI();
      }

      function restoreHistoryBlueprint(blueprint) {
        const restored = loadBlueprintData(blueprint);
        if (restored) autoSave(false, true);
        updateHistoryButtons();
        return restored;
      }

      function undoBlueprint() {
        if (STATE.mode !== 'BUILD' || !STATE.history.canUndo) return;
        const current = cloneBlueprint();
        const target = STATE.history.undo(current);
        if (!target) return;
        if (restoreHistoryBlueprint(target)) {
          showStatus('UNDO', 650);
        } else {
          STATE.history.rollbackUndo(current, target);
          updateHistoryButtons();
        }
      }

      function redoBlueprint() {
        if (STATE.mode !== 'BUILD' || !STATE.history.canRedo) return;
        const current = cloneBlueprint();
        const target = STATE.history.redo(current);
        if (!target) return;
        if (restoreHistoryBlueprint(target)) {
          showStatus('REDO', 650);
        } else {
          STATE.history.rollbackRedo(current, target);
          updateHistoryButtons();
        }
      }

      function normalizeBlueprintData(data) { return Blueprint.normalize(data); }

      function loadBlueprintData(data) {
        const normalized = normalizeBlueprintData(data);
        if (!normalized) return false;

        // CraftModel replacement is atomic. Do not mutate UI/settings or clear the
        // current craft until the normalized document has been accepted.
        setMechanicalAuthoring(false, false);
        cleanupFlightState();
        const replacement = CRAFT.replaceDocument(normalized, 'load-blueprint');
        if (!replacement.ok) {
          console.error('CraftModel rejected a normalized blueprint:', replacement.reason);
          return false;
        }

        STATE.mode = 'BUILD';
        STATE.statusText = 'DRYDOCK';
        STATE.selectedBlock = normalized.selectedBlock;
        STATE.orientation = normalized.orientation;
        STATE.symmetry = normalized.symmetry;
        STATE.thrusterPower = normalized.thrusterPower;
        STATE.balloonPower = normalized.balloonPower;
        STATE.stabilityAssist = normalized.stabilityAssist;
        STATE.controlAxis = normalized.controlAxis;
        STATE.controlSign = normalized.controlSign;

        /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = String(Math.round(STATE.thrusterPower * 100));
        /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = String(Math.round(STATE.balloonPower * 100));
        /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = String(Math.round(STATE.stabilityAssist * 100));
        document.querySelectorAll('.tool-btn').forEach(element => {
          const btn = /** @type {HTMLElement} */ (element);
          btn.classList.toggle('active', btn.dataset.tool === STATE.selectedBlock);
        });
        comSphere.visible = CRAFT.size > 0;
        axesHelper.visible = true;
        updateTelemetry();
        updateGhost();
        updateControlConfigurationUI();
        syncHudVisibility();
        return true;
      }

      let autosaveTimer = null;
      let lastSaveErrorAt = -Infinity;
      function validStoredBlueprint(raw) {
        if (typeof raw !== 'string' || !raw) return false;
        try { return Blueprint.normalize(JSON.parse(raw)) !== null; }
        catch (_) { return false; }
      }
      function utf8ByteLength(text) {
        const source = String(text ?? '');
        if (typeof TextEncoder === 'function') return new TextEncoder().encode(source).byteLength;
        if (typeof Blob === 'function') return new Blob([source]).size;
        return unescape(encodeURIComponent(source)).length;
      }
      function persistBlueprint(showToast = false) {
        try {
          const payload = JSON.stringify(collectBlueprint());
          const previous = localStorage.getItem(SAVE_KEY);
          if (previous && previous !== payload && validStoredBlueprint(previous)) {
            try { localStorage.setItem(SAVE_BACKUP_KEY, previous); }
            catch (backupError) { console.warn('Blueprint backup save failed:', backupError); }
          }
          localStorage.setItem(SAVE_KEY, payload);
          if (showToast) showStatus('SAVED', 800);
          return true;
        } catch (error) {
          console.error('Blueprint save failed:', error);
          const now = Date.now();
          if (showToast || now - lastSaveErrorAt > 5000) showStatus('SAVE ERROR', 1400);
          lastSaveErrorAt = now;
          return false;
        }
      }

      function saveBlueprint() {
        if (autosaveTimer) {
          clearTimeout(autosaveTimer);
          autosaveTimer = null;
        }
        persistBlueprint(true);
      }

      function autoSave(showToast = false, immediate = false) {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        if (immediate) {
          autosaveTimer = null;
          persistBlueprint(showToast);
          return;
        }
        autosaveTimer = setTimeout(() => {
          autosaveTimer = null;
          persistBlueprint(showToast);
        }, 220);
      }

      function flushPendingAutosave() {
        if (autosaveTimer) {
          clearTimeout(autosaveTimer);
          autosaveTimer = null;
        }
        return persistBlueprint(false);
      }

      function loadBlueprint(recordHistory = false) {
        const previous = recordHistory ? collectBlueprint() : null;
        const keys = [SAVE_KEY, SAVE_BACKUP_KEY, ...LEGACY_SAVE_KEYS];
        for (const key of keys) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!loadBlueprintData(parsed)) continue;
            if (recordHistory) commitHistory(previous);
            if (key !== SAVE_KEY || parsed.version !== SAVE_VERSION) autoSave(false, true);
            if (recordHistory) showStatus('LOADED', 800);
            return true;
          } catch (error) {
            console.warn(`Blueprint load failed for ${key}:`, error);
          }
        }
        return false;
      }

      function newBlueprint() {
        setMechanicalAuthoring(false, false);
        const historyBefore = collectBlueprint();
        STATE.selectedBlock = 'Hull';
        STATE.orientation = DEFAULT_ORIENTATION;
        STATE.symmetry = 'NONE';
        STATE.thrusterPower = 0.7;
        STATE.balloonPower = 0.7;
        STATE.stabilityAssist = 0.18;
        /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = '70';
        /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = '70';
        /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = '18';
        resetToEmptyCraft(false);
        document.querySelectorAll('.tool-btn').forEach(element => {
          const btn = /** @type {HTMLElement} */ (element);
          btn.classList.toggle('active', btn.dataset.tool === STATE.selectedBlock);
        });
        commitHistory(historyBefore);
        updateHUD();
        updateGhost();
        autoSave(false);
        showStatus('NEW BLUEPRINT', 800);
      }

      function exportBlueprint() {
        try {
          const payload = JSON.stringify(collectBlueprint(), null, 2);
          const blob = new Blob([payload], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `voxel-aeronautics-blueprint-v${SAVE_VERSION}.json`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 500);
          showStatus('EXPORTED', 800);
        } catch (error) {
          console.error('Blueprint export failed:', error);
          showStatus('EXPORT ERROR', 1400);
        }
      }

      function importBlueprintFile(file) {
        if (!file) return;
        const maxBytes = Number(IMPORT_POLICY?.maxBlueprintBytes) || 8 * 1024 * 1024;
        if (Number.isFinite(file.size) && file.size > maxBytes) {
          showStatus('BLUEPRINT TOO LARGE', 1800);
          console.warn(`Blueprint import rejected: ${file.size} bytes exceeds ${maxBytes}.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const source = String(reader.result || '').replace(/^\uFEFF/, '');
            if (utf8ByteLength(source) > maxBytes) throw new Error('Blueprint text exceeds safe import budget.');
            const parsed = JSON.parse(source);
            const historyBefore = collectBlueprint();
            if (!loadBlueprintData(parsed)) throw new Error('Blueprint validation failed');
            commitHistory(historyBefore);
            autoSave(false, true);
            showStatus('IMPORTED', 900);
          } catch (error) {
            console.error('Blueprint import failed:', error);
            showStatus('INVALID BLUEPRINT', 1600);
          }
        };
        reader.onerror = () => showStatus('IMPORT ERROR', 1400);
        reader.readAsText(file);
      }

      return Object.freeze({
        collectBlueprint, cloneBlueprint, blueprintSignature, updateHistoryButtons,
        commitHistory, restoreHistoryBlueprint, undoBlueprint, redoBlueprint,
        normalizeBlueprintData, loadBlueprintData, persistBlueprint, saveBlueprint,
        autoSave, flushPendingAutosave, loadBlueprint, newBlueprint, exportBlueprint, importBlueprintFile
      });
    }

    return Object.freeze({ create });
  });
})();
