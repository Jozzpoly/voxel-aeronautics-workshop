(() => {
  'use strict';

  window.VAW.define('foundation.runtime-assembly', [
    'foundation.mass-properties', 'foundation.transform-math', 'foundation.assembly-spaces'
  ], (MassProperties, TransformMath, AssemblySpaces) => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      for (const nested of Object.values(value)) deepFreeze(nested, seen);
      return Object.freeze(value);
    }
    function requireNumber(value, label, minimum = -Infinity) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`);
      if (numeric < minimum) throw new RangeError(`${label} must be at least ${minimum}.`);
      return numeric;
    }
    function requireVector(value, label) {
      const result = TransformMath.vec3(value);
      const source = Array.isArray(value) ? value : value && [value.x, value.y, value.z];
      if (!source || source.some(component => !Number.isFinite(Number(component)))) throw new TypeError(`${label} must be a finite 3D vector.`);
      return result;
    }
    function requireId(value, label) {
      if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
      return value;
    }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

    function normalizeLoadout(compiledCraft, raw = {}) {
      const payloadMass = requireNumber(raw.payloadMass ?? raw.payload?.mass ?? 0, 'Launch payload mass', 0);
      if (payloadMass <= 0) return Object.freeze({ payload: null });
      const anchorBlockId = requireId(raw.payloadAnchorBlockId ?? raw.payload?.anchorBlockId ?? compiledCraft.coreBlockId, 'Launch payload anchorBlockId');
      const ownerBodyId = compiledCraft.blockIdToBodyId[anchorBlockId];
      if (!ownerBodyId) throw new Error(`Launch payload anchor block is not part of the compiled craft: ${anchorBlockId}`);
      const ownerAssemblySpaceId = compiledCraft.bodyIdToAssemblySpaceId[ownerBodyId];
      if (!ownerAssemblySpaceId) throw new Error(`Launch payload owner body has no assembly space: ${ownerBodyId}`);
      const anchorPart = compiledCraft.parts.find(part => part.blockId === anchorBlockId);
      const defaultPosition = anchorPart
        ? [anchorPart.assemblyPosition[0], anchorPart.assemblyPosition[1] - 1, anchorPart.assemblyPosition[2]]
        : [0, -1, 0];
      const assemblyPosition = requireVector(raw.payloadAssemblyPosition ?? raw.payload?.assemblyPosition ?? defaultPosition, 'Launch payload assemblyPosition');
      const spaceLocalPosition = TransformMath.inverseTransformPoint(compiledCraft.assemblySpaceRootPoses[ownerAssemblySpaceId], assemblyPosition);
      const halfExtents = requireVector(raw.payloadHalfExtents ?? raw.payload?.halfExtents ?? [0.42, 0.42, 0.42], 'Launch payload halfExtents');
      if (halfExtents.some(value => value <= 0)) throw new RangeError('Launch payload halfExtents must be positive.');
      return Object.freeze({
        payload: Object.freeze({
          payloadId: 'mission-payload',
          mass: payloadMass,
          anchorBlockId,
          ownerBodyId,
          ownerAssemblySpaceId,
          assemblyPosition: Object.freeze(assemblyPosition),
          spaceLocalPosition: Object.freeze(spaceLocalPosition),
          halfExtents: Object.freeze(halfExtents)
        })
      });
    }

    function createPlan(compiledCraft, launchLoadout = {}) {
      if (!compiledCraft || compiledCraft.format !== 'VAW_COMPILED_CRAFT_V5') throw new TypeError('RuntimeAssemblyPlan V3 requires a verified CompiledCraft V5.');
      if (!compiledCraft.ready) throw new Error(`Cannot create runtime plan from an unready craft: ${(compiledCraft.errors || []).join(', ')}`);
      const loadout = normalizeLoadout(compiledCraft, launchLoadout);
      const partsByBodyId = new Map(compiledCraft.rigidIslands.map(island => [island.bodyId, []]));
      for (const part of compiledCraft.parts) partsByBodyId.get(part.bodyId)?.push(part);
      const bodyState = new Map();
      for (const island of compiledCraft.rigidIslands) {
        const sourceParts = partsByBodyId.get(island.bodyId) || [];
        const elements = sourceParts.map(part => ({
          id: part.blockId,
          mass: part.mass,
          center: part.spaceLocalPosition,
          halfExtents: [0.5, 0.5, 0.5]
        }));
        if (loadout.payload?.ownerBodyId === island.bodyId) {
          elements.push({
            id: loadout.payload.payloadId,
            mass: loadout.payload.mass,
            center: loadout.payload.spaceLocalPosition,
            halfExtents: loadout.payload.halfExtents
          });
        }
        const mass = MassProperties.compute(elements);
        const bodyPoseInSpace = { position: [...mass.centerOfMass], quaternion: [0, 0, 0, 1] };
        const assemblyPose = TransformMath.composePose(compiledCraft.assemblySpaceRootPoses[island.assemblySpaceId], bodyPoseInSpace);
        bodyState.set(island.bodyId, {
          island,
          sourceParts,
          spaceLocalCenterOfMass: [...mass.centerOfMass],
          bodyPoseInSpace,
          assemblyPose,
          massProperties: { mass: mass.mass, centerOfMass: [0, 0, 0], inertiaDiagonal: [...mass.inertiaDiagonal] }
        });
      }

      const parts = [];
      const blockIdToBodyId = Object.create(null);
      const blockIdToPartIndex = Object.create(null);
      const blockIdToAssemblySpaceId = Object.create(null);
      const rigidBodies = [];
      for (const island of [...compiledCraft.rigidIslands].sort((a, b) => a.bodyId.localeCompare(b.bodyId))) {
        const state = bodyState.get(island.bodyId);
        const colliders = [];
        for (const sourcePart of state.sourceParts.sort((a, b) => a.blockId.localeCompare(b.blockId))) {
          const bodyLocalPosition = sub(sourcePart.spaceLocalPosition, state.spaceLocalCenterOfMass);
          const constraintIds = compiledCraft.mechanicalGraph.constraintsByEndpointBlockId[sourcePart.blockId] || [];
          const part = {
            partIndex: parts.length,
            blockId: sourcePart.blockId,
            bodyId: island.bodyId,
            assemblySpaceId: island.assemblySpaceId,
            gridKey: sourcePart.gridKey,
            localGridKey: sourcePart.localGridKey,
            type: sourcePart.type,
            assemblyPosition: [...sourcePart.assemblyPosition],
            spaceLocalPosition: [...sourcePart.spaceLocalPosition],
            bodyLocalPosition,
            orientation: sourcePart.orientation,
            controlAxis: sourcePart.controlAxis,
            controlSign: sourcePart.controlSign,
            basis: sourcePart.basis,
            properties: { ...sourcePart.properties },
            mass: sourcePart.mass,
            rigidNeighborBlockIds: [...sourcePart.rigidNeighborBlockIds],
            mechanicalConstraintIds: [...constraintIds]
          };
          blockIdToBodyId[part.blockId] = island.bodyId;
          blockIdToAssemblySpaceId[part.blockId] = island.assemblySpaceId;
          blockIdToPartIndex[part.blockId] = parts.length;
          parts.push(part);
          colliders.push({
            colliderId: `collider:${part.blockId}`,
            blockId: part.blockId,
            bodyId: island.bodyId,
            assemblySpaceId: island.assemblySpaceId,
            kind: 'box',
            center: bodyLocalPosition,
            halfExtents: [0.5, 0.5, 0.5]
          });
        }
        if (loadout.payload?.ownerBodyId === island.bodyId) {
          colliders.push({
            colliderId: 'collider:mission-payload',
            blockId: null,
            bodyId: island.bodyId,
            assemblySpaceId: island.assemblySpaceId,
            kind: 'box',
            payload: true,
            center: sub(loadout.payload.spaceLocalPosition, state.spaceLocalCenterOfMass),
            halfExtents: [...loadout.payload.halfExtents]
          });
        }
        rigidBodies.push({
          bodyId: island.bodyId,
          assemblySpaceId: island.assemblySpaceId,
          role: island.role,
          anchorBlockId: island.anchorBlockId,
          blockIds: state.sourceParts.map(part => part.blockId).sort(),
          sourceSpaceLocalCenterOfMass: [...island.sourceSpaceLocalCenterOfMass],
          sourceAssemblyCenterOfMass: [...island.sourceAssemblyCenterOfMass],
          bodyPoseInSpace: state.bodyPoseInSpace,
          assemblyPose: state.assemblyPose,
          massProperties: state.massProperties,
          colliders
        });
      }

      const constraints = compiledCraft.mechanicalGraph.constraints.map(source => {
        const bodyA = bodyState.get(source.bodyAId);
        const bodyB = bodyState.get(source.bodyBId);
        const inverseA = TransformMath.inversePose(bodyA.assemblyPose);
        const inverseB = TransformMath.inversePose(bodyB.assemblyPose);
        return {
          constraintId: source.constraintId,
          mechanicalLinkId: source.mechanicalLinkId,
          assemblySpaceId: source.assemblySpaceId,
          kind: source.kind,
          bodyAId: source.bodyAId,
          bodyBId: source.bodyBId,
          endpointA: source.endpointA,
          endpointB: source.endpointB,
          assemblyPivotPosition: [...source.assemblyPivotPosition],
          pivotA: TransformMath.transformPoint(inverseA, source.assemblyPivotPosition),
          pivotB: TransformMath.transformPoint(inverseB, source.assemblyPivotPosition),
          axisA: TransformMath.rotateVector(inverseA.quaternion, source.axisAssemblyVector),
          axisB: TransformMath.rotateVector(inverseB.quaternion, source.axisAssemblyVector),
          collideConnected: source.collideConnected,
          maxForce: source.maxForce,
          frictionTorque: source.frictionTorque,
          limits: source.limits ? { ...source.limits } : null,
          control: { mode: 'free', targetSpeed: 0, targetAngle: 0, maxTorque: 30, maxSpeed: 2, positionGain: 4, velocityDamping: 0.5 }
        };
      });
      const bodyById = Object.freeze(Object.fromEntries(rigidBodies.map(body => [body.bodyId, body])));
      const bodyIdToConstraintIds = Object.fromEntries(rigidBodies.map(body => [body.bodyId, []]));
      const bodyIdToPartBlockIds = Object.fromEntries(rigidBodies.map(body => [body.bodyId, [...body.blockIds]]));
      const bodyIdToAssemblySpaceId = Object.fromEntries(rigidBodies.map(body => [body.bodyId, body.assemblySpaceId]));
      for (const constraint of constraints) {
        bodyIdToConstraintIds[constraint.bodyAId].push(constraint.constraintId);
        bodyIdToConstraintIds[constraint.bodyBId].push(constraint.constraintId);
      }
      for (const ids of Object.values(bodyIdToConstraintIds)) ids.sort();

      return deepFreeze({
        format: 'VAW_RUNTIME_ASSEMBLY_PLAN_V3',
        sourceSignature: compiledCraft.signature,
        sourceRevision: compiledCraft.sourceRevision,
        rootAssemblySpaceId: compiledCraft.rootAssemblySpaceId,
        rootBodyId: compiledCraft.rootBodyId,
        assemblySpaces: compiledCraft.assemblySpaces,
        assemblySpaceById: compiledCraft.assemblySpaceById,
        assemblySpaceRootPoses: compiledCraft.assemblySpaceRootPoses,
        rigidBodies,
        bodyById,
        constraints,
        signalLinks: [],
        parts,
        blockIdToBodyId,
        blockIdToAssemblySpaceId,
        blockIdToPartIndex,
        bodyIdToAssemblySpaceId,
        bodyIdToPartBlockIds,
        bodyIdToConstraintIds,
        launchLoadout: loadout
      });
    }

    function rootBody(plan) { return plan?.rigidBodies?.find(body => body.bodyId === plan.rootBodyId) || null; }
    function assemblySpaceRootPose(plan, assemblySpaceId) {
      const pose = plan?.assemblySpaceRootPoses?.[assemblySpaceId];
      if (!pose) throw new Error(`Runtime plan is missing assembly space pose: ${String(assemblySpaceId)}`);
      return pose;
    }
    function worldAssemblySpacePose(plan, spawnTransform, assemblySpaceId) {
      const spawn = TransformMath.requirePose(spawnTransform, 'Spawn transform');
      return TransformMath.composePose(spawn, assemblySpaceRootPose(plan, assemblySpaceId));
    }
    function worldBodyPose(planOrSpawn, spawnOrBody, maybeBodyPlan = null) {
      if (maybeBodyPlan == null) {
        const spawnTransform = TransformMath.requirePose(planOrSpawn, 'Spawn transform');
        const bodyPlan = spawnOrBody;
        if (!bodyPlan?.assemblyPose) throw new TypeError('Body plan requires assemblyPose.');
        return TransformMath.composePose(spawnTransform, bodyPlan.assemblyPose);
      }
      const plan = planOrSpawn;
      const spawnTransform = spawnOrBody;
      const bodyPlan = maybeBodyPlan;
      if (!bodyPlan?.bodyPoseInSpace) throw new TypeError('Body plan requires bodyPoseInSpace.');
      return TransformMath.composePose(
        worldAssemblySpacePose(plan, spawnTransform, bodyPlan.assemblySpaceId),
        bodyPlan.bodyPoseInSpace
      );
    }
    function worldBodyPoses(plan, spawnTransform) {
      return Object.freeze(Object.fromEntries(plan.rigidBodies.map(body => [body.bodyId, worldBodyPose(plan, spawnTransform, body)])));
    }

    return Object.freeze({
      createPlan,
      normalizeLoadout,
      rootBody,
      assemblySpaceRootPose,
      worldAssemblySpacePose,
      worldBodyPose,
      worldBodyPoses
    });
  });
})();
