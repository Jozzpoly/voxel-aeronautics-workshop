(() => {
  'use strict';

  window.VAW.define('game.workshop-selection-controller', [], () => {
    function create({
      THREE = window.THREE,
      state: STATE,
      craft,
      workshop,
      scene,
      camera = null,
      document: documentRef = window.document,
      callbacks = {}
    } = {}) {
      if (!STATE?.workshop || !craft?.getById || !workshop?.meshesByKey) {
        throw new TypeError('Workshop selection controller requires application state, CraftModel, and workshop view.');
      }
      const document = documentRef;
      const {
        hoveredBlockId = () => null,
        hitBlock = () => null,
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
      let dragSession = null;

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
          if (meta) meta.textContent = 'Shift+click to select, or use Select (V): click to inspect, drag on its plane to move.';
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
        cancelDrag();
        const current = selectedBlock();
        if (STATE.workshop.selectedBlockId && !current) clear({ source: 'missing' });
        if (preferLastFailure && lastFailureEvent()?.blockId && craft.getById(lastFailureEvent().blockId)) {
          return selectLastFailure();
        }
        const block = render();
        notify(block, 'sync');
        return block ? { ok: true, block } : { ok: false, reason: 'no-selection' };
      }

      function cancelDrag() {
        if (!dragSession) return false;
        if (dragSession.preview) {
          scene?.remove?.(dragSession.preview);
          dragSession.preview.geometry?.dispose?.();
          dragSession.preview.material?.dispose?.();
        }
        dragSession = null;
        return true;
      }

      // Select-only planar manipulation. Preview is purely visual: CraftModel,
      // history and persistent saves are touched exactly once on release.
      function beginDrag(ndc) {
        cancelDrag();
        if (STATE.mode !== 'BUILD' || !camera || !THREE?.Raycaster || !THREE?.Plane) return false;
        const block = hitBlock(ndc)?.block;
        const visual = block ? workshop.meshesByKey.get(block.key) : null;
        if (!visual?.parent || !visual.updateWorldMatrix) return false;
        visual.updateWorldMatrix(true, true);
        const origin = visual.getWorldPosition(new THREE.Vector3());
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
          visual.parent.getWorldQuaternion(new THREE.Quaternion())
        ).normalize();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const grab = ray.ray.intersectPlane(plane, new THREE.Vector3());
        if (!grab) return false;
        dragSession = { blockId: block.blockId, original: block, visual, origin, plane, grab: grab.clone(),
          targetDx: 0, targetDz: 0, activated: false, preview: null };
        return true;
      }

      function previewDrag(ndc, movedBeyondSlop) {
        const drag = dragSession;
        if (!drag || !movedBeyondSlop || STATE.mode !== 'BUILD') return false;
        if (!drag.activated) {
          drag.activated = true;
          if (craft.linksForBlock?.(drag.blockId)?.length) {
            showStatus('MOVE BLOCKED • MECHANICALLY-LINKED', 1600);
            return true;
          }
          select(drag.blockId, { activateSpace: true, source: 'drag-preview' });
          if (THREE?.BoxHelper && scene) {
            const outline = new THREE.BoxHelper(drag.visual, 0xfbbf24);
            outline.material.depthTest = false;
            outline.material.transparent = true;
            outline.material.opacity = 0.9;
            outline.renderOrder = 75;
            scene.add(outline);
            drag.preview = outline;
          }
        }
        if (craft.linksForBlock?.(drag.blockId)?.length) return true;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const point = ray.ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (!point) return true;
        const worldTarget = drag.origin.clone().add(point.sub(drag.grab));
        drag.visual.parent.updateWorldMatrix(true, false);
        const localTarget = drag.visual.parent.worldToLocal(worldTarget);
        const { x, y, z } = drag.original;
        drag.targetDx = Math.round(localTarget.x) - x;
        drag.targetDz = Math.round(localTarget.z) - z;
        if (drag.preview) {
          const snappedWorld = drag.visual.parent.localToWorld(
            new THREE.Vector3(x + drag.targetDx, y, z + drag.targetDz)
          );
          drag.preview.position.copy(snappedWorld.sub(drag.origin));
          drag.preview.visible = Boolean(drag.targetDx || drag.targetDz);
        }
        return true;
      }

      function finishDrag(ndc, movedBeyondSlop) {
        if (!dragSession) return false;
        if (!movedBeyondSlop) { cancelDrag(); return false; }
        previewDrag(ndc, true);
        const drag = dragSession;
        const deltaX = drag.targetDx, deltaZ = drag.targetDz;
        const stillSameBlock = craft.getById(drag.blockId) === drag.original;
        cancelDrag();
        if (STATE.mode !== 'BUILD' || !stillSameBlock || craft.linksForBlock?.(drag.blockId)?.length) return true;
        if (deltaX || deltaZ) nudge(deltaX, 0, deltaZ);
        return true;
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
        beginDrag, previewDrag, finishDrag, cancelDrag,
        wire
      };
    }

    return { create };
  });
})();
