(() => {
  'use strict';

  window.VAW.define('foundation.assembly-spaces', ['foundation.transform-math'], TransformMath => {
    const ROOT_ASSEMBLY_SPACE_ID = 'space:root';
    const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
    const EPSILON = 1e-12;
    const IDENTITY_POSE = Object.freeze({
      position: Object.freeze([0, 0, 0]),
      quaternion: Object.freeze([0, 0, 0, 1])
    });

    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }

    function cleanNumber(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return Object.is(numeric, -0) || Math.abs(numeric) < EPSILON ? 0 : numeric;
    }

    function normalizeAssemblySpaceId(value) {
      if (typeof value !== 'string') return null;
      const normalized = value.trim();
      return ENTITY_ID_PATTERN.test(normalized) ? normalized : null;
    }

    function normalizeName(value, fallback = 'Assembly Space') {
      const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
      return (normalized || fallback).slice(0, 64);
    }

    function finiteVector(value, length) {
      const source = Array.isArray(value)
        ? value
        : length === 4
          ? [value?.x, value?.y, value?.z, value?.w]
          : [value?.x, value?.y, value?.z];
      if (!source || source.length < length) return null;
      const result = source.slice(0, length).map(cleanNumber);
      return result.every(component => component !== null) ? result : null;
    }

    function canonicalQuaternion(value) {
      const raw = finiteVector(value ?? [0, 0, 0, 1], 4);
      if (!raw) return null;
      const magnitude = Math.hypot(...raw);
      if (!(magnitude > EPSILON)) return null;
      const normalized = raw.map(component => cleanNumber(component / magnitude));
      // q and -q encode the same rotation. Pick one deterministic hemisphere.
      const pivot = [...normalized].reverse().find(component => Math.abs(component) > EPSILON) ?? 1;
      const sign = pivot < 0 ? -1 : 1;
      return normalized.map(component => cleanNumber(component * sign));
    }

    function canonicalPose(value = IDENTITY_POSE) {
      const position = finiteVector(value?.position ?? [0, 0, 0], 3);
      const quaternion = canonicalQuaternion(value?.quaternion ?? [0, 0, 0, 1]);
      if (!position || !quaternion) return null;
      return deepFreeze({ position, quaternion });
    }

    function isIdentityPose(pose) {
      return pose
        && pose.position.every((value, index) => Math.abs(value - IDENTITY_POSE.position[index]) <= EPSILON)
        && pose.quaternion.every((value, index) => Math.abs(value - IDENTITY_POSE.quaternion[index]) <= EPSILON);
    }

    function createRootSpace() {
      return deepFreeze({
        assemblySpaceId: ROOT_ASSEMBLY_SPACE_ID,
        parentAssemblySpaceId: null,
        name: 'Root',
        localPose: IDENTITY_POSE
      });
    }

    function canonicalSpace(raw, { strictId = true } = {}) {
      if (!raw || typeof raw !== 'object') return null;
      const normalizedId = normalizeAssemblySpaceId(raw.assemblySpaceId);
      if (strictId && !normalizedId) return null;
      const assemblySpaceId = normalizedId || ROOT_ASSEMBLY_SPACE_ID;
      const parentAssemblySpaceId = raw.parentAssemblySpaceId == null
        ? null
        : normalizeAssemblySpaceId(raw.parentAssemblySpaceId);
      if (raw.parentAssemblySpaceId != null && !parentAssemblySpaceId) return null;
      const localPose = canonicalPose(raw.localPose);
      if (!localPose) return null;
      if (assemblySpaceId === ROOT_ASSEMBLY_SPACE_ID) {
        if (parentAssemblySpaceId !== null || !isIdentityPose(localPose)) return null;
      } else if (parentAssemblySpaceId === null || parentAssemblySpaceId === assemblySpaceId) {
        return null;
      }
      return deepFreeze({
        assemblySpaceId,
        parentAssemblySpaceId,
        name: normalizeName(raw.name, assemblySpaceId === ROOT_ASSEMBLY_SPACE_ID ? 'Root' : assemblySpaceId),
        localPose
      });
    }

    function diagnostic(code, context = {}) {
      return deepFreeze({ code, ...context });
    }

    function validateAndIndex(rawSpaces, { allowDefaultRoot = true } = {}) {
      const source = Array.isArray(rawSpaces) ? rawSpaces : [];
      const effective = source.length ? source : (allowDefaultRoot ? [createRootSpace()] : []);
      const recordsById = new Map();
      const diagnostics = [];

      for (let sourceIndex = 0; sourceIndex < effective.length; sourceIndex += 1) {
        const raw = effective[sourceIndex];
        const id = normalizeAssemblySpaceId(raw?.assemblySpaceId);
        if (!id) {
          diagnostics.push(diagnostic('assembly-space-invalid-id', { id: null, sourceIndex }));
          continue;
        }
        if (recordsById.has(id)) {
          diagnostics.push(diagnostic('assembly-space-duplicate-id', { id, sourceIndex }));
          continue;
        }
        const space = canonicalSpace(raw);
        if (!space) {
          diagnostics.push(diagnostic('assembly-space-invalid-record', { id, sourceIndex }));
          continue;
        }
        recordsById.set(id, space);
      }

      if (!recordsById.has(ROOT_ASSEMBLY_SPACE_ID)) {
        diagnostics.push(diagnostic('assembly-space-missing-root', { id: ROOT_ASSEMBLY_SPACE_ID }));
      }

      const children = new Map([...recordsById.keys()].map(id => [id, []]));
      for (const space of recordsById.values()) {
        if (space.parentAssemblySpaceId === null) continue;
        if (!recordsById.has(space.parentAssemblySpaceId)) {
          diagnostics.push(diagnostic('assembly-space-missing-parent', {
            id: space.assemblySpaceId,
            parentAssemblySpaceId: space.parentAssemblySpaceId
          }));
          continue;
        }
        children.get(space.parentAssemblySpaceId).push(space.assemblySpaceId);
      }
      for (const ids of children.values()) ids.sort();

      // Iterative color walk avoids stack overflow on hostile/deep imports.
      const color = new Map([...recordsById.keys()].map(id => [id, 0]));
      for (const startId of [...recordsById.keys()].sort()) {
        if (color.get(startId) !== 0) continue;
        const stack = [{ id: startId, entered: false }];
        const path = [];
        const pathIndex = new Map();
        while (stack.length) {
          const frame = stack.pop();
          const id = frame.id;
          if (frame.entered) {
            color.set(id, 2);
            pathIndex.delete(id);
            if (path[path.length - 1] === id) path.pop();
            continue;
          }
          if (color.get(id) === 2) continue;
          if (color.get(id) === 1) {
            const cycleStart = pathIndex.get(id) ?? 0;
            diagnostics.push(diagnostic('assembly-space-parent-cycle', {
              id,
              cycle: path.slice(cycleStart).concat(id)
            }));
            continue;
          }
          color.set(id, 1);
          pathIndex.set(id, path.length);
          path.push(id);
          stack.push({ id, entered: true });
          const parent = recordsById.get(id)?.parentAssemblySpaceId;
          if (parent && recordsById.has(parent)) stack.push({ id: parent, entered: false });
        }
      }

      const canonicalDiagnostics = diagnostics.sort((a, b) =>
        a.code.localeCompare(b.code)
        || String(a.id ?? '').localeCompare(String(b.id ?? ''))
        || JSON.stringify(a).localeCompare(JSON.stringify(b))
      );
      if (canonicalDiagnostics.length) {
        return deepFreeze({
          ok: false,
          spaces: [],
          byId: Object.freeze(Object.create(null)),
          parentById: Object.freeze(Object.create(null)),
          childrenById: Object.freeze(Object.create(null)),
          depthById: Object.freeze(Object.create(null)),
          rootPoses: Object.freeze(Object.create(null)),
          diagnostics: canonicalDiagnostics
        });
      }

      const depthById = Object.create(null);
      const rootPoses = Object.create(null);
      const ordered = [];
      const queue = [ROOT_ASSEMBLY_SPACE_ID];
      depthById[ROOT_ASSEMBLY_SPACE_ID] = 0;
      rootPoses[ROOT_ASSEMBLY_SPACE_ID] = IDENTITY_POSE;
      let cursor = 0;
      let maxDepth = 0;
      while (cursor < queue.length) {
        const id = queue[cursor++];
        ordered.push(recordsById.get(id));
        for (const childId of children.get(id) || []) {
          depthById[childId] = depthById[id] + 1;
          maxDepth = Math.max(maxDepth, depthById[childId]);
          rootPoses[childId] = canonicalPose(TransformMath.composePose(rootPoses[id], recordsById.get(childId).localPose));
          queue.push(childId);
        }
      }

      const byId = Object.freeze(Object.fromEntries(ordered.map(space => [space.assemblySpaceId, space])));
      const parentById = Object.freeze(Object.fromEntries(ordered.map(space => [space.assemblySpaceId, space.parentAssemblySpaceId])));
      const childrenById = Object.freeze(Object.fromEntries(ordered.map(space => [space.assemblySpaceId, Object.freeze([...(children.get(space.assemblySpaceId) || [])])])));
      return deepFreeze({
        ok: true,
        spaces: ordered,
        byId,
        parentById,
        childrenById,
        depthById: Object.freeze({ ...depthById }),
        rootPoses: Object.freeze({ ...rootPoses }),
        metrics: Object.freeze({ count: ordered.length, maxDepth }),
        diagnostics: []
      });
    }

    function requireIndex(rawSpaces) {
      const indexed = validateAndIndex(rawSpaces);
      if (!indexed.ok) throw new Error(`Invalid assembly spaces: ${indexed.diagnostics.map(item => item.code).join(', ')}`);
      return indexed;
    }

    function rootPoseMap(rawSpaces) {
      return requireIndex(rawSpaces).rootPoses;
    }

    function lowestCommonAncestor(aId, bId, rawSpacesOrIndex) {
      const indexed = rawSpacesOrIndex?.ok === true ? rawSpacesOrIndex : validateAndIndex(rawSpacesOrIndex);
      if (!indexed.ok || !indexed.byId[aId] || !indexed.byId[bId]) return null;
      let a = aId;
      let b = bId;
      let aDepth = indexed.depthById[a];
      let bDepth = indexed.depthById[b];
      while (aDepth > bDepth) { a = indexed.parentById[a]; aDepth -= 1; }
      while (bDepth > aDepth) { b = indexed.parentById[b]; bDepth -= 1; }
      while (a !== b) {
        a = indexed.parentById[a];
        b = indexed.parentById[b];
      }
      return a || null;
    }

    function spaceLocalToRoot(assemblySpaceId, point, rawSpacesOrIndex) {
      const indexed = rawSpacesOrIndex?.ok === true ? rawSpacesOrIndex : requireIndex(rawSpacesOrIndex);
      const pose = indexed.rootPoses[assemblySpaceId];
      if (!pose) throw new Error(`Unknown assembly space: ${String(assemblySpaceId)}`);
      return Object.freeze(TransformMath.transformPoint(pose, point).map(cleanNumber));
    }

    function rootToSpaceLocal(assemblySpaceId, point, rawSpacesOrIndex) {
      const indexed = rawSpacesOrIndex?.ok === true ? rawSpacesOrIndex : requireIndex(rawSpacesOrIndex);
      const pose = indexed.rootPoses[assemblySpaceId];
      if (!pose) throw new Error(`Unknown assembly space: ${String(assemblySpaceId)}`);
      return Object.freeze(TransformMath.inverseTransformPoint(pose, point).map(cleanNumber));
    }

    function ownedGridKey(assemblySpaceId, x, y, z) {
      const coordinates = `${cleanNumber(x)},${cleanNumber(y)},${cleanNumber(z)}`;
      return assemblySpaceId === ROOT_ASSEMBLY_SPACE_ID ? coordinates : `${assemblySpaceId}@${coordinates}`;
    }

    return Object.freeze({
      ROOT_ASSEMBLY_SPACE_ID,
      IDENTITY_POSE,
      normalizeAssemblySpaceId,
      normalizeName,
      canonicalQuaternion,
      canonicalPose,
      canonicalSpace,
      createRootSpace,
      validateAndIndex,
      rootPoseMap,
      lowestCommonAncestor,
      spaceLocalToRoot,
      rootToSpaceLocal,
      ownedGridKey
    });
  });
})();
