(() => {
  'use strict';

  window.VAW.define('game.workshop-selection-controller', [], () => {
    function create({
      THREE = window.THREE,
      state: STATE,
      craft,
      workshop,
      scene,
      document: documentRef = window.document,
      callbacks = {}
    } = {}) {
      if (!STATE?.workshop || !craft?.getById || !workshop?.meshesByKey) {
        throw new TypeError('Workshop selection controller requires application state, CraftModel, and workshop view.');
      }
      const document = documentRef;
      const {
        hoveredBlockId = () => null,
        setActiveAssemblySpace = () => false,
        collectBlueprint = () => null,
        commitHistory = () => {},
        updateTelemetry = () => {},
        updateGhost = () => {},
        autoSave = () => {},
        onSelectionChanged = () => {},
        frameSelectedVisual = () => false,
        showStatus = () => {}
      } = callbacks;

      STATE.workshop.selectedBlockId = STATE.workshop.selectedBlockId || null;
      let selectionHelper = null;

      const element = id => document?.getElementById?.(id) || null;
      const selectedBlock = () => {
        const id = STATE.workshop.selectedBlockId;
        return id ? craft.getById(id) : null;
      };
      const testAppliesToCurrentCraft = () => Number.isInteger(STATE.lastTestResult?.craftRevision)
        && STATE.lastTestResult.craftRevision === craft.revision;
      const lastFailureEvent = () => {
        if (!testAppliesToCurrentCraft()) return null;
        const event = STATE.lastTestResult?.firstFailureEvent;
        return event && typeof event === 'object' && event.blockId ? event : null;
      };
      const lastLostBlockIds = () => testAppliesToCurrentCraft() && Array.isArray(STATE.lastTestResult?.lostBlockIds)
        ? STATE.lastTestResult.lostBlockIds
        : [];

      function clearHighlight() {
        if (!selectionHelper) return;
        scene?.remove?.(selectionHelper);
        selectionHelper.geometry?.dispose?.();
        selectionHelper.material?.dispose?.();
        selectionHelper = null;
      }

      function updateHighlight(block) {
        clearHighlight();
        if (block == null || STATE.mode !== 'BUILD' || !THREE?.BoxHelper || !scene) return;
        const mesh = workshop.meshesByKey.get(block.key);
        if (!mesh) return;
        selectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8);
        if (selectionHelper.material) {
          selectionHelper.material.depthTest = false;
          selectionHelper.material.transparent = true;
          selectionHelper.material.opacity = 0.95;
        }
        selectionHelper.renderOrder = 50;
        scene.add(selectionHelper);
      }

      function notify(block, source) {
        updateHighlight(block);
        onSelectionChanged(block, { source });
      }

      function render() {
        let block = selectedBlock();
        if (block == null && STATE.workshop.selectedBlockId) STATE.workshop.selectedBlockId = null;
        block = selectedBlock();

        const title = element('ui-selected-part-title');
        const meta = element('ui-selected-part-meta');
        const test = element('ui-selected-part-test');
        const clear = element('btn-clear-selected-part');
        const failure = element('btn-select-last-failure');
        const nudges = document?.querySelectorAll?.('[data-selected-nudge]') || [];

        if (block == null) {
          if (title) title.textContent = 'No part selected';
          if (meta) meta.textContent = 'Shift + left click a part, or select the hovered part.';
          if (test) {
            const event = lastFailureEvent();
            test.textContent = STATE.lastTestResult && !testAppliesToCurrentCraft()
              ? 'Last test belongs to an earlier craft revision.'
              : event
                ? `Last test first failure: ${event.blockType || 'part'} • ${event.reason || 'unknown reason'}`
                : 'No failed part recorded in the last test.';
          }
        } else {
          if (title) title.textContent = `${block.type} • ${block.blockId}`;
          if (meta) meta.textContent = `${block.assemblySpaceId} • [${block.x}, ${block.y}, ${block.z}]`;
          if (test) {
            const event = lastFailureEvent();
            const failed = event?.blockId === block.blockId;
            const lost = lastLostBlockIds().includes(block.blockId);
            if (failed) {
              test.textContent = `FIRST FAILURE • ${event.reason || 'failure'}${lost ? ' • LOST DURING TEST' : ''}`;
            } else if (lost) {
              test.textContent = 'LOST DURING LAST TEST';
            } else if (STATE.lastTestResult && !testAppliesToCurrentCraft()) {
              test.textContent = 'Last test belongs to an earlier craft revision.';
            } else {
              test.textContent = event ? 'Not the first failed part in the last test.' : 'No failure evidence for this part.';
            }
          }
        }

        if (clear) clear.disabled = block == null;
        const frame = element('btn-frame-selected-part');
        if (frame) frame.disabled = block == null || STATE.mode !== 'BUILD';
        const failureId = lastFailureEvent()?.blockId || null;
        if (failure) failure.disabled = !failureId || !craft.getById(failureId);
        for (const button of nudges) button.disabled = block == null || STATE.mode !== 'BUILD';
        return block;
      }

      function select(blockId, { activateSpace = false, source = 'manual' } = {}) {
        const block = blockId ? craft.getById(blockId) : null;
        if (block == null) return { ok: false, reason: 'missing-block' };
        STATE.workshop.selectedBlockId = block.blockId;
        if (activateSpace) setActiveAssemblySpace(block.assemblySpaceId);
        notify(block, source);
        render();
        return { ok: true, block };
      }

      function clear({ source = 'manual' } = {}) {
        const changed = Boolean(STATE.workshop.selectedBlockId);
        STATE.workshop.selectedBlockId = null;
        notify(null, source);
        render();
        return changed;
      }

      function selectHovered() {
        const blockId = hoveredBlockId();
        if (blockId == null || blockId === '') {
          showStatus('HOVER A PART TO SELECT IT', 1200);
          return { ok: false, reason: 'no-hovered-block' };
        }
        return select(blockId, { activateSpace: true, source: 'hovered' });
      }

      function selectLastFailure() {
        if (STATE.lastTestResult && !testAppliesToCurrentCraft()) {
          showStatus('LAST TEST BELONGS TO EARLIER CRAFT VERSION', 1600);
          return { ok: false, reason: 'stale-test-result' };
        }
        const event = lastFailureEvent();
        if (!event?.blockId) {
          showStatus('NO FAILED PART IN LAST TEST', 1400);
          return { ok: false, reason: 'no-failure-block' };
        }
        const result = select(event.blockId, { activateSpace: true, source: 'last-test' });
        if (!result.ok) showStatus('FAILED PART IS NOT IN CURRENT CRAFT', 1500);
        return result;
      }

      function sync({ preferLastFailure = false } = {}) {
        const current = selectedBlock();
        if (STATE.workshop.selectedBlockId && !current) clear({ source: 'missing' });
        if (preferLastFailure && lastFailureEvent()?.blockId && craft.getById(lastFailureEvent().blockId)) {
          return selectLastFailure();
        }
        const block = render();
        notify(block, 'sync');
        return block ? { ok: true, block } : { ok: false, reason: 'no-selection' };
      }

      function nudge(dx, dy, dz) {
        if (STATE.mode !== 'BUILD') return { ok: false, reason: 'not-build-mode' };
        const block = selectedBlock();
        if (block == null) return { ok: false, reason: 'no-selection' };
        if (craft.linksForBlock?.(block.blockId)?.length) {
          const blocked = { ok: false, reason: 'mechanically-linked' };
          showStatus('MOVE BLOCKED • MECHANICALLY-LINKED', 1500);
          return blocked;
        }
        const before = collectBlueprint();
        const result = craft.move?.(
          block.blockId,
          Math.round(block.x + dx),
          Math.round(block.y + dy),
          Math.round(block.z + dz),
          'move-selected-block'
        ) || { ok: false, reason: 'move-unavailable' };
        if (!result.ok) {
          showStatus(`MOVE BLOCKED • ${String(result.reason || 'invalid').toUpperCase()}`, 1500);
          return result;
        }
        if (result.reason !== 'unchanged') {
          commitHistory(before);
          updateTelemetry();
          updateGhost();
          autoSave(false);
        }
        const next = craft.getById(block.blockId);
        notify(next, 'move');
        render();
        return { ok: true, block: next };
      }

      function wire() {
        element('btn-select-hovered-part')?.addEventListener('click', selectHovered);
        element('btn-select-last-failure')?.addEventListener('click', selectLastFailure);
        element('btn-clear-selected-part')?.addEventListener('click', () => clear());
        element('btn-frame-selected-part')?.addEventListener('click', () => {
          const block = selectedBlock();
          if (!block || STATE.mode !== 'BUILD') return;
          if (!frameSelectedVisual(block)) showStatus('SELECT A VISIBLE PART TO FRAME', 1400);
        });
        for (const button of document?.querySelectorAll?.('[data-selected-nudge]') || []) {
          button.addEventListener('click', () => {
            const vector = String(button.dataset.selectedNudge || '').split(',').map(Number);
            if (vector.length === 3 && vector.every(Number.isFinite)) nudge(vector[0], vector[1], vector[2]);
          });
        }
        render();
      }

      return {
        selectedBlock,
        lastFailureEvent,
        render,
        select,
        clear,
        selectHovered,
        selectLastFailure,
        sync,
        nudge,
        wire
      };
    }

    return { create };
  });
})();
