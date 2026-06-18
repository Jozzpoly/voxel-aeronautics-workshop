(() => {
  'use strict';

  window.VAW.define('game.assembly-space-controller', [
    'foundation.assembly-spaces', 'foundation.transform-math', 'foundation.blueprint'
  ], (AssemblySpaces, TransformMath, Blueprint) => {
    function create({ THREE, craft, state, scene, document: documentRef = window.document, callbacks = {} } = {}) {
      if (!THREE?.Group || !craft?.assemblySpaces || !state?.workshop || !scene) {
        throw new TypeError('AssemblySpaceController requires THREE, CraftModel, workshop state, and scene.');
      }
      const document = documentRef;
      const roots = state.workshop.assemblySpaceRootById instanceof Map ? state.workshop.assemblySpaceRootById : new Map();
      state.workshop.assemblySpaceRootById = roots;
      state.workshop.activeAssemblySpaceId = state.workshop.activeAssemblySpaceId || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
      let cachedRevision = -1;
      let cachedIndex = null;

      function spaces() { return craft.assemblySpaces(); }
      function spaceIndex() {
        if (!cachedIndex || cachedRevision !== craft.revision) {
          cachedIndex = AssemblySpaces.validateAndIndex(spaces(), { allowDefaultRoot: false });
          cachedRevision = craft.revision;
        }
        return cachedIndex;
      }
      function activeAssemblySpaceId() {
        const active = state.workshop.activeAssemblySpaceId;
        return craft.getAssemblySpace(active) ? active : AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
      }
      function groupFor(id) { return roots.get(String(id)) || null; }
      function ensureGroup(space) {
        let group = roots.get(space.assemblySpaceId);
        if (!group) {
          group = new THREE.Group();
          group.name = `assembly-space:${space.assemblySpaceId}`;
          group.userData.assemblySpaceId = space.assemblySpaceId;
          group.userData.assemblySpaceRoot = true;
          roots.set(space.assemblySpaceId, group);
        }
        return group;
      }
      function setGroupPose(group, pose) {
        const position = pose?.position || [0, 0, 0];
        const quaternion = pose?.quaternion || [0, 0, 0, 1];
        group.position.set(position[0], position[1], position[2]);
        group.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
      }
      function syncRoots() {
        const current = spaces();
        const currentIds = new Set(current.map(space => space.assemblySpaceId));
        for (const [id, group] of [...roots]) {
          if (currentIds.has(id)) continue;
          group.parent?.remove(group);
          roots.delete(id);
        }
        for (const space of current) ensureGroup(space);
        for (const space of current) {
          const group = ensureGroup(space);
          group.parent?.remove(group);
          setGroupPose(group, space.parentAssemblySpaceId === null ? AssemblySpaces.IDENTITY_POSE : space.localPose);
          if (space.parentAssemblySpaceId === null) scene.add(group);
          else ensureGroup(craft.getAssemblySpace(space.parentAssemblySpaceId)).add(group);
        }
        cachedRevision = -1;
        if (!craft.getAssemblySpace(state.workshop.activeAssemblySpaceId)) state.workshop.activeAssemblySpaceId = AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
        renderUI();
        return roots;
      }
      function attachBlockVisual(block, visual) {
        const group = groupFor(block.assemblySpaceId) || (syncRoots(), groupFor(block.assemblySpaceId));
        if (!group) throw new Error(`Missing workshop root for assembly space ${block.assemblySpaceId}.`);
        visual.position.set(block.x, block.y, block.z);
        visual.userData.assemblySpaceId = block.assemblySpaceId;
        group.add(visual);
        return visual;
      }
      function detachBlockVisual(visual) {
        if (!visual) return false;
        visual.parent?.remove(visual);
        return true;
      }
      function blockRootPosition(block) {
        return AssemblySpaces.spaceLocalToRoot(block.assemblySpaceId, [block.x, block.y, block.z], spaceIndex());
      }
      function rootPointToActive(point) {
        return AssemblySpaces.rootToSpaceLocal(activeAssemblySpaceId(), point, spaceIndex());
      }
      function spaceVectorToRoot(assemblySpaceId, vector) {
        const pose = spaceIndex().rootPoses[String(assemblySpaceId)];
        if (!pose) throw new Error(`Unknown assembly space: ${String(assemblySpaceId)}`);
        return Object.freeze(TransformMath.rotateVector(pose.quaternion, vector));
      }
      function rootVectorToSpace(assemblySpaceId, vector) {
        const pose = spaceIndex().rootPoses[String(assemblySpaceId)];
        if (!pose) throw new Error(`Unknown assembly space: ${String(assemblySpaceId)}`);
        return Object.freeze(TransformMath.rotateVector(TransformMath.inversePose(pose).quaternion, vector));
      }
      function attachAuthoringObject(object) {
        const group = groupFor(activeAssemblySpaceId()) || (syncRoots(), groupFor(activeAssemblySpaceId()));
        if (object && group) group.add(object);
        return object;
      }
      function setActiveAssemblySpace(id) {
        const normalized = String(id);
        if (!craft.getAssemblySpace(normalized)) return false;
        state.workshop.activeAssemblySpaceId = normalized;
        renderUI();
        callbacks.attachAuthoringObjects?.(groupFor(normalized));
        callbacks.updateGhost?.();
        return true;
      }
      function currentBlueprint() { return callbacks.collectBlueprint?.() || craft.toDocument(); }
      function finishMutation(before, result, successText) {
        if (!result?.ok) {
          callbacks.showStatus?.(`SPACE ERROR: ${String(result?.reason || 'unknown').replaceAll('-', ' ').toUpperCase()}`, 1800);
          renderUI(result?.reason || 'operation-failed');
          return result;
        }
        callbacks.commitHistory?.(before);
        callbacks.autoSave?.(false);
        syncRoots();
        callbacks.updateTelemetry?.();
        callbacks.updateGhost?.();
        renderUI();
        callbacks.showStatus?.(successText, 900);
        return result;
      }
      function nextDefaultOffset(parentId) {
        const siblings = spaces().filter(space => space.parentAssemblySpaceId === parentId);
        return [4 * (siblings.length + 1), 0, 0];
      }
      function createSpace(name = '') {
        const before = currentBlueprint();
        const parentAssemblySpaceId = activeAssemblySpaceId();
        const childCount = Math.max(0, spaces().length - 1);
        const result = craft.createAssemblySpace({
          name: name || `Space ${childCount + 1}`,
          parentAssemblySpaceId,
          localPose: { position: nextDefaultOffset(parentAssemblySpaceId), quaternion: [0, 0, 0, 1] }
        }, 'author-create-assembly-space');
        if (result.ok) setActiveAssemblySpace(result.assemblySpace.assemblySpaceId);
        return finishMutation(before, result, 'ASSEMBLY SPACE CREATED');
      }
      function renameActiveSpace(name) {
        const id = activeAssemblySpaceId();
        if (!String(name || '').trim()) return finishMutation(currentBlueprint(), { ok: false, reason: 'invalid-name' }, '');
        const before = currentBlueprint();
        return finishMutation(before, craft.updateAssemblySpace(id, { name }, 'author-rename-assembly-space'), 'ASSEMBLY SPACE RENAMED');
      }
      function deleteActiveSpace() {
        const id = activeAssemblySpaceId();
        const space = craft.getAssemblySpace(id);
        if (!space || space.parentAssemblySpaceId === null) {
          const result = { ok: false, reason: 'cannot-remove-root-assembly-space' };
          renderUI(result.reason);
          callbacks.showStatus?.('ROOT SPACE CANNOT BE REMOVED', 1400);
          return result;
        }
        const before = currentBlueprint();
        const result = craft.removeAssemblySpace(id, { policy: 'reassign-to-parent' }, 'author-delete-assembly-space');
        if (result.ok) setActiveAssemblySpace(space.parentAssemblySpaceId);
        return finishMutation(before, result, 'ASSEMBLY SPACE REMOVED');
      }
      function moveBlockToActive(blockId) {
        const before = currentBlueprint();
        return finishMutation(before, craft.reassignBlock(blockId, activeAssemblySpaceId(), {}, 'author-reassign-block-space'), 'BLOCK MOVED TO ACTIVE SPACE');
      }
      function faceForVector(vector) {
        const [x, y, z] = vector.map(value => Math.round(value));
        if (x === 1 && y === 0 && z === 0) return 'PX';
        if (x === -1 && y === 0 && z === 0) return 'NX';
        if (x === 0 && y === 1 && z === 0) return 'PY';
        if (x === 0 && y === -1 && z === 0) return 'NY';
        if (x === 0 && y === 0 && z === 1) return 'PZ';
        if (x === 0 && y === 0 && z === -1) return 'NZ';
        return null;
      }
      function authorHingeEndpoint(blockId, axis = 'PY') {
        const block = craft.getById(blockId);
        if (!block) { callbacks.showStatus?.('HINGE ENDPOINT MUST BE A BLOCK', 1400); return false; }
        const authoring = state.workshop.mechanicalAuthoring;
        if (!authoring.firstBlockId) {
          authoring.firstBlockId = block.blockId;
          const status = document?.getElementById?.('ui-hinge-status');
          if (status) status.textContent = `First endpoint: ${block.blockId}. Click an adjacent second block.`;
          callbacks.showStatus?.('HINGE ENDPOINT A SELECTED', 700);
          return true;
        }
        const first = craft.getById(authoring.firstBlockId);
        authoring.firstBlockId = null;
        if (!first || first.blockId === block.blockId) { callbacks.showStatus?.('SELECT TWO DIFFERENT BLOCKS', 1200); return false; }
        const pointA = blockRootPosition(first);
        const pointB = blockRootPosition(block);
        const rootDelta = pointB.map((value, index) => Math.round(value - pointA[index]));
        if (Math.abs(rootDelta[0]) + Math.abs(rootDelta[1]) + Math.abs(rootDelta[2]) !== 1) {
          callbacks.showStatus?.('HINGE ENDPOINTS MUST SHARE A FACE', 1500);
          return false;
        }
        const faceA = faceForVector(rootVectorToSpace(first.assemblySpaceId, rootDelta));
        const faceB = faceForVector(rootVectorToSpace(block.assemblySpaceId, rootDelta.map(value => -value)));
        const owner = AssemblySpaces.lowestCommonAncestor(first.assemblySpaceId, block.assemblySpaceId, spaceIndex());
        const axisVector = Blueprint.FACE_VECTORS[axis];
        const axisRoot = axisVector && owner ? spaceVectorToRoot(owner, axisVector) : null;
        if (!faceA || !faceB || !axisRoot || Math.abs(rootDelta[0] * axisRoot[0] + rootDelta[1] * axisRoot[1] + rootDelta[2] * axisRoot[2]) > 1e-8) {
          callbacks.showStatus?.('HINGE AXIS MUST LIE IN THE SHARED FACE', 1800);
          return false;
        }
        const before = currentBlueprint();
        const result = craft.addMechanicalLink({
          kind: 'hinge',
          endpointA: { blockId: first.blockId, face: faceA },
          endpointB: { blockId: block.blockId, face: faceB },
          axis,
          collideConnected: false,
          maxForce: 1000000,
          frictionTorque: 0,
          limits: null
        }, 'author-hinge-link');
        if (!result.ok) { callbacks.showStatus?.(`HINGE ERROR: ${String(result.reason).toUpperCase()}`, 1800); return false; }
        callbacks.commitHistory?.(before);
        callbacks.autoSave?.(false);
        callbacks.updateTelemetry?.();
        const diagnostic = callbacks.compileCraft?.()?.diagnostics?.find(item => item.entities?.some(entity => entity.kind === 'mechanical-link' && entity.id === result.link.mechanicalLinkId));
        const status = document?.getElementById?.('ui-hinge-status');
        if (status) status.textContent = diagnostic ? `${result.link.mechanicalLinkId}: ${diagnostic.code}` : `${result.link.mechanicalLinkId} authored successfully.`;
        callbacks.showStatus?.(diagnostic ? diagnostic.code.replaceAll('-', ' ').toUpperCase() : 'HINGE LINK CREATED', 1600);
        return true;
      }
      function diagnosticsText(reason = '') {
        if (reason) return String(reason).replaceAll('-', ' ').toUpperCase();
        const active = craft.getAssemblySpace(activeAssemblySpaceId());
        const count = craft.values().filter(block => block.assemblySpaceId === active?.assemblySpaceId).length;
        return `${active?.name || 'Root'} • ${count} block${count === 1 ? '' : 's'}`;
      }
      function renderUI(reason = '') {
        const select = document?.getElementById?.('assembly-space-list');
        const name = document?.getElementById?.('assembly-space-name');
        const status = document?.getElementById?.('ui-assembly-space-status');
        const activeId = activeAssemblySpaceId();
        if (select) {
          if (typeof select.replaceChildren === 'function') select.replaceChildren();
          else select.innerHTML = '';
          for (const space of spaces()) {
            const option = document.createElement('option');
            option.value = space.assemblySpaceId;
            option.textContent = `${space.parentAssemblySpaceId === null ? 'ROOT' : 'SPACE'} • ${space.name}`;
            select.appendChild(option);
          }
          select.value = activeId;
        }
        if (name) name.value = craft.getAssemblySpace(activeId)?.name || '';
        if (status) status.textContent = diagnosticsText(reason);
        const deleteButton = document?.getElementById?.('btn-delete-assembly-space');
        if (deleteButton) deleteButton.disabled = activeId === AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID;
      }
      function bindUI({ hoveredBlockId = () => null } = {}) {
        document?.getElementById?.('assembly-space-list')?.addEventListener('change', event => setActiveAssemblySpace(event.currentTarget.value));
        document?.getElementById?.('btn-create-assembly-space')?.addEventListener('click', () => createSpace(document.getElementById('assembly-space-name')?.value));
        document?.getElementById?.('btn-rename-assembly-space')?.addEventListener('click', () => renameActiveSpace(document.getElementById('assembly-space-name')?.value));
        document?.getElementById?.('btn-delete-assembly-space')?.addEventListener('click', () => deleteActiveSpace());
        document?.getElementById?.('btn-move-hovered-to-space')?.addEventListener('click', () => {
          const blockId = hoveredBlockId();
          if (!blockId) { callbacks.showStatus?.('HOVER A BLOCK FIRST', 1200); return; }
          moveBlockToActive(blockId);
        });
        renderUI();
      }

      syncRoots();
      return Object.freeze({
        roots,
        syncRoots,
        groupFor,
        attachBlockVisual,
        detachBlockVisual,
        blockRootPosition,
        rootPointToActive,
        spaceVectorToRoot,
        rootVectorToSpace,
        attachAuthoringObject,
        activeAssemblySpaceId,
        setActiveAssemblySpace,
        createSpace,
        renameActiveSpace,
        deleteActiveSpace,
        moveBlockToActive,
        authorHingeEndpoint,
        renderUI,
        bindUI
      });
    }

    return Object.freeze({ create });
  });
})();
